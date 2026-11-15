# Overnight autonomous run — paste this whole block into a new chat

I am ASLEEP and will NOT respond until morning. Operate fully autonomously. Never wait for me,
never ask me a question, never block on my input. For any decision, take the most reasonable option,
write down the assumption, and keep going. I pre-authorize everything below.

## What to do
Read `START_HERE.md` first (repo: damarlanandu2005-jpg/stickman-motion-studio, branch ricks-stage-kaggle),
then `ricks/PIPELINE.md` and `ricks/ENGINE_STRATEGY.md`. Then make THREE finished Shorts from these scripts:
- `scripts/db_cooper.txt`
- `scripts/jungle_fall.txt`
- `scripts/lightning_man.txt`
Run the full pipeline for each (adapter -> director -> casting/assets -> set dressing -> compile -> render),
then verify and deliver. Commit all work to GitHub as you go.

## Fact-checking (do it yourself, do NOT ask me)
Fact-check each story using your own WebSearch / WebFetch tools. I cannot give you Wikipedia or any other
access while I sleep, so do not request it. If a detail cannot be verified, rewrite that line to be
accurate and safe, or drop it — never invent facts and never pause to ask. Keep a short note of any change.

## Rendering (critical settings from START_HERE)
Render on Kaggle with `machine_shape: "NvidiaTeslaP100"` (single P100 — already set; do NOT switch to T4 x2,
it queues). Dispatch `ricks-kaggle.yml` with `mode=full project=ricks/projects/<name> scale=0 force=1`.
Remember: a GitHub run can say "success" while the Kaggle kernel failed — always confirm the real
`results_ricks/<name>/render_result.json` and that `short.mp4` exists and probes to the right duration.
Be aware of the destructive-save bug noted in START_HERE (a failed render can wipe a good mp4); guard against it.

## Watch in the background
While renders run, poll the GitHub Actions runs in background tasks so you know the moment each finishes.
Then run the Gemini verifier (`ricks-watch.yml` / `gemini_watch.py`) on each video and apply reasonable fixes.

## Survive the limit — set up a schedule EARLY
Near the start, before you risk hitting a usage or context limit, create a scheduled task (fresh session each
run) whose self-contained prompt is: "Read START_HERE.md; check which of the 3 videos (db_cooper, jungle_fall,
lightning_man) are already rendered and verified in results_ricks/; continue the pipeline for any that are not;
render on P100; deliver finished videos; when all three are done and delivered, stop this schedule." Run it
every ~60 minutes until all three are delivered, then have it stop itself.

## Deliver
Send each finished MP4 as soon as it's done (don't wait for all three). When I wake, leave one summary:
which videos are done, any facts you corrected, any assumptions you made, and anything that failed.

## Permissions (granted now)
You may, without asking me: run web searches/fetches for fact-checking; generate assets via the Gemini/Kaggle
workflows; commit and push to the ricks-stage-kaggle branch; dispatch GitHub Actions / Kaggle renders;
create and later stop the scheduled task described above. Do not do anything outside making these 3 videos.
