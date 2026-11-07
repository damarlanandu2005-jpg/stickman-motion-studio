# PLAYBOOK: how the reference shorts handle each situation (generated from kit/reference/knowledge/rules.json; do not edit by hand)

READ THIS FIRST. These are HABITS measured and seen in real reference shorts. Learn the habit, do not copy a shot. A new topic needs its own world, props and
story; use the habit for how to show it. Each rule says [id | how sure]: measured = computed from every frame, seen = read by eye with the time given, inferred = reasoned.
Use the SITUATIONS list: find the beat you are planning (hook, new place, key prop, dialogue, impact, ...) and follow its recipe and rule ids.

Studied: pirate_cannonballs, memory_price, second_draw, mirror_horse_race, storm_oil, perfect_railroads, roller_coasters, town_button.

## What our videos do wrong now (measured against these references)
- 58 hard cuts per minute, references 4 to 15
- 78 % of shots are a pure zoom (push-in), references 0 to 9 %
- the same camera move repeats in the next shot 89 % of the time, references 26 to 75 %
- camera moves are flat (parallax 0.27, references 0.36 to 0.44): the camera scales the picture, it does not travel through space
- flights are short (0.57 s, references 0.83 to 1.6 s) and the pauses between them are long (2.3 s, references 0.6 to 1.5 s)
- picture moves fast only 21 % of the time (references 33 to 59 %)
- palette 23 colours (references 38 to 47 in the 8 new videos): surfaces are flat, the references use gradients, texture, bloom
- frame-to-frame change 0.6 to 2.6 (references 3.1 to 9.4): too little moves at once

## Measured camera and cut habits (video values, p10 .. p90 over the references; ours in brackets)

| measure | references | ours (claude v2.1) |
|---|---|---|
| hard cuts per minute | 4.22 .. 15.17 (median 9.85) | 58.20 |
| median length between hard cuts (s) | 1.27 .. 11.75 (median 1.73) | 1.00 |
| camera flights per minute | 15.09 .. 23.39 (median 20.10) | 15.00 |
| length of a camera flight (s, median) | 0.83 .. 1.60 (median 1.19) | 0.57 |
| peak flight speed (px per frame at 270 px width) | 6.65 .. 16.03 (median 11.10) | 8.90 |
| pause between flights (s, median) | 0.61 .. 1.54 (median 1.10) | 2.28 |
| depth parallax in flights (0 flat .. 1 strong) | 0.36 .. 0.44 (median 0.40) | 0.27 |
| share of time the picture moves fast | 0.33 .. 0.59 (median 0.49) | 0.21 |
| share of time nearly still | 0.19 .. 0.44 (median 0.27) | 0.43 |
| share of shots that are only a zoom (no pan/tilt/orbit) | 0.00 .. 0.09 (median 0.00) | 0.78 |
| share of shots whose move repeats in the next shot | 0.26 .. 0.75 (median 0.41) | 0.89 |

All 172 flights together: length p10/p50/p90 = 0.53/1.11/3.03 s, peak speed 4.6/9.85/23.99 px per frame at 270 px width (x11.1 = percent of width per second), easing {'accelerate': 0.01, 'constant': 0.5, 'decelerate': 0.08, 'ease_in_out': 0.23, 'hold_then_move': 0.01, 'move_then_hold': 0.07, 'varying': 0.1}.

## Measured picture habits (14 reference videos, p10 .. p90; ours in brackets)

| measure | references | ours |
|---|---|---|
| brightness (luma 0-1) | 0.36 .. 0.56 (mid 0.48) | 0.24 .. 0.65 |
| contrast (luma std) | 0.16 .. 0.24 (mid 0.20) | 0.17 .. 0.20 |
| darkest 2% of pixels | 0.07 .. 0.15 (mid 0.12) | 0.05 .. 0.14 |
| saturation | 0.42 .. 0.58 (mid 0.48) | 0.17 .. 0.48 |
| palette size (colours >0.5% of the picture) | 29.90 .. 41.00 (mid 39.00) | 17.00 .. 24.00 |
| detail (edge density) | 0.11 .. 0.21 (mid 0.15) | 0.08 .. 0.19 |
| median frame-to-frame change | 3.06 .. 9.44 (mid 6.39) | 0.64 .. 2.62 |
| frames with almost no change (held) | 0.00 .. 0.06 (mid 0.02) | 0.00 .. 0.31 |

## Rules

### CAMERA (how it moves, and why)
- [CAM-01 | measured | for: any] The camera is almost always alive, but not always flying. DO: Plan each beat as HOLD or FLIGHT. Flights run 33-59 % of the time, slow creep or stillness 19-44 %. Never leave a long beat with a frozen camera and nothing else moving. NUMBERS: time_moving_fast 0.33-0.59 (median 0.49); time_nearly_still 0.19-0.44 (median 0.27); frames_with_almost_no_change 0-6 % of frames. SEEN IN: all 8 references. (ours now: fast 21 %, still 43 %)
- [CAM-02 | measured | for: any] A flight is about one second long, one every 3 seconds, followed by a short hold. DO: Flight length 0.5-3 s, typical 1.1 s. One flight every 2-4 s (14-28 per minute). Hold between flights 0.3-2.9 s, typical 1.1 s. Peak speed about 100 % of frame width per second (50-260). NUMBERS: flight_s p10 0.53 / p50 1.11 / p90 3.03; flights_per_min 15-23 (median 20); gap_s p10 0.27 / p50 1.05 / p90 2.85; peak_px_per_frame p10 4.6 / p50 9.85 / p90 24. SEEN IN: 172 flights in 8 references. (ours now: flight 0.57 s, pause 2.3 s)
- [CAM-03 | measured | for: any] Move the camera through the 3D world. Do not just zoom. DO: Every flight changes camera POSITION: orbit 20-60 degrees, crane up or down, dolly past objects, tilt while pushing. Foreground, subject and background must slide at different speeds (parallax). A pure push-in or pull-out with no pan, tilt or orbit is rare: use it for 0-9 % of shots. NUMBERS: pure_zoom_shots 0-9 % (median 0); parallax_ratio 0.36-0.44 (0 flat, 1 strong); shot_net_motion shots that combine a push or pull with a pan, tilt or orbit make up about 90 % of all shots (80-100 %). SEEN IN: pirate_cannonballs 0-1.2 s (orbit around the cannon, sea and island revealed); memory_price 4-7 s (fly down an alley into the shop). (ours now: 78 % pure push-in, parallax 0.27)
- [CAM-04 | seen | for: new_place, explain_system] REVEAL: start tight on a detail or a face, then fly out, up or around until the place or its size is clear. DO: Frame 1: face or small object. Last frame: wide view with the hero object of the topic in it. Use crane-up or top-down to show layout or scale of a system. SEEN IN: town_button 4-7 s (crane up to a top view of the circular town); roller_coasters 1-3 s (tilt up the loop); mirror_horse_race 12-14 s (street and hill revealed).
- [CAM-05 | seen | for: key_prop, action_impact] LAND ON THE PROP: a fast push toward the named prop that slows down as it arrives, timed to the word. DO: Start 0.3-0.5 s before the word, arrive on the word. End with the prop filling 40-100 % of the frame, readable. Ease: fast start, slow finish (decelerate). SEEN IN: second_draw 14-15 s (push to the gun while yellow streaks fly); town_button 23-25 s (button under the glass dome); memory_price 28-31 s (HAPPINESS gauge).
- [CAM-06 | seen | for: danger, any] Power and danger: low angle, big object in the foreground. DO: Camera at ground height looking slightly up, holster or weapon or hull edge large and sharp in the lower third, subject behind. SEEN IN: second_draw 0-4 s (bullet and holster in the foreground, camera tilts up to the face).
- [CAM-07 | seen | for: action_impact, danger] FOLLOW: when something travels, the camera pans or tracks with it and the background streams by. DO: Keep the mover in the same screen spot, let the background slide, constant speed. SEEN IN: mirror_horse_race 27-31 s (horse gallops, camera tracks); pirate_cannonballs 4-5 s (ball flies past).
- [CAM-08 | seen | for: dialogue] Dialogue and reaction beats are HELD: two-shot or close-up, slow creep, 1.5-4 s. DO: Save the fast flights for reveals and impacts. Change only the faces and small props while the camera rests. SEEN IN: second_draw 9-13 s (four seconds on one medium shot); storm_oil 7-11 s (captain and chef two-shot).
- [CAM-09 | measured | for: any] Ease every flight. Half are steady, a quarter ease in and out. DO: constant speed 50 % of flights (follow, long gentle drift). ease in and out 23 % (reveals). decelerate 8 % (landing on a prop). move then hold 7 %, varying 10 %. almost never accelerate. NUMBERS: ease_share {'constant': 0.5, 'ease_in_out': 0.23, 'decelerate': 0.08, 'move_then_hold': 0.07, 'varying': 0.1, 'accelerate': 0.01}. SEEN IN: 172 flights. (ours now: 67 % constant, 22 % ease, 11 % accelerate)
- [CAM-10 | measured | for: any] Do not repeat the same move beat after beat. Vary push, pull, orbit, tilt, pan, top-down, low angle, first person. DO: Never more than two beats in a row with the same kind of move. Change camera height or angle at least every 2-3 s of flight time. NUMBERS: repeat_in_next_shot 0.26-0.75 in references, 0.89 in ours. SEEN IN: 8 references. (ours now: 89 % repeat)
- [CAM-11 | seen | for: any] Use shot size as a language: tiny people in a wide world, medium two-shots, face close-ups, extreme close-ups of props. DO: Wide: people under 10 % of frame height, the world is the subject. Medium: people 35-50 % of frame height. Close-up: head 40-60 % of frame width. Insert: prop fills the frame. Change size at nearly every sentence. SEEN IN: pirate_cannonballs 0-20 s; memory_price 19-31 s.
- [CAM-12 | seen | for: any] Frame with something blurred in the foreground at an edge (rope, pole, rail, mast, leaves) to build depth. DO: One soft foreground object on one side, subject sharp behind it. SEEN IN: perfect_railroads 14-17 s; pirate_cannonballs 12-14 s; roller_coasters 10-15 s.

### CUTS
- [CUT-01 | measured | for: any] Hard cuts are rare. One cut for a new place, time or topic; the camera does the rest. DO: 4-15 hard cuts per minute, median 10 (one every 6 s). Do not cut just to change the angle: fly the camera instead. NUMBERS: hard_cuts_per_min p10 4.2 / median 9.9 / p90 15.2 (min 3.1, max 17.9); length_between_cuts_s median 1.7, long takes up to 16 s. SEEN IN: 8 references. (ours now: 58 per minute)

### TRANSITIONS
- [TRN-01 | seen | for: transition] Carry the viewer to the next beat with the camera: fly through, into or under the next place, with motion blur at peak speed. DO: End a flight pointing at the next location, start the next beat already moving. SEEN IN: memory_price 4-8 s (alley, light-lined corridor, shop interior in one move); perfect_railroads 7-10 s (bridge, blur, station).
- [TRN-02 | seen | for: transition, time_passes, emotion_shift] Cross-dissolve 4-10 frames, with a ghost of the old picture, for memory, thought, time shift or a change of speaker. DO: Overlap both pictures at 50 % for 2-3 frames. SEEN IN: memory_price 42-46 s (ghost of the hooded buyer over the boy); mirror_horse_race 3 s and 27 s; second_draw 13.6 s (dissolve to the quick-draw man).
- [TRN-03 | seen | for: transition] Round masks: spyglass circle on black for looking at something far, round windows as frames, a black circle closing as an eye. DO: Use rarely, once or twice per short, for a view-through or a turning point. SEEN IN: mirror_horse_race 18 s (spyglass on the race); second_draw 44-53 s (black circle, then round windows).
- [TRN-04 | seen | for: transition, action_impact] Smoke or cloud wipe: a puff fills the frame, the next place is behind it. DO: Smoke grows over 6-10 frames, clears into the new scene. SEEN IN: pirate_cannonballs 17.5-18.5 s (cannon smoke to open sea).

### STORY SHAPE
- [END-01 | seen | for: ending] End with a callback: return to the first place or object, changed. DO: Last shot repeats the opening place or prop, with the final idea visible on it. SEEN IN: second_draw 54-55 s (street scene like the opening); town_button 64-65 s (crowd around the button from the first shot).

### SCRIPT TO PICTURE
- [SCR-01 | seen | for: any] One idea per sentence, one picture per idea. New place or angle at every sentence, new face or prop at every clause. DO: Narration runs about 2.5-3 words a second, captions show 1-3 words. NUMBERS: voice_onsets_per_s 2.8-3.5. SEEN IN: 8 references.
- [SCR-02 | seen | for: any] Show every important noun. Turn abstract ideas into an object: memory = ticket and shelves of boxes, happiness = gauge, time = ledger of years, rules = a button under glass. DO: List the nouns of each sentence before planning the shot and check each one appears. SEEN IN: memory_price; town_button; mirror_horse_race.
- [SCR-03 | seen | for: hook] Hook in the first 2-3 seconds: a face reacts, the main prop or place is in frame, and the first flight starts within the first second. DO: First fast flight starts at frame 1-27 (0.03-0.9 s) in 7 of 8 references; 2 of them start at frame 1-3. SEEN IN: pirate_cannonballs 0 s; second_draw 0 s; memory_price 0 s.
- [SCR-04 | seen | for: any] Story shape: hook, set up the world with a reveal flight, escalate with a new place every 3-6 s, twist or payoff with a gag, callback ending. DO: Plan the shot list in these five blocks. SEEN IN: second_draw; memory_price; town_button.

### LIGHT
- [LIT-01 | measured | for: any] Every frame has a deep shadow and a near-white highlight. Mean brightness sits at 0.31-0.52 even in night stories. DO: Darkest 2 % of pixels 0.07-0.15, brightest 2 % 0.84-0.98, contrast std 0.16-0.25. Night is not dim: lamps, windows and moon are bright, the subject is lit. NUMBERS: brightness_video_median 0.31-0.52 (14 refs p10-p90 0.36-0.56); p2 0.07-0.15; p98 0.84-0.98; contrast_std 0.16-0.25. SEEN IN: 8 references. (ours now: mean 0.37, but flat)
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

### CHARACTERS
- [CHR-01 | seen | for: introduce_character, any] Character anatomy: big near-white head, bean body with real clothing details, thin noodle limbs. DO: Head: circle slightly wider than tall, soft warm-grey shade on the lower rim, thick uneven near-black outline about 3-4 % of head width. Body: bean as tall as the head, with pocket, buttons, medals or braid, belt, collar, prints (flowers, stripes, dots). Arms: thin lines about as long as the body, small round hands. Legs: very thin, 1.3-1.8 times the body, no feet. Whole figure about 3.5 head heights. SEEN IN: frames memory_price 20.5 s, perfect_railroads 18.2 s, second_draw 15.5 s, town_button 11.2 s, roller_coasters 5.2 s, storm_oil 10.2 s.
- [CHR-02 | seen | for: introduce_character] Identity from headwear and clothes: bowler, chef hat, striped cap, cowboy hat, bandana, tricorn, top hat, police cap. DO: One hat shape and one colour per role, kept in every shot. Hats move with the head and fly off when the body is hit. SEEN IN: 8 references.
- [CHR-03 | seen | for: any] Lit by the scene: skin takes a warm or cool tint, soft gradient, soft contact shadow on the ground. DO: No flat white paper-cut look. SEEN IN: memory_price 50-54 s (warm lamp on the face); second_draw 26-30 s (long shadows).
- [CHR-04 | seen | for: any] Characters hold props with their noodle arms and touch the set (ladle, hammer, telescope, mug, cane, gun, pole). DO: Every character in a medium shot holds or touches something. SEEN IN: storm_oil 0-18 s; roller_coasters 0-9 s.

### FACES AND EMOTION
- [FAC-01 | seen | for: any] Tiny face, strong emotion language. DO: Eyes: white ring with outline and dot pupil, or plain dots. Eyebrows: thick short strokes, they carry the feeling. Mouth: line, smirk, open D, teeth grid. Extras: moustache strokes. In close-ups change the expression every 1-1.5 s. SEEN IN: second_draw 8-20 s; memory_price 58-63 s.
- [FAC-02 | seen | for: emotion_shift, comedy_gag] Emotion vocabulary with effects drawn on or around the head. DO: Anger: head turns purple, white steam puffs on both sides, V brows, gritted teeth. Fear: wide ring eyes, 2-3 sweat drops, teeth grid. Shock: yellow glowing irises, vein mark, speed streaks. Smug: half-closed eyes, smirk. Knocked out: face-down, hat off, X or spiral eyes. Joy: closed arc eyes, big smile. Sick: pale, tired eyes. SEEN IN: perfect_railroads 18 s (purple, steam); second_draw 15 s (sweat, yellow eyes); second_draw 19-20 s (knocked out).

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

## Checks (run on a finished video)
- CHK-01: hard cuts per minute should be 4.2 .. 15.2 (python3 kit/tools/ref_study.py compare video.mp4)
- CHK-02: share of shots that are only a zoom should be 0 .. 0.09 (same)
- CHK-03: share of time the picture moves fast should be 0.33 .. 0.59 (same)
- CHK-04: depth parallax in flights should be 0.36 .. 0.44 (same)
- CHK-05: palette size (4-bit colours over 0.5 %) should be 30 .. 41 (python3 kit/tools/ref_measure.py compare video.mp4)
- CHK-06: frame-to-frame change (median) should be 3.1 .. 9.4 (same)
- CHK-07: script match: every noun of each sentence appears within 0.3 s of the word (manual until the script-match check is built (step 2))

## Limits of this knowledge
- 8 videos, all in one house style (3D world, 2D bean-head cards, one-word captions). Another genre may need other values.
- Cut detection was checked by eye on one video only (pirate_cannonballs). Treat cuts per minute as +-25 %.
- The 6 older reference videos are in the colour database but NOT in the camera study (their video files were not kept). Re-share them to add them.
- Sound design (music, effects, voice) is not studied except loudness: every reference sits at -14 LUFS.
- No script text was available for the references. Script-to-picture rules come from reading captions on the frames.

## How this grows
Add a reference: `python3 kit/tools/ref_study.py study video.mp4 --name NAME --group refs`, `python3 kit/tools/ref_measure.py add video.mp4 --name NAME --group refs`, `python3 kit/tools/ref_sheet.py video.mp4 kit/reference/study/NAME.json /tmp/NAME` (look at the sheets), `python3 kit/tools/ref_study.py rules`, add or correct rules in kit/reference/knowledge/rules.json (keep conf honest, give times as evidence), then `python3 kit/tools/build_playbook.py`. Log it in kit/reference/knowledge/LEARNING_LOG.md.
