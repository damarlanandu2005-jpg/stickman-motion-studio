# Phase 5 Kaggle mascot consistency run

This notebook performs the first actual reference-conditioned consistency experiment using the pinned FLUX.2 [klein] 4B revision from Phase 4.

## Outputs
- One text-to-image master mascot reference.
- 19 separate edits conditioned on the exact saved master: three views, six expressions, five poses and five scene backgrounds.
- A contact sheet for human inspection.
- Per-image prompt seed, source reference SHA-256, output SHA-256, dimensions and timing in `benchmark_report.json`.

## Safety and acceptance
The run is an experiment, not an identity guarantee. The notebook checks that the installed `Flux2KleinPipeline.__call__` explicitly supports an `image` parameter before any edit is attempted. It does not use an assumed `strength` parameter or silently fall back to text-to-image.

All outputs remain unapproved. A successful Kaggle run proves execution and reference-image conditioning was invoked; it does not prove the mascot stayed visually consistent. Human review must compare the contact sheet and individual images before approving a master or any derived asset.

## Run
Use GitHub Actions → **Kaggle Phase 5 mascot consistency test** → **Run workflow**. It runs unit tests first, then uses the existing `motion_studio.kaggle_runner` with a dedicated Kaggle notebook slug and concurrency group. It does not modify Phase 4 benchmark files or `yt-auto`.
