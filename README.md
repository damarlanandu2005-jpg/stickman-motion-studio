# Stickman Motion Studio

Local-first production controller for Stickman Thoughts. The goal is expressive animated scenes with consistent characters—not a still-image slideshow.

## Pipeline
Research & source ledger → script → visual beats/shot plans → artwork & character layers → animation (2D rig / 2.5D / key poses / selective AI video) → narration/music/SFX → FFmpeg render → QC → human approval → manual YouTube upload.

**Status:** foundation scaffold. The controller, manifests, resumable state, validation and animated-clip render gate are being built. Engine adapters are not claimed as integrated until tested.

## Cost and hardware
- Core controller uses Python standard library; no paid API required.
- Kaggle GPU is the optional heavy-inference workstation. Save approved outputs back into project folders.
- Windows laptop handles orchestration and lightweight work.
- Do not assume 24 GB VRAM character workflow fits Kaggle or RTX 3050.
- Install Blender and FFmpeg as prebuilt tools, not source submodules.
- External repositories remain optional; OpenScript's PupCaps nested mapping issue is isolated.

## Windows quick start
```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
python -m motion_studio init --project projects\first-short --title "Why is space silent?"
python -m motion_studio validate --project projects\first-short
python -m motion_studio plan --project projects\first-short
python -m unittest discover -s tests -v
```

Commands: `init`, `validate`, `plan`, `status`, `run-stage`, `render`.

Render accepts approved animated MP4 clips only. It intentionally refuses still-image fallback. The tool never uploads to YouTube. Human review is required before publishing. See docs for architecture and workflow.
