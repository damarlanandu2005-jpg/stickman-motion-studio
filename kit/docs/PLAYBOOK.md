# PLAYBOOK: how the reference shorts handle each situation (generated from kit/reference/knowledge/rules.json; do not edit by hand)

READ THIS FIRST. These are HABITS measured and seen in real reference shorts. Learn the habit, do not copy a shot. A new topic needs its own world, props and
story; use the habit for how to show it. Each rule says [id | how sure]: measured = computed from every frame, seen = read by eye with the time given, inferred = reasoned.
Use the SITUATIONS list: find the beat you are planning (hook, new place, key prop, dialogue, impact, ...) and follow its recipe and rule ids.

Studied: pirate_cannonballs, memory_price, second_draw, mirror_horse_race, storm_oil, perfect_railroads, roller_coasters, town_button, vp3 (Japan pachinko hall), vp4 (lottery ticket), vp5 (two kingdoms and a blacksmith), slot_machines, winning_tickets, idea_zone, random_numbers, knight_loophole, grave_bell.

## What our videos do wrong now (measured against these references)
- 58 hard cuts per minute, references 2 to 15 (median 7)
- scene changes per minute 28, references 22 to 27: our PACE of changing place is close (slightly high); the extra cuts are angle changes INSIDE a scene (about 30 per minute) that the references do with camera flights
- 78 % of shots are a pure zoom (push-in), references 0 to 7 %
- the same camera move repeats in the next shot 89 % of the time, references 0 to 63 % (median 33 %)
- camera moves are flat (parallax 0.27, references 0.32 to 0.44): the camera scales the picture, it does not travel through space
- flights are short (0.57 s, references 0.8 to 1.6 s) and the pauses between them are long (2.3 s, references 0.7 to 1.7 s)
- picture moves fast only 21 % of the time (references 27 to 54 %)
- palette 23 colours (references 36 to 46): surfaces are flat, the references use gradients, texture, bloom
- frame-to-frame change 0.6 to 2.6 (references 3.6 to 9.5): too little moves at once

## Measured camera and cut habits (video values, p10 .. p90 over the references; ours in brackets)

| measure | references | ours (claude v2.1) |
|---|---|---|
| hard cuts per minute | 1.80 .. 14.64 (median 6.60) | 58.20 |
| median length between hard cuts (s) | 1.29 .. 19.90 (median 5.53) | 1.00 |
| camera flights per minute | 13.06 .. 24.22 (median 18.40) | 15.00 |
| length of a camera flight (s, median) | 0.81 .. 1.60 (median 1.05) | 0.57 |
| peak flight speed (px per frame at 270 px width) | 6.60 .. 14.50 (median 10.30) | 8.90 |
| pause between flights (s, median) | 0.71 .. 1.73 (median 1.27) | 2.28 |
| depth parallax in flights (0 flat .. 1 strong) | 0.32 .. 0.44 (median 0.39) | 0.27 |
| share of time the picture moves fast | 0.27 .. 0.54 (median 0.40) | 0.21 |
| share of time nearly still | 0.20 .. 0.51 (median 0.35) | 0.43 |
| share of shots that are only a zoom (no pan/tilt/orbit) | 0.00 .. 0.07 (median 0.00) | 0.78 |
| share of shots whose move repeats in the next shot | 0.00 .. 0.63 (median 0.33) | 0.89 |
| scene changes per minute (new place or set-up, incl. dissolves and fly-throughs) | 21.54 .. 26.90 (median 23.60) | 28.30 |
| median length of a scene (s) | 1.99 .. 2.39 (median 2.10) | 1.96 |

All 299 flights together: length p10/p50/p90 = 0.5/1.07/2.82 s, peak speed 4.0/9.7/21.96 px per frame at 270 px width (x11.1 = percent of width per second), easing {'accelerate': 0.0, 'constant': 0.52, 'decelerate': 0.07, 'ease_in_out': 0.25, 'hold_then_move': 0.0, 'move_then_hold': 0.06, 'varying': 0.09}.

## Measured picture habits (23 reference videos, p10 .. p90; ours in brackets)

| measure | references | ours |
|---|---|---|
| brightness (luma 0-1) | 0.31 .. 0.56 (mid 0.47) | 0.24 .. 0.65 |
| contrast (luma std) | 0.17 .. 0.24 (mid 0.20) | 0.17 .. 0.20 |
| darkest 2% of pixels | 0.05 .. 0.17 (mid 0.11) | 0.05 .. 0.14 |
| saturation | 0.39 .. 0.58 (mid 0.48) | 0.17 .. 0.48 |
| palette size (colours >0.5% of the picture) | 32.00 .. 45.00 (mid 39.00) | 17.00 .. 24.00 |
| detail (edge density) | 0.11 .. 0.22 (mid 0.15) | 0.08 .. 0.19 |
| median frame-to-frame change | 3.57 .. 9.49 (mid 6.39) | 0.64 .. 2.62 |
| frames with almost no change (held) | 0.00 .. 0.06 (mid 0.01) | 0.00 .. 0.31 |

## Rules

### CAMERA (how it moves, and why)
- [CAM-01 | measured | for: any] The camera is almost always alive, but not always flying. DO: Plan each beat as HOLD or FLIGHT. Flights run 27-54 % of the time, slow creep or stillness 20-51 %. The mix depends on the topic (see PRF-02). Never leave a long beat with a frozen camera and nothing else moving. NUMBERS: time_moving_fast 0.271-0.537 (median 0.4); time_nearly_still 0.205-0.507 (median 0.355); frames_with_almost_no_change 0-6 % of frames. SEEN IN: all 17 references. (ours now: fast 21 %, still 43 %)
- [CAM-02 | measured | for: any] A flight is about one second long, one every 3 seconds, followed by a short hold. DO: Flight length 0.5-2.8 s, typical 1.1 s. One flight every 2-5 s (13-24 per minute). Hold between flights typically 0.7-1.7 s. Peak speed about 100 % of frame width per second (45-245). NUMBERS: flight_s p10 0.5 / p50 1.07 / p90 2.82; flights_per_min 13.06-24.22 (median 18.4); gap_s median per video 0.706-1.728; peak_px_per_frame p10 4.0 / p50 9.7 / p90 21.96. SEEN IN: 299 flights in 17 references. (ours now: flight 0.57 s, pause 2.3 s)
- [CAM-03 | measured | for: any] Move the camera through the 3D world. Do not just zoom. DO: Every flight changes camera POSITION: orbit 20-60 degrees, crane up or down, dolly past objects, tilt while pushing. Foreground, subject and background must slide at different speeds (parallax). A pure push-in or pull-out with no pan, tilt or orbit is rare: use it for 0-7 % of shots. NUMBERS: pure_zoom_shots 0-7 % (median 0); parallax_ratio 0.322-0.438 (0 flat, 1 strong); shot_net_motion shots that combine a push or pull with a pan, tilt or orbit make up about 90 % of all shots (80-100 %). SEEN IN: pirate_cannonballs 0-1.2 s (orbit around the cannon, sea and island revealed); memory_price 4-7 s (fly down an alley into the shop). (ours now: 78 % pure push-in, parallax 0.27)
- [CAM-04 | seen | for: new_place, explain_system] REVEAL: start tight on a detail or a face, then fly out, up or around until the place or its size is clear. DO: Frame 1: face or small object. Last frame: wide view with the hero object of the topic in it. Use crane-up or top-down to show layout or scale of a system. SEEN IN: town_button 4-7 s (crane up to a top view of the circular town); roller_coasters 1-3 s (tilt up the loop); mirror_horse_race 12-14 s (street and hill revealed).
- [CAM-05 | seen | for: key_prop, action_impact] LAND ON THE PROP: a fast push toward the named prop that slows down as it arrives, timed to the word. DO: Start 0.3-0.5 s before the word, arrive on the word. End with the prop filling 40-100 % of the frame, readable. Ease: fast start, slow finish (decelerate). SEEN IN: second_draw 14-15 s (push to the gun while yellow streaks fly); town_button 23-25 s (button under the glass dome); memory_price 28-31 s (HAPPINESS gauge).
- [CAM-06 | seen | for: danger, any] Power and danger: low angle, big object in the foreground. DO: Camera at ground height looking slightly up, holster or weapon or hull edge large and sharp in the lower third, subject behind. SEEN IN: second_draw 0-4 s (bullet and holster in the foreground, camera tilts up to the face).
- [CAM-07 | seen | for: action_impact, danger] FOLLOW: when something travels, the camera pans or tracks with it and the background streams by. DO: Keep the mover in the same screen spot, let the background slide, constant speed. SEEN IN: mirror_horse_race 27-31 s (horse gallops, camera tracks); pirate_cannonballs 4-5 s (ball flies past).
- [CAM-08 | seen | for: dialogue] Dialogue and reaction beats are HELD: two-shot or close-up, slow creep, 1.5-4 s. DO: Save the fast flights for reveals and impacts. Change only the faces and small props while the camera rests. SEEN IN: second_draw 9-13 s (four seconds on one medium shot); storm_oil 7-11 s (captain and chef two-shot).
- [CAM-09 | measured | for: any] Ease every flight. Half are steady, a quarter ease in and out. DO: constant speed 50 % of flights (follow, long gentle drift). ease in and out 23 % (reveals). decelerate 8 % (landing on a prop). move then hold 7 %, varying 10 %. almost never accelerate. NUMBERS: ease_share {'accelerate': 0.0, 'constant': 0.52, 'decelerate': 0.07, 'ease_in_out': 0.25, 'hold_then_move': 0.0, 'move_then_hold': 0.06, 'varying': 0.09}. SEEN IN: 172 flights. (ours now: 67 % constant, 22 % ease, 11 % accelerate)
- [CAM-10 | measured | for: any] Do not repeat the same move beat after beat. Vary push, pull, orbit, tilt, pan, top-down, low angle, first person. DO: Never more than two beats in a row with the same kind of move. Change camera height or angle at least every 2-3 s of flight time. NUMBERS: repeat_in_next_shot 0.0-0.633 in references (median 0.333), 0.89 in ours. SEEN IN: 8 references. (ours now: 89 % repeat)
- [CAM-11 | seen | for: any] Use shot size as a language: tiny people in a wide world, medium two-shots, face close-ups, extreme close-ups of props. DO: Wide: people under 10 % of frame height, the world is the subject. Medium: people 35-50 % of frame height. Close-up: head 40-60 % of frame width. Insert: prop fills the frame. Change size at nearly every sentence. SEEN IN: pirate_cannonballs 0-20 s; memory_price 19-31 s.
- [CAM-12 | seen | for: any] Frame with something blurred in the foreground at an edge (rope, pole, rail, mast, leaves) to build depth. DO: One soft foreground object on one side, subject sharp behind it. SEEN IN: perfect_railroads 14-17 s; pirate_cannonballs 12-14 s; roller_coasters 10-15 s.
- [CAM-13 | seen | for: dialogue, introduce_character, number_data, explain_system] WHEN NOT TO MOVE: hold the camera when a person talks, thinks, reacts, or when a number or a rule is being read. WHY: The viewer needs a steady frame to read a face, a caption or a number. Moving the camera there competes with the information. DO: Hold 2-6 s (up to 10 s once) on one medium shot or close-up. Keep life in the frame while the camera rests: eyes, mouth, small gestures, light flicker, floating particles, a slow creep of 1-3 %. Move again at the next scene change or the next reveal. NUMBERS: time_nearly_still_per_video 0.205-0.507 (median 0.355); highest 0.53-0.54 in vp3 and vp4; frames_fully_held 0-6 % (something always moves). SEEN IN: idea_zone 0-10 s (one character on a chair under a lamp, almost still); vp5 0-6 s (king, blacksmith and anvil); random_numbers 15-23 s (clerk beside the elevator panel); vp4 3-8 s (clerk and customer at the counter).

### CUTS
- [CUT-01 | measured | for: any] Hard cuts are rare: a few per minute. The camera and dissolves carry most scene changes (see CUT-02). DO: 2-15 hard cuts per minute, median 7. Do not cut just to change the angle: fly the camera instead. Use a hard cut for a new place, a new time, or a change of topic. NUMBERS: hard_cuts_per_min p10 1.8 / median 6.6 / p90 14.64 (min 0.0, max 17.9); long_takes vp3: 0 hard cuts in 45 s, yet 13 scene changes made by dissolves and fly-throughs (see CUT-02). SEEN IN: 17 references. (ours now: 58 per minute)
- [CUT-02 | measured | for: any, transition] The PLACE or set-up changes about every 2 seconds. Three of every four scene changes are made WITHOUT a hard cut. WHY: Fast change of place keeps attention. A fly-through or a dissolve changes the place while the viewer's eye stays with the moving picture, so it feels smooth, not choppy. DO: Change scene (new place, new angle on a new set-up, new prop focus) every 1.8-2.6 s, 21-27 times per minute. Make the change with a camera fly-through, a short dissolve, a whip or a wipe. Use a hard cut only about 1 time in 4. NUMBERS: scene_changes_per_min p10 21.54 / median 23.6 / p90 26.9 (min 17.3, max 27.4); scene_length_s median 2.1 (p10 1.988, p90 2.388); hard_cuts_per_min_for_comparison median 6.6. SEEN IN: 17 references; scene times checked against sheets of vp3 (changes at about 2, 5, 10, 16, 27 s), grave_bell and vp4. (ours now: 28 per minute: just above the 22-27 range, close)
- [CUT-03 | measured | for: any] Do not cut to a new angle inside the same scene. Stay in the place and move the camera. WHY: The references hold one world for about 2 s and fly through it; every extra cut inside the scene breaks the 3D space the viewer just understood. DO: Count: hard cuts per minute should be at most about the scene changes per minute, and far fewer in practice (references median 7 against 24). A hard cut must land on a NEW place or a new beat of the script, never just a new angle of the same set. NUMBERS: ours_hard_cuts_per_min 58.2; ours_scene_changes_per_min 28.3; references_hard_cuts_per_min 1.8-14.6. SEEN IN: claude_bomb_v21 against 17 references. (ours now: about 30 hard cuts per minute are angle changes inside a scene)

### TRANSITIONS
- [TRN-01 | seen | for: transition] Carry the viewer to the next beat with the camera: fly through, into or under the next place, with motion blur at peak speed. DO: End a flight pointing at the next location, start the next beat already moving. SEEN IN: memory_price 4-8 s (alley, light-lined corridor, shop interior in one move); perfect_railroads 7-10 s (bridge, blur, station).
- [TRN-02 | seen | for: transition, time_passes, emotion_shift] Cross-dissolve 4-10 frames, with a ghost of the old picture, for memory, thought, time shift or a change of speaker. DO: Overlap both pictures at 50 % for 2-3 frames. SEEN IN: memory_price 42-46 s (ghost of the hooded buyer over the boy); mirror_horse_race 3 s and 27 s; second_draw 13.6 s (dissolve to the quick-draw man).
- [TRN-03 | seen | for: transition] Round masks: spyglass circle on black for looking at something far, round windows as frames, a black circle closing as an eye. DO: Use rarely, once or twice per short, for a view-through or a turning point. SEEN IN: mirror_horse_race 18 s (spyglass on the race); second_draw 44-53 s (black circle, then round windows).
- [TRN-04 | seen | for: transition, action_impact] Smoke or cloud wipe: a puff fills the frame, the next place is behind it. DO: Smoke grows over 6-10 frames, clears into the new scene. SEEN IN: pirate_cannonballs 17.5-18.5 s (cannon smoke to open sea).
- [TRN-05 | seen | for: transition, new_place] Most scene changes are either a fly-through (the camera passes into the next place) or a short cross-dissolve where both places show for a moment. WHY: Both keep the picture moving across the change, so the viewer does not feel a jump. DO: Dissolve when the next place is far away in space or time: the old picture ghosts through the new one for roughly 0.3-1 s (estimated from 1 s samples). Fly-through when the next place is next door: the camera ends pointing at a door, street or panel, and the next shot starts already moving. SEEN IN: vp3 10 s, 16 s, 24 s (dissolves between prize hall, counter and street); random_numbers 10-11 s (ghost of the tower over the office); knight_loophole 24 s; vp3 2-5 s (neon street seen from above, camera drops to the door).

### STORY SHAPE
- [END-01 | seen | for: ending] End with a callback: return to the first place or object, changed. DO: Last shot repeats the opening place or prop, with the final idea visible on it. SEEN IN: second_draw 54-55 s (street scene like the opening); town_button 64-65 s (crowd around the button from the first shot).

### SCRIPT TO PICTURE
- [SCR-01 | seen | for: any] One idea per sentence, one picture per idea. New place or angle at every sentence, new face or prop at every clause. DO: Narration runs about 2.5-3 words a second, captions show 1-3 words. NUMBERS: voice_onsets_per_s 2.8-3.5. SEEN IN: 8 references.
- [SCR-02 | seen | for: any] Show every important noun. Turn abstract ideas into an object: memory = ticket and shelves of boxes, happiness = gauge, time = ledger of years, rules = a button under glass. DO: List the nouns of each sentence before planning the shot and check each one appears. SEEN IN: memory_price; town_button; mirror_horse_race.
- [SCR-03 | seen | for: hook] Hook in the first 2-3 seconds: a face reacts, the main prop or place is in frame, and the first flight starts within the first second. DO: First fast flight starts at frame 1-27 (0.03-0.9 s) in 7 of 8 references; 2 of them start at frame 1-3. SEEN IN: pirate_cannonballs 0 s; second_draw 0 s; memory_price 0 s.
- [SCR-04 | seen | for: any] Story shape: hook, set up the world with a reveal flight, escalate with a new place every 3-6 s, twist or payoff with a gag, callback ending. DO: Plan the shot list in these five blocks. SEEN IN: second_draw; memory_price; town_button.

### LIGHT
- [LIT-01 | measured | for: any] Every frame has a deep shadow and a near-white highlight. Mean brightness is 0.30-0.54 for most stories, down to 0.23 for a dark-room mind story. DO: Darkest 2 % of pixels 0.07-0.15, brightest 2 % 0.84-0.98, contrast std 0.16-0.25. Night is not dim: lamps, windows and moon are bright, the subject is lit. NUMBERS: brightness_video_median 0.23-0.62 over 17 videos (p10-p90 0.30-0.54); day war/engineering about 0.5, night or mind stories 0.23-0.38; p2 0.07-0.15; p98 0.84-0.98; contrast_std 0.16-0.25. SEEN IN: 8 references. (ours now: mean 0.37, but flat)
- [LIT-02 | seen | for: any] One dominant colour family per place, with warm against cool. DO: Night: navy and purple with warm lamp and window pools. Day: saturated blue sky, orange or sand ground. Sunset: orange glow, long violet shadows. Indoors: warm lamp pool on cool walls. Pick the family before building the set. SEEN IN: memory_price 5-15 s (blue street, yellow shop windows); second_draw 26-30 s (orange sunset, long shadows); roller_coasters 16-28 s (moonlit blue, warm lanterns and lights).
- [LIT-03 | seen | for: emotion_shift] Colour follows feeling. Change the grade at the emotional turn. DO: Sad, ill, lonely: cold blue, low key light. Warm memory, joy: golden hour, soft glow. Danger, duel: low orange sun, hard long shadows. Power, shock: bright yellow streaks or rim light. SEEN IN: memory_price 32-45 s (blue hospital against the golden lake); second_draw 26-31 s.
- [LIT-04 | seen | for: any] Use light effects as scenery: bloom on lamps, windows and sun; god rays through glass; sun glare in the sky; rim light on night characters; string lights; wet-street reflections and rain streaks at night. DO: At least one light effect in every wide shot. SEEN IN: town_button 23-25 s (beams through the glass dome); perfect_railroads 16 s (sun glare); roller_coasters 21 s (string lights, lantern).

### COLOUR AND TEXTURE
- [COL-01 | measured | for: any] The reference picture has 38-47 colours and soft gradients. Flat colour with an outline gives 23. Add gradient, texture and light, not more coloured boxes. DO: Sky gradient with soft clouds that have a shaded underside. Ground and walls with grain, stones, tufts. Atmosphere: haze that turns far things bluer and lighter. Bloom and soft shading with 3-4 steps plus ambient occlusion in corners. NUMBERS: palette_new_8 38-47; palette_14_refs_p10_p90 30-41; saturation 0.42-0.58; edge_detail 0.11-0.21; frame_to_frame_change_median 3.1-9.4. SEEN IN: db for 14 references. (ours now: palette 23, v2.1 added coloured props and palette did not rise)

### WORLD, SETS, TEXTURES
- [WLD-01 | seen | for: new_place] Each place: 6-10 dressing pieces plus one HERO object or shape that is the topic. DO: Canyon wall with coloured strata for a railroad story, one giant loop for a roller-coaster story, a plaza of rings with a button under glass for the button story, a ship deck with cannons and barrels for the cannonball story. SEEN IN: perfect_railroads 3-6 s; roller_coasters 1-9 s; town_button 4-10 s.
- [WLD-02 | seen | for: new_place] Surfaces have real texture. DO: Rail ballast as single stones with highlights, sleepers, steel rail with gloss. Sand with pebbles and grass tufts, wood planks with grain and nails. Tile plaza with ring pattern, checker floor, brick. Grass as many thin blades, water with caustics and foam, glass with highlights. SEEN IN: perfect_railroads 16 s; second_draw 10 s; storm_oil 12 s; town_button 8 s; memory_price 16 s (pool caustics); roller_coasters 21 s (grass blades).
- [WLD-03 | seen | for: new_place] Three depth layers: soft foreground, sharp middle, hazy background with silhouettes (islands, hills, skyline, ships). DO: Put a far landmark in every wide shot. SEEN IN: pirate_cannonballs 1-5 s; storm_oil 2-3 s.
- [WLD-04 | seen | for: new_place] Outline: thin dark ink on the silhouettes of props and structures. No line on sky, water, clouds, ground joins. DO: Characters keep the thickest line. SEEN IN: storm_oil 12 s (pot, hull); pirate_cannonballs 12 s.
- [WLD-05 | seen | for: crowd] Crowds are real: hundreds of tiny people with different hats and colours in stands and streets, and a few larger ones in front. DO: Rows rising in height, flags and bunting, a few people animated. SEEN IN: mirror_horse_race 18 s and 27-31 s; town_button 64-65 s.
- [WLD-06 | seen | for: explain_system, new_place] CUTAWAY: show hidden things (underground, inside a body, deep water) as a sliced side view with a scale or gauge. WHY: A side slice shows layers and depth at once, so one picture explains where things are. DO: Cut the world like a cake: soil layers with a coffin under the grass, the character as a see-through body with the brain and nerves glowing, an underwater column with a depth gauge and level labels. Label the layers in the world itself, in big letters. SEEN IN: grave_bell 4-9 s (grass, soil layers, coffin, rope up to the bell); idea_zone 13-18 s (see-through body, brain, nerves); idea_zone 24-27 s (sleep depth as underwater gauge).

### CHARACTERS
- [CHR-01 | seen | for: introduce_character, any] Character anatomy: big near-white head, bean body with real clothing details, thin noodle limbs. DO: Head: circle slightly wider than tall, soft warm-grey shade on the lower rim, thick uneven near-black outline about 3-4 % of head width. Body: bean as tall as the head, with pocket, buttons, medals or braid, belt, collar, prints (flowers, stripes, dots). Arms: thin lines about as long as the body, small round hands. Legs: very thin, 1.3-1.8 times the body, no feet. Whole figure about 3.5 head heights. SEEN IN: frames memory_price 20.5 s, perfect_railroads 18.2 s, second_draw 15.5 s, town_button 11.2 s, roller_coasters 5.2 s, storm_oil 10.2 s.
- [CHR-02 | seen | for: introduce_character] Identity from headwear and clothes: bowler, chef hat, striped cap, cowboy hat, bandana, tricorn, top hat, police cap. DO: One hat shape and one colour per role, kept in every shot. Hats move with the head and fly off when the body is hit. SEEN IN: 8 references.
- [CHR-03 | seen | for: any] Lit by the scene: skin takes a warm or cool tint, soft gradient, soft contact shadow on the ground. DO: No flat white paper-cut look. SEEN IN: memory_price 50-54 s (warm lamp on the face); second_draw 26-30 s (long shadows).
- [CHR-04 | seen | for: any] Characters hold props with their noodle arms and touch the set (ladle, hammer, telescope, mug, cane, gun, pole). DO: Every character in a medium shot holds or touches something. SEEN IN: storm_oil 0-18 s; roller_coasters 0-9 s.

### FACES AND EMOTION
- [FAC-01 | seen | for: any] Tiny face, strong emotion language. DO: Eyes: white ring with outline and dot pupil, or plain dots. Eyebrows: thick short strokes, they carry the feeling. Mouth: line, smirk, open D, teeth grid. Extras: moustache strokes. In close-ups change the expression every 1-1.5 s. SEEN IN: second_draw 8-20 s; memory_price 58-63 s.
- [FAC-02 | seen | for: emotion_shift, comedy_gag] Emotion vocabulary with effects drawn on or around the head. DO: Anger: head turns purple, white steam puffs on both sides, V brows, gritted teeth. Fear: wide ring eyes, 2-3 sweat drops, teeth grid. Shock: yellow glowing irises, vein mark, speed streaks. Smug: half-closed eyes, smirk. Knocked out: face-down, hat off, X or spiral eyes. Joy: closed arc eyes, big smile. Sick: pale, tired eyes. SEEN IN: perfect_railroads 18 s (purple, steam); second_draw 15 s (sweat, yellow eyes); second_draw 19-20 s (knocked out).

### TOPIC PROFILES (what stays the same, what changes with the topic)
- [PRF-01 | measured | for: any] UNIVERSAL for every topic (stable across all 17 videos): scene pace, depth parallax, colour richness. WHY: These values barely move between a war story, a lottery story and a sleep story, so they are the house style, not a topic choice. DO: Scene change every 1.8-2.6 s. Camera parallax 0.32-0.44. Palette 36-46 colours, saturation 0.39-0.57, edge detail 0.11-0.22. Pure zoom shots at most 7 %. NUMBERS: scenes_per_min 21.5-26.9; parallax 0.32-0.44; palette p10 35.8 / p90 45.8; saturation p10 0.39 / p90 0.57. SEEN IN: kit/reference/knowledge/topic_profiles.json (per video values).
- [PRF-02 | inferred | for: any] TOPIC DECIDES how busy the camera is. Action and machines: flying about half the time. Talk, tricks and money: holding about half the time. WHY: Moving objects (armies, coasters, trains) give the camera things to follow; talk and number stories need steady frames to read. DO: history_war, engineering: fast 45-51 % of time, still 24-27 %, frame change 7.5-7.6. money_gamble_crime: fast 30 %, still 49 %, frame change 4.8. Pick the profile from the topic, then keep scene pace and parallax from PRF-01. NUMBERS: history_war_n6 fast 0.45, still 0.27, change 7.5; engineering_n3 fast 0.51, still 0.24, change 7.6; money_gamble_crime_n6 fast 0.30, still 0.49, change 4.8. SEEN IN: topic_profiles.json; the grouping into topics is my label, group sizes 3 to 6.
- [PRF-03 | inferred | for: any] MOOD decides brightness. Day stories sit near 0.5, night and mind stories go down to 0.23-0.38 but keep bright accents. WHY: The dark rooms and nights in the references stay readable because lamps, neon, windows and glows are the brightest, and the characters are lit. DO: Dark mood: set the ambient low, add one strong motivated light (lamp cone, neon, moon, candle) and keep the character face near white. Day mood: sky and ground bright, shadows blue or purple, not black. NUMBERS: day_war_engineering_median 0.46-0.50; night_mind_range 0.23 idea_zone, 0.28 vp3 neon night, 0.31 memory_price, 0.36 grave_bell. SEEN IN: idea_zone 0-10 s (lamp cone on a dark room); vp3 2-5 s (neon night street); grave_bell 10-20 s (blue snow night, warm lit windows).
- [PRF-04 | seen | for: number_data, key_prop] MONEY, GAMBLING and NUMBER stories carry the idea on a big object with numbers: a register, a counter, a panel of lights, a scoreboard, a ticket. WHY: The audience reads the number once and understands the stake; the prop makes the data physical. DO: Build one hero number prop per story: large, high contrast, readable at phone size. Let it change on the spoken word (counter rolls, light turns on, ticket value appears). Put a bright, saturated, crowded place around it (neon, carpet, shelves) so the number prop stands out by being clean. SEEN IN: vp4 3 s (register showing 1,000,000 dollars); vp5 7-8 s (YEARS AT WAR counter rolls 099 to 100); random_numbers 14-24 s (elevator panel of numbered lights); vp3 5-8 s (endless row of machines in perspective).

### PROPS, TEXT, NUMBERS
- [PRP-01 | seen | for: key_prop, number_data] The key idea of the story is a readable prop with text or numbers. DO: Odometer counter (BAHAMAS 0299), gauge (HAPPINESS needle and glow), odds board (MILK RUN 100-1), banner (OPENING TOMORROW), ledger (YEAR 2025 SOLD stamps), stopwatch, newspaper headline, polaroid. Text unlit and spelled the same every time. SEEN IN: memory_price 20 s, 28-31 s, 56-57 s; mirror_horse_race 4-7 s; roller_coasters 10-15 s.
- [PRP-02 | seen | for: any] A prop appears in frame within about 0.3 s of the word that names it, and its label can repeat the word. DO: Barrel labelled GARBAGE while the narrator says garbage; barrel LANGRAGE while he explains langrage. SEEN IN: pirate_cannonballs 15-18 s; mirror_horse_race 4 s.
- [PRP-03 | seen | for: number_data] Numbers move with the story: the needle swings, the glow grows, the ledger fills with SOLD stamps year after year. DO: Animate the value over 1-2 s on the beat it changes. SEEN IN: memory_price 28-31 s; memory_price 56-57 s.
- [PRP-04 | seen | for: any] Motifs: one recurring character or object (frog badge, hooded buyer, red button) returns at least three times, each time in a new light. DO: Reuse the exact model and colour. SEEN IN: memory_price 0-63 s; town_button 0-65 s.
- [PRP-05 | seen | for: explain_system, number_data] Draw the idea inside the world: glowing ring with chalk arcs and numbers, blackboard with a sketch, map. DO: Use when the script explains a mechanism or counts something. SEEN IN: town_button 16-20 s (ring with 23 24 25 and arcs); roller_coasters 7-8 s (blackboard).

### EFFECTS
- [FX-01 | seen | for: action_impact, comedy_gag] Anticipation, action, follow-through. DO: Smash: hold the raised hammer at least 0.6 s, hit, the object bulges for 1-2 frames, bursts into pieces within 0.2 s, pieces and coins keep flying 0.5-1 s. The bystander reacts within 0.2 s. SEEN IN: mirror_horse_race 0.4-1.5 s (piggy bank).
- [FX-02 | seen | for: action_impact] Impact starburst: radial spiky shards in 2-3 layers, smoke puff, flying splinters that spread for about 0.8 s, hole shows what is behind. DO: Cut or push to the impact point, then pull back to show the crowd reacting. SEEN IN: pirate_cannonballs 6.5-8 s (ball through the hull).
- [FX-03 | seen | for: action_impact, danger] Speed streaks: bright yellow vertical streaks, flying pebbles and dust around a fast draw or jump, with a quick push-in. DO: Streaks for 0.5-1 s, camera ends on the weapon or hand. SEEN IN: second_draw 13.6-16 s.
- [FX-04 | seen | for: any] Always a few particles: dust, pebbles, rain, confetti, coins, smoke puffs, steam, sparks, bubbles, floating motes. DO: Particles move in every wide and action shot. SEEN IN: 8 references.

### PHYSICS
- [PHY-01 | seen | for: action_impact, comedy_gag] Things have weight. DO: Debris follows gravity arcs and spins, hats fly and fall, bodies fall with rotation then lie still, barrels roll, a cannon recoils, a horse gallops with a rider bob, camera tracks the mover. SEEN IN: second_draw 17-20 s (falls face-down, hat off); pirate_cannonballs 7-9 s; mirror_horse_race 27-31 s.
- [PHY-02 | seen | for: comedy_gag] Comedy: a visual gag after a hard beat (a knocked-out man whose face is stamped in the sand ring), exaggerated reaction faces, size contrast. DO: Hold the gag shot 1-1.5 s. SEEN IN: second_draw 19-20 s.

### CAPTIONS
- [CAP-01 | seen | for: any] Captions: bold white, thick black outline, centred at about 70 % of frame height, 1-3 words at a time, changing with the voice. DO: Keep the caption band free of important detail. SEEN IN: 8 references.

### SOUND
- [SND-01 | measured | for: any] Final loudness about -14 LUFS, loudness range 1.7-3.2 LU. DO: Master to -14 LUFS. SEEN IN: 8 references, ours -13.9.

## Recipes by situation (shot plans)

- HOOK (0-3 s): 1) First flight starts within 1 s. 2) Close on a reacting face, main prop or place visible. 3) First flight ends on the hero object by 1.5-3 s. Rules: SCR-03, CAM-04, CAM-02.
- NEW_PLACE (2-4 s): 1) Start tight on a detail or face. 2) Fly out, up or around 0.8-1.6 s with ease in and out. 3) End on a wide with the hero object, a far landmark and 6-10 dressing pieces. 4) Hold 0.5-1 s. Rules: CAM-04, WLD-01, WLD-02, WLD-03, LIT-02.
- INTRODUCE_CHARACTER (1.5-3 s): 1) Medium shot, character readable by hat and clothes. 2) Expression first, then a prop in the hand. 3) Slow creep. Rules: CHR-01, CHR-02, FAC-01, CAM-08.
- KEY_PROP (1-2 s): 1) Fast push that decelerates onto the prop on the word. 2) Prop fills 40-100 % of the frame, text readable. 3) Light effect on it (glow, glass highlight, bloom). Rules: CAM-05, PRP-01, PRP-02, LIT-04.
- DIALOGUE (1.5-4 s): 1) Two-shot or close-up held. 2) Camera creeps under 8 % per second. 3) Face changes every 1-1.5 s. Rules: CAM-08, FAC-01.
- ACTION_IMPACT (1-2.5 s): 1) Anticipation hold 0.6 s. 2) Push to the point of action with streaks or starburst. 3) Debris 0.5-1 s. 4) Pull back, bystander reaction within 0.2 s. Rules: FX-01, FX-02, FX-03, PHY-01, CAM-05.
- EXPLAIN_SYSTEM (3-5 s): 1) Crane to top-down to show the layout. 2) Draw the idea in the world (ring, arcs, numbers). 3) Come back down to a character reacting. Rules: CAM-04, PRP-05.
- EMOTION_SHIFT (1-3 s): 1) Change the colour grade on the cut or the dissolve. 2) Face shows the new feeling with its effect (steam, sweat, tears). Rules: LIT-03, FAC-02, TRN-02.
- TIME_PASSES (1-2 s): 1) Dissolve with ghost. 2) Show a clock, calendar, ledger or season change. 3) Light changes with the time. Rules: TRN-02, PRP-03.
- CROWD (2-3 s): 1) Wide from low or high. 2) Hundreds of tiny varied people in rows, bunting, a few animated. 3) Cut or fly to one face in the crowd. Rules: WLD-05, CAM-11.
- DANGER (1.5-3 s): 1) Low angle, big prop in the foreground. 2) Hard long shadows, orange low light. 3) Hold, then a sudden push. Rules: CAM-06, LIT-03.
- COMEDY_GAG (1-2 s): 1) Land a hard beat first (impact, fall, reveal). 2) Cut or push to the gag picture: knocked-out face stamped in a sand ring, exaggerated stare, size contrast. 3) Hold 1-1.5 s with only a small motion (dust settling, eye twitch). Rules: PHY-02, PHY-01, FAC-02.
- ENDING (2-4 s): 1) Return to the first place or object. 2) Slow pull back, final line on the prop or a face. Rules: END-01.
- NUMBER_DATA (4-7 s): 1) Medium shot, character beside the big number prop, camera holds (CAM-13). 2) On the key word push toward the prop and land on it with the number readable (CAM-05). 3) The number changes on the spoken word (counter rolls, panel light turns on). 4) Fly out or up to show what the number means in the world (skyline, crowd, line of people). Rules: CAM-13, CAM-05, PRP-01, PRF-04.

## Checks (run on a finished video)
- CHK-01: hard cuts per minute should be 1.8 .. 14.6 (python3 kit/tools/ref_study.py compare video.mp4)
- CHK-08: scene changes per minute (new place or set-up, incl. dissolves) should be 21.5 .. 26.9 (same)
- CHK-09: hard cuts should be well below scene changes (angle cuts inside a scene) (compare the two numbers above)
- CHK-02: share of shots that are only a zoom should be 0 .. 0.07 (same)
- CHK-03: share of time the picture moves fast should be 0.27 .. 0.54 (same)
- CHK-04: depth parallax in flights should be 0.32 .. 0.44 (same)
- CHK-05: palette size (4-bit colours over 0.5 %) should be 32 .. 45 (python3 kit/tools/ref_measure.py compare video.mp4)
- CHK-06: frame-to-frame change (median) should be 3.6 .. 9.5 (same)
- CHK-07: script match: every noun of each sentence appears within 0.3 s of the word (manual until the script-match check is built (step 2))

## Limits of this knowledge
- 17 camera-studied videos, all in one house style (3D world, 2D bean-head cards, one-word captions). Another genre may need other values.
- Topic groups (history/war 6, money-gamble-crime 6, engineering 3, science-mind 1, night-horror 1) are my labels. Groups of 1 to 3 are single examples, not ranges.
- Hard cuts are counted from frame similarity. Scene changes (dissolves, fly-throughs) are counted by a second tool and checked by eye against the picture sheets of 3 videos (timestamps matched, a few extra counts from very big camera moves). Treat both as about +-20 %.
- 3 of the videos (vp3, vp4, vp5) are 360x640; the rest 720x1280. Numbers are taken at 270x480, so they compare, but fine texture and outline thickness need the 720 ones.
- The 6 older reference videos are in the colour database but NOT in the camera study (their video files were not kept).
- Not studied yet: outline thickness in px, exact colours per scene, physics numbers (fall, bounce, gallop), character animation timing (walk, blink, mouth), music and effect timing, caption font and pop, depth of field. Only loudness (-14 LUFS) is known for sound.
- No script text for the references. Script-to-picture rules come from reading the captions on frames.

## How this grows
Add a reference: `python3 kit/tools/ref_study.py study video.mp4 --name NAME --group refs`, `python3 kit/tools/ref_measure.py add video.mp4 --name NAME --group refs`, `python3 kit/tools/ref_sheet.py video.mp4 kit/reference/study/NAME.json /tmp/NAME` (look at the sheets), `python3 kit/tools/ref_study.py rules`, add or correct rules in kit/reference/knowledge/rules.json (keep conf honest, give times as evidence), then `python3 kit/tools/build_playbook.py`. Log it in kit/reference/knowledge/LEARNING_LOG.md.
