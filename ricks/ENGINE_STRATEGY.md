# Engine strategy: Ricks vs inkbeat (and how to render each)

_Last updated: 2026-11-15. Written after a full head-to-head of our Ricks engine against the
inkbeat (Remotion + React-Three-Fiber) engine, including rendering the same 8-second "sold the
Eiffel Tower twice" pilot on both. Read this before re-litigating the engine question or trying
to render inkbeat again — it will save you the day this took to learn._

## The one-line verdict

**inkbeat's *look* is clearly better; its *render stack* is not viable for a free, high-volume
pipeline.** Those two facts pull in opposite directions. Do not adopt inkbeat's renderer wholesale
to get its look — port the look into Ricks instead (see Plan).

## What each engine is

- **Ricks (ours):** Python + three.js in headless Chromium (Playwright), flat 2D cutout puppets in
  a 3D world, Gemini-painted assets. Renders fast and reliably on free Kaggle GPU (minutes/clip).
  Look is cruder — flat "bean" characters, hazy backdrops.
- **inkbeat:** Remotion 4 + R3F, toon-shaded 3D characters with real limbs, code-built geometry
  (e.g. a parametric Eiffel lattice), ink-outline post-process. Look is a tier above ours. Renders
  slowly and only on CPU.

## Render-stack facts (the expensive lessons — do not rediscover these)

- **inkbeat cannot use the Kaggle T4 GPU.** Remotion's headless Chrome fails to create a WebGL
  context on the T4 and crashes in ~11 s (React `commitLayoutEffectOnFiber` error). The ~1 h that a
  GPU run "took" was Kaggle queue time for 2×T4, not rendering.
- **Remotion's own bundled Chrome crashes on Kaggle/CI.** Use Playwright's Chromium instead:
  install it with node `npx playwright install chromium`, locate it with `find /home /root -path
  '*ms-playwright*' -name chrome`, and pass `--browser-executable=<that path>`.
- **Newer Chromium removed old headless mode.** Add `--chrome-mode=chrome-for-testing`.
- **Software GL must be `--gl=swangle`** (SwiftShader via ANGLE). Raw `--gl=swiftshader` and plain
  `--gl=angle` fail GPU-less; `swangle` works.
- **First frame has a ~6 min SwiftShader cold start**, then ~15 s/frame. Cost is geometry-bound, so
  lowering resolution barely helps. One 8 s clip is ~45–60 min on one CPU.
- **GitHub Actions `ubuntu-latest` is now Ubuntu 26.04**, which Playwright rejects. Pin
  `runs-on: ubuntu-24.04`.

## How to render inkbeat for free (the working path)

Workflow: `.github/workflows/inkbeat-split.yml` (dispatch: `comp`, `shards`, `total_frames`, `fps`).
It fans frames across N GitHub runners (12 is a good default), each rendering a frame range to
absolutely-numbered PNGs, then a stitch job pools them, **renders any missing frames itself**, and
**nearest-neighbor-backfills** any residual gap so the video always completes. Key robustness bits,
learned the hard way:
- Time-box each shard's render with a shell `timeout` (NOT GitHub `timeout-minutes`, which marks the
  job "cancelled" and cancels the whole run, killing the stitch).
- Keep the stitch's working directory anchored (`ROOT="$PWD"`, run the gap-fill in a subshell) — a
  stray `cd` was the final bug.
- Measured cost: **~26 min wall-clock for an 8 s clip** across 12 runners. Free, no GPU, no queue.

Result committed to `results_inkbeat/inkbeat_pilot.mp4` (+ `split_result.json`).

## Plan: use the best of both (two tracks)

Default is ONE engine day-to-day (ours), not two full pipelines in parallel — running two stacks
doubles the maintenance (two asset formats, two render paths, two sets of bugs). The "best of both"
is captured as:

- **Track A — volume (Ricks):** every routine/daily/batch short and all fast iteration. Fast, free,
  reliable on Kaggle GPU. This is the default renderer.
- **Track B — hero (inkbeat):** reserved for the occasional showcase piece where max quality earns
  the ~26 min render. Use the split workflow above. Kept on the shelf, not run by default.
- **Shared front-end:** same script + voice feed both; a per-script `tier: volume|hero` flag picks
  the renderer.
- **The real win — port the look into Ricks:** toon-shaded characters with real limbs (hands, legs,
  shoes, hair), code-built geometric props (the lattice tower is a good reference), and an
  ink-outline post-process. This closes most of the quality gap at Ricks' render speed, and over
  time shrinks how often Track B is needed.

## Open decision for the human

Which track dominates depends on volume (many shorts → lean hard on Track A + port the look; a few
hero pieces → Track B is worth its cost). Not yet decided as of this writing.
