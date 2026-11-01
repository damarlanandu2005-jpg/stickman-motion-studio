# Stickman Thoughts character reference library

This library reuses the owner-created character references from the separate `damarlanandu2005-jpg/yt-auto` repository. The source repository is not modified.

- Pinned source commit: `f7da39dbb7506997e4da4a0753938a82e396ba17`
- Source licence/ownership note: [cartoon/character_refs/licence.json](https://github.com/damarlanandu2005-jpg/yt-auto/blob/f7da39dbb7506997e4da4a0753938a82e396ba17/cartoon/character_refs/licence.json)
- Manifest: [yt-auto-reference-manifest.json](./yt-auto-reference-manifest.json)

## Character anchors

- `stickman_front.png`: canonical front-facing character anchor.
- `stickman_side.png`: side-view guide.
- `stickman_three_quarter.png`: three-quarter-view guide.
- `stickman_thinking.png`: channel thinking-face anchor.
- `stickman_faces.png`: expression reference sheet.
- `stickman_poses.png`: pose reference sheet.

## Eight costume references

The library also includes the eight owner-created outfit references: ancient Egypt, astronaut, diver, doctor, explorer, sailor, soldier, and winter. Keep each costume as a separate optional outfit reference. Do not apply costumes to the base mascot unless the scene specifically calls for that outfit.

## How Phase 5 uses the references

The Kaggle notebook downloads the pinned PNGs at runtime and uses view-specific, expression-specific, or pose-specific references as the actual image-conditioning input. Scene backgrounds continue to use the front mascot anchor. All eight costume references are downloaded and retained for the next costume-aware test; they are not mixed into the current 20-image baseline because that baseline tests the unclothed base mascot.

The images are not copied into this repository as binary files; they are retrieved from the immutable source commit at runtime. This keeps the source of truth in `yt-auto` and avoids duplicating large PNGs. The `yt-auto` repository remains untouched.
