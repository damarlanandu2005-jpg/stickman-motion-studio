# Stickman Motion Studio

Local-first production controller for Stickman Thoughts. The goal is expressive animated scenes with consistent characters—not a still-image slideshow.

## Pipeline
Research & source ledger → script → visual beats/shot plans → artwork & character layers → animation (2D rig / 2.5D / key poses / selective AI video) → narration/music/SFX → FFmpeg render → QC → human approval → manual YouTube upload.

**Status:** controller foundation and first ComfyUI HTTP adapter are implemented. The adapter can check a server, submit an API-format workflow, poll its job, and download generated image outputs. Actual generation still requires a running ComfyUI server, compatible models and an exported workflow. Character consistency and animation are not yet integrated.

## Cost and hardware
- Core controller and ComfyUI adapter use Python standard library; no paid API required.
- Kaggle GPU is the optional heavy-inference workstation. Save approved outputs back into project folders.
- Windows laptop handles orchestration and lightweight work.
- Do not assume 24 GB VRAM character workflow fits Kaggle or RTX 3050.
- Install Blender and FFmpeg as prebuilt tools, not source submodules.
- External repositories remain optional; OpenScript's PupCaps nested mapping issue is isolated.

## Windows quick start
Use your installed Python version (3.11 or newer):
```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
python -m unittest discover -s tests -v
```

## ComfyUI connection
Start ComfyUI on the machine/runtime that has the GPU and models. Export a workflow using **Save (API Format)** and save it under `workflows/comfyui/`.

```powershell
python -m motion_studio comfyui-check --url http://127.0.0.1:8188
python -m motion_studio comfyui-run --workflow workflows/comfyui/your_workflow.api.json --output-dir projects/first-short/artwork/comfyui --url http://127.0.0.1:8188
```

For Kaggle, run the controller in the same Kaggle runtime or provide a secure reachable endpoint; Kaggle's `127.0.0.1` is not your Windows laptop. See [ComfyUI integration](docs/COMFYUI_INTEGRATION.md).

Other commands: `init`, `validate`, `plan`, `status`, `run-stage`, `render`.

Render accepts approved animated MP4 clips only. It intentionally refuses still-image fallback. The tool never uploads to YouTube. Human review is required before publishing.
