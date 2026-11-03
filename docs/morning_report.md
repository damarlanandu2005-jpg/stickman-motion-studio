# Report for the owner (night of 3-4 Nov 2026)

Words: *implemented* = code written, *unit tested* = automatic tests pass, *executed* = ran for real, *rendered* = video made, *human reviewed* = you watched it. **Nothing below is human reviewed.** I looked at still frames and contact sheets, not at full playback, and I cannot hear audio.

## Main finding (changes the plan)
Your 4 reference shorts are not made from one character sprite on a background. Almost every shot is a new full picture (new pose, angle, place, 1 to 5 characters, props, flat colour cards). So the main method is now: Kaggle draws each scene with your costume pictures as reference; the sprite engine is only a helper (walk loops, talking heads). This is read from the frames; how the originals were really made is not known.

## What was built and run
- Scene generator on Kaggle (klein 4B, 576x1024): about 215 pictures drawn in 7 runs, 0 failed, about 30 s each (about 6 min setup per run).
- 5 frame types (wide, medium, close, insert, card), costume + note per character, expression notes, object-only pictures without a reference.
- Reel renderer: camera push, pull, drift, shake, captions (1 to 3 words, red keyword, height by frame type), Kokoro voice am_fenrir, object sounds made by code.
- Script planner, picture gate, runner (see docs/shorts_pipeline.md). 92 unit tests pass.
- Recreations of the 4 references with our costumes, same number of shots and same shot lengths.

## Measured, reference vs ours (same code measured both)
| | v1 | v2 | v3 | v4 |
|---|---|---|---|---|
| seconds | 63.1 / 62.4 | 42.1 / 40.3 | 73.1 / 71.4 | 79.3 / 79.3 |
| mean shot s | 2.4 / 2.5 | 2.24 / 3.36* | 1.79 / 1.93 | 1.69 / 1.72 |
| brightness | 158 / 134 | 83 / 94 | 120 / 131 | 148 / 119 |
| colourfulness | 23 / 29 | 30 / 40 | 36 / 39 | 62 / 50 |
| outline density | 0.046 / 0.081 | 0.037 / 0.059 | 0.053 / 0.080 | 0.085 / 0.102 |
*v2: my cut detector misses cuts between dark pictures, so the count is low.
- Still frames: reference 2 to 3 %, ours was 20 % (smooth easing); fixed to 2 %.
- Our outlines are thicker than the references (your mascot has thick outlines). Your call.

## Problems found and fixed
- Object-only pictures (calendar, tower, timer) got a mascot face. Fixed: no reference + no-face prompt; 20 of 20 redrawn pictures are clean (looked at all).
- Captions covered heads in wide shots: now above the heads.
- I overwrote `motion_studio/story.py` by mistake; caught by tests, restored; new code is `short_story.py`.
- Two Kaggle runs failed in the unit-test step (missing numpy on the test server): fixed.
- Walk cycle sprites: legs now move; explorer only; soldier from Kaggle (bare head, no helmet).

## Not done / not proven
- Text on signs is garbled (diffusion limit); references have readable text.
- Gate: finds 3 of 5 known stray faces, but wrongly flags 3 of ~20 clean clock/calendar pictures. It does not check costume, hat fit, anatomy or story match.
- Planner not tested with a real language model.
- Upscaling 576x1024 to 720x1280 is plain resize (soft).
- No sound check by ear. Voice speed 1.12 is my guess.
- Sprite engine: fall pose broken; front/back walk missing; other costumes need their own sheets (or the Kaggle walk test, 6 sheets drawn, 5 frames each).
