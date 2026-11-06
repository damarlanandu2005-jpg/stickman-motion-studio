# LOOK RULES (quality targets for the code writer; numbers measured from reference shorts)
Sources: the MIT repo mromidev/claude-animated-shorts (measured numbers) and a frame study of 5 reference shorts. Use these as targets for every place, prop, light and camera. Do not copy any reference story, character or shot.

## 1. Every place is a real set, not a plain box
- A place has 6 to 10 dressing pieces that belong to it (a lab: shelves with 20+ bottles, chalkboard with a formula, door with a sign "LAB. 3", wall calendar, desk lamp; a camp: huts with green shutters, fence, watch tower, trees, parcel crates).
- Keep the SAME pieces, colours and positions every time the place appears. A prop that returns (a box, a jar, a sign) keeps its text, dents and size.
- Text on props must be readable and spelled the same each time (label "AQUA REGIA", sign "NO GOLD LEAVES GERMANY"). Signs get an unlit (basic) material, or side light turns them grey.
- Numbers in picture only move the way the story moves (calendar 1940 > 1944 > 1945, clocks, scores).
- Floors and walls need texture: wood planks, checker tiles, cobbles, painted paper. Never one flat colour.

## 2. Light (choose one per shot, keep it)
- day: median luma about 0.57. Darkest 5 percent of pixels at least 0.23 (no crushed black). Sky top #3e7fd2 to #5e93d9, horizon about 1.3x brighter, fog colour = horizon colour, starts about 25 m.
- golden / sunset: backlit low sun, peach horizon #ffd08a, shadows violet-blue (never brown), sun disc with glow.
- night: not black. Moon or street lamps, windows lit, sky deep blue, key characters clearly lit (luma of faces above 0.5).
- indoor: warm window light pool plus one lamp; walls mid-tone; shadows blue/purple, not grey.
- underground / glow: a visible lamp with warm bloom, wall brown-orange, still readable.
- Characters are lit by the scene light and drop a soft contact shadow under the feet.
- Bloom only on bright emissive things (lamps, sun, sparks). No film grain.
- AUTO CHECK: a shot whose mean brightness is under 0.25 is a FAIL unless the script says "dark".

## 3. Ink and characters
- World ink: near-black #0b0a0c, about 3 px at 1080 wide, thinner far away. Silhouettes and sharp creases only. No line on floor/wall joints or the horizon.
- Character ink: dark plum #241726, thicker on the shadow side. Bean head (a little taller than wide), stick arms and legs, adult about 3.5 head heights, small dot hands.
- Blink every 0.5 to 2.3 s. Walk: small bob, slight lean, feet planted. No blush, no eye highlights.
- Each cast member keeps the same outfit, hat, hair and colours in every shot.
- A crowd is background only and drawn small. Never more than 4 named characters per shot.

## 3b. Something moves in every frame (the references have under 8 percent held frames; ours had 23 to 34)
- Every shot: a slow camera push or drift, characters blink and sway, and at least one ambient moving effect fits the place (dust motes in a room, bubbles in a liquid, smoke over a fire, rain or snow outside, glints on metal, a clock hand).
- Use the kit's moving effects (fxBubbles fxSparkle fxRings fxSpeed fxDebris fxGlow fxMotes fxSnow fxRain fxSmoke fxSweat fxClock) and the face extras ("shock+sweat", "sad+tears", "dazed+spiral"); change the face every beat.
- Colour: references have a richer palette and stronger saturation than a plain grey-brown set: use several distinct hues per place (see REFERENCE NUMBERS), not one tint.

## 4. Camera
- Every shot has a different angle than the shot before: close face, medium, wide, low angle, from above, cut-away (section through the ground), first-person, insert close-up of a prop.
- Hard cut on big changes. Glide 18 to 40 frames between framings. Never a fully static hold longer than 4 frames: add a slow push-in 0.15 to 0.35 percent per frame.
- Impact: 7 frame shake that flips sign each frame. Dutch tilt 4 to 5 degrees for drama or falls.
- Depth: background soft only if the kit supports it; wide shots stay sharp.
- Keep props at least 2 m from the lens, or they become huge blobs at the frame edge. A foreground prop cut by the frame edge must be recognisable or removed.
- Camera never inside a wall; keep sight lines clear (remove anything between lens and actor).

## 5. Readability traps
- A swing or rope seen as one line behind a person reads as a hanging: use two ropes.
- Flag colours and symbols must be period correct; avoid accidental real-world symbols.
- Golden rim light only on inner edges of head and torso, never an outer copy.
- Rails at chest height through people: lift the camera so rails cross the legs.

## 6. Frame QA the pipeline runs after rendering (tools/frame_qa.py)
- black frames (mean < 0.04), unplanned white frames (> 0.93), frozen spans of 12 frames or more, pop frames (sudden change), loudness, and per-shot mean/std/p2/p98/saturation.
- Day shots: mean near 0.5 to 0.6. A shot under 0.25 or a frozen span is reported as a defect.
