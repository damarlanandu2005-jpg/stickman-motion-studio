# Brief for the AI that writes the script (paste this whole file)

You are writing a **vertical cartoon short, 50-65 seconds, 1080x1920**, for a fixed animation engine: flat 2D bean-head characters
(cards with ink outlines) standing in a painted 3D world with black ink lines, gliding camera, voice narration with burned-in captions.
The engine can only draw what is listed below. A script that needs something else cannot be built, so plan the story around the list.

## Hard rules
1. **8-10 scenes**, about 130-165 narration words in total (about 2.6 words per second). One main place. **1-3 characters**.
2. **Every narration line has one thing the viewer must see** in that shot (`must_see`). If the line says "a tiny crack", the crack is the subject, big, in the picture.
3. Show results, not hard actions: no sawing, fighting, chasing, throwing, explosions, weather, night, water, animals or crowds of named people.
4. Day light first. Golden hour only for the last 1-2 scenes.
5. At most one text prop (a sign, newspaper or chart), big, upright, 3-5 words. At most 2 close insert shots of a small object.
6. Keep two sides of a story (for example "his" and "hers") on fixed left/right sides in every scene.
7. Nothing in a scene may change shape over time (no cracks growing, bridges bending). Show before and after as two scenes instead.

## What the engine draws well (proven)
- `place.street`: town street / square, the template's home ground
- `place.bridge_river`: one bridge over a river
- `place.office`: one room, desk, wall props; camera must keep the desk from covering the frame
- `chars.1_3`: 1-3 cards with ink outlines, expressions, hip/point/cross/temple/reach poses
- `chars.crowd`: crowd mode in the template
- `prop.kit_static`: Kenney CC0 kit pieces, lamps, fences, crates
- `action.talk_stand`: character talks (captions), small gestures, blinks
- `action.walk`: walk bob, planted feet
- `fx.sparkle_smoke`: small card fx
- `light.day`: 
- `light.indoor`: 
- `camera.glide_push`: smootherstep glide then creeping push-in
- `camera.aerial_wide`: high wide establishing shot

## Works, but costs extra rounds (risky: use sparingly)
- `place.canyon`: mesas read as skyscrapers unless silhouettes are varied; needs fog depth  -> if the script needs it: use one street, square or bridge; keep far hills as a flat backdrop
- `chars.4_8_named`: each needs its own outfit, silhouette and staging  -> if the script needs it: cut to 3 named characters, show the rest as a crowd
- `prop.text_sign`: newspaper/sign/chart with readable words: size, angle and crop problems  -> if the script needs it: use one big upright sign or newspaper facing the camera, 3 to 5 words
- `prop.vehicle_moving`: own-built trains; timing, framing and scale all needed rounds  -> if the script needs it: show the vehicle parked or entering once; tell the rest in narration
- `prop.readable_detail`: a small detail the viewer must see (a gap, a crack, a coin): needs close camera + exaggerated geometry  -> if the script needs it: make it large, one close insert shot, one idea per shot
- `action.object_fall`: coin/paper dropping on the beat; physics arc must be authored  -> if the script needs it: use one object, one drop, one close insert
- `light.golden`: pink/purple tint came back every round; shadows violet, lit areas warm  -> if the script needs it: keep golden hour to the last 1-2 scenes only
- `camera.orbit`: keep subject in frame through the move  -> if the script needs it: use a push-in or a glide
- `camera.insert_detail`: cut to a close insert of a small object  -> if the script needs it: max 2 inserts per short, each 30-40 frames
- `state.geometry_change`: scene geometry that changes over time and must read (gap closes, rail buckles)  -> if the script needs it: change the story so nothing in the scene changes shape; show before and after as two scenes

## Cannot be drawn (do not use)
- `place.interior_other`: any room that is not the office: new walls, props, lighting  -> if the script needs it: use the office room we have, or keep the scene outdoors
- `place.sea_ship`: water, hull, waves not built  -> if the script needs it: move the story to a harbour wall or bridge, tell the sea part in narration
- `place.space`: no planets/stars/zero-g  -> if the script needs it: cannot be drawn; change the setting
- `chars.animal`: no animal rig  -> if the script needs it: replace the animal with a person or an object
- `action.tool_use`: sawing, hammering, throwing: no animation exists  -> if the script needs it: show the result, not the action (the cut rail, not the sawing)
- `action.fight_chase`: fast body motion not supported  -> if the script needs it: cannot be drawn; show before and after
- `fx.explosion_fire`: no volumetric fx  -> if the script needs it: cannot be drawn; show the aftermath
- `fx.weather`: rain/snow/fog banks not built  -> if the script needs it: cannot be drawn; use a clear day
- `light.night`: no night grade or lamps tuned  -> if the script needs it: use day or indoor light; say 'night' in narration
- `camera.fast_track`: following fast action  -> if the script needs it: use a steady glide

## Output format (reply with exactly this JSON, then the full narration as plain text)
```json
{
  "title": "Short title",
  "logline": "one sentence",
  "sources": ["link 1", "link 2"],
  "scenes": [
    {"id": "c1", "caption": "the narration line for this scene", "must_see": "what the viewer must see",
      "tags": ["place.street", "chars.1_3", "action.talk_stand", "light.day", "camera.glide_push"]}
  ]
}
```
Use only the tags above. If you need something that is not listed, change the story, do not invent a tag.
