# Design Decisions & Notes

- **Emu character**: Created a custom shaggy texture rendering using the 2D blob primitives (`emuFront` function in `roman.js`). Added a long neck, big beak, and hop animation.
- **Soldier & Farmer outfits**: Added `soldier` (slouch hat, khaki tunic) and `farmer` (straw hat, overalls) definitions into `OUTFITS`, and updated `romanFront` to support them natively (e.g. `hat="slouch"`, `rifle=true`).
- **Expressions**: The author requested expressions like `angry`, `sad`, and `confused`. The base `toonbase.js` only had `stern`, `nervous`, `grin`, `shock`, `neutral`, etc. I remapped `angry` to `stern` and `confused` / `sad` to `nervous` to avoid runtime errors while maintaining the emotion.
- **Farmhouse & Settings**: Simplified the 3D geometry of the farmhouse and the tractor to basic shapes with toon shading to fit the aesthetic. Set up a large flat dirt plane with a separate wheat field plane above it using grass material tinted golden. Re-used tree primitives from the original template for the background elements.
- **Shot 2 Snap-zoom**: The camera snaps on frame 101 perfectly tracking the word "lost".
- **Audio**: Custom procedural sound effects generated directly in numpy matching the shot cues, mixed to exact levels requested by the kit logic. Saved stem mix to `music.wav` and `sfx.wav` for the `mix.py` pipeline.