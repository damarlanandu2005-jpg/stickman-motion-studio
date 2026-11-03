"""Build kaggle/image-to-3d-test/image_to_3d_test.ipynb: can AI turn our cartoon object pictures into 3D models?

Small feasibility test, 3 objects only:
  1. FLUX.2 klein 4B (pinned) draws 3 isolated cartoon objects on white.
  2. TripoSR (MIT) turns each picture into a 3D model (GLB, vertex colours).
  3. Hunyuan3D-2mini turbo turns each picture into a 3D shape (GLB), then Hunyuan3D-Paint tries to texture it.
Every stage runs in its own process with its own time limit, so one crash or out-of-memory does not stop the others.
The 3D engines run in a separate virtualenv (system torch kept, older transformers/diffusers pinned there), so they
cannot break klein's library versions. Every number in the report is measured; nothing is assumed.

    python scripts/build_image_to_3d_notebook.py          # rewrite
    python scripts/build_image_to_3d_notebook.py --check  # exit 1 if out of date
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "kaggle" / "image-to-3d-test" / "image_to_3d_test.ipynb"
OBJECTS_FILE = ROOT / "kaggle" / "image-to-3d-test" / "objects.json"   # the batch of objects to make; written by the story tool

INTRO = """# Image-to-3D feasibility test (3 objects)

klein draws 3 cartoon objects, then **TripoSR** and **Hunyuan3D-2mini** each try to turn them into 3D models (GLB).
Each stage runs in its own process with a time limit and writes its own result; a failed stage is recorded, not hidden.
Licences: TripoSR is MIT. Hunyuan3D-2 is the Tencent Hunyuan 3D 2.0 Community License, which excludes the EU, UK and
South Korea (including displaying outputs there); it is tested here for quality and speed only.
"""

SETUP = r'''import os, sys, json, time, subprocess, pathlib, hashlib, traceback, uuid, shutil

RUN_ID = globals().get("RUN_ID", "manual-" + uuid.uuid4().hex)
RUN_TOKEN = globals().get("RUN_TOKEN", "manual")
COMMIT_SHA = globals().get("COMMIT_SHA", "unknown")
WORKFLOW_RUN_ID = globals().get("WORKFLOW_RUN_ID", "local")

OUT = pathlib.Path(os.environ.get("STICKMAN_OUT_DIR", "/kaggle/working/outputs"))  # override only for unit tests
STAGES = pathlib.Path(os.environ.get("STICKMAN_STAGE_DIR", "/tmp/i23d_stages"))
LOGS = OUT / "logs"
for d in (OUT, LOGS, STAGES):
    d.mkdir(parents=True, exist_ok=True)

VENV = "/tmp/venv3d"
CACHE_ENV = {"HF_HOME": "/tmp/hf_home", "HY3DGEN_MODELS": "/tmp/hy3dgen", "U2NET_HOME": "/tmp/u2net",
             "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True", "CUDA_VISIBLE_DEVICES": "0",
             "TORCH_CUDA_ARCH_LIST": "7.5", "PYTHONUNBUFFERED": "1"}

KLEIN_ID, KLEIN_REVISION = "black-forest-labs/FLUX.2-klein-4B", "e7b7dc27f91deacad38e78976d1f2b499d76a294"
KLEIN_PIP = ["diffusers==0.42.1", "transformers==5.22.1", "huggingface-hub==1.33.0", "accelerate", "pillow"]
TRIPOSR_REPO, TRIPOSR_COMMIT = "https://github.com/VAST-AI-Research/TripoSR.git", "107cefdc244c39106fa830359024f6a2f1c78871"
HUNYUAN_REPO, HUNYUAN_COMMIT = "https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git", "f8db63096c8282cb27354314d896feba5ba6ff8a"
# torchmcubes did not compile on Kaggle's CUDA 13 (run 41585826224). TripoSR only needs its marching_cubes(volume, level);
# this stand-in gives the same result shape with scikit-image (CPU), so nothing has to be compiled.
TORCHMCUBES_SHIM = """import numpy as np, torch
from skimage import measure


def marching_cubes(volume, level):
    v = volume.detach().float().cpu().numpy()
    verts, faces, _, _ = measure.marching_cubes(v, level)
    verts = verts[:, [2, 1, 0]].copy()  # torchmcubes returns (z, y, x); TripoSR swaps it back
    return torch.from_numpy(verts).float(), torch.from_numpy(faces.astype(np.int64))
"""
VENV_PIP = ["transformers==4.48.3", "diffusers==0.32.2", "huggingface-hub==0.30.2", "accelerate==1.3.0",
            "omegaconf==2.3.0", "einops", "trimesh", "pymeshlab", "pygltflib", "xatlas", "rembg[cpu]", "imageio",
            "opencv-python-headless", "moderngl", "scikit-image", "ninja", "pybind11", "scikit-build-core", "cmake", "tqdm"]

STYLE = ("isolated single object, centered, whole object fully visible. Three-quarter perspective view from the front-left "
         "and slightly above, so the side and the depth of the object are clearly visible; not a flat front view. "
         "plain pure white background, no ground, no shadow, no text, no people. Flat 2D cartoon illustration, "
         "clean thick dark outlines, soft muted colours, simple flat shading.")
OBJECTS = [{**o, "prompt": o["prompt"] + " " + STYLE} for o in json.loads(r"""__OBJECTS_JSON__""")]
SIZE, STEPS, GUIDANCE = 768, 4, 1.0

# Nothing below is observed yet; each stage sets its own fields from what actually happened.
REPORT = {
    "run_token": RUN_TOKEN, "run_id": RUN_ID, "commit_sha": COMMIT_SHA, "workflow_run_id": WORKFLOW_RUN_ID,
    "status": "running", "error_message": None, "objects": [o["name"] for o in OBJECTS],
    "environment": {}, "stages": {}, "engines": {},
    "licences": {"klein": "Apache-2.0", "triposr": "MIT",
                 "hunyuan3d": "Tencent Hunyuan 3D 2.0 Community License (excludes EU, UK, South Korea)"},
}
STARTED = time.monotonic()
'''

KLEIN_STAGE = r'''import json, sys, time, hashlib, traceback
from pathlib import Path
cfg = json.loads(Path(sys.argv[1]).read_text())
res = {"stage": "klein", "status": "running", "error": None, "objects": []}
try:
    import torch
    from huggingface_hub import snapshot_download
    from diffusers import Flux2KleinPipeline
    t = time.monotonic(); path = snapshot_download(cfg["model_id"], revision=cfg["revision"])
    res["download_seconds"] = round(time.monotonic() - t, 1)
    t = time.monotonic(); pipe = Flux2KleinPipeline.from_pretrained(path, torch_dtype=torch.float16)
    pipe.enable_model_cpu_offload(gpu_id=0); res["load_seconds"] = round(time.monotonic() - t, 1)
    out = Path(cfg["out_dir"]); out.mkdir(parents=True, exist_ok=True)
    for o in cfg["objects"]:
        torch.cuda.synchronize(); t = time.monotonic()
        img = pipe(prompt=o["prompt"], width=cfg["size"], height=cfg["size"], num_inference_steps=cfg["steps"],
                   guidance_scale=cfg["guidance"], generator=torch.Generator("cpu").manual_seed(o["seed"])).images[0]
        torch.cuda.synchronize(); secs = round(time.monotonic() - t, 2)
        p = out / f"object_{o['name']}.png"; img.save(p)
        res["objects"].append({"name": o["name"], "file": p.name, "seconds": secs, "seed": o["seed"], "width": img.width,
                               "height": img.height, "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "status": "success"})
        print("klein drew", o["name"], "in", secs, "s", flush=True)
    res["peak_vram_gib"] = round(torch.cuda.max_memory_allocated() / 2**30, 2)
    res["status"] = "success"
except Exception as exc:
    res["status"] = "failed"; res["error"] = f"{type(exc).__name__}: {exc}"[:3000]; traceback.print_exc()
Path(cfg["result"]).write_text(json.dumps(res, indent=2))
'''

TRIPOSR_STAGE = r'''import json, sys, time, hashlib, traceback
from pathlib import Path
cfg = json.loads(Path(sys.argv[1]).read_text())
sys.path.insert(0, cfg["repo"]); sys.path.insert(0, cfg["shim_dir"])
res = {"stage": "triposr", "status": "running", "error": None, "objects": []}
try:
    import numpy as np, torch, rembg
    from PIL import Image
    from tsr.system import TSR
    from tsr.utils import remove_background, resize_foreground
    import torchmcubes
    res["marching_cubes"] = "scikit-image stand-in at " + torchmcubes.__file__
    t = time.monotonic()
    model = TSR.from_pretrained("stabilityai/TripoSR", config_name="config.yaml", weight_name="model.ckpt")
    model.renderer.set_chunk_size(8192); model.to("cuda"); res["load_seconds"] = round(time.monotonic() - t, 1)
    session = rembg.new_session()
    for o in cfg["objects"]:
        item = {"name": o["name"], "status": "running"}
        try:
            torch.cuda.reset_peak_memory_stats(); torch.cuda.synchronize(); t = time.monotonic()
            im = resize_foreground(remove_background(Image.open(o["image"]), session), 0.85)
            a = np.array(im).astype(np.float32) / 255.0
            a = a[:, :, :3] * a[:, :, 3:4] + (1 - a[:, :, 3:4]) * 0.5
            im = Image.fromarray((a * 255.0).astype(np.uint8))
            with torch.no_grad():
                codes = model([im], device="cuda")
            mesh = model.extract_mesh(codes, True, resolution=256)[0]
            mesh.fix_normals()
            torch.cuda.synchronize(); secs = round(time.monotonic() - t, 2)
            ext = sorted(float(x) for x in mesh.extents)
            item["depth_ratio"] = round(ext[0] / ext[2], 3) if ext[2] else 0.0
            item["looks_flat"] = item["depth_ratio"] < 0.15
            p = Path(cfg["out_dir"]) / f"triposr_{o['name']}.glb"; mesh.export(p)
            item.update(status="success", file=p.name, seconds=secs, vertices=int(len(mesh.vertices)), faces=int(len(mesh.faces)),
                        peak_vram_gib=round(torch.cuda.max_memory_allocated() / 2**30, 2), bytes=p.stat().st_size,
                        sha256=hashlib.sha256(p.read_bytes()).hexdigest())
            print("TripoSR made", o["name"], "in", secs, "s", flush=True)
        except Exception as exc:
            item.update(status="failed", error=f"{type(exc).__name__}: {exc}"[:2000]); traceback.print_exc()
        res["objects"].append(item)
    ok = sum(1 for x in res["objects"] if x["status"] == "success")
    res["status"] = "success" if ok == len(cfg["objects"]) else ("partial" if ok else "failed")
except Exception as exc:
    res["status"] = "failed"; res["error"] = f"{type(exc).__name__}: {exc}"[:3000]; traceback.print_exc()
Path(cfg["result"]).write_text(json.dumps(res, indent=2))
'''

HUNYUAN_SHAPE_STAGE = r'''import json, sys, time, hashlib, traceback
from pathlib import Path
cfg = json.loads(Path(sys.argv[1]).read_text())
sys.path.insert(0, cfg["repo"])
res = {"stage": "hunyuan_shape", "status": "running", "error": None, "objects": []}
try:
    import torch
    from PIL import Image
    from hy3dgen.rembg import BackgroundRemover
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline, FaceReducer, FloaterRemover, DegenerateFaceRemover
    t = time.monotonic()
    pipe = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained("tencent/Hunyuan3D-2mini", subfolder="hunyuan3d-dit-v2-mini-turbo",
                                                            use_safetensors=False, device="cuda")
    pipe.enable_flashvdm(topk_mode="merge"); res["load_seconds"] = round(time.monotonic() - t, 1)
    remover = BackgroundRemover()
    for o in cfg["objects"]:
        item = {"name": o["name"], "status": "running"}
        try:
            torch.cuda.reset_peak_memory_stats(); torch.cuda.synchronize(); t = time.monotonic()
            image = remover(Image.open(o["image"]).convert("RGB"))
            cut = Path(cfg["out_dir"]) / f"cutout_{o['name']}.png"; image.save(cut)
            mesh = pipe(image=image, num_inference_steps=5, octree_resolution=380, num_chunks=20000,
                        generator=torch.manual_seed(o["seed"]), output_type="trimesh")[0]
            raw_faces = int(len(mesh.faces))
            mesh = FaceReducer()(DegenerateFaceRemover()(FloaterRemover()(mesh)), max_facenum=40000)
            torch.cuda.synchronize(); secs = round(time.monotonic() - t, 2)
            ext = sorted(float(x) for x in mesh.extents)
            item["depth_ratio"] = round(ext[0] / ext[2], 3) if ext[2] else 0.0
            item["looks_flat"] = item["depth_ratio"] < 0.15
            p = Path(cfg["out_dir"]) / f"hunyuan_{o['name']}_shape.glb"; mesh.export(p)
            item.update(status="success", file=p.name, seconds=secs, raw_faces=raw_faces, faces=int(len(mesh.faces)),
                        vertices=int(len(mesh.vertices)), peak_vram_gib=round(torch.cuda.max_memory_allocated() / 2**30, 2),
                        bytes=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest(), cutout=cut.name)
            print("Hunyuan shape", o["name"], "in", secs, "s", flush=True)
        except Exception as exc:
            item.update(status="failed", error=f"{type(exc).__name__}: {exc}"[:2000]); traceback.print_exc()
        res["objects"].append(item)
    ok = sum(1 for x in res["objects"] if x["status"] == "success")
    res["status"] = "success" if ok == len(cfg["objects"]) else ("partial" if ok else "failed")
except Exception as exc:
    res["status"] = "failed"; res["error"] = f"{type(exc).__name__}: {exc}"[:3000]; traceback.print_exc()
Path(cfg["result"]).write_text(json.dumps(res, indent=2))
'''

HUNYUAN_PAINT_STAGE = r'''import json, sys, time, hashlib, traceback
from pathlib import Path
cfg = json.loads(Path(sys.argv[1]).read_text())
sys.path.insert(0, cfg["repo"])
res = {"stage": "hunyuan_paint", "status": "running", "error": None, "objects": []}
try:
    import torch, trimesh
    from PIL import Image
    from hy3dgen.texgen import Hunyuan3DPaintPipeline
    t = time.monotonic()
    paint = Hunyuan3DPaintPipeline.from_pretrained("tencent/Hunyuan3D-2", subfolder="hunyuan3d-paint-v2-0-turbo")
    paint.enable_model_cpu_offload(); res["load_seconds"] = round(time.monotonic() - t, 1)
    out = Path(cfg["out_dir"])
    for o in cfg["objects"]:
        item = {"name": o["name"], "status": "running"}
        shape, cut = out / f"hunyuan_{o['name']}_shape.glb", out / f"cutout_{o['name']}.png"
        if not shape.exists() or not cut.exists():
            item.update(status="skipped", error="no shape from the shape stage"); res["objects"].append(item); continue
        try:
            torch.cuda.reset_peak_memory_stats(); torch.cuda.synchronize(); t = time.monotonic()
            mesh = trimesh.load(shape, force="mesh")
            mesh = paint(mesh, image=Image.open(cut))
            torch.cuda.synchronize(); secs = round(time.monotonic() - t, 2)
            p = out / f"hunyuan_{o['name']}_textured.glb"; mesh.export(p)
            item.update(status="success", file=p.name, seconds=secs, peak_vram_gib=round(torch.cuda.max_memory_allocated() / 2**30, 2),
                        bytes=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest())
            print("Hunyuan paint", o["name"], "in", secs, "s", flush=True)
        except Exception as exc:
            item.update(status="failed", error=f"{type(exc).__name__}: {exc}"[:2000]); traceback.print_exc()
        res["objects"].append(item)
    ok = sum(1 for x in res["objects"] if x["status"] == "success")
    res["status"] = "success" if ok == len(cfg["objects"]) else ("partial" if ok else "failed")
except Exception as exc:
    res["status"] = "failed"; res["error"] = f"{type(exc).__name__}: {exc}"[:3000]; traceback.print_exc()
Path(cfg["result"]).write_text(json.dumps(res, indent=2))
'''

HELPERS = r'''def run_logged(name, cmd, timeout, env=None, cwd=None):
    """Run one command, log it to logs/<name>.log, record seconds and exit code. Never raises on a failed command."""
    log = LOGS / f"{name}.log"
    t = time.monotonic()
    try:
        with log.open("a") as fh:
            fh.write("$ " + " ".join(map(str, cmd)) + "\n"); fh.flush()
            code = subprocess.run(cmd, stdout=fh, stderr=subprocess.STDOUT, timeout=timeout,
                                  env={**os.environ, **CACHE_ENV, **(env or {})}, cwd=cwd).returncode
        outcome = "ok" if code == 0 else f"exit {code}"
    except subprocess.TimeoutExpired:
        code, outcome = None, f"timed out after {timeout} s"
    secs = round(time.monotonic() - t, 1)
    REPORT["stages"].setdefault(name, []).append({"cmd": " ".join(map(str, cmd))[:300], "seconds": secs, "outcome": outcome})
    print(f"[{name}] {outcome} in {secs} s", flush=True)
    return code == 0


def stage_script(name, source, cfg, python, timeout):
    script, cfg_path, result = STAGES / f"{name}.py", STAGES / f"{name}.json", OUT / f"result_{name}.json"
    script.write_text(source, encoding="utf-8")
    cfg_path.write_text(json.dumps({**cfg, "result": str(result), "out_dir": str(OUT)}), encoding="utf-8")
    run_logged(name, [python, str(script), str(cfg_path)], timeout)
    if result.exists():
        data = json.loads(result.read_text(encoding="utf-8"))
    else:
        data = {"stage": name, "status": "failed", "error": "stage wrote no result (crashed, killed or timed out); see logs/" + name + ".log", "objects": []}
    REPORT["engines"][name] = data
    return data


def environment():
    import torch
    env = REPORT["environment"]
    env["python"] = sys.version.split()[0]
    env["torch"] = torch.__version__
    env["torch_cuda"] = torch.version.cuda
    env["cuda_available"] = bool(torch.cuda.is_available())
    env["gpu_names"] = [torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())] if torch.cuda.is_available() else []
    env["gpu_used_for_test"] = "cuda:0 only"
    nvcc = subprocess.run("nvcc --version || ls -d /usr/local/cuda*", shell=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    env["nvcc"] = nvcc.stdout.strip()[-400:]
    env["disk_free_gb_tmp"] = round(shutil.disk_usage("/tmp").free / 1e9, 1)
    if not env["cuda_available"]:
        raise RuntimeError("CUDA is not available: enable the GPU accelerator.")


def summary_line(name):
    data = REPORT["engines"].get(name, {})
    ok = [o for o in data.get("objects", []) if o.get("status") == "success"]
    secs = [o["seconds"] for o in ok if "seconds" in o]
    return {"stage_status": data.get("status"), "objects_ok": len(ok), "objects_total": len(OBJECTS),
            "seconds_per_object": secs, "load_seconds": data.get("load_seconds"), "error": data.get("error")}
'''

MAIN = r'''try:
    environment()
    if not run_logged("install_klein", [sys.executable, "-m", "pip", "install", "--no-cache-dir", *KLEIN_PIP], 1200):
        raise RuntimeError("klein dependencies failed to install; see logs/install_klein.log")
    klein = stage_script("klein", KLEIN_STAGE, {"model_id": KLEIN_ID, "revision": KLEIN_REVISION, "objects": OBJECTS,
                         "size": SIZE, "steps": STEPS, "guidance": GUIDANCE}, sys.executable, 1500)
    if klein.get("status") != "success":
        raise RuntimeError("klein could not draw the 3 objects: " + str(klein.get("error")))
    objects = [{**o, "image": str(OUT / f"object_{o['name']}.png")} for o in OBJECTS]

    # One virtualenv for both 3D engines: keeps Kaggle's torch, pins the older libraries they were written for.
    py = f"{VENV}/bin/python"
    venv_ok = (run_logged("venv", [sys.executable, "-m", "pip", "install", "-q", "virtualenv"], 300)
               and run_logged("venv", [sys.executable, "-m", "virtualenv", "--system-site-packages", VENV], 300)
               and run_logged("install_3d_common", [py, "-m", "pip", "install", "--no-cache-dir", *VENV_PIP], 1500))
    if not venv_ok:
        raise RuntimeError("3D environment failed to install; see logs/install_3d_common.log")

    # TripoSR
    tsr_repo = "/tmp/TripoSR"
    if (run_logged("triposr_clone", ["git", "clone", "-q", TRIPOSR_REPO, tsr_repo], 300)
            and run_logged("triposr_clone", ["git", "-C", tsr_repo, "checkout", "-q", TRIPOSR_COMMIT], 120)
            and run_logged("triposr_shim", [py, "-c", "import skimage; print('scikit-image', skimage.__version__)"], 120)):
        shim_dir = pathlib.Path("/tmp/i23d_shims/torchmcubes"); shim_dir.mkdir(parents=True, exist_ok=True)
        (shim_dir / "__init__.py").write_text(TORCHMCUBES_SHIM, encoding="utf-8")
        stage_script("triposr", TRIPOSR_STAGE, {"repo": tsr_repo, "shim_dir": str(shim_dir.parent), "objects": objects}, py, 1500)
    else:
        REPORT["engines"]["triposr"] = {"stage": "triposr", "status": "failed", "objects": [],
                                        "error": "TripoSR setup failed; see logs/triposr_clone.log and logs/triposr_shim.log"}

    # Hunyuan3D-2mini shape, then texture (texture needs two compiled extensions)
    hy_repo = "/tmp/Hunyuan3D-2"
    if (run_logged("hunyuan_clone", ["git", "clone", "-q", HUNYUAN_REPO, hy_repo], 300)
            and run_logged("hunyuan_clone", ["git", "-C", hy_repo, "checkout", "-q", HUNYUAN_COMMIT], 120)):
        stage_script("hunyuan_shape", HUNYUAN_SHAPE_STAGE, {"repo": hy_repo, "objects": objects}, py, 1800)
        built = (run_logged("hunyuan_build_rasterizer", [py, "-m", "pip", "install", "--no-build-isolation", "."], 1200,
                            cwd=f"{hy_repo}/hy3dgen/texgen/custom_rasterizer")
                 and run_logged("hunyuan_build_renderer", [py, "setup.py", "build_ext", "--inplace"], 600,
                                cwd=f"{hy_repo}/hy3dgen/texgen/differentiable_renderer"))
        if built:
            stage_script("hunyuan_paint", HUNYUAN_PAINT_STAGE, {"repo": hy_repo, "objects": objects}, py, 2400)
        else:
            REPORT["engines"]["hunyuan_paint"] = {"stage": "hunyuan_paint", "status": "failed", "objects": [],
                                                  "error": "texture extensions did not build; see logs/hunyuan_build_*.log"}
    else:
        REPORT["engines"]["hunyuan_shape"] = {"stage": "hunyuan_shape", "status": "failed", "objects": [],
                                              "error": "Hunyuan3D-2 clone failed; see logs/hunyuan_clone.log"}

    REPORT["summary"] = {name: summary_line(name) for name in ("klein", "triposr", "hunyuan_shape", "hunyuan_paint")}
    REPORT["status"] = "completed"  # every stage ran; per-engine success is in REPORT["summary"]
except Exception as exc:
    REPORT["status"] = "failed"
    REPORT["error_message"] = f"{type(exc).__name__}: {exc}"
    traceback.print_exc()
finally:
    REPORT["notebook_duration_seconds"] = round(time.monotonic() - STARTED, 1)
    (OUT / "image_to_3d_report.json").write_text(json.dumps(REPORT, indent=2), encoding="utf-8")
    print(json.dumps(REPORT.get("summary", REPORT), indent=2))
'''

SHOW = r'''from IPython.display import display, Image as IPyImage
for p in sorted(OUT.glob("object_*.png")):
    print(p.name); display(IPyImage(filename=str(p), width=256))
for p in sorted(OUT.glob("*.glb")):
    print(p.name, p.stat().st_size, "bytes")
'''

VERDICT = r'''assert REPORT["status"] == "completed", "Test did not complete: " + str(REPORT["error_message"])
print("Test completed. Engine results:", json.dumps(REPORT["summary"], indent=1))
'''


def cell(kind: str, source: str) -> dict:
    base = {"cell_type": kind, "metadata": {}, "source": source.splitlines(keepends=True)}
    if kind == "code":
        base.update({"execution_count": None, "outputs": []})
    return base


def stage_constants() -> str:
    return "".join(f"{name} = {value!r}\n" for name, value in (
        ("KLEIN_STAGE", KLEIN_STAGE), ("TRIPOSR_STAGE", TRIPOSR_STAGE),
        ("HUNYUAN_SHAPE_STAGE", HUNYUAN_SHAPE_STAGE), ("HUNYUAN_PAINT_STAGE", HUNYUAN_PAINT_STAGE)))


def build() -> dict:
    return {
        "cells": [cell("markdown", INTRO), cell("code", SETUP.replace("__OBJECTS_JSON__", json.dumps(json.loads(OBJECTS_FILE.read_text(encoding="utf-8")), indent=1))), cell("code", stage_constants()), cell("code", HELPERS),
                  cell("code", MAIN), cell("code", SHOW), cell("code", VERDICT)],
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
            print(f"{TARGET} is out of date; run scripts/build_image_to_3d_notebook.py", file=sys.stderr)
            return 1
        return 0
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(text, encoding="utf-8")
    print(f"Wrote {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
