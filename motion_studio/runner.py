"""One command from a story file to a finished short, with checks and redraws. Runs wherever `git`, `gh` (logged in) and the repo are.

    python -m motion_studio.runner story.json out_dir models_dir [--rounds 2]

Steps: shots -> jobs.json -> commit + push (starts the Kaggle scene batch) -> wait -> download pictures -> gate -> redraw bad ones
(new seeds, up to --rounds) -> voice + captions + camera + sounds -> out_dir/<name>.mp4 and out_dir/report.json.
Final upload to YouTube is NOT done here (it stays a human step). Pictures that still fail the gate after the last round are used anyway
and listed in the report as unresolved.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import time
from pathlib import Path

from .gate import check, redo_jobs
from .scene_plan import make_jobs
from .short_story import build_shots, speak
from .assemble import assemble

ROOT = Path(__file__).resolve().parents[1]
REPO = "damarlanandu2005-jpg/stickman-motion-studio"
WORKFLOW = "kaggle-scene-batch.yml"
REDO_REASONS = ("missing", "blank", "unreadable", "wrong size", "too dark", "stray face", "near-copy")


def sh(*cmd: str, check_rc: bool = True) -> str:
    p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if check_rc and p.returncode:
        raise RuntimeError(f"{' '.join(cmd)} failed: {p.stderr.strip()[:500]}")
    return p.stdout.strip()


def run_kaggle(jobs: dict, label: str, dest: Path, poll: int = 30, limit_s: int = 7000) -> dict:
    """Push jobs.json, wait for the workflow of that commit, download its pictures into dest. Returns the klein report."""
    (ROOT / "kaggle" / "scene-batch" / "jobs.json").write_text(json.dumps(jobs, indent=1), encoding="utf-8")
    sh("git", "add", "kaggle/scene-batch/jobs.json")
    sh("git", "commit", "-q", "-m", f"Scene batch: {label}\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>")
    sha = sh("git", "rev-parse", "HEAD")
    sh("git", "push", "-q", "origin", "HEAD")
    run_id, t0 = None, time.time()
    while time.time() - t0 < limit_s:
        rows = json.loads(sh("gh", "run", "list", "--workflow", WORKFLOW, "-R", REPO, "--commit", sha, "--json", "databaseId,status,conclusion"))
        if rows:
            run_id = rows[0]["databaseId"]
            if rows[0]["status"] == "completed":
                if rows[0]["conclusion"] != "success":
                    raise RuntimeError(f"Kaggle scene batch run {run_id} ended with {rows[0]['conclusion']}")
                break
        time.sleep(poll)
    else:
        raise TimeoutError(f"scene batch for {sha[:7]} did not finish in {limit_s} s")
    dest.mkdir(parents=True, exist_ok=True)
    listing = sh("gh", "api", f"repos/{REPO}/contents/scene-batch?ref=test-results", "--jq", ".[].name").split()
    folder = next(n for n in listing if n.startswith(f"{run_id}-"))
    files = sh("gh", "api", f"repos/{REPO}/contents/scene-batch/{folder}/outputs?ref=test-results", "--jq", '.[]|[.name,.download_url]|@tsv')
    for line in files.splitlines():
        name, url = line.split("\t")
        if url:
            subprocess.run(["curl", "-sSL", "-o", str(dest / name), url], check=True)
    return json.loads((dest / "poses_report.json").read_text())


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("story"), ap.add_argument("out"), ap.add_argument("models")
    ap.add_argument("--rounds", type=int, default=2)
    a = ap.parse_args(argv)
    story = json.loads(Path(a.story).read_text())
    out, pics = Path(a.out), Path(a.out) / "pictures"
    out.mkdir(parents=True, exist_ok=True)
    jobs = make_jobs(story["shots"])
    report = {"story": a.story, "shots": len(story["shots"]), "rounds": [], "unresolved": []}
    todo = jobs["jobs"]
    for rnd in range(a.rounds + 1):
        rep = run_kaggle({"jobs": todo}, f"{Path(a.story).stem} round {rnd} ({len(todo)} pictures)", out / f"round{rnd}")
        for f in (out / f"round{rnd}").glob("pose_*.png"):
            (pics / f.name).parent.mkdir(exist_ok=True)
            f.replace(pics / f.name)
        flagged = {k: v for k, v in check(jobs["jobs"], pics).items() if any(r in w for w in v for r in REDO_REASONS)}
        report["rounds"].append({"round": rnd, "drawn": len(todo), "klein_status": rep["klein"]["status"], "flagged": flagged})
        if not flagged or rnd == a.rounds:
            report["unresolved"] = sorted(flagged)
            break
        todo = redo_jobs(jobs["jobs"], flagged, rnd + 1)
    wav = out / "voice.wav"
    durs = speak([s["text"] for s in story["shots"]], Path(a.models), story.get("voice", "am_fenrir"), story.get("speed", 1.12), wav)
    mp4 = out / (Path(a.story).stem + ".mp4")
    report["video"] = assemble(build_shots(story, durs), pics, mp4, wav)
    (out / "report.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    print(json.dumps(report, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
