"""Script reader: your hand-written script (plain text) + a cast file  ->  checked scene list, and a list of what is missing.

Script file (see docs/script_format.md):
    TITLE: He Defused 41 Bombs
    VOICE: am_fenrir
    CAST: animation/cast/bomb_story.json

    SCENE
    bg: bomb squad office, inside
    who: arthur@normal, chief
    pose: stand
    props: bomb, clock
    say: Arthur was a *normal* man.
    text: 41 BOMBS
    sound: tick
    camera: push

    CHANGE: arthur -> squad        (from the next scene on, Arthur wears his squad costume)

What the reader does by code: parse, check names and costume stages, find backgrounds and props in the asset library by words,
list every missing costume / background / prop so the pipeline can make them. It does NOT plan shots, timing or camera: that is the next step.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

from . import asset_library as lib

ROOT = Path(__file__).resolve().parents[1]
KEYS = {"bg", "who", "pose", "props", "say", "text", "sound", "camera", "from", "next"}
CAMERAS = {"push", "pull", "pan", "still"}
STOP = {"a", "an", "the", "of", "at", "on", "with", "and", "in", "to"}
HUES = {"green": (0.17, 0.45), "olive green": (0.17, 0.45), "yellow": (0.10, 0.20), "blue": (0.50, 0.70), "light blue": (0.50, 0.62),
        "navy": (0.55, 0.72), "purple": (0.72, 0.85), "red": (0.0, 0.05)}


class ScriptError(Exception):
    pass


def words(s: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in STOP]


def parse_script(text: str) -> dict:
    """Plain text -> {'title','voice','cast','scenes':[...], 'problems':[...]}. Never raises on a bad line: it is reported."""
    out = {"title": "", "voice": "am_fenrir", "cast": "", "scenes": [], "changes": [], "problems": []}
    cur: dict | None = None
    stage_changes: list[tuple[int, str, str]] = []                 # (before scene index, character, stage)
    for n, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.upper() == "SCENE":
            cur = {"line": n}; out["scenes"].append(cur); continue
        m = re.match(r"^CHANGE\s*:\s*(\w+)\s*->\s*(\w+)\s*$", line, re.I)
        if m:
            stage_changes.append((len(out["scenes"]), m.group(1).lower(), m.group(2).lower())); cur = None; continue
        m = re.match(r"^(\w+)\s*:\s*(.*)$", line)
        if not m:
            out["problems"].append(f"line {n}: cannot read '{line[:40]}'"); continue
        key, val = m.group(1).lower(), m.group(2).strip()
        if cur is None:
            if key in ("title", "voice", "cast"):
                out[key] = val
            else:
                out["problems"].append(f"line {n}: '{key}' is outside a SCENE block")
            continue
        if key not in KEYS:
            out["problems"].append(f"line {n}: unknown field '{key}' (allowed: {', '.join(sorted(KEYS))})"); continue
        cur[key] = val
    out["stage_changes"] = stage_changes
    return out


def red_marks(say: str) -> tuple[str, list[str]]:
    """'Arthur was a *normal* man' -> ('Arthur was a normal man', ['normal'])"""
    red = re.findall(r"\*([^*]+)\*", say)
    return re.sub(r"\*([^*]+)\*", r"\1", say), red


# Words that only change the LOOK of a place (time of day, light, weather). Same place + a different one of these words = a continuation of that
# place, not a different place: it is drawn FROM the earlier picture. Anything else that changes a place is written by the author with `from:`.
VARIANT = {"day", "daytime", "night", "nighttime", "morning", "midday", "noon", "afternoon", "evening", "sunset", "sunrise", "dawn", "dusk", "sun", "sunny",
           "moon", "moonlit", "moonlight", "cloudy", "rain", "rainy", "storm", "stormy", "snow", "snowy", "fog", "foggy", "dark", "bright", "twilight", "midnight"}


def place_words(text: str) -> set[str]:
    return {w for w in words(text) if w not in VARIANT}


def match_bg(db: dict, wanted: str) -> tuple[str | None, float, str | None]:
    """(library id, score, base id).  A background counts as found only when its look words (night, sunset, rain...) match too;
    otherwise the closest picture of the SAME place is returned as `base` to draw the new one from."""
    want = set(words(wanted)); look = want & VARIANT; place = place_words(wanted)
    best, bscore, base, base_s = None, 0.0, None, 0.0
    for k, v in db["items"].items():
        if v["type"] != "background":
            continue
        tags = set(v["tags"])
        s = len(want & tags) / len(want) if want else 0.0
        if look - tags:                                     # the script asks for a look (night, sunset, rain...) this picture does not have
            ps = len(place & tags) / max(len(place), 1) if place else 0.0
            if ps >= 0.99 and len(place_words(" ".join(tags))) <= len(place) + 1 and ps > base_s:
                base, base_s = k, ps
            continue
        if s > bscore or (s == bscore and best and len(v["tags"]) < len(db["items"][best]["tags"])):
            best, bscore = k, s
    if bscore >= 0.6:
        return best, bscore, None
    return None, bscore, base


def _match(db: dict, wanted: str, kind: str) -> tuple[str | None, float]:
    want = set(words(wanted))
    if not want:
        return None, 0.0
    best, score = None, 0.0
    for k, v in db["items"].items():
        if v["type"] != kind:
            continue
        s = len(want & set(v["tags"])) / len(want)
        if s > score or (s == score and best and len(v["tags"]) < len(db["items"][best]["tags"])):
            best, score = k, s
    return (best, score) if score >= 0.6 else (None, score)


def costume_status(name: str, root: Path = ROOT) -> str:
    """ready = full sprite set (bodies + heads) | bodies_only = accepted bodies, no heads yet | spec_only = spec written, not drawn | missing"""
    if (root / "animation" / "assets2d" / name).is_dir() or (root / "animation" / "assets2d" / f"role_{name}").is_dir():
        return "ready"
    if (root / "animation" / "costumes" / name / "manifest.json").exists():
        return "bodies_only"
    if (root / "animation" / "costume_specs" / f"{name}.json").exists():
        return "spec_only"
    return "missing"


def resolve(script: dict, cast: dict, db: dict | None = None, root: Path = ROOT) -> dict:
    """Check every scene against the cast file and the library. Returns the checked scene list + errors + what is missing."""
    db = db if db is not None else lib.load()
    chars = {k.lower(): v for k, v in cast.get("characters", {}).items()}
    errors = list(script["problems"]); needs_bg, needs_obj, costumes = [], [], {}; prev_bg = None
    stage = {c: v.get("default_stage") or next(iter(v["stages"])) for c, v in chars.items()}
    changes = sorted(script["stage_changes"]); ci = 0; scenes = []
    for i, sc in enumerate(script["scenes"]):
        while ci < len(changes) and changes[ci][0] <= i:
            _, c, s = changes[ci]; ci += 1
            if c not in chars:
                errors.append(f"CHANGE: unknown character '{c}'")
            elif s not in chars[c]["stages"]:
                errors.append(f"CHANGE: '{c}' has no stage '{s}' (has: {', '.join(chars[c]['stages'])})")
            else:
                stage[c] = s
        tag = f"scene {i + 1} (line {sc['line']})"
        if not sc.get("say"):
            errors.append(f"{tag}: missing 'say:' (the voice line)")
        voice, red = red_marks(sc.get("say", ""))
        who = []
        for part in [p.strip() for p in sc.get("who", "").split(",") if p.strip()]:
            c, _, s = part.lower().partition("@"); s = s or stage.get(c, "")
            if c not in chars:
                errors.append(f"{tag}: unknown character '{c}' (cast has: {', '.join(chars) or 'nobody'})"); continue
            if s not in chars[c]["stages"]:
                errors.append(f"{tag}: '{c}' has no stage '{s}' (has: {', '.join(chars[c]['stages'])})"); continue
            cos = chars[c]["stages"][s]["costume"]
            costumes.setdefault(cos, costume_status(cos, root))
            who.append({"character": c, "stage": s, "costume": cos, "costume_status": costumes[cos]})
        bg, bscore = (None, 0.0)
        if sc.get("bg"):
            bg, bscore, base = match_bg(db, sc["bg"])
            mode = "same" if base else None
            link = sc.get("from") or sc.get("next")                         # the author says: draw it from this picture ('previous' = the scene before)
            if sc.get("from") and sc.get("next"):
                errors.append(f"{tag}: use 'from:' OR 'next:', not both")
            if link and not bg:
                mode = "next" if sc.get("next") and not sc.get("from") else "same"
                if link.strip().lower() in ("previous", "prev"):
                    base = prev_bg
                    if not base:
                        errors.append(f"{tag}: '{'from' if sc.get('from') else 'next'}: previous' but this is the first scene")
                else:
                    fb, fs, _ = match_bg(db, link)
                    fid = "bg_" + "_".join(words(link))[:40]
                    base = fb or (fid if any(n["id"] == fid for n in needs_bg) else None)
                    if not base:
                        errors.append(f"{tag}: '{'from' if sc.get('from') else 'next'}: {link}' is not in the library and not drawn earlier in this script")
            nid = "bg_" + "_".join(words(sc["bg"]))[:40]
            if not bg and not base:                                          # no explicit base: an earlier missing picture of the same place?
                pw = place_words(sc["bg"])
                for n in needs_bg:
                    if pw and place_words(n["desc"]) == pw and n["id"] != nid:
                        base = n["id"]; break
            if not bg and not any(n["id"] == nid for n in needs_bg):
                need = {"id": nid, "type": "background", "tags": words(sc["bg"]), "desc": sc["bg"], "scene": i + 1}
                if base and base != nid:
                    bd = (db["items"].get(base) or {}).get("desc") or next((n["desc"] for n in needs_bg if n["id"] == base), "")
                    need["base"] = base; need["mode"] = mode or "same"
                    need["root"] = (db["items"].get(base) or {}).get("root") or next((n.get("root") or n["id"] for n in needs_bg if n["id"] == base), base)
                    need["change"] = sc["bg"] if link else (" ".join(w for w in words(sc["bg"]) if w not in set(words(bd))) or sc["bg"])
                needs_bg.append(need)
            prev_bg = bg or nid
        else:
            errors.append(f"{tag}: missing 'bg:'")
        props = []
        for p in [p.strip() for p in sc.get("props", "").split(",") if p.strip()]:
            hit, s = _match(db, p, "object")
            props.append({"wanted": p, "library_id": hit, "match": round(s, 2)})
            if not hit:
                needs_obj.append({"id": "obj_" + "_".join(words(p))[:40], "type": "object", "tags": words(p), "desc": p, "scene": i + 1})
        cam = sc.get("camera", "").lower()
        if cam and cam not in CAMERAS:
            errors.append(f"{tag}: camera '{cam}' not known (use: {', '.join(sorted(CAMERAS))})")
        scenes.append({"n": i + 1, "voice": voice, "red": red, "bg": {"wanted": sc.get("bg", ""), "library_id": bg, "match": round(bscore, 2)},
                       "who": who, "pose": [p.strip() for p in sc.get("pose", "").split(",") if p.strip()], "props": props,
                       "text": sc.get("text", ""), "sound": sc.get("sound", ""), "camera": cam or "auto"})
    seen = {}
    for n in needs_bg + needs_obj:
        seen.setdefault(n["id"], n)
    missing_costumes = sorted(c for c, s in costumes.items() if s in ("missing", "spec_only", "bodies_only"))
    return {"title": script["title"], "voice": script["voice"], "scenes": scenes, "errors": errors, "costume_status": costumes,
            "missing_costumes": missing_costumes, "missing_assets": list(seen.values()), "ok": not errors}


def make_costume_spec(name: str, look: str, colour: str, template: Path | None = None) -> dict:
    """Spec for the automatic costume loop, from one line of words and a colour. Colours the hue check can judge only."""
    colour = colour.lower().strip()
    if colour not in HUES:
        raise ScriptError(f"colour '{colour}' is not supported by the automatic hue check yet (use: {', '.join(HUES)})")
    t = json.loads((template or ROOT / "animation" / "costume_specs" / "bombsuit.json").read_text())
    old = t["prompt_first"].split("Only the outfit changes:")[0]
    keep = " Keep the round white hands and the plain white neck stub exactly as in the reference. Do not draw any head, face, helmet or hat. No text, no letters, no numbers."
    first = (old + f"Only the outfit changes: every figure wears {look}, instead of the khaki explorer outfit. The legs, including the shins, are covered by the same outfit." + keep)
    spec = dict(t); spec["name"] = name; spec["target_hue"] = list(HUES[colour]); spec["prompt_first"] = first
    spec["prompt_retry"] = (t["prompt_retry"].split("Image 2 shows the exact outfit design")[0] +
                            f"Image 2 shows the exact outfit design (some cells may be empty): {look}. Draw a new sheet with all 12 poses at the same layout, same positions, same size and same body proportions as image 1, every figure wearing exactly the same outfit as image 2, the legs and shins fully covered, same thick dark outlines and flat cartoon style. Keep the round white hands and the plain white neck stub. Do not draw any head, face, helmet or hat. No text, no letters, no numbers.")
    spec["prompt_pose"] = (f"Image 1 is a headless cartoon body in one pose on a plain white background. Image 2 is a headless cartoon body wearing {look}. Draw ONE figure in exactly the pose, body position, size and proportions of image 1, wearing exactly the same outfit as image 2. The legs and shins are fully covered. Front view like image 1. Round white hands, plain white neck stub, no head, no face, no helmet, plain white background, same thick dark outlines and flat cartoon style. No text.")
    return spec


def write_specs(result: dict, cast: dict, out_dir: Path) -> list[str]:
    """For every costume that is missing: write its spec stub if the cast file gave a 'look' and a 'colour'. Nothing is drawn here."""
    made = []
    for name in result["missing_costumes"]:
        if result["costume_status"].get(name) != "missing":
            continue
        info = cast.get("costumes", {}).get(name, {})
        if not info.get("look") or not info.get("colour"):
            result["errors"].append(f"costume '{name}' is missing and the cast file has no 'look' and 'colour' for it")
            continue
        spec = make_costume_spec(name, info["look"], info["colour"])
        p = Path(out_dir) / f"{name}.json"; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(json.dumps(spec, indent=1)); made.append(str(p))
    result["ok"] = not result["errors"]
    return made


def summary(r: dict) -> str:
    lines = [f"{r['title'] or '(no title)'}: {len(r['scenes'])} scenes, voice {r['voice']}"]
    lines += [f"  ERROR  {e}" for e in r["errors"]]
    lines += [f"  costume {c}: {s}" for c, s in sorted(r["costume_status"].items())]
    lines += [f"  to draw: {a['type']} '{a['desc']}' (scene {a['scene']})" for a in r["missing_assets"]]
    lines.append("OK" if r["ok"] else "NOT OK: fix the errors above")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(); p.add_argument("script"); p.add_argument("--cast"); p.add_argument("--out")
    p.add_argument("--write-specs", metavar="DIR"); p.add_argument("--write-request", metavar="FILE", help="write the missing backgrounds/props as an asset request file")
    p.add_argument("--lib", help="asset library folder (default: animation/asset_library)"); p.add_argument("--root", help="project root to look for costumes/sprites in (default: this repo)")
    a = p.parse_args(argv); script = parse_script(Path(a.script).read_text(encoding="utf-8"))
    cast_path = Path(a.cast or script["cast"] or "")
    if not cast_path.is_file():
        print(f"cast file not found: {cast_path}"); return 2
    cast = json.loads(cast_path.read_text(encoding="utf-8"))
    db = json.loads((Path(a.lib) / "index.json").read_text()) if a.lib else None
    r = resolve(script, cast, db, Path(a.root) if a.root else ROOT)
    if a.write_request:
        Path(a.write_request).parent.mkdir(parents=True, exist_ok=True)
        Path(a.write_request).write_text(json.dumps({"name": Path(a.script).stem, "needs": [{k: n[k] for k in ("id", "type", "tags", "desc", "base", "change", "mode", "root") if k in n} for n in r["missing_assets"]]}, indent=1))
    if a.write_specs:
        r["specs_written"] = write_specs(r, cast, Path(a.write_specs))
    if a.out:
        Path(a.out).parent.mkdir(parents=True, exist_ok=True); Path(a.out).write_text(json.dumps(r, indent=1))
    print(summary(r)); return 0 if r["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
