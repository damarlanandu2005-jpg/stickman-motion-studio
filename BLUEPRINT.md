# Blueprint review: script-to-Short pipeline (2026-11-16)

Written for an outside reviewer. Goal of the project: the owner supplies a narration script; the system
produces a finished 40-60 s vertical animated Short with no human fixing, on free infrastructure
(GitHub Actions, Kaggle GPU, Gemini, Kokoro voice).

All scores below are the builder's own estimates, not from an independent judge. Treat them as claims to challenge.

## 1. The two systems today

| | Ours ("Ricks") | inkbeat |
|---|---|---|
| What it is | Data-driven three.js stage: a `short.json` describes sets, flat 2D "bean" puppets, cameras | Remotion + React Three Fiber: scenes are React components, toon-shaded 3D characters |
| Input | Script -> `breakdown.json` -> compiled `short.json` (automated) | Hand-written scene file per film (about 200 lines for 40 s) |
| Characters | Flat bean, stick limbs, swappable face images, no elbows or knees | 3D figure with arms, hands, legs, shoes, clothes, parametric face states, walk cycle |
| Sets and props | Boxes, textured planes, Gemini-painted backdrops and prop images | Code-built 3D props, toon materials, ink outline pass, moods incl. interiors |
| Voice, captions, music | Yes (Kokoro, word timings) | Yes, reusing our voice and word timings |
| Render | Kaggle T4 x2, about 5.5 min for 40 s | Kaggle T4 x2, about 4 min for 40 s (measured once) |
| Checks | Stills gate (brightness, framing flags), Gemini watches the MP4 | None |
| Automation | Script to video end to end | None; one film written by hand |

## 2. What worked

- Script -> fact-check -> voice -> word-timed captions: reliable.
- Render on free Kaggle GPU for both engines. inkbeat needed the NVIDIA userspace driver plus `--gl=angle-egl`;
  with that it renders at about 0.2 s per frame.
- Gemini watching the finished MP4 and listing defects (built for Ricks, proven once).
- inkbeat look: the owner judged the quality acceptable; the Ricks look was rejected.
- Same script (D.B. Cooper) now exists in both engines for direct comparison:
  `results_ricks/db_cooper/short.mp4` and `results_inkbeat/inkbeat_pilot.mp4`.

## 3. Where it failed

| # | Failure | Root cause |
|---|---|---|
| 1 | Empty scenes, missing crowds and secondary props (overnight run of 3 scripts) | Rules about populating scenes were prose in a doc; nothing enforced them. An older doc even said crowds were impossible |
| 2 | Interiors rendered as a lit box in an open field | Engine had no concept of "indoor"; 6 of 9 cabin shots were also untagged |
| 3 | Scene-to-scene cuts have no meaning (both engines) | The plan maps each spoken line to a picture. It never plans where/when each scene is or how it follows from the previous one |
| 4 | Wrong framing (camera on legs, subject at frame edge, tags hidden behind trees) | No automatic check that faces and key props are inside the frame before rendering |
| 5 | Owner receives a video plus a list of known defects | Checking is done by the builder by eye after render; no loop that fixes and re-renders until checks pass |
| 6 | Days lost on wrong conclusions | "inkbeat cannot use the Kaggle GPU" (really a missing driver) and "P100 avoids the queue" (Kaggle retired the P100 and silently runs T4 x2) were accepted without a test |
| 7 | Work spent on single videos | Fixes were made in one `short.json` or one scene file instead of in the generator or the gate |
| 8 | Texture flicker on moving shots (Ricks) | Fine textures alias under camera motion; reduced about 65% by pre-softening, not eliminated |

## 4. Scores (builder's estimate, out of 10)

| Area | Ricks | inkbeat (hand-made film) | Notes |
|---|---|---|---|
| Character quality | 3 | 7 | Largest gap |
| Sets and props | 4 | 6 | inkbeat props are simple shapes but consistent |
| Lighting and style | 5 | 7 | |
| Camera and framing | 4 | 5 | Both fail without a framing check |
| Story continuity between scenes | 3 | 3 | Same planning gap in both |
| Scene population (crowds, dressing) | 4 | 4 | |
| Automation (script in, video out) | 7 | 1 | inkbeat has no generator |
| Self-checking before delivery | 4 | 0 | |
| Render speed and cost | 7 | 7 | Both free; queue on Kaggle is unpredictable |
| **Overall as a product** | **4.5** | **4** | Neither delivers a ready video unattended |

Earlier blind-verifier baseline for Ricks was 34/70 on picture criteria; the bar set for unattended runs is 45/70.
No blind score exists yet for the inkbeat film.

## 5. Proposed blueprint (one pipeline)

Keep everything of ours before the picture; replace the renderer with inkbeat; add the two missing layers.

1. **Script adapter** (keep): fact-check, tighten, voice, word timings.
2. **Story plan** (new): one entry per scene with place, time, who, action, proof, and the link to the previous
   scene (why we cut, what carries over). A scene with no link is rejected here.
3. **Set and cast library** (new, in inkbeat): reusable cabin, desk, tarmac, forest, river, plane, crowd;
   character presets by role and period.
4. **Generator** (new): story plan -> inkbeat scene file. Replaces hand-writing and replaces `short.json`.
5. **Pre-render gate** (rebuild for inkbeat): faces in frame, subject not at edge, tags and props not occluded,
   people count matches the place, interior enclosed. Fixable failures are auto-corrected and re-checked;
   others block the render.
6. **Render** on Kaggle (keep).
7. **Post-render watch** (keep, extend): Gemini watches the MP4 against the story plan; defects go back to
   step 5. Only a passing video is delivered.

Retire: the bean renderer, `short.json`, per-video hand fixes.

## 6. Open questions for the reviewer

- Is replacing the renderer the right call, or is the planning gap (items 3-5 above) the only thing that matters?
- Is a generated React scene file per film maintainable, or should inkbeat be driven by a data file like `short.json`?
- Can the pre-render gate be computed from scene geometry alone, or does it need a rendered still per shot?
- What is a realistic target score for an unattended run, and which criteria should block delivery?
