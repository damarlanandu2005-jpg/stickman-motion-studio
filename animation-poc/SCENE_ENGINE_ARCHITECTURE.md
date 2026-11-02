# Universal topic scene engine

## Design principle

The pinned upstream Bridge project is the rendering reference, not a universal world. Its strongest reusable systems are the Remotion frame clock, Three.js scene graph, authored camera grammar, toon character cards, lighting/material conventions, ink pass, depth of field, bloom, tone mapping and grade. The Bridge river, town, bridge geometry and collapse physics remain a Bridge-specific world.

This project keeps those shared rendering systems and adds a topic layer above them.

## Runtime layers

1. **Story contract** — `src/topic-story.ts`: scene timing, environment type, subjects, explicit asset keys, actions, camera and narration.
2. **Shot compiler** — `src/reference-topic-adapter.ts`: converts seconds to frames and crossfades.
3. **Environment registry** — `src/scene-modules.tsx`: one world module per environment family. Each module owns its ground/sky/architecture/lighting rather than relying on a generic fallback.
4. **Subject and asset registry** — `TopicAsset` in `scene-modules.tsx`: explicit authored assets such as rocket, spacecraft, Earth, Sun, alien planet and crystal. Unsupported explicit asset keys throw instead of silently becoming boxes.
5. **Character system** — upstream `toon.ts` + `cardShade`: characters are rendered as lit 2D cards in the 3D world. Costume identity is supplied by the topic data.
6. **Reference camera and post** — `src/reference/camera.ts` and the existing upstream ink/lens/grade stack.
7. **Visual QA** — render contact sheets and inspect the actual images; metadata and TypeScript success alone are not visual acceptance.

## Adding another topic

A new topic should normally need:
- a new story JSON file;
- existing environment modules where appropriate;
- explicit `assetKey` values for reusable objects;
- a new environment or asset module only when the story introduces a genuinely new visual system;
- authored camera paths and action timings.

Do not add topic-specific exceptions to the shared renderer when a reusable environment or asset module is the right place.

## Current built-in modules

Environments: space, launchpad, alien-world, historical-site, city, village, forest, ocean, mountains, interior/cockpit, laboratory, cave and abstract.

Assets: Earth, alien planet, Sun, rocket, spacecraft, starfield and alien crystal. Character cards use the upstream toon drawing system; the current astronaut wardrobe and helmet overlay are topic style adaptations.

## Important current limitations

- The 30-shot space story is authored as a 60-second timeline, but the CI acceptance render intentionally samples only its first five shots (10 seconds) to keep the single GitHub Actions test bounded.
- The user's 30 individual Flux source images are not currently present in this repository tree; only a contact-sheet image was shared in chat. The current procedural modules therefore use those images as design guidance, not as loaded image textures or extracted 3D assets.
- Several asset models are deliberately authored procedural approximations. They are not a substitute for a dedicated high-detail rocket/spacecraft model or a fully reconstructed Flux scene.
- The engine is not declared universally production-ready until materially different topics (space, history, animals/science) have each been rendered and visually accepted.
