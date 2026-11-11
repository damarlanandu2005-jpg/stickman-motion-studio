# Engine pipeline (Remotion + React Three Fiber, rendered on Kaggle GPU)

One way to make a ~55-70 s vertical cartoon short in the "2D characters in a 3D world" look. Built on the template of
mromidev/claude-animated-shorts (MIT). The look targets live in his `references/reports/*.md` (private study material, not in this repo).

## The pipeline, in order
0. **Pick a topic** with `engine/scriptfinder` (scores an idea against what the engine can draw). Easy topics first.
1. **Measure the reference** (once per look): one report per topic with numbers, not adjectives. His reports are the source of truth.
2. **Start the short**: `python engine/tools/new_short.py <name>` copies a working project (his method: copy the template, rename).
3. **Write the story file** (scenes, camera keys, STATE) and fill the world/props/cast files. See `CONTRACT.md` for who owns what.
4. **Five owners, one sandbox each** (cam, world, mat, char, post). Each edits only its own files and renders a few stills.
5. **Merge, type-check, re-sync every sandbox** from main before the next round.
6. **Render on Kaggle** (`engine-render` workflow, mode=full): 1 tab, 8 parts, finds bad frames, re-renders only those, splices,
   adds audio + captions. About 7 minutes for 1,701 frames.
7. **QA**: `engine/tools/short_qa.py` (black/white/frozen/pop frames, loudness) and `engine/tools/framecheck.py` (tiled/blank frames).
8. **Blind verifier** (fresh agent, same 7 criteria): `engine/tools/make_sheets.py` builds 3 frames per scene side by side with the reference.
   It scores /70, lists numbered fixes with frame + owner, and judges camera and story logic scene by scene.
9. **Fix by owner**, record the round in `docs/<short>_rounds/`, repeat until the score stops rising. Then ship.

## Commands
- Test the GPU: Actions > "Engine render on Kaggle GPU" > mode=test.
- Full render: mode=full, `project`, `comp`, `total` (frames), `parts`, `audio`, `captions` (or `none`).
- Result: `results_engine/<comp>/<comp>.mp4` + `render_result.json` (frames, bad frames found/fixed, size). The file must stay under 100 MB.
- New short: `python engine/tools/new_short.py street` then edit `mine/street_remotion/src/videos/street/`.
- Scenes from a story file: `python engine/tools/shots_from_story.py story.ts shots.json`.
- Review sheets: `python engine/tools/make_sheets.py video.mp4 shots.json out --ref ref1.jpg ref2.jpg`.

## Rules
- Branch `engine-pipeline` and its children. Never `main`. The old Kaggle/stickman pipeline and scheduled task stay untouched.
- The repo is public: no reference videos, frames or sheets are committed.
- Judge by looking at the picture, not by metrics. Do not claim animation quality from still frames.
