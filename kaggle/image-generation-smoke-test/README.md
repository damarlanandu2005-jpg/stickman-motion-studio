# Kaggle ComfyUI real image-generation smoke test

This independent stage verifies actual text-to-image generation, not just ComfyUI server startup.

## What it does

1. Clones official ComfyUI and installs requirements while preserving Kaggle's existing PyTorch/CUDA packages.
2. Downloads the pinned 2.13 GB Stable Diffusion 1.5 FP16 checkpoint into Kaggle working storage.
3. Verifies the checkpoint SHA-256 before loading it.
4. Starts ComfyUI and checks the HTTP API and required node types.
5. Submits a fixed-seed, 512×512, one-image text-to-image workflow through `/prompt`.
6. Waits for `/history/{prompt_id}`, retrieves the PNG through `/view`, displays it, and saves a JSON report.

## Model source and licence

- Repository: https://huggingface.co/Comfy-Org/stable-diffusion-v1-5-archive
- Pinned revision: `82ddc01b8d77adc5b4a7c6b5e8f2ddf1a6fe0c08`
- File: `v1-5-pruned-emaonly-fp16.safetensors` (2.13 GB)
- SHA-256: `e9476a13728cd75d8279f6ec8bad753a66a1957ca375a1464dc63b37db6e3916`
- Licence label: CreativeML OpenRAIL-M. Read the model card and licence restrictions before production use.

This is a legacy SD 1.5 baseline checkpoint for testing the generation path. It is not a final production model or a guarantee of consistent Stickman Thoughts character artwork.

## Outputs

- `stickman-motion-studio-generated.png`
- `image-generation-smoke-test.json`
- `comfyui-image-generation-server.log`

The report records model source/revision/hash, prompts, seed, dimensions, generation duration, ComfyUI/PyTorch versions, GPU names, CUDA peak memory and output file details.

## Pass criteria

The notebook must finish with its explicit PASS message, the report must have all required boolean checks set to true, the model hash must match, and the PNG must be present and exactly 512×512. Inspect the displayed image manually for visual quality. A technical pass does not establish character consistency or animation readiness.
