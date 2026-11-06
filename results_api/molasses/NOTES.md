- Added `kid2` outfit in `cast.js` to provide a second child character.
- Used a rotated `CylinderGeometry` for the rolling molasses wave, scaling it up during the burst and moving it along the Z axis to chase the camera.
- The elevated train track and falling house are animated in `worldState` based on the frame number during the `s10_flatten` shot.
- Used 2D FX cards for the thermometer, plaque, steam, sparks, and the dripping jar.
- Adjusted the wave speed to `0.05` units per frame so it perfectly hits the house at `z=0` exactly at the start of `s10_flatten`.


## pipeline
rounds: 3 fix calls. final build error: none. audio: ok.
