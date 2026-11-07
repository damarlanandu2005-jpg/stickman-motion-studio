# BEATS: the beat plan (generated from kit/schema/beat.v1.schema.json and rules.json; do not edit by hand)

Schema version 1.1.0. One JSON file per video (beats.json). It turns the narration into structured picture instructions: what the words do, what must be seen, how the camera and the cut serve that, and which checks apply.
It is a plan. It does not replace shot_notes.txt yet. Code that reads it is not built in this step (see kit/docs/TRACEABILITY.md).

## Rules for the author of a beats file
- Every beat covers consecutive WORDS of the narration; all beats together cover every word once, in order. Times follow the word times.
- Every id (character, object, environment) must exist in `entities`. Write real sizes in meters for objects (as in FORMAT.md).
- Choose the intent first, then the recipe, then the camera purpose, then the move. A hold is a choice with a reason (rule CAM-16). Do not copy a fixed recipe order (rule SCR-05).
- Use only kit names for faces, poses, outfits and light (FORMAT.md section 6). Extra names go to `extensions`.
- Keep each character's identity lock the same in every beat (rule CON-01).

## Values
- intent: hook, introduce_place_or_time, introduce_character, explain_mechanism, give_number_or_quantity, physical_action, create_suspense, surprising_reveal, emotional_reaction, dialogue_or_argument, time_passes, comedic_beat, crowd_or_scale, summarize_or_conclude
- camera.purpose: establish, reveal, follow, inspect, emphasize, compare, land_on_prop, power_angle, hold_for_performance, carry_to_next_place, impact
- camera.mode: static, creep, push-in, pull-back, pan, tilt, crane-up, crane-down, orbit, track, fly-through, snap-zoom, whip, top-down
- camera.ease: smooth, easeOut, easeIn, back, anticip, spring
- shot.framing: wide, medium_wide, medium, close, detail, top_down, pov
- transition_in.type: start, cut, dissolve, blend_fly, fly_through, flash, whip, in_place
- transition_in.reason: start, new_place, time_shift, memory_or_thought, scale_change, emphasis, continuity
- object event: appear, move, swing, roll, slide, drop, impact, break, launch, spin, glow, heat, bend, change_value, settle
- motion_profile: rigid, elastic, fluid, smoke, flame, rope_lag, none
- action phase: attention, anticipation, action, contact, response, settle
- confidence: measured, estimated, designed

## Fields of one beat

- `id` (required)
- `index` (required)
- `time` (required)
- `narration` (required)
- `intent` (required): What the WORDS are doing. The shot recipe and the camera are chosen from this plus the available assets and the previous beat; there is no fixed order.
- `visual_purpose` (required): One sentence: what the viewer must understand from the picture.
- `subject` (required)
- `environment_id` (required)
- `light`: optional: overrides the environment light for this beat (a story can change the light in one place)
- `character_actions`
- `object_events`
- `shot` (required)
- `camera` (required)
- `captions` (required)
- `audio_events`
- `transition_in` (required)
- `continuity_change`: identity_lock items that the script changes on purpose in this beat (rule CON-01)
- `validation` (required)
- `rule_refs`
- `extensions`

## Intent to recipe (candidates, not a sequence)
- hook: S04, S03, S05 (First 2-3 s: a reacting face, the hero object or the place in frame. The camera may fly, reveal suddenly or hold, whichever the story needs (a flight inside 1 s is only a suggested technique).)
- introduce_place_or_time: S01, S05 (Environment, a scale anchor and one key prop.)
- introduce_character: S02, S04 (The character readable by hat and clothes, expression first.)
- explain_mechanism: S03, S07, S06 (The hero object, its moving part and the cause and effect state.)
- give_number_or_quantity: S03, S07 (A large legible value on a prop plus context for scale.)
- physical_action: S06, S03 (Actor, object and the destination or impact.)
- create_suspense: S03, S04, S07 (One clear focal point, controlled information, a slow creep or a hold.)
- surprising_reveal: S05, S04 (Before and after composition: start tight or on a reaction, widen to the truth.)
- emotional_reaction: S04, S02 (Face pose plus the trigger object.)
- dialogue_or_argument: S08, S04 (Two characters, reaction faces, held camera.)
- time_passes: S07, S01 (A clock, calendar, season or light change; a dissolve.)
- comedic_beat: S04, S06 (Land a hard beat, then the gag picture with a small motion.)
- crowd_or_scale: S05, S01 (Hundreds of tiny varied people or a huge object against a person.)
- summarize_or_conclude: S01, S02, S05 (Return to the first place or object, changed.)

## Shot recipes
- S01 Establishing world: Orient viewer to location, scale and key objects
- S02 Narrator character hold: Let the narration land while maintaining character presence
- S03 Object / mechanism insert: Explain a mechanism, detail or evidence
- S04 Character reaction close-up: Emphasize recognition, fear, surprise, confidence or realization
- S05 Scale reveal / pullback: Reveal crowd, full machine, geography or surprising scale
- S06 Action demonstration: Show how an action works and its consequence
- S07 Diagrammatic metaphor / cutaway: Make abstract ideas visible
- S08 Two-character dialogue: Show an exchange or contrast

## Quality gates that a beat can request (validation.gates)
- Q01 Character identity
- Q02 Composition
- Q03 Camera intent
- Q04 Narration match
- Q05 Physics causality
- Q06 Environment depth
- Q07 Material readability
- Q08 Edit purpose
- Q09 Audio events
- Q10 Render preflight

Examples: kit/schema/examples/beats_railroads_v2.json and beats_bomb_v22.json. Check a file: python3 kit/tools/validate_beats.py <beats.json>
