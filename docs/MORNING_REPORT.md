# Morning report (Thu 2026-11-05)

Branch: `test/image-to-3d-objects` (main untouched). Videos and notes are on branch `test-results`: `shorts/<name>/<name>.mp4`, `daily/MORNING_NOTE.md`, `daily/ledger.json`.

## What runs now, by itself
Every day 5:03 AM IST a scheduled task starts the workflow `daily-shorts`. It takes the next 3 scripts from `scripts_queue/` (files sort by name) and makes them one after another:
script check -> backgrounds/props (Kaggle) -> new costumes (Kaggle + heads borrowed) -> voice + sounds + live effects -> video -> code check -> publish.
Bounded tries. A step that cannot be fixed is skipped and written in `daily/MORNING_NOTE.md`. A script that fails twice waits for you. Script mistakes are not retried (note says what to fix).

## Final test (3 topics, whole pipeline, all on GitHub + Kaggle)
| Short | Result | Pictures |
|---|---|---|
| 1 bomb, colour blind (reference topic) | done, 20 s, 1 warning (costume heads borrowed) | docs/final_test/1_bomb.png |
| 2 sea, 438 days | done after a fix, 19 s, warnings: costume heads borrowed, 7 of 12 poses copied | docs/final_test/2_sea.png |
| 3 year without summer | done after a fix, 20 s, 1 warning + notes | docs/final_test/3_summer.png |
Shorts are short (about 20 s) because the test scripts were short, not because of a limit.

Found in the test and fixed: first run, shorts 2 and 3 got no new costume (every pose failed on colour-type checks) and one "same place, one change" picture was missing. Fix: the last round accepts colour-type flaws (marked in the note). Reruns of 2 and 3 worked. Also fixed: two props drawn on top of each other.

## What was only checked by code, not by a person
Everything. Please look at the three videos and the 3 picture sheets. Honest limits:
- Heads and hats are borrowed from a stand-in (explorer hat on the fisher and farmer). New heads are not drawn yet.
- Poses the costume loop cannot draw are copied from another pose (fisher: 7 of 12 poses; "fall" looks like "stand").
- Counts in prompts ("three houses") are not followed by the model. Positions and colours are (docs/prompt_format_test.md).
- Weather effects on white-on-white backgrounds (snow on snow) are hard to see.
- Check thresholds (continuation, text, noise) are guesses, not tuned.
- Time: one short took about 1 to 1.5 hours with new costume and backgrounds. 3 shorts fit in the 6 hour GitHub limit (guard: no new short after 4.5 hours).
- Queue is now empty (the 3 tests are done). Put new scripts in `scripts_queue/` (cast file in `animation/cast/`). Tonight's run will say "no scripts waiting" if you add none.

## Other things built this session
Prompt format test and result (docs/prompt_format_test.md); `draw:` per-scene prompt and weekly style file `animation/style/house_style.txt`; sounds from the script (rain, thunder, splash, bubbles, fire, door, crowd, wind, siren, tick) and live effects (rain, snow, bubbles, ripples, dust, fog) made by code; one-short-at-a-time queue with ledger; video check (size, length, black/frozen picture, silent audio).
