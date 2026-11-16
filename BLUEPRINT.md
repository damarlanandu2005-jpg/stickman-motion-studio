# Blueprint v2.1: script-to-Short production engine (2026-11-16)

Supersedes v1 and v2 (same date). Folds in two rounds of outside review; v2.1 changes are marked (v2.1). Nothing in sections 3-8 is built yet unless marked
"exists". Scores are the builder's estimates and are targets to test, not predictions.

Goal: the owner supplies a narration script; the system delivers a finished 40-60 s vertical animated Short
that has passed its own checks, with no human fixing.

## 1. Decisions

1. **Look (provisional, v2.1):** inkbeat's toon-shaded 3D figure is the leading candidate, not a locked choice.
   The original target was flat 2D characters in a 3D world. The owner decides after three complete automated
   films. Until then the cast library stores roles and attributes (age, period, costume, colours), not
   inkbeat-specific rig settings, so the figure style can still change.
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
`scene_ir.json`, validated against a JSON schema. Two parts, kept apart (v2.1):
- **Semantic scene data** (renderer-neutral): what must be shown, who acts, what they hold, what the camera
  must communicate, in a fixed vocabulary (`walk_with_prop`, `hand_over`, `medium_wide`, `interior_night`).
- **Renderer adapter** (inkbeat-specific, separate file and code): maps each vocabulary term to a component,
  rig action, set slot, mood and camera rig. A term with no adapter entry fails validation.
The semantic file never names an inkbeat component. Illustrative semantic shape:

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
**Stills (sampled per shot, low resolution; v2.1):** shot start, each key action moment, the proof moment, shot
end. A static shot may use two samples; a moving camera or a prop interaction uses all four or more. Checks:
face visible and large enough; proof visible; the action's state is correct at its moment (prop in hand after
a pickup, gone after a hand-over); brightness and contrast in range; tag and captions do not cover faces;
frame is not mostly empty.
**Repairs (v2.1).** Every repair is logged and the shot is re-checked; a repair is never assumed to work.

| Allowed automatically | Must block or go back to the director |
|---|---|
| Small camera re-aim, pull-back, margin change | Changing or dropping a proof item |
| Moving captions and tags | Anything that changes period or historical context |
| Minor light or exposure correction | Replacing a required character |
| Swapping a non-critical dressing item for a same-period one | Changing what an action means |
| | Changing a crowd count the plan set on purpose |

### Stage 6. Compiler and renderer
A single generic inkbeat composition reads `scene_ir.json` and mounts library components. Render on Kaggle with
the proven recipe (NVIDIA userspace driver, `--gl=angle-egl`). GitHub Actions only orchestrates.

### Stage 7. Post-render QA
Deterministic, code-enforced (v2.1): 1080x1920 at 30 fps; valid MP4 that decodes end to end; duration matches
the voice; no black, blank or frozen stretches; flicker under threshold; audio present, no clipping, no
unintended silence, target loudness, voice-to-music balance in range; narration in sync with word timings;
every caption present, on time and inside safe margins. Gemini watch: given the story plan, confirm each scene shows its proof and
action and list timestamped defects. Defects map back to a scene and trigger a repair round.

### Stage 8. Delivery and learning
Deliver the MP4 plus a one-page QA record. Per job, record: each gate result, each auto-fix, each fallback, each
re-render, Gemini calls, GPU minutes, queue time. A job that used a fallback for a proof item is never marked
successful. New library items are saved for reuse.

## 4. Infrastructure assumptions

- GitHub Actions: orchestration and state only (no GPU runners are used).
- Kaggle is a best-effort worker. It runs T4 x2 (the P100 is retired and substituted), may queue, and has a
  weekly GPU quota. Quota and availability are checked at job start, never assumed.
- **Checkpoints (v2.1):** every stage writes a durable checkpoint so a job resumes from the last finished
  stage. Git holds code, schemas, plans and the job record (a manifest with file hashes). Generated stills,
  renders and intermediates go to storage outside Git history (GitHub release assets or Actions artifacts).
- **Render count (v2.1):** one full render active at a time; at most three repair rounds per job, each of which
  may re-render. Gate stills run on CPU or in one short GPU session.
- "Free" means no paid compute, not guaranteed turnaround. Per-video cost and time are measured in stage 8.

## 5. What is kept, changed, retired

| Kept | Changed | Retired after benchmark |
|---|---|---|
| Script adapter, fact-check, Kokoro voice, word timings | Director gains scenes, relations, continuity, beats -> shots | Bean renderer (`ricks/stage`) |
| Gemini MP4 watch | Watch compares against the story plan | `short.json` as the film format |
| Kaggle workflow and driver recipe | Gate rebuilt in three layers for inkbeat | Hand-written scene files (`inkbeat/src/cooper`) become library sources |

## 6. Build order

1. Story director and `story_plan.json` (fixes "no meaning between scenes"; engine-independent). Milestone
   (v2.1): plans for a set of test scripts are validated and read by the owner before any library work starts.
2. Scene IR schema, validator, and the separate inkbeat adapter.
3. Library: lift cabin, ticket hall, tarmac, forest, riverbank, plane, crowd out of the hand-made db_cooper film.
4. Compiler: generic composition driven by the IR. Milestone: db_cooper regenerated from data matches the
   hand-made film.
5. Geometry gate, then sampled-stills gate. Test with deliberate failures first; enable auto-repair after.
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
- Character style (decision 1) is decided by the owner after the three benchmark films.
- Which free storage holds job artifacts, and its size and retention limits.

## 10. Implementation checklist (from the v2.1 review; not a redesign)

- [x] Timelines: a hook, flashback or parallel scene keeps its own continuity snapshot; the first scene's
      relation is `opening`. Built into the story plan and its validator.
- [x] Originality and licence rules restored (`director/DIRECTOR.md`; each plan carries an `originality` block).
      Music licence must be recorded before delivery: not yet done for the existing track.
- [ ] Style decision by direct comparison: one representative scene in flat 2D and in 3D toon, same set, camera,
      narration and action, before the cast library is locked.
- [ ] Duration target: the three test scripts run 40 s; the earlier target was 50-60 s. Owner to decide.
- [ ] Gemini verdicts: every finding carries timestamp, frame reference, defect category and a specific claim;
      test against videos with known defects; an inconclusive result is never a pass; owner review stays in
      place through the benchmark.

## 11. Milestone 1 status (Story Director)

Built: `director/plan_tool.py` (validate, render), `director/DIRECTOR.md`, and plans for db_cooper,
jungle_fall and lightning_man in `director/plans/`. All three pass the validator with fact warnings.
The plans were written by the director model following DIRECTOR.md; nothing has been rendered from them.
Awaiting owner review before any library work.

