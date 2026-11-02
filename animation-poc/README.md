# Reference-template topic engine adaptation

This branch extends the MIT-licensed `mromidev/claude-animated-shorts` template. It is **not a new renderer**. The upstream project remains the visual/rendering foundation: Remotion + Three.js, the toon character renderer, cast/billboard animation, camera grammar, world shading, ink, depth of field, grading, and audio/QA utilities.

Upstream source is pinned as a Git submodule at `upstream/`. Preserve its MIT license and notices. The reference frames are style-study material only and are not production assets.

## Architecture rule

**Reuse the reference renderer; replace bridge-specific story/world data with topic modules.**

| Reference module | Reuse / adaptation |
|---|---|
| `toon.ts` | Reuse character drawing, proportions, expressions, outfit drawing and pose primitives |
| `cast.ts` + `cardshade.ts` | Reuse character billboards, walk cycles, blinks, crowds and effect cards; remove bridge-only story imports through a small adapter |
| `Bridge.tsx` | Retain Remotion/R3F composition, composer and post-processing order; rename/generalise the composition after dependencies are decoupled |
| `story.ts` | Keep camera key interpolation, cuts, glides, crossfades, kicks and DOF mechanics; feed it compiled topic shot data instead of the bridge timeline |
| `world.ts` + `build.ts` + `paint.ts` | Keep shared world/material/geometry helpers; move bridge-specific river, bridge, town and collapse physics behind a bridge environment module |
| `lights.ts`, `shade.ts`, `ink.ts`, `lensblur.ts`, `grade.ts` | Reuse as shared visual pipeline and configurable style presets |
| `templates/audio/` + `templates/scripts/` | Reuse synthesis, mixing, still rendering, contact sheets and frame QA; make cues/timelines topic-driven |

## Topic contract added

- `src/topic-story.ts`: topic-neutral story schema and strict timing/subject/action validation.
- `src/reference-topic-adapter.ts`: compiles topic scenes into frame-based shots and transition data matching the reference template's `SHOTS` / camera concepts.
- `src/earth-to-alien.story.json`: first story expressed using the new contract.
- `src/toon-reference.ts`: original upstream toon drawing implementation, preserved with the upstream license.
- `src/reference-earth-alien.tsx`: temporary visual integration test using the upstream toon renderer and Remotion/Three.js. The character texture is redrawn every frame so the original walk/face/blink logic actually animates.

## What is and is not universal yet

The story format is topic-neutral. A story can declare space, city, village, forest, ocean, mountains, interiors, historical sites, laboratories or abstract environments. Subjects and actions are also described generically.

However, declaring an environment in JSON does not magically create its 3D assets or simulation. Each environment needs a renderer module plugged into the upstream `world.ts` / `build.ts` pipeline. The next refactor must extract bridge-specific world logic and character story dependencies while preserving the upstream shared renderer and post stack. The first environment modules should be space, general land/city, and water; later modules can add historical sets, animals, disasters and scientific visualisations.

Likewise, the current Earth-to-alien composition is still a focused proof scene, not yet the final universal renderer. It deliberately does not replace or modify the existing image-generation, mascot-consistency, fact-checking, or script-writer workflows.

## Required acceptance tests

1. Render Earth-to-alien from the topic contract using the upstream character, camera and post-processing stack.
2. Render a history topic using the same engine, with a different environment module and cast/outfits.
3. Render an animal or disaster topic using the same composition, with a different subject/environment module.
4. Verify that adding a topic requires story data and, only when necessary, a new reusable environment/subject module—not edits to the shared rendering core.
5. Compare frame sheets, camera continuity, character animation, audio mix and final MP4 QA.

The engine is considered reusable only after at least three materially different topics pass those tests.

## Upstream baseline integration (2026-11-02)

The Remotion root now registers `BridgeReferenceBaseline`, importing the upstream `BridgeShort` composition directly from the pinned submodule (`upstream/templates/bridge/Bridge.tsx`). This is an exact-source baseline, not a claim that the topic engine has been rebuilt.

Run it locally with:

```bash
npm run render:bridge-reference
```

CI smoke-renders frames 0–89 of that composition before the Earth-to-alien topic proof. This isolates two separate questions:
- **Reference baseline:** can this repo compile and render the original Bridge composition from the pinned upstream source?
- **Topic engine:** can one shared composition deliver materially different topic worlds with authored shot plans and proper visual QA?

The second question is still open. The existing `ReferenceTopicEngine` remains a prototype and must not be treated as the finished universal engine. The next engineering work is to extract reusable camera/shot/post/cast contracts from the Bridge source, then implement environment-specific world builders and subject/cast adapters without substituting generic primitives for authored scene design. Bridge-specific bridge/river/collapse physics stays in the Bridge example only.

## Implemented reference-system reuse

The current topic path has been moved closer to the Bridge production architecture:
- `src/reference/BridgeReference.tsx` is a local, type-safe entry for the upstream Bridge composition. It imports the original `World`, `build`, `cast`-backed world, ink, lens blur, grade and story modules from the pinned submodule. Its only source-level adjustment is replacing nullable conditional children with empty React fragments to satisfy this project's installed React/postprocessing type definitions.
- `src/reference/camera.ts` extracts the upstream smootherstep camera glide and evaluates authored topic camera keyframes. Existing push/pull/pan/orbit/follow movement settings remain supported when a shot has no keyframes.
- The topic shot adapter now compiles per-shot crossfade lengths; the composition stacks separate ThreeCanvas shot layers during fades, following the upstream Bridge composition's crossfade approach.
- Topic character cards now use upstream `cardShade`, the `NOINK` layer, the reference 600x1000 character design scale and render-resolution-aware card shading instead of unlit, oversized MeshBasicMaterial planes.
- Topic stories can specify per-shot depth-of-field strength and focus points; the existing upstream lens blur passes are used for those values.
- Space and historical-site environment layers no longer add duplicate planets/pyramids on top of the authored story subjects.

These are shared production-system integrations, not proof that every world type has been authored to final quality. The environment and non-character subject builders still need substantial topic-specific modelling, animation, material and composition work. A metadata-valid MP4 is not visual acceptance.
