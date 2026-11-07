# kit/schema: the beat plan

`beat.v1.schema.json` (JSON Schema 2020-12, version **1.0.0**) describes one file per video, `beats.json`: the narration turned into structured picture instructions
(intent, subject, hero object, actions, shot and composition, camera purpose and move, material and light, captions, audio events, transition, validation).
Readable summary for models: `kit/docs/BEATS.md` (generated). Examples from the two real stories: `examples/beats_railroads_v2.json`, `examples/beats_bomb_v22.json`.

Check a plan and run the automatic quality gates: `python3 kit/tools/validate_beats.py beats.json` (needs `pip install jsonschema`).
Tests: `python3 kit/schema/tests/test_validate_beats.py` (the two examples must pass; 18 deliberate breaks must each be caught by the right gate).

## Stability rules (so the render code can be built on it later without a redesign)
- 1.x only ADDS optional fields or enum values. A renamed/removed field or a changed meaning is 2.0.0 and needs a converter.
- Unknown data goes into `extensions` (any object, at root or per beat). The core objects reject unknown keys on purpose, so typos are caught.
- Time is seconds in the file; the renderer converts with `project.fps` (30). `character_actions` and `object_events` start times are relative to the beat start; `audio_events.time_s` and `camera.kicks.time_s` are absolute.
- Vocabulary follows the kit: faces, poses, outfits, hats, light (FORMAT.md section 6) and camera moves (FORMAT.md section 5, plus creep, pan, tilt, track, fly-through, top-down).
- Mapping to what exists in the renderer today (no code reads the plan yet): `camera.*` -> `camFromKeys` keys in story.js (pos/look/fov/ease/path/kicks); `transition_in` -> `STORY.TRANS` (dissolve / fly / cut / flash); `captions` + `narration.words` -> `words.js` in the project main.js; `environment`+`light` -> `SHOTS` place/light and `LIGHTS`; `audio_events` -> the SFX lines of audio.py; `character_actions` -> `actorsAt` poses and faces; `object_events` -> `worldState` and `fxAt`.

## Status
Step 1 only: schema, validator, examples, and an optional Gemini step (`tools/make_beats.py`, workflow input `beats`, default false). Nothing in the renderer reads the plan. See `kit/docs/TRACEABILITY.md`.
