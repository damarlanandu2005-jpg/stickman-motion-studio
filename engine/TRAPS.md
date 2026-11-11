# Traps we hit (and what fixed them)

## Rendering
- **Broken frames on the GPU** (a strip of the picture tiled ~3x5, fully white stretches, frames from two scenes alternating):
  came from two browser tabs on one GPU (`CONC=2`) and from forcing the drawing buffer to persist (`preserveDrawingBuffer`) plus a
  per-frame wait guard. Fix: one tab (`CONC=1`), no guard, 8 parts, then `framecheck.py` + re-render only the bad frames + splice.
- **Last 2 frames missing**: the audio track was 2 frames shorter than the video and `-shortest` cut the video. Pad the audio (`-af apad`).
- **Final file over 100 MB** cannot be pushed to git: the kernel re-encodes at a higher CRF until it is under ~92 MB.
- **Free GitHub Actions**: 20 concurrent jobs, 6 h per job; public repo minutes are free. CPU (swiftshader) rendering takes about an hour
  per 85-frame part; use Kaggle for full renders (T4, `GL=angle-egl`, ~0.25 s per frame in one tab).
- **Artifacts cannot be downloaded from the agent sandbox** (proxy). Assemble inside the workflow/kernel and commit the result.
- **Remotion timeouts** ("waiting for the page to render the React component") with several tabs on CPU: CONC 1-2 and `timeoutInMilliseconds: 600000`.
- `ink.dispose is not a function` at scene transitions: guard the dispose in the post file.

## Look
- Pink/purple everywhere: lift + violet shadow tint too strong. Keep violet in shadow only; lit areas must stay warm.
- A day fog that is too strong washes whole shots white. Fog = horizon colour, modest range.
- Kenney nature-kit materials are teal: recolour them by material name. `railroad-straight` node is offset y=-1.
- Transparent steam sprites get ink outlines: put them on the NOINK layer.
- Backgrounds built from tall boxes read as a city. Vary silhouettes (tilted slabs, spires, notched mesas).

## Process
- Verifier sheets of stills do not show motion: also look at 5-8 frames across each moving shot, and run `short_qa.py` + `framecheck.py`.
- A pop in the QA list is not automatically a cut. Look at the frame before dismissing it.
- Do not add random effects, characters, props or camera moves. Every item must come from the story or a verifier fix.
- Sub-agents can hit the weekly rate limit (HTTP 429): resume them with SendMessage after the reset.
