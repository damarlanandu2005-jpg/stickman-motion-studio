# Railroad short — Remotion + React Three Fiber

This is the railway production branch of Stickman Motion Studio. It uses the bridge-proven
Remotion/R3F pipeline rather than the earlier single-canvas Three.js renderer.

## Production method

- One authored 3D world, posed deterministically from a frame-based shot timeline.
- Flat, hand-drawn 2D character cards inside the 3D scene, with camera-facing orientation.
- Kenney Nature + Train GLBs for authored environment and train assets (CC0).
- Story-specific dual railway lines, a boardroom set, train movement, expansion joints and a
  heat-buckle payoff.
- Ink, thin-lens depth of field, bloom, neutral tone mapping and per-shot day/golden grading.
- 19 authored camera shots mapped to the existing 56.7-second narration timeline.

The original bridge implementation is MIT-licensed and its rendering/scene conventions are
adapted here. This railway scene, shot plan, cast staging and story physics are project-specific.

## Quick shot render

From this folder:

```bash
npm install
npm install --no-save playwright
npx playwright install chromium
CHROME="$(node -e \"import('playwright').then(({chromium}) => console.log(chromium.executablePath()))\")"
COMP=RailShort CHROME="$CHROME" REMOTION_DPR=0.5 node still.mjs out/rail_ "45,154,258,325,419,505,551,634,758,890,990,1050,1108,1174,1236,1340,1445,1511,1625" 0.5
```

GitHub Actions runs the same 19-shot type-check/render QA on pull requests into `gemini-cartoon`.
The QA artifact is a review sheet of representative frames; it is not a claim that the final
full-resolution MP4 has been approved.