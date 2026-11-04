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
import shutil
import sys
from pathlib import Path

from PIL import Image

from . import costume_auto as ca
from . import costume_check as cc

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "animation" / "reference_art"
JOBS = ROOT / "kaggle" / "scene-batch" / "jobs.json"


def load_spec(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def accepted_ref_name(spec: dict, round_no: int) -> str:
    return f"cast/costume_{spec['name']}_accepted_r{round_no}.png"


def plan(spec: dict, round_no: int, state: Path, art: Path = ART, jobs_file: Path = JOBS) -> dict:
    state = Path(state)
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
    return {"round": round_no, "refs": refs, "jobs": [j["id"] for j in jobs], "needs_ref_commit": len(refs) > 1}


def judge(spec: dict, round_no: int, state: Path, outputs: Path, art: Path = ART) -> dict:
    state = Path(state)
    cand = state / "candidates"; cand.mkdir(parents=True, exist_ok=True)
    for f in Path(outputs).rglob("pose_*.png"):          # keep every sheet ever drawn for this costume
        shutil.copy(f, cand / f.name.replace("pose_", "", 1))
    sheets = {p.stem: p for p in sorted(cand.glob(f"{spec['name']}_r*_s*.png"))}
    info = json.loads((art / spec["old_info"]).read_text())
    ref = art / spec["old_sheet"]
    scored = {k: ca.score_sheet(p, ref, info, tuple(spec["target_hue"])) for k, p in sheets.items()}
    picks = ca.pick_best(scored) if scored else {}
    manifest = ca.save_accepted(spec["name"], picks, sheets, info, state / "out") if scored else {"missing": list(range(len(info))), "complete": False}
    why = {k: {str(r["pose"]): r["why"] for r in v if not r["pass"]} for k, v in scored.items()}
    report = {"costume": spec["name"], "round": round_no, "sheets_drawn": sorted(sheets), "complete": manifest["complete"],
              "missing_poses": manifest["missing"], "why_failed_per_sheet": why, "status": "auto_accepted", "human_reviewed": False,
              "last_round": round_no >= spec["max_rounds"]}
    out = state / "out" / spec["name"]; out.mkdir(parents=True, exist_ok=True)
    (out / "report.json").write_text(json.dumps(report, indent=1))
    return report


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(); p.add_argument("cmd", choices=["plan", "judge"]); p.add_argument("--spec", required=True)
    p.add_argument("--round", type=int, required=True); p.add_argument("--state", required=True); p.add_argument("--outputs")
    a = p.parse_args(argv); spec = load_spec(Path(a.spec))
    if a.cmd == "plan":
        r = plan(spec, a.round, Path(a.state)); print(json.dumps(r)); print(f"NEEDS_REF_COMMIT={'true' if r['needs_ref_commit'] else 'false'}")
    else:
        r = judge(spec, a.round, Path(a.state), Path(a.outputs)); print(json.dumps({k: r[k] for k in ("round", "complete", "missing_poses", "sheets_drawn")}))
        print(f"DONE={'true' if r['complete'] else 'false'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
