# Script format for the cartoon-short pipeline (instructions for the AI that WRITES the script)

You write ONE script file per video. A second AI (Gemini) turns it into code, and the kit draws it. Gemini follows your shots exactly, so
anything vague, missing or impossible in the script becomes a mistake in the video. Follow every rule below. Copy `scripts/TEMPLATE.txt`.

## 1. File rules
- ONE video = ONE file. Never put several scripts in one file.
- The file has only: `TITLE:`, `NARRATION:`, `SHOTS:` (then CAST, PLACES, NEW OBJECTS, shots). No numbering lines ("1."), no "42-second Short" labels, no notes at the end.
- Do not write the length in seconds. Length comes from the words: about 3.7 words per second (40 s = 150 words, 30 s = 110 words, 60 s = 220 words).

## 2. NARRATION rules
- The exact words the voice says. Numbers as words. No stage directions inside.
- Order: HOOK (strange fact) > SETUP (place) > INCIDENT > ESCALATION > STANDOFF / TIME JUMP > RESOLUTION > TWIST (last words).

## 3. SHOT rules (DO)
- The WORDS of all shots, put together in order, must equal the NARRATION exactly: copy-paste, skip no sentence, add none.
- One shot = 1 or 2 short sentences (about 8 to 20 words, 3 to 6 seconds).
- One place, one light, ONE camera move, one face change per shot.
- Number the shots `SHOT 1`, `SHOT 2`, ... (no names needed).
- Every shot has ALL fields: WORDS, PLACE, LIGHT, CAMERA, CHARACTERS, EFFECTS, MUST SEE, MUST NOT, SFX, MUSIC. Use `none` when empty.
- Everything named in MUST SEE must exist in CAST, PLACES, NEW OBJECTS or the kit list below. Nothing may appear only in MUST SEE.
- Groups need a number: `4 workers`, `crowd of 30`. A crowd (more than 6 people) is background only. Named characters per shot: 4 at most.
- Numbers shown in the picture (timers, scores, day counters) must stay consistent from shot to shot (a countdown only goes down).
- Loudest sound on the key action, music silent just before it, biggest picture on the last three words.

## 4. SHOT rules (DON'T)
- Do not use a face, pose, hat or light that is not in the kit list (section 6). Use ONLY listed names in the face and pose columns.
- Do not put a face in the pose column or a pose in the face column. Order is always: NAME | POSE | FACE | position | depth | facing.
- Do not use `near/mid/far` together with a contradicting `wide/tight` (a huge object at `near (2 m)` cannot be `wide`).
- Do not write a place or object that is not defined above the shots. Every PLACE in a shot must be in PLACES.
- Do not ask for two things the picture cannot do at once (one camera move only; no cuts inside a shot).
- Do not describe modern weapons, uniforms or vehicles as if the kit had them: define them in NEW OBJECTS (section 7).

## 5. Camera and distance (portrait frame is narrow)
- The picture shows about HALF the distance in width: at 2 m about 1 m wide, at 6 m about 3 m, at 15 m about 7 m.
- near = 2 m (one face or object), mid = 6 m (two or three people), far = 15 m (a whole scene). Anything wider than 7 m cannot fit in one shot.
- SMALL OBJECTS (under 1 m, like a bomb, a circuit, a coin, a radio): write the real camera distance in meters, e.g. `camera 0.4 m`. Never `near (2 m)`.
- Position words: left / middle / right and near / mid / far. Facing: camera, left, right, away, or a named character or object.
- Moves: static, push-in, pull-back, orbit, snap-zoom, whip, crane-up, crane-down.

## 6. Kit list (use exactly these names)
- FACES: neutral, stern, grin, laugh, whistle, nervous, shock, relief, dazed, pained, smile, lick, snore, stubborn, squint, sad, angry, scared, proud, tired, shout, desperate.
- ARM POSES: hang, spear, point, up, wave, hip, belly, temple, lift, reach, cheek, shield, cross, thumb, sit.
  (`spear` = holding a long stick or spear. It is NOT a rifle.) No other poses exist yet: no crouch, kneel, run, lie, salute.
- HATS: shako, shako_tall, cap, hair, tophat, bonnet, slouch (army hat), straw, fire (tall fire-fighter hat), none.
- OUTFITS (base): legion, old, toga, civA, civB, civC, workA, workB, digger, farmer, troffea, peasA to peasE, councilman, council2, musician, carpenter, worker1, worker2, kid1, fireman, modern, walker, walkerB.
- LIGHT: day, dawn, golden, night, indoor.
- READY-MADE: crowd (many people in one card), emu and emu herd, horse with cart, dust, smoke, stars, steam, sparks, flash, question mark, hearts, confetti, calendar page, score board, text label.
- If a thing is not here, it must be a `NEW:` item (section 7). Faces and poses cannot be NEW: choose the nearest listed one
  (determined = stubborn or stern, worried = nervous, crouching = shield or hang with a lower camera).

## 7. NEW items (anything not in the kit list: outfits, hats, props, vehicles, rooms)
Write one line each under NEW OBJECTS with: name | size in meters | colors | shape | what it does.
```
- NEW: rifle | 0.9 m long | black metal, brown stock | held by the right hand | SEALs and enemy carry it
- NEW: turban | 0.3 m wide | white cloth with a red top knot | worn as a hat by the KING
- NEW: hospital bed | 2 m long | white sheet, metal frame | SEAL-LEADER lies in it
```
- Every uniform, helmet, vest, headset, visor suit, turban, weapon or machine is NEW unless it is in the kit list.
- A place that is not a plain outdoor field or street (hospital, vault, furnace room) is defined in PLACES with size and 3 landmarks.

## 8. CAST and PLACES
```
CAST:
- NAME | outfit (kit name or NEW item) + hat | skin, hair, beard | usual face
PLACES:
- PLACE-NAME | what it is | width in meters | 3 landmarks and where (left/middle/right, near/far)
```

## 9. Check yourself before you output (answer each in your head)
1. Do all WORDS put together equal the narration, word for word, in order?
2. Is every face, pose, hat and light from the kit list? Is every pose in the pose column and every face in the face column?
3. Does every PLACE, outfit, prop and weapon exist in PLACES, CAST, NEW OBJECTS or the kit list?
4. Is every group a number? Are there 4 named characters or fewer per shot?
5. Do small objects have real distances in meters? Does any camera say `near` with `wide`?
6. Do all numbers on screen (timers, scores) stay consistent?
7. Is the file one script only, with nothing before TITLE and nothing after the last shot?
