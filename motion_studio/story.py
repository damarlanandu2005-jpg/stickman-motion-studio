"""Story -> assets -> per-shot scene files.

A story file lists what the video needs (assets with a type and a real size) and the shots (scene fragments: who is
where, what they do, where the camera looks). This module does the repeatable work around it:

  plan    which assets are in the library, which are missing (and the picture prompt for each missing one)
  ingest  take the generated 3D files, measure them, write each one's behavior file from its TYPE template
          (library/types/<type>.json), add them to library/catalog.json
  build   write one scene JSON per shot: environment preset, assets with behavior files, solid footprints from the
          type rules, characters from the species table, auto camera. Nothing is hand-fixed per video.

The story itself (the script) is written by a person or, later, by the script writer. This module never invents
story content.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "library" / "catalog.json"
TYPES = ROOT / "library" / "types"

# ---------------------------------------------------------------- environments (one per shot; the same list serves every topic)
ENVS: dict[str, dict[str, Any]] = {
    "launch_pad": {"light": "day", "sky_top": "#3f86d8", "sky_horizon": "#d4e8ff", "ground": "#b9b4a8", "fog_near": 40, "fog_far": 220},
    "suit_room": {"light": "day", "sky_top": "#20242e", "sky_horizon": "#20242e", "ground": None, "fog_near": 60, "fog_far": 400, "room": {"size": [7, 3, 6], "floor": "#58606e", "wall": "#dfe3ec", "trim": "#2f6fd6"}},
    "cockpit": {"light": "day", "sky_top": "#10131c", "sky_horizon": "#10131c", "ground": None, "fog_near": 60, "fog_far": 400, "room": {"size": [7, 3, 6], "floor": "#4a5160", "wall": "#c9cfdb", "ceiling": "#9aa1b0", "trim": "#e0692a"}},
    "sky": {"light": "day", "sky_top": "#2f74d0", "sky_horizon": "#cfe6ff", "ground": None, "fog_near": 80, "fog_far": 500},
    "high_sky": {"light": "day", "sky_top": "#050b2e", "sky_horizon": "#2c63b8", "ground": None, "fog_near": 120, "fog_far": 600, "stars": 500},
    "space": {"light": "day", "sky_top": "#04050d", "sky_horizon": "#0a0c1c", "ground": None, "fog_near": 200, "fog_far": 800, "stars": 900},
    "alien_world": {"light": "day", "sky_top": "#5a3fa0", "sky_horizon": "#f0b0cf", "ground": "#9a5f98", "fog_near": 25, "fog_far": 150,
                    "scatter": [{"type": "rocks", "count": 40, "radius": 24, "min_size": 0.15, "max_size": 0.6, "color": "#8a5f8f", "seed": 11, "keep_clear": [[0, -3, 3], [1.5, -2, 1.5]]}]},
}


# ---------------------------------------------------------------- helpers
def read_json(p: Path) -> Any:
    return json.loads(p.read_text(encoding="utf-8"))


def type_rules(t: str) -> dict[str, Any]:
    p = TYPES / f"{t}.json"
    if not p.is_file():
        raise SystemExit(f"no rules template for type {t!r}: write library/types/{t}.json first")
    return read_json(p)


def glb_extent(path: Path) -> tuple[float, float, float]:
    """(width x, height y, depth z) of a GLB from its position accessors (no 3D library needed)."""
    data = path.read_bytes()
    if data[:4] != b"glTF":
        raise ValueError(f"{path.name}: not a GLB")
    n = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + n])
    lo, hi = [1e9] * 3, [-1e9] * 3
    # a model may be a tree of nodes with transforms; scenes from the image-to-3D pipeline have one mesh, so the plain accessor box is exact
    for mesh in gltf.get("meshes", []):
        for prim in mesh["primitives"]:
            acc = gltf["accessors"][prim["attributes"]["POSITION"]]
            for i in range(3):
                lo[i] = min(lo[i], acc["min"][i]); hi[i] = max(hi[i], acc["max"][i])
    return hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]


def footprint_radius_m(glb: Path, height_m: float) -> float:
    w, h, d = glb_extent(glb)
    return max(w, d) / 2 * (height_m / h) if h > 0 else 0.5


def sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


# ---------------------------------------------------------------- plan
def plan(story: dict[str, Any], cat: dict[str, Any]) -> dict[str, Any]:
    items = {i["id"]: i for i in cat["items"]}
    have, missing = [], []
    for name, a in story["assets"].items():
        lib = a.get("library", name)
        it = items.get(lib)
        if it and (ROOT / it["local"]).is_file():
            have.append({"asset": name, "library_id": lib, "type": a["type"], "height_m": a["height_m"]})
        else:
            missing.append({"asset": name, "type": a["type"], "height_m": a["height_m"], "tags": a.get("tags", []), "prompt_file": a.get("prompt_file", name)})
    return {"story": story["id"], "in_library": have, "missing": missing}


# ---------------------------------------------------------------- ingest (generated model -> library item with rules)
def make_behavior(name: str, typ: str, glb: Path, height_m: float) -> dict[str, Any]:
    rules = type_rules(typ)["automatic"]
    r = min(rules["max_collide_m"], max(0.2, footprint_radius_m(glb, height_m) * rules["collide_from_footprint"]))
    return {"id": name, "type": typ, "solid": bool(rules["solid"]), "collide_radius_m": round(r, 2), "source": f"generated from library/types/{typ}.json and the model's measured footprint"}


def ingest(story: dict[str, Any], models: Path, provenance: dict[str, Any], dry: bool = False) -> list[str]:
    cat = read_json(CATALOG)
    ids = {i["id"] for i in cat["items"]}
    done = []
    for name, a in story["assets"].items():
        if name in ids:
            continue
        stem = a.get("prompt_file", name)
        src = next((c for c in (models / f"hunyuan_{stem}_textured.glb", models / f"{stem}.glb") if c.is_file()), None)
        if src is None:
            continue
        dst = ROOT / "animation/assets/models" / f"{name}.glb"
        beh = make_behavior(name, a["type"], src, a["height_m"])
        bpath_a, bpath_l = ROOT / "animation/assets/behaviors" / f"{name}.json", ROOT / "library/behaviors" / f"{name}.json"
        if dry:
            done.append(f"{name}: would add model + behavior {beh['collide_radius_m']} m"); continue
        shutil.copyfile(src, dst)
        for b in (bpath_a, bpath_l):
            b.parent.mkdir(parents=True, exist_ok=True); b.write_text(json.dumps(beh, indent=2) + "\n", encoding="utf-8")
        prov = provenance.get(a.get("prompt_file", name), {})
        cat["items"].append({"id": name, "kind": "model", "file": f"model__{name}.glb", "local": f"animation/assets/models/{name}.glb", "height_m": a["height_m"], "tags": a.get("tags", []) + [a["type"]],
                             "behavior": f"library/behaviors/{name}.json", "sha256": sha256(dst), "bytes": dst.stat().st_size,
                             "licence": prov.get("licence", "Generated by Hunyuan3D-2mini turbo + Hunyuan3D-Paint turbo (Tencent Hunyuan 3D 2.0 Community License; owner accepted the licence on 2026-11-03) from a FLUX.2 klein 4B picture (Apache-2.0)"),
                             "source": prov.get("source", {"pipeline": "story asset creation", "made": "2026-11-03"})})
        cat["items"].append({"id": f"behavior_{name}", "kind": "behavior", "file": f"behavior__{name}.json", "local": f"library/behaviors/{name}.json", "tags": ["behavior", a["type"]],
                             "sha256": sha256(bpath_l), "bytes": bpath_l.stat().st_size, "licence": "Written for this project (owner's repository)",
                             "source": {"method": f"generated from library/types/{a['type']}.json by motion_studio.story", "made": "2026-11-03"}})
        done.append(f"{name}: added (type {a['type']}, collide {beh['collide_radius_m']} m)")
    if not dry and done:
        CATALOG.write_text(json.dumps(cat, indent=2) + "\n", encoding="utf-8")
    return done


# ---------------------------------------------------------------- build (story -> one scene per shot)
def asset_entry(name: str, a: dict[str, Any], cat: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    lib = a.get("library", name)
    it = next((i for i in cat["items"] if i["id"] == lib), None)
    if not it:
        raise SystemExit(f"asset {name}: not in the library yet (run plan, create it, then ingest)")
    ent: dict[str, Any] = {"file": it["local"].replace("animation/", ""), "height_m": a["height_m"]}
    if a.get("forward_deg") is not None:
        ent["forward_deg"] = a["forward_deg"]
    beh = ROOT / "animation/assets/behaviors" / f"{lib}.json"
    if beh.is_file():
        ent["behavior"] = f"assets/behaviors/{lib}.json"
    return ent, (read_json(beh) if beh.is_file() else {})


def build_shot(story: dict[str, Any], shot: dict[str, Any], cat: dict[str, Any]) -> dict[str, Any]:
    env = json.loads(json.dumps(ENVS[shot["env"]]))
    assets: dict[str, Any] = {}
    objects = []
    for o in shot.get("objects", []):
        name = o["asset"]
        if name not in assets:
            ent, beh = asset_entry(name, story["assets"][name], cat)
            assets[name] = ent
            assets[name]["_beh"] = beh
        beh = assets[name]["_beh"]
        o = dict(o)
        # the type rules decide solidity; a shot can still override
        if "solid_radius_m" not in o and beh.get("solid"):
            o["solid_radius_m"] = beh["collide_radius_m"]
        if o.get("thrust") and "flame_m" not in o["thrust"]:
            o["thrust"] = {**o["thrust"], "flame_m": round(story["assets"][name]["height_m"] * type_rules("rocket")["automatic"]["flame_m_ratio"], 2)}
        objects.append(o)
    for a in assets.values():
        a.pop("_beh", None)
    chars = []
    for c in shot.get("cast", []):
        base = story["characters"][c["who"]]
        ch = {"id": c.get("id", c["who"]), "rig": {**base["rig"]}, "height_m": c.get("height_m", base["height_m"]), "at": c["at"], "actions": c["actions"]}
        for k in ("moves", "expressions", "until_s", "appear_s"):
            if k in c:
                ch[k] = c[k]
        chars.append(ch)
    scene: dict[str, Any] = {"id": f"{story['id']}_{shot['id']}", "description": shot["id"], "fps": story["fps"], "duration_s": shot["duration_s"], "environment": env,
                             "assets": assets, "objects": objects, "characters": chars, "camera": shot["camera"]}
    if shot.get("bodies"):
        env["bodies"] = shot["bodies"]
    if shot.get("props"):
        scene["props"] = shot["props"]
    if shot.get("kicks"):
        scene["kicks"] = shot["kicks"]
    return scene


def build(story: dict[str, Any], out: Path) -> list[Path]:
    cat = read_json(CATALOG)
    out.mkdir(parents=True, exist_ok=True)
    paths = []
    for shot in story["shots"]:
        sc = build_shot(story, shot, cat)
        p = out / f"{shot['id']}.json"
        p.write_text(json.dumps(sc, indent=1) + "\n", encoding="utf-8")
        paths.append(p)
    (out / "shots.json").write_text(json.dumps([{"id": s["id"], "scene": f"{s['id']}.json", "duration_s": s["duration_s"]} for s in story["shots"]], indent=1) + "\n")
    return paths


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="motion_studio.story")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for n in ("plan", "build", "ingest"):
        p = sub.add_parser(n); p.add_argument("story", type=Path)
    sub.choices["build"].add_argument("--out", type=Path, required=True)
    sub.choices["ingest"].add_argument("--models", type=Path, required=True)
    sub.choices["ingest"].add_argument("--provenance", type=Path)
    a = ap.parse_args(argv)
    story = read_json(a.story)
    if a.cmd == "plan":
        print(json.dumps(plan(story, read_json(CATALOG)), indent=1))
    elif a.cmd == "build":
        for p in build(story, a.out):
            print(p)
    else:
        prov = read_json(a.provenance) if a.provenance else {}
        for line in ingest(story, a.models, prov):
            print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
