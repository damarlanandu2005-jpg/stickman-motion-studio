"""Build kaggle/image-generation-smoke-test/image_generation_smoke_test.ipynb.

The notebook is generated so its cell sources can be unit-tested (every code cell must
parse) and so the committed .ipynb can be checked for drift:

    python scripts/build_image_smoke_notebook.py          # rewrite the notebook
    python scripts/build_image_smoke_notebook.py --check  # exit 1 if it is out of date
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "kaggle" / "image-generation-smoke-test" / "image_generation_smoke_test.ipynb"

INTRO = """# Stickman Motion Studio: real image-generation smoke test

Installs a **pinned** ComfyUI, downloads a pinned Stable Diffusion 1.5 FP16 checkpoint, verifies its SHA-256,
generates one image through the ComfyUI HTTP API (`/prompt`, `/history`, `/view`) and validates the PNG.

Every success field in `generation_report.json` is set only at the moment the matching event is observed.
If anything fails the report is still written (status `failed`, with `error_message`) and the notebook ends in an error,
so a failed run can never look like a pass. Output files are written to `/kaggle/working/outputs/`;
ComfyUI and the 2 GB checkpoint live in `/tmp` so they are not part of the downloaded output.

SD 1.5 is a baseline for proving the pipeline, not the production model.
"""

SETUP = '''import os, sys, json, time, subprocess, pathlib, hashlib, re, shutil, urllib.request, urllib.error, urllib.parse, platform, traceback, uuid

# Injected by the Kaggle execution manager (first notebook cell). Defaults keep the notebook runnable by hand.
RUN_ID = globals().get("RUN_ID", "manual-" + uuid.uuid4().hex)
RUN_TOKEN = globals().get("RUN_TOKEN", "manual")
COMMIT_SHA = globals().get("COMMIT_SHA", "unknown")
WORKFLOW_RUN_ID = globals().get("WORKFLOW_RUN_ID", "local")

OUT = pathlib.Path(os.environ.get("STICKMAN_OUT_DIR", "/kaggle/working/outputs"))  # override only for unit tests
OUT.mkdir(parents=True, exist_ok=True)
WORK = pathlib.Path("/tmp/comfyui_run")
COMFY = WORK / "ComfyUI"
BASE = "http://127.0.0.1:8188"

COMFYUI_REPO = "https://github.com/comfyanonymous/ComfyUI.git"
COMFYUI_COMMIT = "423cbd20511becb1f16122ab518e92e58bfa03d9"  # tag v0.43.2
MODEL_ID = "Comfy-Org/stable-diffusion-v1-5-archive"
MODEL_REVISION = "82ddc01b8d77adc5b4a7c6b5e8f2ddf1a6fe0c08"
MODEL_FILE = "v1-5-pruned-emaonly-fp16.safetensors"
MODEL_URL = f"https://huggingface.co/{MODEL_ID}/resolve/{MODEL_REVISION}/{MODEL_FILE}"
MODEL_SHA256 = "e9476a13728cd75d8279f6ec8bad753a66a1957ca375a1464dc63b37db6e3916"
MODEL_LICENSE = "CreativeML OpenRAIL-M (review use restrictions before commercial production use)"

PROMPT = ("A friendly white stickman astronaut standing on the moon, with a large round white head, thick dark outline, "
          "small oval eyes, expressive eyebrows, simple stick arms and legs, Earth visible in the background, "
          "clean flat vector cartoon illustration, soft muted colours, simple shading, clear readable composition.")
NEGATIVE = "photorealistic, 3D render, multiple heads, extra limbs, distorted face, text, watermark, logo, duplicate characters, blurry image."
SEED, WIDTH, HEIGHT, STEPS, CFG = 20261101, 512, 512, 20, 7.0

WORKFLOW = {
    "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": MODEL_FILE}},
    "2": {"class_type": "CLIPTextEncode", "inputs": {"text": PROMPT, "clip": ["1", 1]}},
    "3": {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE, "clip": ["1", 1]}},
    "4": {"class_type": "EmptyLatentImage", "inputs": {"width": WIDTH, "height": HEIGHT, "batch_size": 1}},
    "5": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0],
          "latent_image": ["4", 0], "seed": SEED, "steps": STEPS, "cfg": CFG, "sampler_name": "euler",
          "scheduler": "normal", "denoise": 1.0}},
    "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
    "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": "stickman_smoke"}},
}
REQUIRED_NODES = sorted({n["class_type"] for n in WORKFLOW.values()})

# Every field starts as "not observed". Code below sets a field only when the event really happened.
REPORT = {
    "run_token": RUN_TOKEN, "run_id": RUN_ID, "commit_sha": COMMIT_SHA, "workflow_run_id": WORKFLOW_RUN_ID,
    "prompt_id": None, "status": "running",
    "comfyui_started": False, "api_system_stats_ok": False, "api_object_info_ok": False,
    "generation_submitted": False, "generation_completed": False, "image_downloaded": False, "image_valid": False,
    "image_width": None, "image_height": None, "image_sha256": None, "generation_duration_seconds": None,
    "model_id": MODEL_ID, "model_revision": MODEL_REVISION, "model_license": MODEL_LICENSE, "model_sha256": None,
    "gpu_names": [], "cuda_available": False, "torch_version": None, "python_version": sys.version,
    "error_message": None,
    "seed": SEED, "steps": STEPS, "cfg": CFG, "comfyui_commit_requested": COMFYUI_COMMIT,
}
STARTED = time.monotonic()
'''

HELPERS = '''def sh(cmd, **kw):
    return subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, **kw)


def get_json(path, timeout=30):
    with urllib.request.urlopen(BASE + path, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(8 * 1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def gpu_memory_used_mib():
    r = sh(["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"])
    try:
        return [int(x) for x in r.stdout.split()]
    except ValueError:
        return []


def detect_hardware():
    import torch
    REPORT["torch_version"] = torch.__version__
    REPORT["cuda_available"] = bool(torch.cuda.is_available())
    REPORT["cuda_version"] = torch.version.cuda
    count = torch.cuda.device_count() if torch.cuda.is_available() else 0
    REPORT["gpu_count"] = count
    REPORT["gpu_names"] = [torch.cuda.get_device_name(i) for i in range(count)]
    REPORT["gpu_total_vram_bytes"] = [int(torch.cuda.get_device_properties(i).total_memory) for i in range(count)]
    REPORT["gpu_free_vram_bytes_at_start"] = [int(torch.cuda.mem_get_info(i)[0]) for i in range(count)]
    usage = shutil.disk_usage("/tmp")
    REPORT["disk_free_bytes_tmp"] = usage.free
    REPORT["disk_free_bytes_working"] = shutil.disk_usage("/kaggle/working").free
    REPORT["note_gpu_use"] = "ComfyUI is pinned to CUDA device 0 only; a second GPU is not used for this test."
    if not REPORT["cuda_available"]:
        raise RuntimeError("CUDA is not available: enable the GPU accelerator for this notebook.")


def install_comfyui():
    WORK.mkdir(parents=True, exist_ok=True)
    install_log = OUT / "install.log"
    with install_log.open("w") as log:
        if not (COMFY / ".git").exists():
            COMFY.mkdir(parents=True, exist_ok=True)
            for cmd in (["git", "init"], ["git", "remote", "add", "origin", COMFYUI_REPO],
                        ["git", "fetch", "--depth", "1", "origin", COMFYUI_COMMIT], ["git", "checkout", "--detach", "FETCH_HEAD"]):
                r = sh(cmd, cwd=COMFY)
                log.write("$ " + " ".join(cmd) + "\\n" + r.stdout + "\\n")
                if r.returncode:
                    raise RuntimeError("git step failed: " + " ".join(cmd) + "\\n" + r.stdout[-2000:])
        head = sh(["git", "rev-parse", "HEAD"], cwd=COMFY).stdout.strip()
        REPORT["comfyui_commit"] = head
        if head != COMFYUI_COMMIT:
            raise RuntimeError(f"ComfyUI checkout is {head}, expected pinned {COMFYUI_COMMIT}")
        skip = {"torch", "torchvision", "torchaudio"}
        keep = []
        for line in (COMFY / "requirements.txt").read_text(encoding="utf-8").splitlines():
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            name = re.match(r"^([A-Za-z0-9_.-]+)", s)
            if name and name.group(1).lower().replace("_", "-") in skip:
                continue
            keep.append(line)
        req = WORK / "requirements.filtered.txt"
        req.write_text("\\n".join(keep) + "\\n", encoding="utf-8")
        before = sh([sys.executable, "-c", "import torch;print(torch.__version__)"]).stdout.strip()
        r = sh([sys.executable, "-m", "pip", "install", "--no-cache-dir", "-r", str(req)])
        log.write(r.stdout)
        if r.returncode:
            raise RuntimeError("pip install failed:\\n" + r.stdout[-3000:])
        after = sh([sys.executable, "-c", "import torch;print(torch.__version__, torch.cuda.is_available())"]).stdout.strip()
        log.write(f"\\ntorch before: {before}\\ntorch after: {after}\\n")
        REPORT["torch_before_install"], REPORT["torch_after_install"] = before, after
        if not after.endswith("True"):
            raise RuntimeError("CUDA was lost after installing ComfyUI requirements: " + after)


def download_model():
    ckpt_dir = COMFY / "models" / "checkpoints"
    ckpt_dir.mkdir(parents=True, exist_ok=True)
    path = ckpt_dir / MODEL_FILE
    started = time.monotonic()
    if not path.exists():
        import requests
        part = path.with_suffix(".part")
        with requests.get(MODEL_URL, stream=True, timeout=(30, 180)) as r:
            r.raise_for_status()
            with part.open("wb") as f:
                for chunk in r.iter_content(chunk_size=8 * 1024 * 1024):
                    f.write(chunk)
        part.replace(path)
    seconds = round(time.monotonic() - started, 2)
    actual = sha256_of(path)
    REPORT["model_sha256"] = actual
    meta = {"model_id": MODEL_ID, "revision": MODEL_REVISION, "file": MODEL_FILE, "source_url": MODEL_URL,
            "license": MODEL_LICENSE, "expected_sha256": MODEL_SHA256, "actual_sha256": actual,
            "sha256_matches": actual == MODEL_SHA256, "bytes": path.stat().st_size, "download_seconds": seconds}
    (OUT / "model_metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    if actual != MODEL_SHA256:
        raise RuntimeError(f"Model SHA-256 mismatch: got {actual}, expected {MODEL_SHA256}")


def start_server():
    log_file = (OUT / "comfyui_server.log").open("w")
    proc = subprocess.Popen([sys.executable, "main.py", "--listen", "127.0.0.1", "--port", "8188", "--cuda-device", "0"],
                            cwd=COMFY, stdout=log_file, stderr=subprocess.STDOUT)
    stats = None
    deadline = time.monotonic() + 300
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f"ComfyUI exited early with code {proc.returncode}; see comfyui_server.log")
        try:
            stats = get_json("/system_stats", timeout=5)
            break
        except Exception:
            time.sleep(3)
    if stats is None:
        raise RuntimeError("ComfyUI API did not answer /system_stats within 300 s")
    REPORT["comfyui_started"] = True
    REPORT["api_system_stats_ok"] = True
    REPORT["comfyui_version"] = stats.get("system", {}).get("comfyui_version")
    info = get_json("/object_info", timeout=120)
    REPORT["api_object_info_ok"] = bool(info)
    REPORT["installed_node_type_count"] = len(info)
    missing = [n for n in REQUIRED_NODES if n not in info]
    if missing:
        raise RuntimeError(f"ComfyUI is missing required node types: {missing}")
    return proc, log_file


def generate():
    (OUT / "workflow_api.json").write_text(json.dumps(WORKFLOW, indent=2), encoding="utf-8")
    started = time.monotonic()
    body = json.dumps({"prompt": WORKFLOW, "client_id": "stickman-" + RUN_ID}).encode()
    req = urllib.request.Request(BASE + "/prompt", data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            submitted = json.loads(r.read().decode())
    except urllib.error.HTTPError as exc:
        raise RuntimeError("ComfyUI rejected the workflow: " + exc.read().decode(errors="replace")[:2000])
    prompt_id = submitted.get("prompt_id")
    if not prompt_id:
        raise RuntimeError("ComfyUI returned no prompt_id: " + json.dumps(submitted)[:1000])
    REPORT["prompt_id"] = prompt_id
    REPORT["generation_submitted"] = True
    peak = []
    entry = None
    deadline = time.monotonic() + 900
    while time.monotonic() < deadline:
        used = gpu_memory_used_mib()
        peak = [max(a, b) for a, b in zip(peak or used, used)] if used else peak
        hist = get_json("/history/" + urllib.parse.quote(prompt_id), timeout=20)
        if prompt_id in hist:
            entry = hist[prompt_id]
            status = entry.get("status", {}).get("status_str")
            if status == "error":
                raise RuntimeError("ComfyUI execution failed: " + json.dumps(entry.get("status"))[:3000])
            if status == "success" and entry.get("outputs"):
                break
            entry = None
        time.sleep(2)
    if entry is None:
        raise RuntimeError("Timed out after 900 s waiting for /history/" + prompt_id)
    REPORT["generation_completed"] = True
    REPORT["generation_duration_seconds"] = round(time.monotonic() - started, 2)
    REPORT["gpu_memory_peak_used_mib_nvidia_smi"] = peak
    images = [i for out in entry["outputs"].values() for i in out.get("images", [])]
    if not images:
        raise RuntimeError("History reports success but lists no image output")
    meta = images[0]
    query = urllib.parse.urlencode({"filename": meta["filename"], "subfolder": meta.get("subfolder", ""), "type": meta.get("type", "output")})
    with urllib.request.urlopen(BASE + "/view?" + query, timeout=120) as r:
        data = r.read()
    target = OUT / "generated_image.png"
    target.write_bytes(data)
    REPORT["image_downloaded"] = target.is_file() and target.stat().st_size > 0
    return target


def validate_image(path):
    data = path.read_bytes()
    if not data.startswith(b"\\x89PNG\\r\\n\\x1a\\n"):
        raise RuntimeError("Downloaded file does not start with the PNG signature")
    from PIL import Image
    with Image.open(path) as im:
        im.load()  # decodes every pixel; raises on corruption
        width, height, fmt = im.size[0], im.size[1], im.format
    if fmt != "PNG":
        raise RuntimeError(f"Image format is {fmt}, not PNG")
    if (width, height) != (WIDTH, HEIGHT):
        raise RuntimeError(f"Image is {width}x{height}, expected {WIDTH}x{HEIGHT}")
    REPORT["image_width"], REPORT["image_height"] = width, height
    REPORT["image_sha256"] = sha256_of(path)
    REPORT["image_bytes"] = path.stat().st_size
    REPORT["image_valid"] = True
'''

MAIN = '''server = None
server_log = None
try:
    detect_hardware()
    install_comfyui()
    download_model()
    server, server_log = start_server()
    image_path = generate()
    validate_image(image_path)
    REPORT["status"] = "success"
except Exception as exc:
    REPORT["status"] = "failed"
    REPORT["error_message"] = f"{type(exc).__name__}: {exc}"
    traceback.print_exc()
finally:
    if server is not None and server.poll() is None:
        server.terminate()
        try:
            server.wait(timeout=30)
        except subprocess.TimeoutExpired:
            server.kill()
    if server_log is not None:
        server_log.close()
    REPORT["notebook_duration_seconds"] = round(time.monotonic() - STARTED, 2)
    (OUT / "generation_report.json").write_text(json.dumps(REPORT, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in REPORT.items() if k != "gpu_total_vram_bytes"}, indent=2))
'''

SHOW = '''from IPython.display import display, Image as IPyImage
if (OUT / "generated_image.png").is_file():
    display(IPyImage(filename=str(OUT / "generated_image.png")))
'''

VERDICT = '''# This cell makes a failed run end in a Kaggle ERROR state instead of a green notebook.
assert REPORT["status"] == "success", "Image generation failed: " + str(REPORT["error_message"])
for key in ("comfyui_started", "api_system_stats_ok", "api_object_info_ok", "generation_submitted",
            "generation_completed", "image_downloaded", "image_valid"):
    assert REPORT[key] is True, key + " was not observed"
print("PASS: a real image was generated, retrieved and validated.", REPORT["image_sha256"])
'''


def cell(kind: str, source: str) -> dict:
    lines = source.splitlines(keepends=True)
    base = {"cell_type": kind, "metadata": {}, "source": lines}
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
    if args.check:
        if not TARGET.exists() or TARGET.read_text(encoding="utf-8") != text:
            print(f"{TARGET} is out of date; run scripts/build_image_smoke_notebook.py", file=sys.stderr)
            return 1
        return 0
    TARGET.write_text(text, encoding="utf-8")
    print(f"Wrote {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
