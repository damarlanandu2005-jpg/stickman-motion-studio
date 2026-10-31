# ComfyUI integration

## What is implemented

The ComfyUI adapter uses Python's standard library; no paid API and no additional package are required. It supports:

- Server health check through `GET /system_stats`.
- Workflow submission through `POST /prompt`.
- Job polling through `GET /history/{prompt_id}`.
- Downloading generated image outputs through `GET /view`.
- A result manifest recording prompt ID, server and saved output paths.

The integration uses ComfyUI's documented HTTP routes. See the [ComfyUI server route documentation](https://github.com/Comfy-Org/docs/blob/main/development/comfyui-server/comms_routes.mdx).

## What is not implemented or verified yet

- No ComfyUI server has been connected from this repository change.
- No model checkpoint, LoRA, ControlNet, IP-Adapter or custom node is installed by this adapter.
- No model-specific workflow is bundled; node graphs vary with installed models and extensions.
- Character identity consistency and image approval are still separate pipeline stages.
- Kaggle connectivity and GPU availability must be tested in the user's own runtime.

## Safety and reliability

Keep ComfyUI bound to localhost unless you have configured an authenticated, secure tunnel or reverse proxy. The default server is not an authenticated public API. Treat generated images as candidates until a human approves them. Store the exported API workflow alongside the project so a run can be reproduced.
