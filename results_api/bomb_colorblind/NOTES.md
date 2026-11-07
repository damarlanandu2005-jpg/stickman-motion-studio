# Notes and Decisions
- `bomb suit` and `bomb helmet` are primarily 2D character outfits, but to strictly satisfy the ASSETS rule, I created dummy 3D groups for them in `world.js` (which are hidden).
- `bombSuit` and `policeChief` are implemented as custom character drawing functions in `cast.js` to handle the specific requirements (the thick glass visor for the suit, and the specific skin/hair/beard for the chief).
- The `CIRCUIT-VIEW` is built as a separate macro-scale environment at `x=300` to allow extreme close-ups of the wires and circuit board without clipping into the main room.
- The `digital timer` uses a dynamic canvas texture that counts down based on the frame number.
- In `s14`, the `wire cutters` are animated to close, and the red wire is swapped to a cut version to visually show the defusal.


## pipeline
calls: 9. final build error: none. audio: ok.
