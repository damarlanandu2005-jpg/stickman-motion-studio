"""Automatic assets: the script's missing list -> Kaggle draws -> code checks every picture -> failed ones are redrawn -> accepted ones are saved.

    plan   --request R --round N --state DIR    jobs.json for round N (new seeds each round; only the items not accepted yet)
    judge  --request R --round N --state DIR --outputs DIR [--lib animation/asset_library]
                                                 gate every drawn picture, keep the best passing one per item, save it into the library + index

A request file (animation/asset_requests/<name>.json) is {"name": ..., "needs": [{"id","type","tags","desc"}]}: exactly what `script_reader` lists as missing.
Backgrounds are drawn WITH style references (the closest existing backgrounds, mounted from the asset dataset as ds: refs).
Objects are drawn text-only (a reference makes the model copy that object's shape or put a face on it).

The checks measure: size, blank picture, text in the picture (tesseract), style statistics against the library, empty floor in the lower part,
copy of a reference, and for objects one complete object on plain white. They cannot judge taste or whether the picture shows what the words say.
"""
from __future__ import annotations

import argparse
import colorsys
import os
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

from . import asset_library as lib_mod
from . import asset_store as store

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "animation" / "asset_library"
W, H = 576, 1024
MAX_ROUNDS_DEFAULT = 3
CANDIDATES = 2


# ---------------------------------------------------------------- planning
def words(s: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", s.lower()))


def style_refs(db: dict, need: dict, k: int = 2) -> list[str]:
    """Closest existing plain backgrounds (bg_*) by shared words, as ds: references. Same art style in, a different place out."""
    want = words(need["desc"]) | {t.lower() for t in need["tags"]}
    cands = []
    for i, v in db["items"].items():
        if v["type"] == "background" and i.startswith("bg_") and v.get("source") != "auto":     # never copy the style of a picture the loop drew itself
            cands.append((-len(want & (set(v["tags"]) | words(v.get("desc", "")))), i))
    return ["ds:" + store.flat_name(db["items"][i]["file"]) for _, i in sorted(cands)[:k]]


def prompt_for(need: dict, refs: list[str]) -> str:
    base = lib_mod.PROMPTS[need["type"]].format(desc=need["desc"])
    if refs and need["type"] == "background":
        return ("Use exactly the same art style, line weight and colour feeling as the reference pictures, but draw a completely different place. " + base)
    return base


def pending(request: dict, state: Path) -> list[dict]:
    done = json.loads((state / "accepted.json").read_text()) if (state / "accepted.json").exists() else {}
    return [n for n in request["needs"] if n["id"] not in done]


def plan(request: dict, round_no: int, state: Path, lib: Path = LIB, jobs_file: Path | None = None) -> dict:
    db = json.loads((lib / "index.json").read_text())
    jobs, needs = [], pending(request, Path(state))
    for ni, n in enumerate(needs):
        refs = style_refs(db, n) if n["type"] == "background" and os.environ.get("ASSET_REFS", "1") != "0" else []
        for c in range(CANDIDATES):
            jobs.append({"id": f"{n['id']}_r{round_no}_c{c}", "prompt": prompt_for(n, refs), "refs": refs,
                         "seed": 8100 + 1000 * round_no + 10 * ni + c, "width": W, "height": H})
    jf = jobs_file or ROOT / "kaggle" / "scene-batch" / "jobs.json"
    jf.write_text(json.dumps({"jobs": jobs}, indent=1), encoding="utf-8")
    return {"round": round_no, "pending": [n["id"] for n in needs], "jobs": len(jobs), "uses_dataset": any(j["refs"] for j in jobs)}


# ---------------------------------------------------------------- checks
def stats(img: Image.Image) -> dict:
    a = np.asarray(img.convert("RGB").resize((W // 2, H // 2))).astype(np.float32) / 255.0
    mx, mn = a.max(2), a.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    dark = mx < 0.24
    low = dark[int(dark.shape[0] * 0.7):]
    g = a.mean(2) * 255
    grad = float((np.abs(np.diff(g, axis=0)).mean() + np.abs(np.diff(g, axis=1)).mean()) / 2)   # flat cartoon pictures are low, noise is high
    return {"sat": float(sat.mean()), "dark": float(dark.mean()), "bright": float(mx.mean()), "low_dark": float(low.mean()), "grad": grad}


def bottom_hsv(img: Image.Image) -> tuple[float, float, float]:
    a = np.asarray(img.convert("RGB").resize((W // 2, H // 2))).astype(np.float32)
    r, g, b = np.median(a[int(a.shape[0] * 0.85):].reshape(-1, 3), 0) / 255
    return colorsys.rgb_to_hsv(float(r), float(g), float(b))


def pale_blue_bottom(img: Image.Image) -> bool:
    """The failure seen on drawn rooms: the bottom of the picture is a bright pale sky-blue block that does not belong to the room.
    Library backgrounds never have a bottom like that (checked on all 17). It is a NARROW check, not a general floor judge."""
    h, s, v = bottom_hsv(img)
    return 0.45 <= h <= 0.60 and 0.08 <= s <= 0.50 and v >= 0.95


def _pale(r: tuple[float, float, float]) -> bool:
    h, sat, v = colorsys.rgb_to_hsv(*r)
    return 0.45 <= h <= 0.60 and 0.08 <= sat <= 0.50 and v >= 0.95


def band_start(img: Image.Image) -> int | None:
    """Row (in a 1024-high picture) where the pale sky-blue band at the bottom begins; None when the bottom is not such a band."""
    a = np.asarray(img.convert("RGB").resize((W, H))).astype(np.float32)
    med = np.median(a, axis=1) / 255
    y = H - 1
    while y > 0 and _pale(tuple(float(x) for x in med[y])):
        y -= 1
    return y + 1 if y < H - 1 else None


MIN_KEEP = 0.70      # the part above the band must be at least this share of the picture, else stretching it back would distort too much


def repair_bottom(img: Image.Image) -> Image.Image | None:
    """Every drawn background came with a pale sky-blue band at the bottom (model habit). Cut the band off and stretch the rest back to the full
    picture. Returns None when the band is too tall to repair this way (then the picture is redrawn instead)."""
    y = band_start(img)
    if y is None:
        return img.convert("RGB")
    if y < MIN_KEEP * H or H - y < 0.03 * H:
        return None
    return img.convert("RGB").resize((W, H)).crop((0, 0, W, y)).resize((W, H), Image.LANCZOS)


def library_style(db: dict, lib: Path = LIB) -> dict:
    """Median style numbers of the plain library backgrounds (the pictures already accepted as the channel's look)."""
    rows = [stats(Image.open(lib / v["file"])) for i, v in db["items"].items() if v["type"] == "background" and i.startswith("bg_") and (lib / v["file"]).exists()]
    out = {"n": len(rows)}
    for k in ("sat", "dark", "bright", "low_dark", "grad"):
        v = [r[k] for r in rows]; span = max(max(v) - min(v), 0.02)
        out[k] = float(np.median(v)); out[k + "_lo"] = float(min(v) - 0.12 * span); out[k + "_hi"] = float(max(v) + 0.12 * span)   # the library's own range + a small margin
    return out


def text_words(path: Path) -> list[str] | None:
    """Clear words tesseract reads in the picture (None when tesseract is not installed).

    WEAK CHECK: strict on purpose (0 false hits on the 40 library backgrounds).
    It only catches clear text; small or busy-background text can slip through.
    """
    if not shutil.which("tesseract"):
        return None
    import tempfile
    im = Image.open(path).convert("RGB")
    w, h = im.size
    band = max(60, h // 7); found = []
    with tempfile.TemporaryDirectory() as td:
        for y in range(0, max(1, h - band + 1), max(1, band // 2)):
            f = Path(td) / "b.png"
            im.crop((0, y, w, min(h, y + band))).resize((w * 2, (min(h, y + band) - y) * 2)).save(f)
            out = subprocess.run(["tesseract", str(f), "stdout", "--psm", "7", "tsv"], capture_output=True, text=True).stdout.splitlines()[1:]
            for line in out:
                c = line.split("\t")
                if len(c) >= 12 and c[11].strip():
                    try:
                        conf = float(c[10])
                    except ValueError:
                        continue
                    t = c[11].strip()
                    if conf >= 50 and len(t) >= 5 and t.isalpha() and t not in found:
                        found.append(t)
    return found


def gate_background(path: Path, ref_style: dict, ref_paths: list[Path] | None = None) -> dict:
    im = Image.open(path).convert("RGB"); why = []
    if im.size != (W, H):
        why.append(f"size {im.size}")
    s = stats(im)
    if np.asarray(im).std() < 12:
        why.append("blank picture")
    for key, label in (("sat", "colour style"), ("dark", "outline weight"), ("bright", "brightness"), ("low_dark", "lower part is busy (floor not clear)"), ("grad", "picture is noisy")):
        if not ref_style[key + "_lo"] <= s[key] <= ref_style[key + "_hi"]:
            why.append(f"{label} is outside the library's range" if key != "low_dark" else label)
    if pale_blue_bottom(im):
        why.append("the bottom of the picture is a pale sky-blue block, not a floor")
    for rp in ref_paths or []:
        r = Image.open(rp).convert("RGB").resize(im.size)
        if float(np.abs(np.asarray(im).astype(int) - np.asarray(r).astype(int)).mean()) < 8:
            why.append("copy of a reference picture"); break
    tw = text_words(path)
    if tw:
        why.append("text in the picture: " + " ".join(tw[:4]))
    score = round(-abs(s["sat"] - ref_style["sat"]) - abs(np.log((s["dark"] + 1e-3) / (ref_style["dark"] + 1e-3))) * 0.1 - abs(s["bright"] - ref_style["bright"]), 3)
    return {"pass": not why, "why": why, "score": score, "text_check": tw is not None, **{k: round(v, 3) for k, v in s.items()}}


def gate_object(path: Path) -> dict:
    from scipy import ndimage as ndi
    im = Image.open(path).convert("RGB"); a = np.asarray(im).astype(int); why = []
    if im.size != (W, H):
        why.append(f"size {im.size}")
    lab, _ = ndi.label(a.min(2) > 235)
    edge = (set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])) - {0}
    fg = ndi.binary_opening(~np.isin(lab, list(edge)), iterations=1)
    l2, n = ndi.label(fg)
    if n == 0:
        return {"pass": False, "why": ["no object found (blank or all white)"], "score": -9}
    sizes = sorted((float(x) for x in ndi.sum(fg, l2, range(1, n + 1))), reverse=True)
    share = sizes[0] / fg.size
    ys, xs = np.nonzero(l2 == (1 + int(np.argmax(ndi.sum(fg, l2, range(1, n + 1))))))
    m = 0.02
    if not 0.04 <= share <= 0.75:
        why.append(f"object fills {share:.0%} of the picture (want 4-75%)")
    if xs.min() < W * m or ys.min() < H * m or xs.max() > W * (1 - m) or ys.max() > H * (1 - m):
        why.append("object touches the picture edge (cut off)")
    if len(sizes) > 1 and sizes[1] > 0.12 * sizes[0]:
        why.append("more than one object")
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    if border.min(1).mean() < 225:
        why.append("background is not plain white")
    tw = text_words(path)
    if tw:
        why.append("text in the picture: " + " ".join(tw[:4]))
    return {"pass": not why, "why": why, "score": round(share if not why else -1, 3), "text_check": tw is not None}


# ---------------------------------------------------------------- judging and saving
def candidates_for(outputs: Path, item_id: str) -> list[Path]:
    return sorted(Path(outputs).rglob(f"pose_{item_id}_r*_c*.png"))


def judge(request: dict, round_no: int, state: Path, outputs: Path, lib: Path = LIB, run: str = "") -> dict:
    state = Path(state); state.mkdir(parents=True, exist_ok=True)
    cand_dir = state / "candidates"; cand_dir.mkdir(exist_ok=True)
    for f in Path(outputs).rglob("pose_*.png"):
        shutil.copy(f, cand_dir / f.name)
    db = json.loads((lib / "index.json").read_text()); style = library_style(db, lib)
    acc_file = state / "accepted.json"; accepted = json.loads(acc_file.read_text()) if acc_file.exists() else {}
    log, new_items = {}, {}
    for n in request["needs"]:
        if n["id"] in accepted:
            continue
        scored = []
        for c in sorted(cand_dir.glob(f"pose_{n['id']}_r*_c*.png")):
            note = None
            if n["type"] == "background" and pale_blue_bottom(Image.open(c)):
                fixed = repair_bottom(Image.open(c))
                if fixed is not None:
                    fixed.save(c); note = "pale bottom band cut off and picture stretched back (code repair)"
            g = gate_background(c, style) if n["type"] == "background" else gate_object(c)
            if note:
                g["repair"] = note
            scored.append((c, g))
        log[n["id"]] = [{"file": c.name, **g} for c, g in scored]
        ok = [(c, g) for c, g in scored if g["pass"]]
        if not ok:
            continue
        c, g = max(ok, key=lambda t: t[1]["score"])
        sub = "backgrounds" if n["type"] == "background" else "objects"; dst = lib / sub / f"{n['id']}.png"
        if n["type"] == "object":
            lib_mod.cutout(c, dst)
        else:
            dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy(c, dst)
        new_items[n["id"]] = {"type": n["type"], "tags": sorted({t.lower() for t in n["tags"]}), "file": f"{sub}/{n['id']}.png", "desc": n["desc"],
                              "run": run, "source": "auto", "gate_score": g["score"], "from_picture": c.name}
        accepted[n["id"]] = c.name
    if new_items:
        store.merge_index(lib, new_items); store.stamp_hashes(lib)
    acc_file.write_text(json.dumps(accepted, indent=1))
    missing = [n["id"] for n in request["needs"] if n["id"] not in accepted]
    report = {"request": request.get("name"), "round": round_no, "accepted": sorted(accepted), "still_missing": missing, "complete": not missing,
              "gate_log": log, "human_reviewed": False, "style_reference": style}
    (state / "report.json").write_text(json.dumps(report, indent=1))
    return report


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(); p.add_argument("cmd", choices=["plan", "judge"]); p.add_argument("--request", required=True)
    p.add_argument("--round", type=int, required=True); p.add_argument("--state", required=True); p.add_argument("--outputs"); p.add_argument("--lib", default=str(LIB))
    a = p.parse_args(argv); req = json.loads(Path(a.request).read_text(encoding="utf-8"))
    if a.cmd == "plan":
        r = plan(req, a.round, Path(a.state), Path(a.lib)); print(json.dumps(r))
        print(f"NOTHING_PENDING={'true' if not r['pending'] else 'false'}"); print(f"USES_DATASET={'true' if r['uses_dataset'] else 'false'}")
    else:
        r = judge(req, a.round, Path(a.state), Path(a.outputs), Path(a.lib), run=__import__("os").environ.get("GITHUB_RUN_ID", ""))
        print(json.dumps({k: r[k] for k in ("round", "accepted", "still_missing", "complete")})); print(f"DONE={'true' if r['complete'] else 'false'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
