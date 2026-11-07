# REFERENCE NUMBERS (measured at 30 fps by tools/ref_measure.py; rebuilt automatically)

READ THIS FIRST. These are RANGES from real reference shorts, not targets to copy. A new topic may need a different value
(a night story is darker, a lab story has more small props). Use them as: (a) the usual range of a good short, (b) a way to notice
that a shot is far outside it WITHOUT a reason in the script. Copy the STYLE GRAMMAR below (how the shorts are built), not the numbers.

Videos behind the ranges: grave_bell, gym_tunnel, idea_zone, jar_nobel, knight_loophole, memory_price, mirror_horse_race, perfect_railroads, pig_war, pirate_cannonballs, random_numbers, red_baron, robot_year, roller_coasters, second_draw, slot_machines, storm_oil, town_button, tsar_garden, vp3, vp4, vp5, winning_tickets. Our own earlier videos (for comparison): claude_bomb, claude_bomb_v21, claude_bomb_v22, claude_rail_v1, claude_rail_v2, claude_seals, claude_sniper, claude_staircase, gemini_bomb.

## Ranges (video medians, p10 .. p90 over the reference videos) and where our videos are

| measure | reference range | ours |
|---|---|---|
| brightness (luma 0-1) | 0.314 .. 0.564 (mid 0.471) | 0.255 .. 0.644 (mid 0.366) |
| contrast (luma std) | 0.174 .. 0.240 (mid 0.204) | 0.176 .. 0.204 (mid 0.192) |
| darkest 2% of pixels | 0.046 .. 0.175 (mid 0.113) | 0.053 .. 0.117 (mid 0.086) |
| saturation | 0.394 .. 0.584 (mid 0.482) | 0.184 .. 0.533 (mid 0.383) |
| colourfulness | 0.215 .. 0.333 (mid 0.273) | 0.110 .. 0.287 (mid 0.170) |
| palette size (colours >0.5% of the picture) | 32.0 .. 45.0 (mid 39.0) | 18.2 .. 29.2 (mid 23.0) |
| detail (edge density) | 0.106 .. 0.218 (mid 0.151) | 0.082 .. 0.172 (mid 0.144) |
| frames with almost no change (held) | 0.002 .. 0.059 (mid 0.012) | 0.001 .. 0.298 (mid 0.049) |
| frames with tiny change | 0.016 .. 0.137 (mid 0.050) | 0.057 .. 0.550 (mid 0.375) |
| median frame-to-frame change | 3.6 .. 9.5 (mid 6.4) | 0.690 .. 4.554 (mid 1.053) |
| 90th pct frame-to-frame change | 11.0 .. 25.1 (mid 18.1) | 4.5 .. 15.1 (mid 6.7) |
| object motion after removing camera motion (median) | 3.2 .. 8.4 (mid 5.7) | 0.834 .. 4.424 (mid 1.076) |
| shots per minute | 4.8 .. 33.8 (mid 10.1) | 18.5 .. 60.3 (mid 38.0) |
| median shot length (s) | 0.990 .. 10.590 (mid 2.467) | 0.920 .. 2.817 (mid 1.500) |

Share of frames by camera behaviour (static = no move, creep = slow push, glide = 18-40 frame move, whip = fast):

| camera | reference | ours |
|---|---|---|
| static | 0.000 .. 0.086 (mid 0.000) | 0.044 .. 0.566 (mid 0.438) |
| creep | 0.000 .. 0.449 (mid 0.059) | 0.244 .. 0.550 (mid 0.317) |
| glide | 0.244 .. 0.982 (mid 0.776) | 0.000 .. 0.462 (mid 0.109) |
| whip | 0.000 .. 0.314 (mid 0.076) | 0.000 .. 0.093 (mid 0.023) |

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
| claude_bomb_v21 | ours | 36 | 35 | 0% | 0.37 | 0.58 | 23 | 0.144 |
| claude_bomb_v22 | ours | 36 | 12 | 0% | 0.36 | 0.52 | 27 | 0.157 |
| claude_rail_v1 | ours | 57 | 19 | 4% | 0.33 | 0.48 | 26 | 0.108 |
| claude_rail_v2 | ours | 57 | 12 | 5% | 0.43 | 0.49 | 38 | 0.137 |
| claude_seals | ours | 42 | 48 | 23% | 0.21 | 0.38 | 15 | 0.079 |
| claude_sniper | ours | 63 | 40 | 23% | 0.65 | 0.15 | 22 | 0.148 |
| claude_staircase | ours | 79 | 52 | 0% | 0.64 | 0.36 | 25 | 0.226 |
| gemini_bomb | ours | 36 | 14 | 34% | 0.27 | 0.28 | 19 | 0.082 |
| grave_bell | refs | 60 | 5 | 1% | 0.36 | 0.54 | 42 | 0.144 |
| gym_tunnel | refs | 53 | 18 | 2% | 0.49 | 0.58 | 29 | 0.141 |
| idea_zone | refs | 39 | 4 | 1% | 0.23 | 0.37 | 32 | 0.094 |
| jar_nobel | refs | 60 | 29 | 8% | 0.62 | 0.42 | 32 | 0.109 |
| knight_loophole | refs | 41 | 10 | 1% | 0.53 | 0.48 | 45 | 0.172 |
| memory_price | refs | 78 | 9 | 4% | 0.31 | 0.55 | 39 | 0.123 |
| mirror_horse_race | refs | 64 | 13 | 1% | 0.47 | 0.40 | 39 | 0.220 |
| perfect_railroads | refs | 65 | 11 | 1% | 0.46 | 0.49 | 47 | 0.174 |
| pig_war | refs | 43 | 25 | 6% | 0.56 | 0.46 | 27 | 0.107 |
| pirate_cannonballs | refs | 64 | 20 | 1% | 0.52 | 0.48 | 39 | 0.140 |
| random_numbers | refs | 47 | 3 | 1% | 0.62 | 0.38 | 47 | 0.200 |
| red_baron | refs | 60 | 30 | 5% | 0.56 | 0.42 | 33 | 0.094 |
| robot_year | refs | 63 | 54 | 7% | 0.35 | 0.50 | 38 | 0.184 |
| roller_coasters | refs | 63 | 5 | 2% | 0.44 | 0.51 | 41 | 0.154 |
| second_draw | refs | 56 | 8 | 6% | 0.44 | 0.46 | 39 | 0.125 |
| slot_machines | refs | 31 | 8 | 0% | 0.37 | 0.60 | 41 | 0.318 |
| storm_oil | refs | 65 | 23 | 0% | 0.38 | 0.62 | 38 | 0.164 |
| town_button | refs | 66 | 4 | 1% | 0.50 | 0.45 | 41 | 0.151 |
| tsar_garden | refs | 51 | 40 | 0% | 0.49 | 0.58 | 39 | 0.224 |
| vp3 | refs | 45 | 6 | 1% | 0.28 | 0.49 | 40 | 0.119 |
| vp4 | refs | 58 | 7 | 3% | 0.51 | 0.42 | 37 | 0.166 |
| vp5 | refs | 45 | 5 | 4% | 0.55 | 0.39 | 45 | 0.106 |
| winning_tickets | refs | 63 | 10 | 2% | 0.42 | 0.49 | 34 | 0.213 |

## Notes on reading the numbers
- Videos differ in resolution (360p / 720p / 1080p) and compression. Frame-to-frame change is noisy for low-resolution files, so trust 'held frames', camera share and shot length more than the raw change numbers.
- Camera, cut, texture and story habits (what to do, with numbers and evidence) are in docs/PLAYBOOK.md, generated from reference/knowledge/rules.json. The biggest measured gaps of our videos are listed at its top.
- Captions (lower-middle band) are ignored in every measure.

## How to extend (adaptive)
Add any new reference short: `python3 kit/tools/ref_measure.py add video.mp4 --name NAME --group refs`. The ranges and this file rebuild themselves.
Compare a finished video: `python3 kit/tools/ref_measure.py compare video.mp4` (add `--dark` if the script is meant to be dark).
