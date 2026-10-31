# ComfyUI workflow setup

This folder is for ComfyUI workflows exported in **API format**.

## First artwork test

1. Start ComfyUI in the machine or Kaggle notebook that has the GPU and models.
2. Open the ComfyUI web interface.
3. Build and test one simple text-to-image workflow using a checkpoint already installed there.
4. Enable Dev Mode options in ComfyUI settings if needed.
5. Export with **Save (API Format)**.
6. Save the JSON in this folder, for example as `stickman_first_test.api.json`.
7. Set the server URL with `--url` when running the controller. For a local server this is normally `http://127.0.0.1:8188`.

Do not copy a normal UI workflow JSON here. The adapter expects the API-format node graph.

## Run

```powershell
python -m motion_studio comfyui-check --url http://127.0.0.1:8188
python -m motion_studio comfyui-run --workflow workflows/comfyui/stickman_first_test.api.json --output-dir projects/first-short/artwork/comfyui --url http://127.0.0.1:8188
```

The run command submits the workflow, waits for completion, downloads image outputs, and writes `comfyui-result.json`. It does not automatically approve or promote generated artwork into the production storyboard.

## Kaggle

When ComfyUI runs inside Kaggle, `127.0.0.1` refers to the Kaggle runtime, not your Windows laptop. Run the controller in the same runtime, or configure a secure reachable endpoint. Do not expose the default unauthenticated ComfyUI port publicly.
