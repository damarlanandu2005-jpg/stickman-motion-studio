# Ricks stage on Kaggle GPU (branch `ricks-stage-kaggle`)

What this adds, without touching `engine-pipeline`:
- `ricks/stage/` the three.js puppet stage, `render.mjs` (stop-frame check + render), `puppet.py`, `shortkit.py` (word timings, camera check, numeric compare), and `gate_render.py` (gate, then render, then check).
- `ricks/references/` the measured style rules and prompt templates; `ricks/projects/demo/` a small finished project to copy.
- `kaggle/ricks-gpu/` the Kaggle kernel; `.github/workflows/ricks-kaggle.yml` pushes it and commits results to `results_ricks/`.

GPU recipe: installs the NVIDIA userspace driver, then launches new-headless Chromium with `--use-angle=gl-egl` (the variant that reached the T4 in `kaggle/gpu-webgl-test`: 3.7 ms per pass against about 1100 ms on CPU). `RICKS_REQUIRE_GPU=1` stops the job if the browser still lands on SwiftShader, so a CPU fallback never burns quota.

## Run it
1. Secrets `KAGGLE_USERNAME` and `KAGGLE_KEY` are already used by the other workflows.
2. Actions -> "Ricks Short on Kaggle GPU" -> Run workflow. `mode=stills` runs only the stop-frame check; `mode=full` runs the check, refuses to render if anything is flagged (`force=1` overrides), renders 1080x1920 at 30 fps and runs the camera check.
3. Results: `results_ricks/<project>/` (result.json, stills sheet, log, short.mp4 if under 100 MB).
No merge needed: the push trigger on the workflow file registers it from this branch, and it can be started from Actions (choose branch `ricks-stage-kaggle`) or with `gh workflow run ricks-kaggle.yml --ref ricks-stage-kaggle -f mode=stills`.

## Tested here (CPU only)
Demo project: stop-frame gate passed (0 flagged), half-size render finished (284 frames, 90 s on CPU), camera check passed (static frames 2.8%, pan and zoom in range), and `RICKS_REQUIRE_GPU=1` correctly refuses a software renderer.
## NOT tested
The Kaggle run itself (driver install, T4 launch, `npm ci` and Chromium install there). Run `mode=stills` first.
