"""Build kaggle/model-benchmark-klein4b/klein4b_benchmark.ipynb (FLUX.2 [klein] 4B on a Kaggle T4).

    python scripts/build_klein_benchmark_notebook.py          # rewrite
    python scripts/build_klein_benchmark_notebook.py --check  # exit 1 if out of date
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "kaggle" / "model-benchmark-klein4b" / "klein4b_benchmark.ipynb"

INTRO = """# Model benchmark: FLUX.2 [klein] 4B on a Kaggle T4

Measures one candidate model under the same conditions every time: fixed seeds, 576x1024 (9:16 for Shorts),
time per picture measured with `cuda.synchronize`, peak VRAM, peak RAM, download size and file hashes.

The T4 has fp16 tensor cores but no native bf16, so fp16 is tried first and bf16 only if the fp16 picture is broken.
A failed run still writes `benchmark_report.json` with `status: failed` and the error, and then ends in a notebook error.
Model weights live in `/tmp`; only the report, metadata and pictures are in `/kaggle/working/outputs`.
"""

SETUP = '''import os, sys, json, time, subprocess, pathlib, hashlib, re, shutil, traceback, uuid, resource, gc

RUN_ID = globals().get("RUN_ID", "manual-" + uuid.uuid4().hex)
RUN_TOKEN = globals().get("RUN_TOKEN", "manual")
COMMIT_SHA = globals().get("COMMIT_SHA", "unknown")
WORKFLOW_RUN_ID = globals().get("WORKFLOW_RUN_ID", "local")

OUT = pathlib.Path(os.environ.get("STICKMAN_OUT_DIR", "/kaggle/working/outputs"))  # override only for unit tests
OUT.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("HF_HOME", "/tmp/hf_home")
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

MODEL_ID = "black-forest-labs/FLUX.2-klein-4B"
MODEL_LICENSE = "Apache-2.0 (per the model card)"
PIP_PACKAGES = ["diffusers==0.42.1", "transformers==5.22.1", "huggingface-hub==1.33.0", "accelerate", "psutil"]
WIDTH, HEIGHT, STEPS, GUIDANCE = 576, 1024, 4, 1.0  # card: 4 steps, guidance 1.0 (distilled model)

CHAR = ("a friendly white stickman with a large round white head, thick dark outline, small oval black eyes, "
        "expressive eyebrows, simple thin stick arms and legs")
STYLE = "clean flat 2D vector cartoon illustration, soft muted colours, simple shading, clear readable composition"
CASES = [
    {"name": "astronaut_a", "seed": 20261101,
     "prompt": "A friendly white stickman astronaut standing on the moon, with a large round white head, thick dark outline, small oval eyes, expressive eyebrows, simple stick arms and legs, Earth visible in the background, clean flat vector cartoon illustration, soft muted colours, simple shading, clear readable composition."},
    {"name": "astronaut_b", "seed": 7,
     "prompt": "A friendly white stickman astronaut standing on the moon, with a large round white head, thick dark outline, small oval eyes, expressive eyebrows, simple stick arms and legs, Earth visible in the background, clean flat vector cartoon illustration, soft muted colours, simple shading, clear readable composition."},
    {"name": "titanic_deck", "seed": 11,
     "prompt": f"{CHAR}, standing at the rail of a ship deck at night looking up at an enormous ocean liner, calm sea, stars, {STYLE}."},
    {"name": "surprised", "seed": 23,
     "prompt": f"{CHAR}, showing a surprised expression with wide eyes and raised eyebrows, hands up, plain soft background, {STYLE}."},
]

REPORT = {
    "run_token": RUN_TOKEN, "run_id": RUN_ID, "commit_sha": COMMIT_SHA, "workflow_run_id": WORKFLOW_RUN_ID,
    "status": "running", "error_message": None, "model_id": MODEL_ID, "model_license": MODEL_LICENSE,
    "model_revision": None, "install_ok": False, "model_downloaded": False, "pipeline_loaded": False,
    "cuda_available": False, "torch_version": None, "python_version": sys.version, "gpu_names": [],
    "dtype_used": None, "dtype_attempts": [], "width": WIDTH, "height": HEIGHT, "steps": STEPS, "guidance_scale": GUIDANCE,
    "results": [],
}
STARTED = time.monotonic()
'''

HELPERS = '''def sh(cmd, **kw):
    return subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, **kw)


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(8 * 1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def gpu_used_mib():
    r = sh(["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"])
    try:
        return [int(x) for x in r.stdout.split()]
    except ValueError:
        return []


def peak_rss_gb():
    return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 / 1024, 2)


def install():
    r = sh([sys.executable, "-m", "pip", "install", "--no-cache-dir"] + PIP_PACKAGES)
    (OUT / "install.log").write_text(r.stdout, encoding="utf-8")
    if r.returncode:
        raise RuntimeError("pip install failed:\\n" + r.stdout[-3000:])
    import torch
    REPORT["torch_version"] = torch.__version__
    REPORT["cuda_available"] = bool(torch.cuda.is_available())
    count = torch.cuda.device_count() if torch.cuda.is_available() else 0
    REPORT["gpu_names"] = [torch.cuda.get_device_name(i) for i in range(count)]
    REPORT["gpu_total_vram_bytes"] = [int(torch.cuda.get_device_properties(i).total_memory) for i in range(count)]
    REPORT["disk_free_bytes_tmp"] = shutil.disk_usage("/tmp").free
    REPORT["note_gpu_use"] = "Only CUDA device 0 is used (model CPU offload); a second GPU is not used."
    if not REPORT["cuda_available"]:
        raise RuntimeError("CUDA is not available: enable the GPU accelerator.")
    import diffusers, transformers
    REPORT["library_versions"] = {"diffusers": diffusers.__version__, "transformers": transformers.__version__}
    REPORT["install_ok"] = True


def download():
    from huggingface_hub import HfApi, snapshot_download
    info = HfApi().model_info(MODEL_ID, files_metadata=True)
    REPORT["model_revision"] = info.sha
    files = []
    for s in info.siblings:
        lfs = getattr(s, "lfs", None)
        files.append({"file": s.rfilename, "bytes": s.size, "lfs_sha256": (lfs.get("sha256") if isinstance(lfs, dict) else getattr(lfs, "sha256", None))})
    started = time.monotonic()
    path = snapshot_download(MODEL_ID, revision=info.sha)
    seconds = round(time.monotonic() - started, 1)
    total = sum(f["bytes"] or 0 for f in files)
    meta = {"model_id": MODEL_ID, "revision": info.sha, "license": MODEL_LICENSE, "source_url": f"https://huggingface.co/{MODEL_ID}",
            "total_bytes": total, "download_seconds": seconds, "files": files, "card_license_tag": [t for t in (info.tags or []) if t.startswith("license")]}
    (OUT / "model_metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    REPORT["download_bytes"], REPORT["download_seconds"] = total, seconds
    REPORT["model_downloaded"] = True
    return path


def load(path, dtype_name):
    import torch
    from diffusers import Flux2KleinPipeline
    dtype = getattr(torch, dtype_name)
    started = time.monotonic()
    pipe = Flux2KleinPipeline.from_pretrained(path, torch_dtype=dtype)
    pipe.enable_model_cpu_offload(gpu_id=0)
    REPORT["pipeline_loaded"] = True
    REPORT["pipeline_load_seconds"] = round(time.monotonic() - started, 1)
    return pipe


def image_stats(img):
    import numpy as np
    a = np.asarray(img.convert("L"), dtype="float32")
    return {"mean": round(float(a.mean()), 1), "std": round(float(a.std()), 1)}


def draw(pipe, case, dtype_name):
    import torch
    torch.cuda.synchronize()
    torch.cuda.reset_peak_memory_stats()
    before = gpu_used_mib()
    started = time.monotonic()
    gen = torch.Generator(device="cpu").manual_seed(case["seed"])
    image = pipe(prompt=case["prompt"], width=WIDTH, height=HEIGHT, num_inference_steps=STEPS,
                 guidance_scale=GUIDANCE, generator=gen).images[0]
    torch.cuda.synchronize()
    seconds = round(time.monotonic() - started, 2)
    stats = image_stats(image)
    path = OUT / f"klein4b_{case['name']}.png"
    image.save(path)
    return {"case": case["name"], "seed": case["seed"], "dtype": dtype_name, "seconds": seconds,
            "peak_vram_allocated_gib_torch": round(torch.cuda.max_memory_allocated() / 2**30, 2),
            "gpu_used_mib_before": before, "gpu_used_mib_after": gpu_used_mib(),
            "peak_process_rss_gb": peak_rss_gb(), "file": path.name, "image_width": image.size[0], "image_height": image.size[1],
            "image_sha256": sha256_of(path), "stats": stats, "looks_broken": stats["std"] < 8 or stats["mean"] < 6}
'''

MAIN = '''try:
    install()
    model_path = download()
    chosen = None
    for dtype_name in ("float16", "bfloat16"):
        pipe = load(model_path, dtype_name)
        first = draw(pipe, CASES[0], dtype_name)
        REPORT["dtype_attempts"].append({"dtype": dtype_name, "looks_broken": first["looks_broken"], "seconds": first["seconds"]})
        if not first["looks_broken"]:
            chosen = dtype_name
            REPORT["results"].append({**first, "is_first_call_includes_warmup": True})
            break
        del pipe
        gc.collect()
        import torch
        torch.cuda.empty_cache()
    if chosen is None:
        raise RuntimeError("Both fp16 and bf16 produced a broken (flat/black) picture for the first case.")
    REPORT["dtype_used"] = chosen
    for case in CASES[1:]:
        REPORT["results"].append(draw(pipe, case, chosen))
    timed = [r["seconds"] for r in REPORT["results"][1:]]
    REPORT["seconds_per_picture_after_warmup_mean"] = round(sum(timed) / len(timed), 2)
    REPORT["all_pictures_ok"] = all(not r["looks_broken"] for r in REPORT["results"])
    REPORT["status"] = "success" if REPORT["all_pictures_ok"] else "failed"
    if not REPORT["all_pictures_ok"]:
        REPORT["error_message"] = "At least one picture looks broken (flat or black)."
except Exception as exc:
    REPORT["status"] = "failed"
    REPORT["error_message"] = f"{type(exc).__name__}: {exc}"
    traceback.print_exc()
finally:
    REPORT["notebook_duration_seconds"] = round(time.monotonic() - STARTED, 2)
    (OUT / "benchmark_report.json").write_text(json.dumps(REPORT, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in REPORT.items() if k not in ("gpu_total_vram_bytes",)}, indent=2))
'''

SHOW = '''from IPython.display import display, Image as IPyImage
for p in sorted(OUT.glob("klein4b_*.png")):
    print(p.name)
    display(IPyImage(filename=str(p), width=288))
'''

VERDICT = '''assert REPORT["status"] == "success", "Benchmark failed: " + str(REPORT["error_message"])
print("PASS: klein 4B produced", len(REPORT["results"]), "pictures with dtype", REPORT["dtype_used"])
'''


def cell(kind: str, source: str) -> dict:
    base = {"cell_type": kind, "metadata": {}, "source": source.splitlines(keepends=True)}
    if kind == "code":
        base.update({"execution_count": None, "outputs": []})
    return base


def build() -> dict:
    return {
        "cells": [cell("markdown", INTRO), cell("code", SETUP), cell("code", HELPERS), cell("code", MAIN),
                  cell("code", SHOW), cell("code", VERDICT)],
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
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    if args.check:
        if not TARGET.exists() or TARGET.read_text(encoding="utf-8") != text:
            print(f"{TARGET} is out of date; run scripts/build_klein_benchmark_notebook.py", file=sys.stderr)
            return 1
        return 0
    TARGET.write_text(text, encoding="utf-8")
    print(f"Wrote {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
