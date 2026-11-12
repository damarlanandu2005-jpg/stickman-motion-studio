# Measured style rules

Every number here was measured frame by frame from the 20 most recent @ricksclips3000 Shorts: 34,359 frames at 1080x1920 and 30 fps, condensed into 549 shot reference sheets. A number marked *observed* is a visual observation instead. `rules.json` holds the same numbers in machine-readable form.

Contents: the four core rules, supporting rules, camera math, QA checklist.

## The four core rules

### 1. Character
Put one stick figure on screen whose round, outlined white head fills about a fifth of the frame width.
- Characters are in 77% of shots. Of those shots, 57% have one character, 21% two, 11% three, 6% four and 4% a crowd.
- Largest head: median 20% of frame width (~216 px at 1080); middle half 12-30%.
- A round, outlined white or cream head in 94% of character shots. Thin stick limbs; costume and props carry the role (observed).
- Method: a by-eye count of 61 sampled shots, good to about +/-5 points; automated head detection failed on this footage.
- **Stage:** `"headWidth": 0.20` on a shot frames its target's head at 20% of the frame width.

### 2. Line
Outline every drawn element with an even 10 px stroke (at 1080 wide) in plum-black, never pure black.
- Width: median 10 px (0.9% of frame width); middle half 7-12 px; range 6-16 px.
- Colour: median RGB 39/25/37 (#271925). Pure black appears in 2.8% of shots.
- The 3D set carries no outline (observed).
- **Stage:** the cutout outline is 10/216 = 4.6% of head diameter, so a head at 20% of frame width gets a 10 px line. Test render: 9 px of exactly #271925 plus 1 px of anti-aliasing on a 20.6% head.

### 3. Colour
Set warm orange-red against cool blue in a muted palette, and tint every shadow red-brown, blue or violet, lifted off black.
- Shadow hue: red-brown 40%, blue 32%, violet 25%. Neutral grey only 6%. Median shadow saturation 0.51.
- Shadow value: median 76 of 255 (range 42-129). Overall median shadow #342838.
- Palette by area: warm 48.7%, blue 34.6%, magenta 9.4%, green 7.2%. Median saturation 0.37; at most 2 strongly saturated colours in 84% of shots.
- Mid-key exposure: mean brightness per shot 120 of 255 (range 72-160).
- **Stage:**
  - Shadows get their colour from the hemisphere `fill`; violet ground fill and blue sky fill by default.
  - The sky dome runs blue at the top to warm at the horizon.
  - The cutouts skip tone mapping, so their flat colours stay exact.
  - Test render shadow: hue 272, saturation 0.38, value 53.

### 4. Camera
Keep the camera moving in every shot, usually pushing in: arrive fast, then settle.
- Locked shots at most 8.7%.
- 58% of shots push in (above +1 %/s) and 29% pull out. Median zoom +2.6 %/s; range -15.5 to +26.2 %/s.
- Speed: median 44 px/s; middle half 13-118 px/s; 90th percentile 255 px/s.
- 58 px/s in a shot's first third, 37 px/s after.
- Pan direction is free.
- **Stage:** each shot's `zoom` (%/s) and `pan` ([x, y] px/s) run through the camera math below.

## Supporting rules

**Format.** 1080x1920, 30 fps, 56-66 s (median 61.8 s).

**Pacing.**
- Shot length: median 1.17 s, with 80% of shots between 0.33 and 3.87 s.
- First change of view at ~1.2 s.
- 30 transitions a minute (17-41 per video).

**Transitions.**
- Camera-move transitions are 61%, median 10 frames (4-16). `shortkit` uses a 10-frame whip.
- Dissolves are 38%, median 8 frames (4-12).
- Hard cuts are 0.7%, at most 1 per video.
- In the first 3 s, 86% of transitions are camera moves.

**Captions.**
- Always on screen; 1-2 words each.
- Centred at x 540, y 1350 (70% down); one line with a ~60 px glyph band.
- New caption every 10 frames (2.77 a second).
- Style: white heavy sans with a dark outline (observed).

**Lighting.**
- Bright side of the frame toward the top in 65.6% of shots.
- Direction steady within a shot (R = 0.98).
- **Stage:** keep sun `elevation` at 40-65 degrees so light reads from above.

## Camera math

Units: output pixels at 1080x1920, seconds, fps = 30.

**Speed profile** for an n-frame shot, with u = (i + 0.5) / n:

    m(u) = 1 + 0.7 * (1 - smoothstep(0.15, 0.40, u))

The median is 1, so the shot's median speed equals the requested speed, and the first third averages ~1.57x the rest (measured 58/37).

**Profile time:** `T_i = sum_{k<=i} m_k / fps - m_0 / fps`

**Picture motion:**
- `dx_i = pan_x * T_i`, `dy_i = pan_y * T_i`. +x means the picture moves right (camera turns left); +y means the picture moves down (camera tilts up).
- `scale_i = exp(ln(1 + zoom/100) * T_i)`

**Framing:** the camera distance that puts the target head at fraction f of the frame width is

    d0 = headDiameter / (f * 2*tan(fov/2) * 1080/1920)

**Lens glide** (`"glide": "lens"`, the default; reproduces the measured whole-frame motion):
- The camera holds position at d0.
- `fov_i = 2*atan(tan(fov/2) / scale_i)`
- `yaw_i = atan(dx_i * 2*tan(fov_i/2) / 1920)`
- `pitch_i = atan(dy_i * 2*tan(fov_i/2) / 1920)`

**Dolly glide** (`"glide": "dolly"`; physical move with parallax):
- `d_i = d0 / scale_i`
- Truck by `-dx_i * w` and pedestal by `+dy_i * w`, where `w = 2*d_i*tan(fov/2) / 1920` world units per pixel.
- The numbers hold at the anchor's depth. The background moves less, so a whole-frame check reads lower.

**Transitions (stage v2):**
- Glide (default): over 0.8 s the camera travels from one shot's framing to the next, eased in and out; both shots keep drifting underneath, so speed is continuous at both ends.
- Dissolve: 8 frames, alpha rising linearly.
- The video length never changes with transitions, so the picture stays locked to the voice.

**Checker:**
- Farneback flow on 270x480 grey frames over an 8 px grid, keeping only textured points (gradient above 20).
- Fit `flow = t + (s-1)*(p - centre)` with 4 rounds of trimming to the 70th percentile.
- speed = |t| x 4 x 30 / step px/s; zoom = (s-1) x 30 x 100 / step %/s.

## QA checklist

| Parameter | Target | Acceptable |
| --- | --- | --- |
| Length | 62 s | 56-66 s |
| Frame | 1080x1920, 30 fps | no exceptions |
| Caption centre | x 540, y 1350 | y 1348-1356 |
| Caption change | every 10 frames | 4-18 frames |
| Shot length | 1.17 s | 0.33-3.87 s |
| Transitions per minute | 30 | 17-41 |
| Hard cuts | 0 | at most 1 |
| Dissolve / whip | 8 / 10 frames | 4-12 / 4-16 |
| Camera speed (median) | 44 px/s | 13-118 px/s |
| Zoom | push in on most shots | locked at most 9% of shots |
| Head size | 20% of width | 12-30% |
| Line | 10 px #271925 | 6-16 px, never pure black |
| Shadows | tinted, value ~76 | under 10% neutral grey |

## Notes

- The rules describe these 20 videos, not what performs best; there is no engagement data behind them.
- Character numbers come from a 61-shot sample. Transition lengths are accurate to about +/-2 frames.
- The measured footage carries no outline on the 3D set; the stage adds a thin one by default (`ink.set`, 0 turns it off) because a lined set reads closer to the look viewers expect from this style.
- Reference frames from the source videos are not included in this package.
