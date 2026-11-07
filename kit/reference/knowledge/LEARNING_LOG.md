# LEARNING LOG (what the toolkit has learned from reference videos, and what is still missing)

Read `kit/docs/PLAYBOOK.md` for the rules. This file is the history: which videos were studied, how, what was found, what is not known yet.
We keep NUMBERS and RULES only. The reference video files and their frames are NOT stored in this repo (it is public).

## 2026-11-07, session 2: 8 new reference shorts
Videos (720x1280, 30 fps, 56-78 s each): pirate_cannonballs, memory_price, second_draw, mirror_horse_race, storm_oil, perfect_railroads, roller_coasters, town_button.
(Original titles: Levels of Pirate Cannonballs, Every Memory Has a Price, Why the Second Draw Always Wins, How a Mirror Rigged a Horse Race, Why Sailors Carried Storm Oil,
Why Perfect Railroads Don't Work, This Shape Saved Roller Coasters, The Town Built Around a Button.)

How they were studied
1. `kit/tools/ref_study.py study` (new): every frame at 270x480. Dense optical flow, robust affine fit per frame = camera zoom, pan, tilt, roll, depth parallax;
   hard cuts from frame similarity; "flights" (spans of fast whole-picture motion) with length, peak speed and easing; time shares (fast / some / nearly still); audio onsets.
2. `kit/tools/ref_measure.py add` (existing): brightness, saturation, palette, edge detail, held frames, motion. Added to the database as group refs.
3. `kit/tools/ref_sheet.py` (new): one frame per second with red = hard cut, green = flight. Read by eye: all 8 videos (first sheets of each, plus endings of three).
4. Full-size frames (6 character close-ups, 6 world frames) and 0.1 s strips of 4 events (piggy-bank smash, quick draw, cannon impact, horse gallop).
5. `kit/tools/ref_study.py rules` writes `kit/reference/study/_summary.json`; rules written by hand into `knowledge/rules.json`; `kit/tools/build_playbook.py` makes `docs/PLAYBOOK.md`.

Biggest findings (details and numbers in the playbook)
- The references fly a 3D camera (orbit, crane, dolly with parallax) about once every 3 s and cut rarely (median 10 hard cuts/min). Ours cut 58/min and mostly zoom.
- Pure zoom is 0-9 % of reference shots (ours 78 %). Moves are chosen for a reason: reveal, land on a prop, follow, power angle, hold for dialogue.
- Picture richness comes from gradients, texture, light effects (palette 38-47 against ours 23), and much more of the frame moves (frame change 3-9 against ours 0.6-2.6).
- Characters: big near-white head, thick uneven outline, bean body with real clothing detail, noodle limbs; emotion shown with effects (purple head and steam, sweat, yellow irises).
- Story props carry the idea (counters, gauges, ledgers, banners); labels echo the spoken word; endings call back to the opening.

How sure
- Camera and cut numbers: measured on 8 videos. Cut detection was checked by eye on one video (pirate_cannonballs) only, so cuts per minute is about +-25 %.
- Character, texture, effect and story rules: seen by eye with times. Marked `seen` in rules.json.

Not known yet / please share
1. The narration SCRIPT TEXT of each reference (or a transcript). Without it, script-to-picture rules come only from reading captions on frames.
2. The 6 older reference videos (robot-year, Gym Class tunnel, 80 Victories / Red Baron, Tsar garden, Jar Nobel, Pig War) as files, to run the camera study on them. Their colour numbers are in the database; their camera numbers are not.
3. More topics and moods: science / lab, space, kitchen and food, sport, war battle, horror / night, animals and nature, underwater, school / office, fantasy. Each new place and mood adds recipes.
4. Sound: music style, effect timing against cuts, voice style. Only loudness (-14 LUFS) is known.
5. A reference that fails: a video the author does NOT like, so the tool learns what to avoid.

Known limits of the tools
- `ref_study.py` expects burned-in captions in the band 60-78 % of frame height. A video with captions elsewhere needs `CAP0/CAP1` changed.
- Frames with very fast motion blur can look like cuts or hide them. Flights that contain a cut are marked `has_cut_inside`.
- The 6 older videos use an older cut rule, so their `cuts_per_min` is not comparable with the new 8.
