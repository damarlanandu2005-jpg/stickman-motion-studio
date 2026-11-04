"""Build kaggle/scene-batch/scene_batch.ipynb from kaggle/scene-batch/jobs.json: FLUX.2 klein 4B draws one full 9:16 scene picture per job, with costume reference pictures.

This is the generic scene generator (any topic): the planner writes jobs.json (id, prompt, refs, seed, size); the notebook is stamped with the jobs and the sha256 of every reference picture.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "kaggle" / "scene-batch" / "scene_batch.ipynb"

INTRO = """# Scene batch

klein draws one complete vertical scene per job, conditioned on costume reference pictures.
Every number in the report is measured; a failed picture is recorded, not hidden.
"""

SETUP = r'''import os, sys, json, time, subprocess, pathlib, hashlib, tarfile, traceback, uuid, urllib.request

RUN_ID = globals().get("RUN_ID", "manual-" + uuid.uuid4().hex)
RUN_TOKEN = globals().get("RUN_TOKEN", "manual")
COMMIT_SHA = globals().get("COMMIT_SHA", "unknown")
WORKFLOW_RUN_ID = globals().get("WORKFLOW_RUN_ID", "local")

OUT = pathlib.Path(os.environ.get("STICKMAN_OUT_DIR", "/kaggle/working/outputs"))  # override only for unit tests
WORK = pathlib.Path(os.environ.get("STICKMAN_WORK_DIR", "/tmp/scene_batch"))
LOGS = OUT / "logs"
for d in (OUT, LOGS, WORK):
    d.mkdir(parents=True, exist_ok=True)

REPO = "damarlanandu2005-jpg/stickman-motion-studio"
FALLBACK_REF = "test/image-to-3d-objects"
REFDIR = "animation/reference_art/"
REFS = __REFS__

KLEIN_ID, KLEIN_REVISION = "black-forest-labs/FLUX.2-klein-4B", "e7b7dc27f91deacad38e78976d1f2b499d76a294"
KLEIN_PIP = ["diffusers==0.42.1", "transformers==5.22.1", "huggingface-hub==1.33.0", "accelerate", "pillow"]
CACHE_ENV = {"HF_HOME": "/tmp/hf_home", "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True", "CUDA_VISIBLE_DEVICES": "0", "PYTHONUNBUFFERED": "1"}

JOBS = __JOBS__
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
                rp = Path(cfg["ds_map"][r]) if r.startswith("ds:") else Path(cfg["refdir"]) / r
                im = Image.open(rp).convert("RGB"); im.thumbnail((1024, 1024)); refs.append(im)
            torch.cuda.synchronize(); t = time.monotonic()
            kw = {"image": refs} if refs else {}  # object-only pictures use no reference, so no mascot face leaks onto objects
            img = pipe(prompt=job["prompt"], width=job["width"], height=job["height"], num_inference_steps=cfg["steps"],
                       guidance_scale=cfg["guidance"], generator=torch.Generator("cpu").manual_seed(job["seed"]), **kw).images[0]
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
        if name.startswith("ds:"):
            continue
        if sha256_of(folder / name) != digest:
            raise RuntimeError(f"reference picture {name} does not match the approved file (hash differs)")
    return folder


def find_input(flat_name):
    """A file of the mounted asset dataset, found by its (flat) name anywhere under /kaggle/input."""
    for root, _dirs, files in os.walk("/kaggle/input"):
        if flat_name in files:
            return os.path.join(root, flat_name)
    raise RuntimeError(f"asset dataset file {flat_name} not found under /kaggle/input (is the dataset attached to the notebook?)")


def dataset_refs():
    """ds:<flat name> references -> real paths, each checked against the hash the run was stamped with."""
    out = {}
    for name, digest in REFS.items():
        if name.startswith("ds:"):
            p = find_input(name[3:])
            if sha256_of(p) != digest:
                raise RuntimeError(f"dataset picture {name} does not match the approved file (hash differs)")
            out[name] = p
    return out


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
    cfg.write_text(json.dumps({"model_id": KLEIN_ID, "revision": KLEIN_REVISION, "refdir": str(reference), "ds_map": dataset_refs(), "jobs": JOBS,
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


JOBS_FILE = ROOT / "kaggle" / "scene-batch" / "jobs.json"


def stamped_setup() -> str:
    import hashlib
    jobs = json.loads(JOBS_FILE.read_text(encoding="utf-8"))
    refs = sorted({r for j in jobs["jobs"] for r in j["refs"]})
    def local(r: str) -> Path:
        if r.startswith("ds:"):      # a picture of the asset dataset: the same file, synced into the library folder
            return ROOT / "animation" / "asset_library" / r[3:].replace("__", "/")
        return ROOT / "animation" / "reference_art" / r
    shas = {r: hashlib.sha256(local(r).read_bytes()).hexdigest() for r in refs}
    table = {j["id"]: {"refs": j["refs"], "prompt": j["prompt"], "seed": j["seed"], "width": j.get("width", 576), "height": j.get("height", 1024)}
             for j in jobs["jobs"]}
    return SETUP.replace("__REFS__", json.dumps(shas, indent=1)).replace("__JOBS__", json.dumps(table, indent=1))


def build() -> dict:
    return {
        "cells": [cell("markdown", INTRO), cell("code", stamped_setup()), cell("code", f"KLEIN_STAGE = {KLEIN_STAGE!r}\n"),
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
            print(f"{TARGET} is out of date; run scripts/build_scene_batch_notebook.py", file=sys.stderr)
            return 1
        return 0
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(text, encoding="utf-8")
    print(f"Wrote {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
