"""Build kaggle/astronaut-poses/astronaut_poses.ipynb: draw the stickman in his space costume in many poses.

FLUX.2 klein 4B (pinned) gets the approved costume picture (animation/reference_art/costume_astronaut.png) as an image
reference and draws the same character in each pose (walk cycle, run, jump, sit, fall, point, wave, float ...), two
seeds per pose so a bad drawing can be replaced. The notebook only draws; cutting out, scaling and checking happen
in plain code afterwards (motion_studio/poses.py) and a human picks the final pose files.

    python scripts/build_astronaut_poses_notebook.py          # rewrite
    python scripts/build_astronaut_poses_notebook.py --check  # exit 1 if out of date
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "kaggle" / "astronaut-poses" / "astronaut_poses.ipynb"

INTRO = """# Astronaut stickman poses

klein draws the approved space-costume character in many poses, using the costume picture as an image reference.
Every number in the report is measured; a failed picture is recorded, not hidden.
"""

SETUP = r'''import os, sys, json, time, subprocess, pathlib, hashlib, tarfile, traceback, uuid, urllib.request

RUN_ID = globals().get("RUN_ID", "manual-" + uuid.uuid4().hex)
RUN_TOKEN = globals().get("RUN_TOKEN", "manual")
COMMIT_SHA = globals().get("COMMIT_SHA", "unknown")
WORKFLOW_RUN_ID = globals().get("WORKFLOW_RUN_ID", "local")

OUT = pathlib.Path(os.environ.get("STICKMAN_OUT_DIR", "/kaggle/working/outputs"))  # override only for unit tests
WORK = pathlib.Path(os.environ.get("STICKMAN_WORK_DIR", "/tmp/astronaut_poses"))
LOGS = OUT / "logs"
for d in (OUT, LOGS, WORK):
    d.mkdir(parents=True, exist_ok=True)

REPO = "damarlanandu2005-jpg/stickman-motion-studio"
FALLBACK_REF = "test/image-to-3d-objects"
REFERENCE = "animation/reference_art/costume_astronaut.png"
REFERENCE_SHA256 = "727c42aab50eee50040b7811325a52094fde063d3e628f9f0e8a3344ab2f7db0"

KLEIN_ID, KLEIN_REVISION = "black-forest-labs/FLUX.2-klein-4B", "e7b7dc27f91deacad38e78976d1f2b499d76a294"
KLEIN_PIP = ["diffusers==0.42.1", "transformers==5.22.1", "huggingface-hub==1.33.0", "accelerate", "pillow"]
CACHE_ENV = {"HF_HOME": "/tmp/hf_home", "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True", "CUDA_VISIBLE_DEVICES": "0", "PYTHONUNBUFFERED": "1"}

BASE = ("The exact same cartoon astronaut character as in the reference image: round white head with a simple face inside a "
        "clear helmet with a blue visor, white spacesuit with grey details, small chest control panel, black gloves, white boots. "
        "Same flat 2D cartoon style with thick clean black outlines. The whole body is fully visible from helmet to boots with "
        "empty margin around it, plain pure white background, no ground, no shadow, no text, one character only. ")
POSES = {
    "stand": "Standing relaxed, front view, arms hanging down.",
    "walk_1": "Side view facing right, walking. Contact pose: the right leg is stretched far forward with the heel down, the left leg is behind with the toe down, the arms swing opposite to the legs.",
    "walk_2": "Side view facing right, walking. Passing pose: standing on one straight leg while the other knee is lifted and bent, body slightly higher, arms close to the body.",
    "walk_3": "Side view facing right, walking. Contact pose: the left leg is stretched far forward with the heel down, the right leg is behind with the toe down, the arms swing opposite to the legs.",
    "walk_4": "Side view facing right, walking. Passing pose: standing on the other straight leg while the opposite knee is lifted and bent forward, body slightly higher.",
    "run_1": "Side view facing right, running fast, leaning forward, one knee high, both arms bent and pumping.",
    "run_2": "Side view facing right, running fast, in the air with both feet off the ground, one leg stretched back, arms pumping.",
    "crouch": "Side view facing right, crouching low with bent knees and arms swung back, about to jump.",
    "jump": "Side view facing right, jumping high in the air, both arms raised up, knees bent, feet off the ground.",
    "sit": "Side view facing right, sitting on the ground with the legs stretched forward and the hands resting beside the body.",
    "fall": "Side view facing right, falling over backwards, arms flailing, legs in the air, surprised.",
    "point": "Side view facing right, standing and pointing forward with one straight arm, the other arm down.",
    "wave": "Front view, standing and waving hello with one raised arm, friendly.",
    "surprised": "Front view, standing with both hands raised next to the helmet in surprise, mouth open.",
    "float": "Floating weightless in space, relaxed, arms and legs spread out slightly, three-quarter view.",
}
SEEDS = [4201, 4202]
WIDTH, HEIGHT, STEPS, GUIDANCE = 768, 1152, 4, 1.0

REPORT = {
    "run_token": RUN_TOKEN, "run_id": RUN_ID, "commit_sha": COMMIT_SHA, "workflow_run_id": WORKFLOW_RUN_ID,
    "status": "running", "error_message": None, "poses": list(POSES), "seeds": SEEDS, "reference": REFERENCE,
    "environment": {}, "klein": {}, "files": [],
}
STARTED = time.monotonic()
'''

KLEIN_STAGE = r'''import json, sys, time, hashlib, traceback
from pathlib import Path
cfg = json.loads(Path(sys.argv[1]).read_text())
res = {"stage": "klein", "status": "running", "error": None, "pictures": []}
try:
    import torch
    from PIL import Image
    from huggingface_hub import snapshot_download
    from diffusers import Flux2KleinPipeline
    t = time.monotonic(); path = snapshot_download(cfg["model_id"], revision=cfg["revision"])
    res["download_seconds"] = round(time.monotonic() - t, 1)
    t = time.monotonic(); pipe = Flux2KleinPipeline.from_pretrained(path, torch_dtype=torch.float16)
    pipe.enable_model_cpu_offload(gpu_id=0); res["load_seconds"] = round(time.monotonic() - t, 1)
    ref = Image.open(cfg["reference"]).convert("RGB").resize((cfg["width"], cfg["height"]), Image.LANCZOS)
    out = Path(cfg["out_dir"]); out.mkdir(parents=True, exist_ok=True)
    for name, text in cfg["poses"].items():
        for seed in cfg["seeds"]:
            item = {"pose": name, "seed": seed, "status": "running"}
            res["pictures"].append(item)
            try:
                torch.cuda.synchronize(); t = time.monotonic()
                img = pipe(prompt=cfg["base"] + text, image=ref, width=cfg["width"], height=cfg["height"], num_inference_steps=cfg["steps"],
                           guidance_scale=cfg["guidance"], generator=torch.Generator("cpu").manual_seed(seed)).images[0]
                torch.cuda.synchronize(); secs = round(time.monotonic() - t, 2)
                p = out / f"pose_{name}_s{seed}.png"; img.save(p)
                item.update({"file": p.name, "seconds": secs, "width": img.width, "height": img.height,
                             "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "status": "success"})
                print("klein drew", p.name, "in", secs, "s", flush=True)
            except Exception as exc:  # one bad picture must not stop the rest
                item.update({"status": "failed", "error": f"{type(exc).__name__}: {exc}"[:500]}); traceback.print_exc()
    res["peak_vram_gib"] = round(torch.cuda.max_memory_allocated() / 2**30, 2)
    res["status"] = "success" if all(i["status"] == "success" for i in res["pictures"]) else "partial"
except Exception as exc:
    res["status"] = "failed"; res["error"] = f"{type(exc).__name__}: {exc}"[:3000]; traceback.print_exc()
Path(cfg["result"]).write_text(json.dumps(res, indent=2))
'''

HELPERS = r'''def run_logged(name, cmd, timeout):
    log = LOGS / f"{name}.log"
    t = time.monotonic()
    try:
        with log.open("a") as fh:
            fh.write("$ " + " ".join(map(str, cmd)) + "\n"); fh.flush()
            code = subprocess.run(cmd, stdout=fh, stderr=subprocess.STDOUT, timeout=timeout, env={**os.environ, **CACHE_ENV}).returncode
        outcome = "ok" if code == 0 else f"exit {code}"
    except subprocess.TimeoutExpired:
        code, outcome = None, f"timed out after {timeout} s"
    print(f"[{name}] {outcome} in {round(time.monotonic() - t, 1)} s", flush=True)
    return code == 0


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def fetch_reference():
    ref = COMMIT_SHA if len(COMMIT_SHA) == 40 else FALLBACK_REF
    tgz = WORK / "repo.tar.gz"
    urllib.request.urlretrieve(f"https://codeload.github.com/{REPO}/tar.gz/{ref}", tgz)
    with tarfile.open(tgz) as tf:
        tf.extractall(WORK / "repo", filter="data")
    path = next((WORK / "repo").iterdir()) / REFERENCE
    if sha256_of(path) != REFERENCE_SHA256:
        raise RuntimeError("costume reference picture does not match the approved file (hash differs)")
    return path


def environment():
    import torch
    env = REPORT["environment"]
    env["python"] = sys.version.split()[0]
    env["torch"] = torch.__version__
    env["cuda_available"] = bool(torch.cuda.is_available())
    env["gpu_names"] = [torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())] if torch.cuda.is_available() else []
    if not env["cuda_available"]:
        raise RuntimeError("CUDA is not available: enable the GPU accelerator.")
'''

MAIN = r'''try:
    environment()
    reference = fetch_reference()
    if not run_logged("install_klein", [sys.executable, "-m", "pip", "install", "--no-cache-dir", *KLEIN_PIP], 1200):
        raise RuntimeError("klein dependencies failed to install; see logs/install_klein.log")
    script, cfg, result = WORK / "klein_stage.py", WORK / "klein_stage.json", OUT / "result_klein.json"
    script.write_text(KLEIN_STAGE, encoding="utf-8")
    cfg.write_text(json.dumps({"model_id": KLEIN_ID, "revision": KLEIN_REVISION, "reference": str(reference), "poses": POSES, "base": BASE,
                               "seeds": SEEDS, "width": WIDTH, "height": HEIGHT, "steps": STEPS, "guidance": GUIDANCE,
                               "result": str(result), "out_dir": str(OUT)}), encoding="utf-8")
    run_logged("klein", [sys.executable, str(script), str(cfg)], 3000)
    if not result.exists():
        raise RuntimeError("klein wrote no result; see logs/klein.log")
    REPORT["klein"] = json.loads(result.read_text(encoding="utf-8"))
    REPORT["files"] = [p["file"] for p in REPORT["klein"]["pictures"] if p.get("status") == "success"]
    if REPORT["klein"]["status"] == "failed":
        raise RuntimeError("klein failed: " + str(REPORT["klein"].get("error")))
    REPORT["status"] = "completed"  # per-picture success is in REPORT["klein"]["pictures"]
except Exception as exc:
    REPORT["status"] = "failed"
    REPORT["error_message"] = f"{type(exc).__name__}: {exc}"
    traceback.print_exc()
finally:
    REPORT["notebook_duration_seconds"] = round(time.monotonic() - STARTED, 1)
    (OUT / "poses_report.json").write_text(json.dumps(REPORT, indent=2), encoding="utf-8")
    print(json.dumps({k: REPORT[k] for k in ("status", "error_message", "files", "notebook_duration_seconds")}, indent=2))
'''

VERDICT = r'''assert REPORT["status"] == "completed", "Poses did not complete: " + str(REPORT["error_message"])
print("Drew", len(REPORT["files"]), "of", len(POSES) * len(SEEDS), "pictures")
'''


def cell(kind: str, source: str) -> dict:
    base = {"cell_type": kind, "metadata": {}, "source": source.splitlines(keepends=True)}
    if kind == "code":
        base.update({"execution_count": None, "outputs": []})
    return base


def build() -> dict:
    return {
        "cells": [cell("markdown", INTRO), cell("code", SETUP), cell("code", f"KLEIN_STAGE = {KLEIN_STAGE!r}\n"),
                  cell("code", HELPERS), cell("code", MAIN), cell("code", VERDICT)],
        "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
                     "language_info": {"name": "python"}},
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
            print(f"{TARGET} is out of date; run scripts/build_astronaut_poses_notebook.py", file=sys.stderr)
            return 1
        return 0
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(text, encoding="utf-8")
    print(f"Wrote {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
