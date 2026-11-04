"""Automatic costume loop (no person in the middle). One spec file in animation/costume_specs/ -> accepted poses saved for reuse.

    plan   --spec S --round N --state DIR     write kaggle/scene-batch/jobs.json for round N (+ the reference sheet made from the accepted poses so far)
    judge  --spec S --round N --state DIR --outputs DIR
                                              score every drawn sheet (this round + earlier rounds), keep the best passing pose per cell,
                                              save accepted poses, print DONE=true when all 12 are accepted

Round 1: old sheet only. Later rounds: old sheet + accepted-so-far sheet as references, new seeds, only failed cells are taken.
After max_rounds the poses still failing are listed as missing in the report; nothing is blocked and nothing is called reviewed.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

from . import costume_auto as ca
from . import costume_check as cc

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "animation" / "reference_art"
JOBS = ROOT / "kaggle" / "scene-batch" / "jobs.json"


def load_spec(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def accepted_ref_name(spec: dict, round_no: int) -> str:
    return f"cast/costume_{spec['name']}_accepted_r{round_no}.png"


POSE_SIZE = 768


def _square(im: Image.Image, size: int = POSE_SIZE) -> Image.Image:
    im = im.convert("RGB"); k = size / max(im.size)
    im = im.resize((max(int(im.width * k), 1), max(int(im.height * k), 1)), Image.LANCZOS)
    out = Image.new("RGB", (size, size), "white"); out.paste(im, ((size - im.width) // 2, (size - im.height) // 2))
    return out


def _filled(cut: Image.Image) -> np.ndarray:
    return ndi.binary_fill_holes(np.asarray(cut)[:, :, 3] > 0)


def similar_accepted(i: int, accepted: list[int], ref: Image.Image, info: list[dict]) -> tuple[int, float] | None:
    """The accepted pose whose OLD (explorer) silhouette is most like old pose i: intersection over union in the cell frame."""
    if not accepted:
        return None
    mi = _filled(cc.cutout(ref.crop(tuple(info[i]["cell"]))))
    best = None
    for j in accepted:
        mj = _filled(cc.cutout(ref.crop(tuple(info[j]["cell"]))))
        h, w = min(mi.shape[0], mj.shape[0]), min(mi.shape[1], mj.shape[1]); a, b = mi[:h, :w], mj[:h, :w]
        iou = float((a & b).sum() / max((a | b).sum(), 1))
        if best is None or iou > best[1]:
            best = (j, iou)
    return best


def place_single(drawn: Image.Image, i: int, ref: Image.Image, info: list[dict]) -> Image.Image:
    """Put a one-pose drawing into sheet position i: figure cut out, scaled to the old pose's height, feet and centre where the old pose has them."""
    sheet = Image.new("RGB", (cc.SHEET_W, cc.SHEET_H), "white")
    box = tuple(info[i]["cell"]); old = cc.cutout(ref.crop(box)); ob = old.getchannel("A").getbbox()
    cut = cc.cutout(drawn.convert("RGB")); nb = cut.getchannel("A").getbbox()
    if not ob or not nb:
        return sheet
    fig = cut.crop(nb); k = (ob[3] - ob[1]) / fig.height
    fig = fig.resize((max(int(fig.width * k), 1), max(int(fig.height * k), 1)), Image.LANCZOS)
    cell = Image.new("RGB", (box[2] - box[0], box[3] - box[1]), "white")
    x = int((ob[0] + ob[2]) / 2 - fig.width / 2); y = ob[3] - fig.height
    cell.paste(fig.convert("RGB"), (x, y), fig.getchannel("A")); sheet.paste(cell, box[:2])
    return sheet


def plan_pose_round(spec: dict, round_no: int, state: Path, art: Path, jobs_file: Path) -> dict:
    """Pose-level redraw: one picture per missing pose. Refs: that pose of the old character + the most similar ACCEPTED pose in the new costume."""
    state = Path(state); man = json.loads((state / "out" / spec["name"] / "manifest.json").read_text())
    info = json.loads((art / spec["old_info"]).read_text()); ref = Image.open(art / spec["old_sheet"]).convert("RGB")
    acc_sheet = Image.open(state / "out" / spec["name"] / "accepted_sheet.png").convert("RGB")
    accepted = sorted(int(k) for k in man["poses"]); jobs, files = [], []
    for i in man["missing"]:
        sim = similar_accepted(i, accepted, ref, info)
        if not sim:
            continue
        a = art / "cast" / f"costume_{spec['name']}_p{i}_r{round_no}_pose.png"; b = art / "cast" / f"costume_{spec['name']}_p{i}_r{round_no}_suit.png"
        a.parent.mkdir(parents=True, exist_ok=True)
        _square(ref.crop(tuple(info[i]["cell"]))).save(a); _square(acc_sheet.crop(tuple(info[sim[0]]["cell"]))).save(b)
        files += [str(a.relative_to(art.parent.parent)), str(b.relative_to(art.parent.parent))]
        for k in range(spec.get("pose_seeds", 3)):
            jobs.append({"id": f"{spec['name']}_p{i}_k{round_no}{k}", "prompt": spec["prompt_pose"], "refs": [str(a.relative_to(art)), str(b.relative_to(art))],
                         "seed": 9900 + 100 * round_no + 10 * i + k, "width": POSE_SIZE, "height": POSE_SIZE})
    jobs_file.write_text(json.dumps({"jobs": jobs}, indent=1), encoding="utf-8")
    return {"round": round_no, "mode": "pose", "missing": man["missing"], "jobs": [j["id"] for j in jobs], "needs_ref_commit": bool(jobs), "ref_files": files}


def fallbacks(spec: dict, state: Path, art: Path = ART) -> dict:
    """After the last round: a pose that never passed gets the closest accepted pose, clearly marked. Never called 'accepted'."""
    out = Path(state) / "out" / spec["name"]; man = json.loads((out / "manifest.json").read_text())
    info = json.loads((art / spec["old_info"]).read_text()); ref = Image.open(art / spec["old_sheet"]).convert("RGB")
    accepted = sorted(int(k) for k in man["poses"]); man["fallback"] = {}
    for i in list(man["missing"]):
        sim = similar_accepted(i, accepted, ref, info)
        if sim and (out / f"body_{sim[0]:02d}.png").exists():
            shutil.copy(out / f"body_{sim[0]:02d}.png", out / f"body_{i:02d}.png")
            man["fallback"][str(i)] = {"copied_from_pose": sim[0], "old_pose_similarity": round(sim[1], 2), "note": "NOT a redrawn pose: closest accepted pose reused"}
    man["usable"] = all(not(k in man["missing"] and str(k) not in man["fallback"]) for k in range(len(info)))
    (out / "manifest.json").write_text(json.dumps(man, indent=1))
    return man["fallback"]


def plan(spec: dict, round_no: int, state: Path, art: Path = ART, jobs_file: Path = JOBS) -> dict:
    state = Path(state)
    man_file = state / "out" / spec["name"] / "manifest.json"
    if round_no >= spec.get("pose_rounds_from", 99) and man_file.exists() and json.loads(man_file.read_text())["poses"]:
        return plan_pose_round(spec, round_no, state, art, jobs_file)
    refs = [spec["old_sheet"]]
    acc_sheet = state / "out" / spec["name"] / "accepted_sheet.png"
    if round_no > 1 and acc_sheet.exists():
        name = accepted_ref_name(spec, round_no)
        (art / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(acc_sheet, art / name)
        refs.append(name)
    first = round_no == 1 or len(refs) == 1
    prompt = spec["prompt_first"] if first else spec["prompt_retry"]
    n = spec["first_round_seeds"] if round_no == 1 else spec["retry_seeds"]
    jobs = [{"id": f"{spec['name']}_r{round_no}_s{k}", "prompt": prompt, "refs": refs, "seed": 9500 + 100 * (round_no - 1) + k,
             "width": cc.SHEET_W, "height": cc.SHEET_H} for k in range(n)]
    jobs_file.write_text(json.dumps({"jobs": jobs}, indent=1), encoding="utf-8")
    return {"round": round_no, "mode": "sheet", "refs": refs, "jobs": [j["id"] for j in jobs], "needs_ref_commit": len(refs) > 1,
            "ref_files": [f"animation/reference_art/{refs[1]}"] if len(refs) > 1 else []}


def judge(spec: dict, round_no: int, state: Path, outputs: Path, art: Path = ART) -> dict:
    state = Path(state)
    cand = state / "candidates"; cand.mkdir(parents=True, exist_ok=True)
    info = json.loads((art / spec["old_info"]).read_text()); ref_im = Image.open(art / spec["old_sheet"]).convert("RGB")
    for f in Path(outputs).rglob("pose_*.png"):          # keep every picture ever drawn for this costume
        name = f.name.replace("pose_", "", 1); m = re.match(rf"{re.escape(spec['name'])}_p(\d+)_k\d+\.png$", name)
        if m:                                              # one-pose picture -> placed into its sheet position, other cells stay empty
            place_single(Image.open(f), int(m.group(1)), ref_im, info).save(cand / name)
        else:
            shutil.copy(f, cand / name)
    for p in sorted(list(cand.glob(f"{spec['name']}_r*_s*.png")) + list(cand.glob(f"{spec['name']}_p*_k*.png"))):   # every drawn sheet also gets a code-repaired twin (bare / pale leg parts filled with suit colour)
        if not p.stem.endswith("fix") and not (cand / f"{p.stem}fix.png").exists():
            ca.repair_sheet(p, info, cand / f"{p.stem}fix.png")
    sheets = {p.stem: p for p in sorted(list(cand.glob(f"{spec['name']}_r*_s*.png")) + list(cand.glob(f"{spec['name']}_p*_k*.png")))}
    ref = art / spec["old_sheet"]
    scored = {k: ca.score_sheet(p, ref, info, tuple(spec["target_hue"])) for k, p in sheets.items()}
    picks = ca.pick_best(scored) if scored else {}
    manifest = ca.save_accepted(spec["name"], picks, sheets, info, state / "out") if scored else {"missing": list(range(len(info))), "complete": False}
    why = {k: {str(r["pose"]): r["why"] for r in v if not r["pass"]} for k, v in scored.items()}
    report = {"costume": spec["name"], "round": round_no, "sheets_drawn": sorted(sheets), "complete": manifest["complete"],
              "missing_poses": manifest["missing"], "why_failed_per_sheet": why, "status": "auto_accepted", "human_reviewed": False,
              "last_round": round_no >= spec["max_rounds"]}
    manifest_file = state / "out" / spec["name"] / "manifest.json"
    out = state / "out" / spec["name"]; out.mkdir(parents=True, exist_ok=True)
    if round_no >= spec["max_rounds"] and manifest["missing"] and scored:
        report["fallback_poses"] = fallbacks(spec, state, art)
    (out / "report.json").write_text(json.dumps(report, indent=1))
    return report


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(); p.add_argument("cmd", choices=["plan", "judge"]); p.add_argument("--spec", required=True)
    p.add_argument("--round", type=int, required=True); p.add_argument("--state", required=True); p.add_argument("--outputs")
    a = p.parse_args(argv); spec = load_spec(Path(a.spec))
    if a.cmd == "plan":
        r = plan(spec, a.round, Path(a.state)); print(json.dumps(r)); print(f"NEEDS_REF_COMMIT={'true' if r['needs_ref_commit'] else 'false'}")
        print("REF_FILES=" + ",".join(r.get("ref_files", [])))
    else:
        r = judge(spec, a.round, Path(a.state), Path(a.outputs)); print(json.dumps({k: r[k] for k in ("round", "complete", "missing_poses", "sheets_drawn")}))
        print(f"DONE={'true' if r['complete'] else 'false'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
