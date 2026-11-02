# Reference-inspired animation proof of concept

This is an isolated experimental path. It does not replace the existing image-generation, mascot-consistency, fact-checking, or script-writer workflows.

## Production method being adapted

Use the reference project's production architecture as a technical guide:
- short-form narrative with a strong hook and escalating visual beats;
- a timed shot plan connected to narration segments;
- stylized 2D subjects staged inside a layered 3D world;
- authored camera moves, depth, lighting, transitions, and foreground elements;
- original synthesized sound design and a controlled final mix;
- still-frame/contact-sheet review and automated frame/audio QA.

We will implement original scenes, code, models, music, and assets. Do not copy the reference project's story, characters, shot compositions, frame images, or other creator-specific creative assets. Its MIT-licensed code may be studied/adapted with its license and notices preserved; reference frames are style-study material, not reusable production assets.

## Test project

`test_projects/earth_to_alien_planet/story.json` defines the first 10-second render test. It uses a temporary neutral proxy subject and procedural planets/spacecraft. The existing Stickman mascot is deliberately not redesigned in this proof; character design can be swapped after the renderer is proven.

## Milestones

1. Render a 10-second vertical MP4 in Kaggle and verify actual output bytes, dimensions, duration, FPS, and playback.
2. Measure renderer, Chromium/ANGLE, GPU/CPU, RAM, disk, and wall-clock performance. Do not assume Chromium uses the NVIDIA GPU merely because Kaggle has a GPU.
3. Inspect contact sheets and sampled frames for composition, camera continuity, and visual defects.
4. Only after the proof passes, connect AI-generated scripts, factual review, narration timing, full sound design, and the reusable character system.

## Visual target for this test

Original stylized animation: expressive flat 2D subjects over a dimensional 3D environment, atmospheric depth, readable silhouettes, deliberate camera motion, cinematic light, and clear transitions. Match broad production qualities, not a shot-for-shot or frame-for-frame recreation.

## Non-goals

- No copying the reference video or its 1831 bridge story.
- No use of its reference frames as generated-video inputs.
- No changes to Phase 4 benchmark assets or existing Kaggle workflows.
- No claim of GPU acceleration until renderer diagnostics prove it.
