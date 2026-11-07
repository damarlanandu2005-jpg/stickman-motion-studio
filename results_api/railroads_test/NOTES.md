# Notes and Decisions

- **Characters**: Used `worker1` for the ENGINEER, overriding `moustache: null` to match the "no beard" requirement. Used `councilman` for the BOSS. Used `council2` for the RIVAL-BOSS, overriding `skin`, `beard`, and `brows` to match the "dark skin, black hair, black beard" requirement.
- **Props**: The `handsaw`, `gold coin`, and `sheet of paper` are placed in the 3D world in `RAIL-CLOSEUP` and toggled visible in their respective shots. The `newspaper` is placed on the desk in `OFFICE`.
- **Dynamic Rails**: Instead of static rails in `RAIL-CLOSEUP`, I split them into two segments (`railL1`, `railL2`, `railR1`, `railR2`) and adjust their Z-position based on the `gap` variable in `worldState`. The gap shrinks from 0.2m to 0m across the shots as described in the script.
- **Trains**: Two instances of `steam train` are placed in `BRIDGE-WIDE`. `trainLeft` moves on the left bridge in s9. `trainRight` moves on the right bridge in s19.
- **Effects**: Used the kit's built-in 2D effects (`fxSmoke`, `fxGlow`, `fxMotes`, `fxDebris`, `crowd`) in `fxAt`.
- **Camera**: Followed the framing instructions (tight, near, mid, far) and camera moves (push-in, pull-back, crane-up, snap-zoom).
- **Lighting**: Added the `indoor` preset to `LIGHTS` in `story.js` for the OFFICE shots.


## pipeline
calls: 9. final build error: none. audio: ok.
