# LEARNING LOG (what the toolkit has learned from reference videos, and what is still missing)

Read `kit/docs/PLAYBOOK.md` for the rules. This file is the history: which videos were studied, how, what was found, what is not known yet.
We keep NUMBERS and RULES only. The reference video files and their frames are NOT stored in this repo (it is public).

## 2026-11-07, session 3b: audit of the scene counter and the measurable look studies (same 17 videos)
Tools added: `ref_transitions.py` (types of scene change, hand-check, audit), `ref_look.py` (outline, heads, colour and surface, captions, blur, camera speed curves, shake, sound), `build_profiles.py`.
Files: `knowledge/scene_truth.json` (hand labels), `knowledge/transition_audit.json` (per-video table), `look/*.json` and `look/_summary.json`.

Audit of the scene counter
- Hand labels: 43 scene changes in the first 30 s of 4 videos (vp3, pirate_cannonballs, grave_bell, random_numbers). Detector: precision 0.84, recall 0.84 (+-0.75 s). First version had precision 0.73; a colour-layout filter fixed most extras (big camera moves inside one scene).
- Type labels spot-checked on 0.1 s strips: 5 of 6 right. Real dissolves last about 0.2-0.4 s.
- Counts changed: references 16-25 scene changes per minute (median 20.4, gap median 2.4 s, average 2.75 s). Before the filter I wrote 17-27 and 2.1 s: that was too high. Ours is 28.3, about 40 % above the median.
- References: 43 % dissolve, 22 % camera fly-through, 21 % hard cut, 12 % in-place, 2 % whip. Ours: 100 % hard cut. Hard cuts inside a scene: references median 1.1 per minute, ours 25.
- Correction of an older rule: TRN-01 said "motion blur at peak speed". Measured sharpness at the flight peak is 1.05 of the median: there is no motion blur. Fixed.

New measured numbers (all ratios): head size, line width, outline, surface mix (flat / gradient / detail), warm and cool share, captions, edge blur, camera speed curve, shake, sound alignment. See PLAYBOOK tables.
Biggest findings against ours: no captions in our engine; surfaces 60 % flat (refs 35-48 %); heads 13 % of frame height (refs 17 %); scene changes all hard cuts; shake 35 per minute (refs 10).
Limits found: head finder only works on clean near-white heads; caption height is reliable in 8 of 17 videos; scene changes are not aligned to voice onsets (lift 1.0), music and effects cannot be separated from the mixed track; physics trajectories, limb thickness, body proportions and material types are NOT measured.
STATUS: none of this is read by the render code yet.

## 2026-11-07, session 3: 9 more reference shorts (17 camera-studied in total)
Videos: vp3 (Japan pachinko hall), vp4 (lottery ticket), vp5 (two kingdoms and a blacksmith), slot_machines, winning_tickets, idea_zone (sleep and ideas), random_numbers,
knight_loophole, grave_bell. vp3-vp5 are 360x640, the others 720x1280; all 30 fps, 31-78 s.
How: `ref_study.py study` + `ref_measure.py add` on each, picture sheets (`ref_sheet.py`) read by eye for 8 of them, then the new `ref_scenes.py` on all 17 refs and on our v2.1.
Genre groups were written by hand into `knowledge/topic_profiles.json` (per-video values and per-group medians).

What changed in our understanding
- CORRECTION: the hard-cut counter MISSES dissolves and fly-through changes. vp3 showed "0 cuts, 1 shot" while the sheet shows 6+ places. The new counter (`ref_scenes.py`)
  finds scene changes: 17-27 per minute in all 17 references (median 23.6, one every 2.1 s). Ours has 28, so our PACE is close (slightly high). Ours has 58 hard cuts, the references 2-15:
  our extra cuts are angle changes inside a scene. Rules CUT-02, CUT-03, TRN-05.
- Stable across topics (PRF-01): scene pace, parallax 0.32-0.44, palette 36-46, saturation 0.39-0.57. Changes with topic (PRF-02, PRF-03, inferred, small groups):
  action and machine stories fly the camera about half the time; talk, trick and money stories hold about half the time; dark moods go to brightness 0.23-0.38.
- New rules: CAM-13 (when NOT to move), WLD-06 (cutaway view), PRF-04 (number props), recipe number_data. Old numbers in CAM-01..03, CAM-09, CAM-10, CUT-01, LIT-01, checks refreshed to 17 videos.

How sure
- Camera, flight, scene numbers: measured on every frame. Scene counter checked against the picture sheets of vp3, grave_bell and vp4 (times match, a few extra counts from very big camera moves): about +-20 %.
- Topic profiles: groups of 1 to 6 videos, labelled by me. Single examples (science_mind, night_horror) are not ranges.
- Character, prop and world rules: seen by eye with times. Not re-checked on all 9 new videos frame by frame by eye (sheets of 8 read, 1 s step).

Not known yet
1. Not studied: outline thickness (px), exact colours per scene, physics numbers, character animation timing, music and effect timing, caption font/pop, depth of field.
2. The 6 older reference videos have colour numbers only (no camera study, files not kept).
3. More topics: space, nature, kitchen, sport, underwater, school. A disliked video (what to avoid).
4. Nothing here has been tested by building a new video yet. The next test is a v2.2 using the playbook.

Known limits of the tools
- `ref_study.py` expects burned-in captions in the band 60-78 % of frame height. A video with captions elsewhere needs `CAP0/CAP1` changed.
- Very fast motion blur can look like a cut or hide one. Flights that contain a cut are marked `has_cut_inside`.
- `ref_scenes.py` can count one extra change on a very big camera move (crane across a whole city).
- The 6 older videos use an older cut rule, so their `cuts_per_min` is not comparable.

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

## Session 3c - v2.2 controlled test (same script, narration, 36 s, 9:16)
Hand-applied rules (render code still does NOT read rules.json): continuous camera flights, no pure zoom, scene mix (hard cut / dissolve / fly-through / flash), one-word captions, camera shake kicks, line width 3.2, grain + light gradient.
Now inside reference range: hard cuts/min (13 vs refs 2-15), scene changes/min (20), flights/min, flight length, pause, pure zoom (0%), shake/min, ramp times, line width, caption pop.
Still outside: flat surface share 55% (refs 35-48), gradient 7% (refs 14-20), palette 27 (refs 32-45), foreground soft edge 10% (refs 24-61), head size 0.116 (refs 0.12-0.21), parallax 0.47 (slightly high), word stay 0.23 s, caption speed slightly high.
Missing in engine: rules wired into code, richer materials/textures, depth-of-field blur, bigger head framing, physics/animation of objects, classifier labels fly-through/flash as cut/dissolve.

## Session 3d - railroads (unseen topic), script words only
- Script words were read from the burned-in captions of a reference (no frames copied). Pipeline ran from words alone after adding tools/make_notes.py (Gemini writes shot notes, checked word for word).
- v1 (Gemini only, old engine): 19.1 hard cuts/min, 3.2 flights/min, 80% nearly still, 16% zoom-only shots, no captions.
- v2 (Claude polish, rules applied BY HAND in the project; engine still does not read rules.json): hard cuts 7.4, flights 15.9, pause 1.35 s, parallax 0.43, zoom-only 0%, soft-edge frames 36%, shake decay 0.2 s - all inside the reference range.
- Still outside: scene changes/min 18 (low), scene length 3.0 s (high), repeat-move share 0.71 (high), flat colour 49% (high), gradient 10.5% (low), warm share 0.87 (high), cool 0 (low), head size 0.102 (low), line width 0.0047 (low), caption words/s 3.5 (high) and stay 0.2 s (low).
