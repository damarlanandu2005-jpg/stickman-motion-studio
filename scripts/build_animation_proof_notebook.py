"""Build kaggle/animation-proof/animation_proof.ipynb: render the scene-engine proof on a Kaggle GPU.

The notebook downloads this repository at the exact commit being tested, installs headless Chromium, renders
animation/scenes/alien_crystal_proof.json at 1080x1920 with animation/render_frames.py (GPU WebGL first, CPU
fallback, the renderer actually used is recorded), then checks the MP4 with ffprobe and the reference repo's own
QA script (animation/reference/short_qa.py, unchanged).

    python scripts/build_animation_proof_notebook.py          # rewrite
    python scripts/build_animation_proof_notebook.py --check  # exit 1 if out of date
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "kaggle" / "animation-proof" / "animation_proof.ipynb"

INTRO = """# Scene-engine proof render (12 s, 1080x1920)

Library 3D objects + stickman cards + camera moves, drawn with the reference repo's own look files, rendered in
headless Chromium. Tries GPU WebGL first and records which renderer was really used. Every number in the report is
measured; a failed step is recorded and the notebook ends in an error.
"""

SETUP = r'''import os, sys, json, time, subprocess, pathlib, hashlib, shutil, tarfile, traceback, uuid, urllib.request

RUN_ID = globals().get("RUN_ID", "manual-" + uuid.uuid4().hex)
RUN_TOKEN = globals().get("RUN_TOKEN", "manual")
COMMIT_SHA = globals().get("COMMIT_SHA", "unknown")
WORKFLOW_RUN_ID = globals().get("WORKFLOW_RUN_ID", "local")

OUT = pathlib.Path(os.environ.get("STICKMAN_OUT_DIR", "/kaggle/working/outputs"))  # override only for unit tests
LOGS = OUT / "logs"
WORK = pathlib.Path(os.environ.get("STICKMAN_WORK_DIR", "/tmp/animation_proof"))
for d in (OUT, LOGS, WORK):
    d.mkdir(parents=True, exist_ok=True)

REPO = "damarlanandu2005-jpg/stickman-motion-studio"
FALLBACK_REF = "test/image-to-3d-objects"
SCENE = "scenes/alien_crystal_proof.json"
WIDTH, HEIGHT = 1080, 1920
PLAYWRIGHT = "playwright==1.63.0"

REPORT = {
    "run_token": RUN_TOKEN, "run_id": RUN_ID, "commit_sha": COMMIT_SHA, "workflow_run_id": WORKFLOW_RUN_ID,
    "status": "running", "error_message": None, "scene": SCENE, "width": WIDTH, "height": HEIGHT,
    "steps": {}, "environment": {}, "render": None, "video": None, "qa": None,
}
STARTED = time.monotonic()
'''

HELPERS = r'''def step(name, cmd, timeout, cwd=None, shell=False):
    log = LOGS / f"{name}.log"
    t = time.monotonic()
    try:
        with log.open("a") as fh:
            fh.write(("$ " + (cmd if shell else " ".join(map(str, cmd)))) + "\n"); fh.flush()
            code = subprocess.run(cmd, stdout=fh, stderr=subprocess.STDOUT, timeout=timeout, cwd=cwd, shell=shell).returncode
        outcome = "ok" if code == 0 else f"exit {code}"
    except subprocess.TimeoutExpired:
        code, outcome = None, f"timed out after {timeout} s"
    REPORT["steps"][name] = {"seconds": round(time.monotonic() - t, 1), "outcome": outcome}
    print(f"[{name}] {outcome} in {REPORT['steps'][name]['seconds']} s", flush=True)
    return code == 0


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def fetch_repo():
    ref = COMMIT_SHA if len(COMMIT_SHA) == 40 else FALLBACK_REF
    url = f"https://codeload.github.com/{REPO}/tar.gz/{ref}"
    tgz = WORK / "repo.tar.gz"
    t = time.monotonic()
    urllib.request.urlretrieve(url, tgz)
    with tarfile.open(tgz) as tf:
        tf.extractall(WORK / "repo", filter="data")
    root = next((WORK / "repo").iterdir()) / "animation"
    REPORT["steps"]["fetch_repo"] = {"seconds": round(time.monotonic() - t, 1), "outcome": "ok", "ref": ref}
    if not (root / "dist" / "page.js").exists():
        raise RuntimeError("animation/dist/page.js missing in the downloaded repository")
    return root


def environment():
    env = REPORT["environment"]
    env["python"] = sys.version.split()[0]
    smi = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total,driver_version", "--format=csv,noheader"], text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    env["nvidia_smi"] = smi.stdout.strip()
    env["cpu_count"] = os.cpu_count()


def probe(video):
    r = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-show_entries",
                        "stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,pix_fmt:format=duration,size",
                        "-of", "json", str(video)], text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if r.returncode:
        raise RuntimeError("ffprobe failed: " + r.stdout[-1000:])
    data = json.loads(r.stdout)
    v = next(s for s in data["streams"] if s["codec_type"] == "video")
    return {"codec": v["codec_name"], "width": v["width"], "height": v["height"], "fps": v["r_frame_rate"], "pix_fmt": v.get("pix_fmt"),
            "frames": int(v.get("nb_read_frames", 0)), "duration_s": round(float(data["format"]["duration"]), 3),
            "bytes": int(data["format"]["size"]), "audio_streams": sum(1 for s in data["streams"] if s["codec_type"] == "audio")}
'''

MAIN = r'''try:
    environment()
    if not step("install_playwright", [sys.executable, "-m", "pip", "install", "-q", PLAYWRIGHT], 900):
        raise RuntimeError("playwright install failed; see logs/install_playwright.log")
    if not step("install_chromium", [sys.executable, "-m", "playwright", "install", "--with-deps", "chromium"], 1500):
        raise RuntimeError("chromium install failed; see logs/install_chromium.log")
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        step("install_ffmpeg", "apt-get update -qq && apt-get install -y -qq ffmpeg", 900, shell=True)
    REPORT["environment"]["ffmpeg"] = subprocess.run(["ffmpeg", "-version"], text=True, stdout=subprocess.PIPE).stdout.splitlines()[0]
    root = fetch_repo()
    render_dir = OUT / "render"
    ok = step("render", [sys.executable, "render_frames.py", "--scene", SCENE, "--out", str(render_dir),
                         "--width", str(WIDTH), "--height", str(HEIGHT), "--gl", "auto"], 7200, cwd=root)
    rr = render_dir / "render_report.json"
    REPORT["render"] = json.loads(rr.read_text()) if rr.exists() else None
    if not ok or not REPORT["render"] or REPORT["render"].get("status") != "completed":
        raise RuntimeError("render failed: " + str((REPORT["render"] or {}).get("error")) + "; see logs/render.log")
    video = render_dir / "render.mp4"
    REPORT["video"] = {**probe(video), "file": "render/render.mp4", "sha256": sha256_of(video)}
    qa_dir = OUT / "qa"
    step("qa", [sys.executable, str(root / "reference" / "short_qa.py"), str(video), str(qa_dir)], 900)
    qa_md = qa_dir / "report.md"
    REPORT["qa"] = qa_md.read_text() if qa_md.exists() else None
    v = REPORT["video"]
    problems = []
    if (v["width"], v["height"]) != (WIDTH, HEIGHT): problems.append(f"size {v['width']}x{v['height']}")
    if v["frames"] != REPORT["render"]["total_frames"]: problems.append(f"frames {v['frames']} != {REPORT['render']['total_frames']}")
    if problems:
        raise RuntimeError("video check failed: " + ", ".join(problems))
    REPORT["status"] = "completed"
except Exception as exc:
    REPORT["status"] = "failed"
    REPORT["error_message"] = f"{type(exc).__name__}: {exc}"
    traceback.print_exc()
finally:
    REPORT["notebook_duration_seconds"] = round(time.monotonic() - STARTED, 1)
    (OUT / "proof_report.json").write_text(json.dumps(REPORT, indent=2), encoding="utf-8")
    print(json.dumps({k: REPORT[k] for k in ("status", "error_message", "environment", "steps", "video")}, indent=2))
    if REPORT.get("render"):
        print({k: REPORT["render"].get(k) for k in ("mode", "gl", "gpu_used", "seconds_per_frame_mean", "render_seconds_total")})
'''

VERDICT = r'''assert REPORT["status"] == "completed", "Proof render failed: " + str(REPORT["error_message"])
print("PASS: rendered", REPORT["video"]["frames"], "frames,", REPORT["video"]["width"], "x", REPORT["video"]["height"],
      "with", REPORT["render"]["gl"], "| GPU used:", REPORT["render"]["gpu_used"])
'''


def cell(kind: str, source: str) -> dict:
    base = {"cell_type": kind, "metadata": {}, "source": source.splitlines(keepends=True)}
    if kind == "code":
        base.update({"execution_count": None, "outputs": []})
    return base


def build() -> dict:
    return {
        "cells": [cell("markdown", INTRO), cell("code", SETUP), cell("code", HELPERS), cell("code", MAIN), cell("code", VERDICT)],
        "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}, "language_info": {"name": "python"}},
        "nbformat": 4, "nbformat_minor": 5,
    }


def render() -> str:
    return json.dumps(build(), indent=1) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    text = render()
    if args.check:
        if not TARGET.exists() or TARGET.read_text(encoding="utf-8") != text:
            print(f"{TARGET} is out of date; run scripts/build_animation_proof_notebook.py", file=sys.stderr)
            return 1
        return 0
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(text, encoding="utf-8")
    print(f"Wrote {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
