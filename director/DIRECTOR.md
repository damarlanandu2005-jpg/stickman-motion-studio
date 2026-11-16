# Story Director (Blueprint v2.1, stage 2)

Turns a narration script plus its word timings into `story_plan.json`. Engine-independent: nothing here names
a renderer. Tools: `plan_tool.py validate|render <plan> <words.json>`.

## What the director must decide
- **Scenes.** For each: place (interior or exterior, period, public or not), time of day, who is present with
  costume and what they hold, background people, at least five dressing pieces, and the on-screen tag.
- **The cut into each scene.** One of opening, continuation, time_jump, location_change, parallel, contrast,
  flashback, montage, with a one-line reason. The first scene is `opening`. A jump is fine; an unexplained one
  is not. time_jump, location_change, flashback and parallel need a tag.
- **Timelines.** A hook that shows the ending, a flashback or a parallel event gets its own `timeline` name so
  its costume and prop state is tracked separately from the main story.
- **Beats and shots.** A beat is one claim in the narration with its proof: the thing on screen that shows the
  claim is true, and how. A beat has one or more shots (wide, medium, two_shot, close, detail), each starting
  on a word index. Every word belongs to exactly one shot.
- **Props.** Anything handed over, picked up, shown, dropped or put on is an event on a shot. Anything a
  character holds entering a scene must match what they held leaving the last scene on that timeline, or carry
  a `holds_reason`. Same for costume and `costume_reason`.
- **Facts.** Each claim points at a fact with a source URL and a status (verified, partly verified, unverified,
  disputed, contradicted). The picture must not add facts the script does not state.

## What the validator blocks
Missing relation, reason or tag; a public place with fewer than 6 background people and no `empty_reason`; an
empty scene with no reason; fewer than 5 dressing pieces; a costume or prop change with no reason; an event
using a prop the character does not hold or that is not in the scene; a beat with no proof or whose proof no
shot shows; a shot under 0.7 s or over 4.6 s; a shot on something not in the scene; a fact the source
contradicts. Facts that are unverified or disputed are warnings the owner sees in the plan.

## Originality and licences
Stories are retold in our own words from public facts. Characters, shots and designs are our own; reference
channels are for style study only. Voice is Kokoro. Music must have a recorded licence before delivery. Images
are generated or code-built, never downloaded photos. Each plan carries this as its `originality` block.
