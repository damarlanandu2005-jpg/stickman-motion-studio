"""Automatic heads and extra poses for the characters a script uses. Input = the script + its cast file; nothing is chosen by hand.

    needs    --script S --out REQ                  what is missing: heads (cast file 'head:' text) and pose words the sprite set does not have
    plan     --request REQ --round N --state DIR   jobs.json for this round (all characters in ONE Kaggle run)
    judge    --request REQ --round N --state DIR --outputs DIR   code checks every drawn picture, keeps the best
    finalize --request REQ --state DIR             last round: best picture even with soft flaws (marked), installed into animation/assets2d/<folder>

Cast file: "costumes": {"doctor": {"look": "...", "head": "bald, round glasses, grey mustache"}}
  * head: drawn as a sheet of 20 faces from animation/reference_art/headhat/heads_20.png (same layout, same expressions) -> head_<face>.png
  * a pose word in the script that is not one of the 12 built-in poses (e.g. "kneel with hands on a box") -> pose_<words>.png for that character,
    drawn from the character's standing body (dataset reference), headless, same outfit.
Checks by code: size, single figure, face features in the right place (heads), headless / outfit colour (poses). They cannot judge taste.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from . import script_reader as sr
from .costume_check import cutout
from .make_sprites import FACES, cells, tight

ROOT = Path(__file__).resolve().parents[1]
A2D = ROOT / "animation" / "assets2d"
HEAD_REF = "headhat/heads_20.png"                         # reference_art path (in the repo)
HEAD_W, HEAD_H = 1120, 1408
POSE_W = POSE_H = 768
CORE_FACES = ["neutral", "happy", "laugh", "smug", "surprised", "scared", "sad", "angry"]
MAX_ROUNDS = 3


def slug(words: str) -> str:
    return "_".join(re.findall(r"[a-z0-9]+", words.lower()))[:48]


def folder_of(costume: str, root: Path = ROOT) -> str | None:
    a = root / "animation" / "assets2d"
    for cand in (f"role_{costume}", costume):
        if (a / cand / "body_00.png").exists():
            return cand
    return None


# ---------------------------------------------------------------- what is missing
def needs(script: dict, cast: dict, root: Path = ROOT) -> dict:
    from .shot_planner import POSES, EXPRESSIONS
    chars = {k.lower(): v for k, v in cast.get("characters", {}).items()}
    costumes = cast.get("costumes", {})
    out = {"heads": [], "poses": [], "skipped": []}
    seen_heads, seen_poses = set(), set()
    stage = {c: v.get("default_stage") or next(iter(v["stages"])) for c, v in chars.items()}
    changes = sorted(script.get("stage_changes", [])); ci = 0
    for i, sc in enumerate(script["scenes"]):
        while ci < len(changes) and changes[ci][0] <= i:
            _, c, s = changes[ci]; ci += 1
            if c in chars and s in chars[c]["stages"]:
                stage[c] = s
        who = [p.strip() for p in sc.get("who", "").split(",") if p.strip() and p.strip().lower() not in ("none", "nobody")]
        poses = [p.strip() for p in sc.get("pose", "").split(",") if p.strip()]
        for k, part in enumerate(who):
            c, _, s = part.lower().partition("@"); s = s or stage.get(c, "")
            if c not in chars or s not in chars[c]["stages"]:
                continue
            cos = chars[c]["stages"][s]["costume"]
            fol = folder_of(cos, root)
            head = (costumes.get(cos) or {}).get("head", "").strip()
            if head and cos not in seen_heads:
                seen_heads.add(cos)
                marker = root / "animation" / "assets2d" / (fol or cos) / "head_source.json"
                done = marker.exists() and json.loads(marker.read_text()).get("desc") == head
                if not fol:
                    out["skipped"].append(f"head of '{cos}': its body is not made yet (costume step first)")
                elif not done:
                    out["heads"].append({"id": f"head_{slug(cos)}", "costume": cos, "folder": fol, "desc": head})
            raw = poses[k] if k < len(poses) else (poses[-1] if poses else "stand")
            for pw in [p.strip() for p in re.split(r"->|→", raw) if p.strip()]:
                key = pw.lower().replace(" ", "_")
                if key in POSES or key in EXPRESSIONS:
                    continue
                sg = slug(pw)
                if (cos, sg) in seen_poses:
                    continue
                seen_poses.add((cos, sg))
                if not fol:
                    out["skipped"].append(f"pose '{pw}' of '{cos}': its body is not made yet"); continue
                if (root / "animation" / "assets2d" / fol / f"pose_{sg}.png").exists():
                    continue
                out["poses"].append({"id": f"pose_{slug(cos)}_{sg}"[:70], "costume": cos, "folder": fol, "pose": pw, "slug": sg,
                                     "ref": f"ds:sprites__{fol}__body_00.png"})
    return out


# ---------------------------------------------------------------- planning
def head_prompt(desc: str) -> str:
    return ("Image 1 shows 20 round cartoon heads on a plain white background, in 4 columns and 5 rows, each with a different facial expression. "
            "Draw the same 20 heads in exactly the same layout, the same positions, the same size, the same facial expressions and the same thick "
            f"dark outlines and flat cartoon style. Every head now has: {desc.strip().rstrip('.')}. Only the heads: no neck, no body, no shoulders. "
            "Plain white background. No text, no letters, no numbers.")


def pose_prompt(pose: str) -> str:
    return ("Image 1 is a headless cartoon body standing on a plain white background. Draw the same character with exactly the same outfit, the same colours, "
            f"the same round white hands and the same thick dark outlines, in this pose: {pose.strip().rstrip('.')}. Headless: only the short neck stub "
            "on top, no head, no face, no hat. The whole body is visible. Plain white background, nothing else. No text.")


def state_of(state: Path) -> dict:
    f = Path(state) / "cast_state.json"
    return json.loads(f.read_text()) if f.exists() else {"accepted": {}, "scores": {}}


def save_state(state: Path, st: dict) -> None:
    Path(state).mkdir(parents=True, exist_ok=True)
    (Path(state) / "cast_state.json").write_text(json.dumps(st, indent=1))


def plan(req: dict, round_no: int, state: Path, jobs_file: Path = ROOT / "kaggle" / "scene-batch" / "jobs.json") -> dict:
    st = state_of(state)
    pending = [n for n in req["heads"] + req["poses"] if n["id"] not in st["accepted"]]
    seeds = 2 if round_no == 1 else 3
    jobs = []
    for n in pending:
        for k in range(seeds):
            jid = f"{n['id']}_r{round_no}_s{k}"
            if n["id"].startswith("head_"):
                jobs.append({"id": jid, "prompt": head_prompt(n["desc"]), "refs": [HEAD_REF], "seed": 7100 + 100 * round_no + k, "width": HEAD_W, "height": HEAD_H})
            else:
                jobs.append({"id": jid, "prompt": pose_prompt(n["pose"]), "refs": [n["ref"]], "seed": 7300 + 100 * round_no + k, "width": POSE_W, "height": POSE_H})
    jobs_file.parent.mkdir(parents=True, exist_ok=True)
    jobs_file.write_text(json.dumps({"jobs": jobs}, indent=1))
    return {"round": round_no, "pending": [n["id"] for n in pending], "jobs": len(jobs), "uses_dataset": any(j["refs"][0].startswith("ds:") for j in jobs)}


# ---------------------------------------------------------------- checks
def _dark_face(rgba: Image.Image) -> np.ndarray:
    """Dark marks (eyes, brows, mouth) in the face area of a cut-out head, 48x48, values 0..1."""
    h = tight(rgba)
    a = np.asarray(h.convert("RGBA").resize((96, 96), Image.LANCZOS)).astype(np.float32)
    inside = a[:, :, 3] > 0
    dark = (a[:, :, :3].max(2) < 90) & inside
    sub = dark[34:90, 14:82].astype(np.float32)                  # lower 2/3: eyes and mouth, not the hair and not the outline at the sides
    return np.asarray(Image.fromarray((sub * 255).astype(np.uint8)).resize((48, 40), Image.BILINEAR), np.float32) / 255


def check_head_sheet(drawn: Path, ref_sheet: Path) -> dict:
    """Per face: present, size against the reference face, face marks where the reference has them. Returns {face: {...}}."""
    im = Image.open(drawn).convert("RGB")
    rf = Image.open(ref_sheet).convert("RGB")
    im = im.resize(rf.size, Image.LANCZOS)
    dc, rc = list(cells(im, 4, 5)), list(cells(rf, 4, 5))
    out = {}
    for name, (r, c) in FACES.items():
        new, old = cutout(dc[r * 4 + c]), cutout(rc[r * 4 + c])
        bn, bo = new.getchannel("A").getbbox(), old.getchannel("A").getbbox()
        if not bn or not bo:
            out[name] = {"pass": False, "soft": False, "why": ["empty"]}; continue
        hr, wr = (bn[3] - bn[1]) / (bo[3] - bo[1]), (bn[2] - bn[0]) / (bo[2] - bo[0])
        fa, fb = _dark_face(new), _dark_face(old)
        corr = float(np.corrcoef(fa.ravel(), fb.ravel())[0, 1]) if fa.std() > 0 and fb.std() > 0 else 0.0
        why = []
        if not 0.75 <= hr <= 1.7:
            why.append("height")
        if not 0.75 <= wr <= 1.6:
            why.append("width")
        if corr < 0.25:
            why.append("face differs from the reference face")
        soft = all(w == "face differs from the reference face" for w in why) or (0.6 <= hr <= 2.0 and 0.6 <= wr <= 1.9)
        out[name] = {"pass": not why, "soft": soft, "why": why, "h_ratio": round(hr, 2), "w_ratio": round(wr, 2), "face_corr": round(corr, 2),
                     "score": round(corr - abs(1.15 - hr) * 0.5, 3)}
    return out


def _suit_rgb(rgba: Image.Image) -> np.ndarray | None:
    a = np.asarray(rgba.convert("RGBA")).astype(np.float32)
    m = a[:, :, 3] > 0
    rgb = a[:, :, :3][m]
    if not len(rgb):
        return None
    mx, mn = rgb.max(1), rgb.min(1)
    col = rgb[(mx - mn > 30) & (mx > 60)]
    return col.mean(0) if len(col) > 50 else rgb.mean(0)


def check_pose(drawn: Path, stand: Path) -> dict:
    cut = tight(cutout(Image.open(drawn).convert("RGB")))
    a = np.asarray(cut)[:, :, 3] > 0
    if a.sum() < 2000:
        return {"pass": False, "soft": False, "why": ["empty"], "score": -9}
    hgt = a.shape[0] / POSE_H
    rows = a.sum(1); top = rows[: max(int(len(rows) * 0.06), 2)].mean(); widest = rows.max()
    s0 = _suit_rgb(Image.open(stand)); s1 = _suit_rgb(cut)
    cdiff = float(np.abs(s0 - s1).max()) if s0 is not None and s1 is not None else 255.0
    why = []
    if not 0.2 <= hgt <= 0.98:
        why.append("figure too small or cut off")
    if top / max(widest, 1) > 0.42:
        why.append("head or hat drawn")
    if cdiff > 70:
        why.append("outfit colour differs")
    soft = "figure too small or cut off" not in why
    return {"pass": not why, "soft": soft, "why": why, "height_part": round(hgt, 2), "top_ratio": round(float(top / max(widest, 1)), 2),
            "colour_diff": round(cdiff, 1), "score": round(-cdiff / 100 - top / max(widest, 1), 3)}


# ---------------------------------------------------------------- judging
def _drawn(outputs: Path, nid: str) -> list[Path]:
    return sorted(Path(outputs).rglob(f"pose_{nid}_r*_s*.png")) if outputs and Path(outputs).exists() else []


def judge(req: dict, round_no: int, state: Path, outputs: Path, root: Path = ROOT, final: bool = False) -> dict:
    st = state_of(state); cand = Path(state) / "candidates"; cand.mkdir(parents=True, exist_ok=True)
    ref_sheet = root / "animation" / "reference_art" / HEAD_REF
    for n in req["heads"] + req["poses"]:
        if n["id"] in st["accepted"]:
            continue
        for f in _drawn(outputs, n["id"]) if outputs else []:
            (cand / f.name).write_bytes(f.read_bytes())
        files = sorted(cand.glob(f"pose_{n['id']}_r*_s*.png"))
        best = None
        for f in files:
            if n["id"].startswith("head_"):
                res = check_head_sheet(f, ref_sheet)
                core_ok = sum(res[x]["pass"] for x in CORE_FACES); soft_ok = all(res[x]["soft"] for x in CORE_FACES)
                sc, strict = core_ok + sum(r.get("score", 0) for r in res.values()) / 20, core_ok == len(CORE_FACES)
                ok = strict or (final and soft_ok)
            else:
                res = check_pose(f, root / "animation" / "assets2d" / n["folder"] / "body_00.png")
                sc, strict = res["score"] + (2 if res["pass"] else 0), res["pass"]
                ok = strict or (final and res["soft"])
            st["scores"][f.name] = {"ok": ok, "strict": strict, "score": round(sc, 3), "detail": res}
            if ok and (best is None or sc > best[1]):
                best = (f.name, sc, strict)
        if best:
            st["accepted"][n["id"]] = {"file": best[0], "final_soft": not best[2]}
    save_state(state, st)
    missing = [n["id"] for n in req["heads"] + req["poses"] if n["id"] not in st["accepted"]]
    return {"round": round_no, "accepted": sorted(st["accepted"]), "still_missing": missing, "complete": not missing}


# ---------------------------------------------------------------- installing
def _shoulders(a: np.ndarray) -> int:
    rows = a.sum(1); n = max(int(len(rows) * 0.35), 3)
    return int(rows[:n].max())


def install(req: dict, state: Path, root: Path = ROOT) -> list[str]:
    st = state_of(state); cand = Path(state) / "candidates"; notes = []
    for n in req["heads"]:
        acc = st["accepted"].get(n["id"])
        if not acc:
            notes.append(f"head of '{n['costume']}' not made: the old head is used"); continue
        dest = root / "animation" / "assets2d" / n["folder"]
        sheet = Image.open(cand / acc["file"]).convert("RGB").resize(Image.open(root / "animation" / "reference_art" / HEAD_REF).size, Image.LANCZOS)
        cs = list(cells(sheet, 4, 5))
        for name, (r, c) in FACES.items():
            h = tight(cutout(cs[r * 4 + c]))
            h.resize((600, max(int(600 * h.height / max(h.width, 1)), 1)), Image.LANCZOS).save(dest / f"head_{name}.png")
        (dest / "head_source.json").write_text(json.dumps({"desc": n["desc"], "from": acc["file"], "soft_accepted": bool(acc.get("final_soft")), "human_reviewed": False}, indent=1))
        notes.append(f"head of '{n['costume']}' drawn automatically ({n['desc']})" + (" with soft flaws" if acc.get("final_soft") else ""))
    for n in req["poses"]:
        acc = st["accepted"].get(n["id"])
        if not acc:
            notes.append(f"pose '{n['pose']}' of '{n['costume']}' not made: standing pose used"); continue
        dest = root / "animation" / "assets2d" / n["folder"]
        cut = tight(cutout(Image.open(cand / acc["file"]).convert("RGB")))
        stand = Image.open(dest / "body_00.png").convert("RGBA")
        a_new, a_old = np.asarray(cut)[:, :, 3] > 0, np.asarray(stand)[:, :, 3] > 0
        if re.search(r"\b(lie|lies|lying|sleep|sleeping|bed)\b", n["pose"].lower()):
            k = stand.height * 0.95 / max(cut.width, 1)
        else:
            k = _shoulders(a_old) / max(_shoulders(a_new), 1)
        k = min(max(k, 0.4), 2.5)
        cut.resize((max(int(cut.width * k), 1), max(int(cut.height * k), 1)), Image.LANCZOS).save(dest / f"pose_{n['slug']}.png")
        notes.append(f"pose '{n['pose']}' of '{n['costume']}' drawn automatically" + (" with soft flaws" if acc.get("final_soft") else ""))
    return notes


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(); p.add_argument("cmd", choices=["needs", "plan", "judge", "finalize"])
    p.add_argument("--script"); p.add_argument("--out"); p.add_argument("--request"); p.add_argument("--round", type=int, default=1)
    p.add_argument("--state"); p.add_argument("--outputs")
    a = p.parse_args(argv)
    if a.cmd == "needs":
        script = sr.parse_script(Path(a.script).read_text(encoding="utf-8"))
        cast = json.loads((ROOT / script["cast"]).read_text(encoding="utf-8")) if script["cast"] else {}
        r = needs(script, cast)
        Path(a.out).parent.mkdir(parents=True, exist_ok=True); Path(a.out).write_text(json.dumps(r, indent=1))
        print(json.dumps({"heads": [h["costume"] for h in r["heads"]], "poses": [f"{x['costume']}: {x['pose']}" for x in r["poses"]], "skipped": r["skipped"]}))
        print(f"CAST_NEEDS={len(r['heads']) + len(r['poses'])}"); return 0
    req = json.loads(Path(a.request).read_text(encoding="utf-8"))
    if a.cmd == "plan":
        r = plan(req, a.round, Path(a.state)); print(json.dumps(r))
        print(f"NOTHING_PENDING={'true' if not r['pending'] else 'false'}"); print(f"USES_DATASET={'true' if r['uses_dataset'] else 'false'}")
    elif a.cmd == "judge":
        r = judge(req, a.round, Path(a.state), Path(a.outputs) if a.outputs else None); print(json.dumps(r)); print(f"DONE={'true' if r['complete'] else 'false'}")
    else:
        r = judge(req, MAX_ROUNDS, Path(a.state), None, final=True)
        notes = install(req, Path(a.state))
        (Path(a.state) / "cast_notes.json").write_text(json.dumps(notes, indent=1))
        print(json.dumps({"complete": r["complete"], "notes": notes})); print(f"DONE={'true' if r['complete'] else 'false'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
