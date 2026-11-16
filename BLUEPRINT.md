# Blueprint v2: script-to-Short production engine (2026-11-16)

Supersedes v1 (same date). Folds in an outside review. Nothing in sections 3-8 is built yet unless marked
"exists". Scores are the builder's estimates and are targets to test, not predictions.

Goal: the owner supplies a narration script; the system delivers a finished 40-60 s vertical animated Short
that has passed its own checks, with no human fixing.

## 1. Decisions

1. **Look:** inkbeat's toon-shaded 3D figures replace the flat bean. This changes the original target (flat 2D
   characters in a 3D world). Recorded as the owner's choice after viewing both db_cooper films; reversible
   until the character library is built.
2. **Two problems, two layers.** The visual system (characters, sets, light, animation) and the directing
   system (story, scene relationships, framing, proof) are built and scored separately.
3. **Scene data, not generated code.** The director outputs a schema-validated scene file. A fixed library of
   inkbeat components renders it. No per-film React source is generated.
4. **Three check layers**, kept separate: geometry (before any render), stills (one per shot), final video.
5. **Delivery rule:** a video is delivered only when all hard gates pass. A job that cannot pass is reported as
   blocked with its evidence, never delivered with a list of known defects.
6. **Ricks is not deleted.** Its script, voice, planning, watch and state code is kept. Only the bean renderer
   and `short.json` are retired, and only after the benchmark in section 8 passes.

## 2. Where we are (facts)

| | Ours ("Ricks") | inkbeat |
|---|---|---|
| Input | script -> `breakdown.json` -> `short.json`, automated | one hand-written scene file per film |
| Characters | flat bean, stick limbs | 3D figure with limbs, clothes, face states, walk |
| Checks | stills gate, Gemini watches the MP4 | none |
| Render (Kaggle T4 x2) | about 5.5 min for 40 s | about 4 min for 40 s, measured once |
| Same script in both | `results_ricks/db_cooper/short.mp4` | `results_inkbeat/inkbeat_pilot.mp4` |

The two films are not a controlled comparison: one is automated, one is hand-directed. The owner's judgement
after watching both is the basis for decision 1.

Known failures that this blueprint must close: empty scenes; interiors shown as a box in a field; cuts with no
stated reason; subject out of frame or tags hidden; defects reported to the owner instead of fixed; conclusions
accepted without a test ("inkbeat cannot use the Kaggle GPU", "P100 avoids the queue" were both wrong).

## 3. Architecture

```
script.txt
  -> 1 Script and voice        (exists)   facts.json, voice.mp3, words.json
  -> 2 Story director          (new)      story_plan.json
  -> 3 Library lookup          (new)      sets, cast, props resolved or requested
  -> 4 Scene IR                (new)      scene_ir.json, schema-validated
  -> 5 Pre-render gate         (new)      geometry checks, then one still per shot
  -> 6 Compiler + renderer     (new + exists) inkbeat components driven by scene_ir.json, Kaggle
  -> 7 Post-render QA          (extend)   deterministic checks + Gemini watch against the story plan
  -> 8 Delivery and learning   (new)      mp4, QA evidence, job record, library additions
```
Failures at 5 or 7 go back to 4 (re-plan the shot) or 2 (re-plan the scene). At most 3 repair rounds per job.

### Stage 1. Script and voice (exists)
Fact-check, tighten, Kokoro voice, word timings. Addition: `facts.json` keeps, for each factual claim, the
source URL and the sentence it supports. A claim with no source is cut or flagged before planning.

### Stage 2. Story director (new)
Output `story_plan.json`: narration lines -> beats -> shots. One beat may have several shots (wide, close,
detail) under one spoken line.

Per scene: place, time, who is present, what happens, the **proof** (what on screen shows the line is true),
and the **relationship to the previous scene**, one of: `continuation`, `time_jump`, `location_change`,
`parallel`, `contrast`, `flashback`, `montage`. Every scene must declare one; a jump is allowed, an undeclared
one is not. Time and location changes get an on-screen place/time tag.

A continuity state is carried scene to scene: each character's location, costume and what they hold; state of
the set. A shot that contradicts the state (a prop held that was handed over, a costume change with no reason)
is rejected here.

### Stage 3. Library (new, inside inkbeat)
- **Sets:** parametric components with declared bounds, whether enclosed, and standing/sitting slots
  (first batch: airliner cabin, ticket hall, tarmac, forest, riverbank, night sky, street, office).
- **Cast:** presets by role and period, built on inkbeat's character system.
- **Props:** hand-held and set props with a declared size and grip point.
- **Crowd:** fills a set's slots to a requested count.
Each item carries metadata the gate can read. A plan that needs something missing either maps to the nearest
item (recorded as a fallback) or blocks if the item is the scene's proof.

### Stage 4. Scene IR (new)
`scene_ir.json`, validated against a JSON schema. Renderer-neutral: names from the library, positions in set
slots, camera as shot type + subject + move, timings from `words.json`. Illustrative shape:

```json
{ "scene": "s04", "set": "tarmac", "time": "dusk", "relation": "location_change",
  "tag": "SEATTLE · ON THE GROUND",
  "cast": [{ "id": "attendant", "slot": "apron_1", "action": "walk", "holds": "money_bag" }],
  "crowd": { "count": 9, "action": "walk_off" },
  "shots": [{ "from": "w:63", "type": "medium_wide", "subject": "attendant", "move": "push" }],
  "proof": { "item": "money_bag", "must_be": "visible" } }
```
Useful fields and validation logic from `short.json` and `breakdown.py` are carried over; renderer-specific
ones are dropped.

### Stage 5. Pre-render gate (new)
**Geometry (no render, seconds):** every referenced item exists; subject's head and the proof item are inside
the camera frustum with a safe margin at shot start, middle and end; nothing in the library's bounds lies
between camera and subject or proof; interior sets are enclosed and the mood is an interior one; cast and crowd
counts meet the set's minimum; continuity state holds.
**Stills (one frame per shot, low resolution):** face visible and large enough; proof visible; brightness and
contrast in range; tag and captions do not cover faces; frame is not mostly empty.
**Auto-fix, then re-check:** re-aim or pull back the camera, move a tag, raise a crowd count, switch to an
interior mood, swap to the nearest library item (non-proof only). Anything else blocks.

### Stage 6. Compiler and renderer
A single generic inkbeat composition reads `scene_ir.json` and mounts library components. Render on Kaggle with
the proven recipe (NVIDIA userspace driver, `--gl=angle-egl`). GitHub Actions only orchestrates.

### Stage 7. Post-render QA
Deterministic: duration matches the voice, audio present and at target loudness, no black or frozen stretches,
flicker measure under threshold. Gemini watch: given the story plan, confirm each scene shows its proof and
action and list timestamped defects. Defects map back to a scene and trigger a repair round.

### Stage 8. Delivery and learning
Deliver the MP4 plus a one-page QA record. Per job, record: each gate result, each auto-fix, each fallback, each
re-render, Gemini calls, GPU minutes, queue time. A job that used a fallback for a proof item is never marked
successful. New library items are saved for reuse.

## 4. Infrastructure assumptions

- GitHub Actions: orchestration and state only (no GPU runners are used).
- Kaggle is a best-effort worker. It always runs T4 x2 (the P100 is retired and silently substituted), may
  queue, and has a weekly GPU quota. Jobs must be resumable: every stage writes its output to the repo, so a
  job restarts from the last finished stage.
- Avoid stacking sessions: all gate stills render on CPU or in one short GPU session; one full render per job.
- "Free" means no paid compute, not guaranteed turnaround. Per-video cost and time are measured in stage 8.

## 5. What is kept, changed, retired

| Kept | Changed | Retired after benchmark |
|---|---|---|
| Script adapter, fact-check, Kokoro voice, word timings | Director gains scenes, relations, continuity, beats -> shots | Bean renderer (`ricks/stage`) |
| Gemini MP4 watch | Watch compares against the story plan | `short.json` as the film format |
| Kaggle workflow and driver recipe | Gate rebuilt in three layers for inkbeat | Hand-written scene files (`inkbeat/src/cooper`) become library sources |

## 6. Build order

1. Story director and `story_plan.json` (fixes "no meaning between scenes"; engine-independent).
2. Scene IR schema and validator.
3. Library: lift cabin, ticket hall, tarmac, forest, riverbank, plane, crowd out of the hand-made db_cooper film.
4. Compiler: generic composition driven by the IR. Milestone: db_cooper regenerated from data matches the
   hand-made film.
5. Geometry gate, then stills gate, with auto-fix.
6. Post-render QA wired to repair rounds; job record.
7. Benchmark (section 8).

## 7. Scoring

One versioned rubric, picture criteria out of 70 (composition, environment, characters, lighting, camera, style,
readability) plus two added criteria out of 10 each: story continuity and proof. Before any threshold is fixed,
both existing db_cooper films are scored by a blind judge under this rubric to set the baseline; earlier
figures (34/70, 40/70) came from different samples and are not comparable.

Hard gates block delivery regardless of score. Provisional score bar: 45/70 picture and 6/10 on each added
criterion, to be recalibrated against the owner's own ratings of the benchmark videos.

Builder's target for the finished pipeline is about 7.5/10 overall. This is a hypothesis.

## 8. Benchmark before retiring Ricks

- Three new scripts on different topics, run unattended end to end.
- Pass means: all hard gates pass, score bar met, and the owner accepts each video without asking for fixes.
- Then failure drills: a missing proof asset, a Kaggle interruption mid-job (resume), a script with an unsourced
  claim, a changed library item (cache invalidation).
- Three runs prove the pipeline works once; reliability is judged on the job records as runs accumulate.

## 9. Open points

- Whether stills for the gate can run on CPU fast enough (about 2 min per still locally today) or need one
  short GPU session per job.
- How much of the framing gate geometry alone can settle; measure false passes against the stills layer.
- Whether the character style decision (decision 1) stands after the benchmark videos.
