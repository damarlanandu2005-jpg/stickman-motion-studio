# Decisions and Notes

- **Poses**: Used `spear` for the sawing action in shot 1, as it's the closest two-handed tool-holding pose available.
- **Characters**: The requested outfits (`worker1`, `worker2`, `workA`) are fully supported by the kit's base `OUTFITS`. I used the actor definition overrides to swap the hats (e.g., `hatx: 'tophat'` for the boss, `hatx: 'slouch'` for the rival) to match the notes exactly without needing to create new outfit entries.
- **Assets**: All 10 requested assets were built as `THREE.Group` objects in `world.js` and placed in the world.
- **Dynamic Elements**: The gap size, train position, and rail warping are all driven continuously by `worldState` based on the current frame.
- **Audio**: Matched the SFX cues exactly to the frame timings derived from the beat plan seconds.


## pipeline
calls: 8. final build error: none. audio: ok.
