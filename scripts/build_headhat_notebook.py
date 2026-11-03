"""Build kaggle/head-hat-test/head_hat_test.ipynb: can klein draw a stickman head WEARING a hat, in many expressions?

FLUX.2 klein 4B (pinned) gets the owner's bare-head pictures and a hat picture as image references and draws the same
head wearing the hat. Test A: a whole 4 x 5 sheet of 20 heads in one picture. Test B: single heads with a named
expression. Measured only; whether the hat fits is judged by looking at the pictures afterwards.

    python scripts/build_head_hat_test_notebook.py          # rewrite
    python scripts/build_head_hat_test_notebook.py --check  # exit 1 if out of date
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "kaggle" / "head-hat-test" / "head_hat_test.ipynb"

INTRO = """# Stickman head with hat test

klein draws the owner's stickman head wearing a hat, using bare-head and hat pictures as image references.
Every number in the report is measured; a failed picture is recorded, not hidden.
"""

SETUP = r'''import os, sys, json, time, subprocess, pathlib, hashlib, tarfile, traceback, uuid, urllib.request

RUN_ID = globals().get("RUN_ID", "manual-" + uuid.uuid4().hex)
RUN_TOKEN = globals().get("RUN_TOKEN", "manual")
COMMIT_SHA = globals().get("COMMIT_SHA", "unknown")
WORKFLOW_RUN_ID = globals().get("WORKFLOW_RUN_ID", "local")

OUT = pathlib.Path(os.environ.get("STICKMAN_OUT_DIR", "/kaggle/working/outputs"))  # override only for unit tests
WORK = pathlib.Path(os.environ.get("STICKMAN_WORK_DIR", "/tmp/head_hat_test"))
LOGS = OUT / "logs"
for d in (OUT, LOGS, WORK):
    d.mkdir(parents=True, exist_ok=True)

REPO = "damarlanandu2005-jpg/stickman-motion-studio"
FALLBACK_REF = "test/image-to-3d-objects"
REFDIR = "animation/reference_art/headhat/"
REFS = {"heads_20.png": "18d24f9fd1afcccbf2c3f86122400f4fe20e522ece0fd6cb8f1332cface95c6d", "head_neutral.png": "9a6996322895f603761ed2bdfd85bbaa15149e4fbdce8863adc20ca4da46d064",
        "hat_explorer.png": "c47d32322533c5c0d5f88391dacfee06ce3d3a96f0970205faadba81c099351b", "hat_sailor.png": "9b1c13bdd855eb36c44bf8127ab24cb1656570027133c4570d4d49004eab3104",
        "hat_astro.png": "684326cef6581ef9e6d92eb5e1d0e0a2533af4dbf3306ce3e0a7b415a5403c3e"}

KLEIN_ID, KLEIN_REVISION = "black-forest-labs/FLUX.2-klein-4B", "e7b7dc27f91deacad38e78976d1f2b499d76a294"
KLEIN_PIP = ["diffusers==0.42.1", "transformers==5.22.1", "huggingface-hub==1.33.0", "accelerate", "pillow"]
CACHE_ENV = {"HF_HOME": "/tmp/hf_home", "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True", "CUDA_VISIBLE_DEVICES": "0", "PYTHONUNBUFFERED": "1"}

SHEET = ("Use the first reference image as the exact style and the exact 20 faces: the same 4 x 5 grid, the same order, the same bare "
         "round white heads with thick black outlines. Draw the same 20 heads, but every head WEARS the hat shown in the second "
         "reference image. The hat sits snugly on top of the head, its edges touching the head outline with no gap at the sides, and it "
         "looks identical in all 20 cells: same size, same angle, same position. The head circle stays the same size and position in "
         "every cell. Pure white background, wide white gaps, no frame lines, no text, no marks. Head and hat only, no neck, no body.")
SINGLE = ("Draw ONE stickman head: the same bare round white head with thick black outline from the first reference image, WEARING the "
          "hat shown in the second reference image. The hat sits snugly on top of the head, edges touching the head outline, no gap at the "
          "sides. Same flat 2D cartoon style. The head is a perfect round circle, the same size every time. Facial expression: {expr}. Centered, pure white background, no neck, no body, no text.")
EXPR = {"neutral": "calm neutral, small straight mouth, soft brows", "happy": "big happy open-mouth smile, brows raised",
        "angry": "angry, brows slanted down, gritted teeth", "scared": "scared, tiny eyes, wavy mouth, one sweat drop",
        "sad": "sad, small frown, brows slanted up in the middle", "surprised": "surprised, big round eyes, small round open mouth",
        "smug": "smug, half-closed eyes, one brow up, small smirk", "laugh": "laughing, eyes closed as curves, wide open mouth"}
HATS = {"explorer": "hat_explorer.png", "astro": "hat_astro.png", "sailor": "hat_sailor.png"}
JOBS = {}
for hat, hf in HATS.items():
    for ex, text in EXPR.items():
        JOBS[f"consist_{hat}_{ex}"] = {"refs": ["head_neutral.png", hf], "prompt": SINGLE.format(expr=text), "seed": 4311, "width": 768, "height": 768}
STEPS, GUIDANCE = 4, 1.0

REPORT = {
    "run_token": RUN_TOKEN, "run_id": RUN_ID, "commit_sha": COMMIT_SHA, "workflow_run_id": WORKFLOW_RUN_ID,
    "status": "running", "error_message": None, "poses": list(JOBS), "seeds": [0], "reference": REFDIR,
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
    out = Path(cfg["out_dir"]); out.mkdir(parents=True, exist_ok=True)
    for name, job in cfg["jobs"].items():
        item = {"pose": name, "seed": job["seed"], "status": "running"}
        res["pictures"].append(item)
        try:
            refs = []
            for r in job["refs"]:
                im = Image.open(Path(cfg["refdir"]) / r).convert("RGB"); im.thumbnail((1024, 1024)); refs.append(im)
            torch.cuda.synchronize(); t = time.monotonic()
            img = pipe(prompt=job["prompt"], image=refs, width=job["width"], height=job["height"], num_inference_steps=cfg["steps"],
                       guidance_scale=cfg["guidance"], generator=torch.Generator("cpu").manual_seed(job["seed"])).images[0]
            torch.cuda.synchronize(); secs = round(time.monotonic() - t, 2)
            p = out / f"pose_{name}.png"; img.save(p)
            item.update({"file": p.name, "seconds": secs, "width": img.width, "height": img.height,
                         "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "status": "success"})
            print("klein drew", p.name, "in", secs, "s", flush=True)
        except Exception as exc:  # one bad picture must not stop the rest
            item.update({"status": "failed", "error": f"{type(exc).__name__}: {exc}"[:500]}); traceback.print_exc()
            try:
                torch.cuda.empty_cache()
            except Exception:
                pass
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
    folder = next((WORK / "repo").iterdir()) / REFDIR
    for name, digest in REFS.items():
        if sha256_of(folder / name) != digest:
            raise RuntimeError(f"reference picture {name} does not match the approved file (hash differs)")
    return folder


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
    cfg.write_text(json.dumps({"model_id": KLEIN_ID, "revision": KLEIN_REVISION, "refdir": str(reference), "jobs": JOBS,
                               "steps": STEPS, "guidance": GUIDANCE,
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
print("Drew", len(REPORT["files"]), "of", len(JOBS), "pictures")
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
            print(f"{TARGET} is out of date; run scripts/build_head_hat_test_notebook.py", file=sys.stderr)
            return 1
        return 0
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(text, encoding="utf-8")
    print(f"Wrote {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
