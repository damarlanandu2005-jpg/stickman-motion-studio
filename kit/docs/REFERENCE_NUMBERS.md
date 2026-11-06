# REFERENCE NUMBERS (measured at 30 fps by tools/ref_measure.py; rebuilt automatically)

READ THIS FIRST. These are RANGES from real reference shorts, not targets to copy. A new topic may need a different value
(a night story is darker, a lab story has more small props). Use them as: (a) the usual range of a good short, (b) a way to notice
that a shot is far outside it WITHOUT a reason in the script. Copy the STYLE GRAMMAR below (how the shorts are built), not the numbers.

Videos behind the ranges: gym_tunnel, jar_nobel, pig_war, red_baron, robot_year, tsar_garden. Our own earlier videos (for comparison): claude_bomb, claude_seals, claude_sniper, claude_staircase, gemini_bomb.

## Ranges (video medians, p10 .. p90 over the reference videos) and where our videos are

| measure | reference range | ours |
|---|---|---|
| brightness (luma 0-1) | 0.418 .. 0.590 (mid 0.528) | 0.232 .. 0.646 (mid 0.463) |
| contrast (luma std) | 0.196 .. 0.238 (mid 0.225) | 0.170 .. 0.200 (mid 0.192) |
| darkest 2% of pixels | 0.061 .. 0.155 (mid 0.111) | 0.052 .. 0.148 (mid 0.082) |
| saturation | 0.420 .. 0.582 (mid 0.482) | 0.165 .. 0.374 (mid 0.280) |
| colourfulness | 0.211 .. 0.318 (mid 0.250) | 0.101 .. 0.188 (mid 0.132) |
| palette size (colours >0.5% of the picture) | 28.0 .. 38.5 (mid 32.5) | 16.6 .. 23.8 (mid 20.0) |
| detail (edge density) | 0.100 .. 0.204 (mid 0.125) | 0.080 .. 0.199 (mid 0.148) |
| frames with almost no change (held) | 0.010 .. 0.072 (mid 0.053) | 0.092 .. 0.318 (mid 0.230) |
| frames with tiny change | 0.031 .. 0.169 (mid 0.137) | 0.216 .. 0.587 (mid 0.503) |
| median frame-to-frame change | 2.4 .. 41.0 (mid 5.0) | 0.624 .. 1.481 (mid 0.779) |
| 90th pct frame-to-frame change | 11.7 .. 64.5 (mid 14.2) | 3.5 .. 10.8 (mid 6.0) |
| object motion after removing camera motion (median) | 2.485 .. 12.970 (mid 4.950) | 0.737 .. 1.672 (mid 0.889) |
| shots per minute | 24.6 .. 49.3 (mid 32.4) | 29.2 .. 57.4 (mid 39.4) |
| median shot length (s) | 0.917 .. 1.542 (mid 1.050) | 0.907 .. 2.020 (mid 1.483) |

Share of frames by camera behaviour (static = no move, creep = slow push, glide = 18-40 frame move, whip = fast):

| camera | reference | ours |
|---|---|---|
| static | 0.046 .. 0.399 (mid 0.085) | 0.258 .. 0.518 (mid 0.438) |
| creep | 0.153 .. 0.495 (mid 0.331) | 0.278 .. 0.439 (mid 0.319) |
| glide | 0.164 .. 0.602 (mid 0.346) | 0.044 .. 0.417 (mid 0.242) |
| whip | 0.021 .. 0.235 (mid 0.122) | 0.000 .. 0.041 (mid 0.015) |

## Style grammar (how the reference shorts are built; copy these habits, they hold for any topic)
1. Every shot is a full set: 6-10 pieces of dressing that belong to the place; the same pieces return every time the place returns.
2. Something moves in every frame: camera creep/glide, blinks, idle sway, walk bob, particles, glints, clock hands, bubbles. Nearly-held frames stay a small share.
3. One clear light per shot, chosen for the mood; shadows are tinted (cool in warm light, warm in cool light), never flat grey.
4. Each shot has a different framing from the one before (face / medium / wide / insert / cut-away / first-person / aerial).
5. Props that matter get readable text or a dated label; numbers and dates change only the way the story changes.
6. Characters keep the same look; faces change every beat (shock, sweat, dizzy, laugh) so the story reads without sound.
7. Detail goes where the eye is: the face or key prop is sharpest and most coloured; background is simpler but not empty.

## Per video

| video | group | seconds | shots | held | luma | sat | palette | edge |
|---|---|---|---|---|---|---|---|---|
| claude_bomb | ours | 73 | 50 | 29% | 0.46 | 0.19 | 20 | 0.159 |
| claude_seals | ours | 42 | 48 | 23% | 0.21 | 0.38 | 15 | 0.079 |
| claude_sniper | ours | 63 | 40 | 23% | 0.65 | 0.15 | 22 | 0.148 |
| claude_staircase | ours | 79 | 52 | 0% | 0.64 | 0.36 | 25 | 0.226 |
| gemini_bomb | ours | 36 | 14 | 34% | 0.27 | 0.28 | 19 | 0.082 |
| gym_tunnel | refs | 53 | 18 | 2% | 0.49 | 0.58 | 29 | 0.141 |
| jar_nobel | refs | 60 | 29 | 8% | 0.62 | 0.42 | 32 | 0.109 |
| pig_war | refs | 43 | 25 | 6% | 0.56 | 0.46 | 27 | 0.107 |
| red_baron | refs | 60 | 30 | 5% | 0.56 | 0.42 | 33 | 0.094 |
| robot_year | refs | 63 | 54 | 7% | 0.35 | 0.50 | 38 | 0.184 |
| tsar_garden | refs | 51 | 40 | 0% | 0.49 | 0.58 | 39 | 0.224 |

## Notes on reading the numbers
- Videos differ in resolution (360p / 720p / 1080p) and compression. Frame-to-frame change is noisy for low-resolution files, so trust 'held frames', camera share and shot length more than the raw change numbers.
- Biggest measured gaps of our videos against the references: saturation, palette size (variety of colours in the picture), share of held frames, and whip/glide camera moves. Brightness and detail are inside the range for some of our videos and far outside for others.
- Captions (lower-middle band) are ignored in every measure.

## How to extend (adaptive)
Add any new reference short: `python3 kit/tools/ref_measure.py add video.mp4 --name NAME --group refs`. The ranges and this file rebuild themselves.
Compare a finished video: `python3 kit/tools/ref_measure.py compare video.mp4` (add `--dark` if the script is meant to be dark).
