# Stickman Thoughts — 30-scene space adventure

This is a separate Kaggle experiment; it does not modify the Phase 4 benchmark or the existing Phase 5 mascot-reference benchmark.

## Story
30 individual vertical scenes follow one continuous story: Earth and suit preparation, rocket boarding, countdown and launch, leaving Earth's atmosphere, Sun and stars, zero gravity, turbulence and recovery, alien-planet discovery, landing, exploration, first contact, alien chase, rocket escape and departure.

## Character and visual treatment
Every scene is conditioned on the approved astronaut costume reference from the pinned owner-created `yt-auto` reference library. The prompt requires the same Stickman face and the same astronaut suit in every scene, while asking for a complete illustrated environment. Each output is a separate 576×1024 image, not a storyboard collage.

## Outputs
- 30 separate PNG images named `klein4b_<scene>.png`
- `klein4b_space_adventure_contact_sheet.png` for quick visual review
- `benchmark_report.json` with run identity, per-scene prompt/seed, timing, dimensions, source-reference hash and output hashes
- installation log and model metadata

The notebook refuses to proceed if the installed FLUX.2 Klein pipeline does not explicitly expose image conditioning. A technically successful run does not guarantee consistent character identity; visually inspect every frame before publication.

## Run
GitHub Actions → **Kaggle 30-scene space adventure** → **Run workflow**. It uses the existing Kaggle credentials and serialized runner with a dedicated kernel slug. The workflow must be manually dispatched.
