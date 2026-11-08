# Notes and Decisions

- **Characters**: Added `engineer` (based on worker1 but without moustache), `boss` (based on councilman), and `rival` (based on worker2 with tophat and dark skin) to `OUTFITS` in `cast.js` to perfectly match the shot notes.
- **Poses**: Used `reach` for the sawing action in Shot 1 as it extends the arms forward.
- **Assets**: Built all 13 required assets exactly as named in the prompt. The `steel rail with gap` is built as a group of two halves so the gap can be animated shrinking and closing in `worldState`.
- **Layout**: Rails in `TRACK-CLOSEUP` and `SMOOTH-TRACK` run along the X-axis (left to right) so the gap is clearly visible from the front. Bridges in `CANYON-BRIDGE` run along the Z-axis (away from camera) with the gap bridge on the left (X=-6) and smooth bridge on the right (X=6).
- **Animation**: The train is rotated 90 degrees when placed on the bridges to align with the Z-axis. The gap shrinking is handled by lerping the positions of the two rail halves in `worldState`.


## pipeline
calls: 9. final build error: none. audio: ok.
