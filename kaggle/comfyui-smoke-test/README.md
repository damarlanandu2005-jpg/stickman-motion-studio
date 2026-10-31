# Kaggle ComfyUI server smoke test

This is the next validation stage after the PyTorch/CUDA smoke test.

## What it checks

- Clones the official ComfyUI repository into the Kaggle working directory.
- Installs ComfyUI Python requirements while preserving Kaggle's existing PyTorch, torchvision, and torchaudio packages.
- Starts ComfyUI on localhost.
- Checks the `/system_stats` and `/object_info` API endpoints.
- Saves `/kaggle/working/comfyui-smoke-test.json` and a server log.

## Important limits

This test does **not** download a checkpoint, generate an image, prove character consistency, or test animation. Those are separate next stages. It uses Kaggle internet access and consumes notebook runtime while installing dependencies.

## Run

The GitHub Actions workflow submits this notebook as a private Kaggle kernel after the regular unit tests and the basic GPU smoke-test submission succeed. Open Kaggle → Your Work → Code → **Stickman Motion Studio ComfyUI Server Smoke Test** and inspect its latest run.

A successful result should report:
- `comfyui_started: true`
- `api_system_stats_ok: true`
- `api_object_info_ok: true`
- `cuda_available: true`
- at least one node type

If installation or startup fails, inspect the notebook cell output and `comfyui-server.log`. Do not treat successful notebook submission as a successful ComfyUI run.
