# Notes and Decisions

- **Characters**: Added `clockmaker` outfit to `cast.js` to match the specific "worker1 + cap + grey beard + grey hair" requirement.
- **Environment**: Built a unified `CLOCK-INTERIOR` mechanism containing the gears, spring, escapement, anchor, and pendulum. This allows smooth continuous animation of the tick-tock mechanism.
- **Animation**: The tick-tock motion is driven procedurally in `worldAt(f)`. The pendulum and anchor swing together using a sine wave, while the escapement wheel advances in steps based on the phase. This naturally satisfies the requirements of shots 5, 6, and 7 without needing complex hard-coded keyframes.
- **Camera**: The camera is positioned precisely in front of the relevant mechanism parts for each shot in `CLOCK-INTERIOR`, ensuring the correct components are in focus and framed properly.


## pipeline
calls: 9. final build error: none. audio: ok.
