- **Poses**: Since `run` is not a valid human arm pose in the kit, I used `step` and `tilt` combined with `L: 'up', R: 'up'` to simulate the running/scared motion for the workers in the burst and wave shots.
- **Assets**: The notes did not explicitly use the `NEW OBJECTS` format, but I defined `tank`, `broken_tank`, `track`, `house`, `scaffold`, and `plaque` in the `ASSETS` dictionary to strictly follow the ASSETS rule.
- **Wave**: Built as a deformed sphere mesh in 3D that scales and moves dynamically in `worldState`.
- **Thermometer**: Built as a 2D `fxThermo` card in `cast.js` so it can clearly display the warm number as requested.
- **Sparks**: Added `fxSparks` to `cast.js` for the construction shot.


## pipeline
calls: 6. final build error: none. audio: ok.
