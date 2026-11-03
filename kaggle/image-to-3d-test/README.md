# Image-to-3D feasibility test (3 objects)

Question: can AI turn our flat cartoon object pictures into 3D models we could store in a library and reuse in a 3D scene?

1. FLUX.2 klein 4B (pinned `e7b7dc27`) draws 3 isolated objects: rocket, crystal cluster, space rover (768x768, white background).
2. **TripoSR** (MIT, commit `107cefd`) turns each picture into a GLB with vertex colours.
3. **Hunyuan3D-2mini turbo** (commit `f8db630`) turns each picture into a 3D shape, reduced to 40,000 faces; then **Hunyuan3D-Paint turbo** tries to texture it. Texturing needs two compiled extensions; if they do not build, that is recorded.

Each stage runs in its own process with its own time limit and writes `result_<stage>.json`; a crash or timeout is recorded as a failure, never hidden. Logs are in `logs/`. The 3D engines use a separate virtualenv (Kaggle's torch kept; transformers 4.48.3 / diffusers 0.32.2 pinned there), so they cannot change klein's libraries. Only GPU 0 is used.

Licences: klein Apache-2.0; TripoSR MIT; Hunyuan3D-2 is the Tencent Hunyuan 3D 2.0 Community License, which does not apply in the EU, UK or South Korea and forbids displaying outputs there. A YouTube video is shown there, so Hunyuan output would need a licence review before any production use. It is tested here for speed and quality only.

Run: GitHub Actions → **Kaggle image-to-3D test (3 objects)** → Run workflow. Outputs: artifact `image-to-3d-test-output`, and a copy on branch `test-results` under `image-to-3d/<run>/`.
