# Shorts pipeline (generic, any topic)

Status words used here: **implemented** (code written), **unit tested**, **executed** (ran once), **rendered** (video made),
**human reviewed** (the owner watched it). Nothing here is "human reviewed" unless the report says so.

## What the 4 reference shorts do (measured on the owner's 4 mp4 files, 30 fps, 720x1280, AAC audio)
- 17 to 47 distinct pictures per video, a hard cut every 1.2 to 2.4 s (mean shot 1.1 to 2.0 s).
- Almost every shot is a NEW full scene picture with the characters drawn inside it (new pose, new angle, new place).
  Characters keep the same costume and face across shots. Sprites cannot make these compositions, so full scene
  pictures are the main method; sprites are only a helper (walk and run loops, talking heads).
- Five frame types: wide (small characters, rich place, 2 to 5 characters), medium (chest-up), close (huge face),
  insert (one object, no character), card (flat colour + one symbol, e.g. a calendar or a timer).
- Captions: small, white with a thin black outline, all caps, about 68 to 70 % of the height, 1 to 3 words, a red key word.
- Audio: one continuous voice (no silence). No steady music and no cut sounds could be seen in the spectrogram. Object
  sounds are only added by us where the scene needs them (explosion, timer ticks, wind...), made by code.
- This is read from the pictures and spectrograms, not known: how the originals were really made is not documented.

## Our pipeline
1. `motion_studio/scene_plan.py`: shot spec (frame, characters by costume name, place, action, props) -> klein prompt
   + `kaggle/scene-batch/jobs.json`. Costume references: `animation/reference_art/costumes/`.
2. `.github/workflows/kaggle-scene-batch.yml`: pushing `jobs.json` runs FLUX.2 klein 4B on Kaggle (576x1024, 4 steps),
   one picture per job, published to the `test-results` branch.
3. `motion_studio/assemble.py` + `reel.py`: pictures + camera move (push, pull, drift, shake) + captions + sounds -> mp4.
   `motion_studio/narrated.py` makes the Kokoro voice (am_fenrir) and times shots to it.
4. `motion_studio/compare.py`: same numbers for a reference and our video, side by side.
5. Sprite helper: `shot2d.py`, `cut_cycle.py` (walk/run loops from sheets).

6. `motion_studio/planner.py`: script -> shot list through any language model (prompt, answer checking, retry, rule-based fallback). Tested with a fake model only.
7. `motion_studio/gate.py`: picture checks (missing, blank, too dark, near-copy, stray face on an object-only picture) + redraw job maker.
8. `motion_studio/runner.py`: one command, story file -> Kaggle -> download -> gate -> redraw rounds -> voice + video. Run end to end once on the 12-shot lighthouse story (0 pictures flagged, 1 round).

Not built yet: a real language model behind the planner, costume/hat/anatomy checks, upscaling of 576x1024 pictures, daily scheduling, final upload (stays human).
