# Verifier round 6: rail short (blind, strict)

Video checked: /home/claude/stickman-motion-studio/results_kaggle/rail/railroads_kaggle.mp4. It is 1080x1920, 30 fps, 1699 decoded frames (56.66 s), with audio.
I used the 4 SBS sheets, all 57 sample frames at full size and about 50 extra frames pulled with ffmpeg. I also ran a scan of every frame for corrupted frames.

## Scores

| # | Area | Score | Why |
|---|------|------:|-----|
| 1 | Composition | 5/10 | The day medium shots work (c1, c4, c6, c8). Several shots fail: c10 is 45 % empty desk front, c14 crops the hat at the top, c15 cuts the boss in half and then holds on an empty track, c16 is an empty truss corridor for 155 f, and c17 has a fg post plus a railing across a torso. |
| 2 | Environment | 5/10 | The canyon mesas are stacked rectangular boxes that read like city skyscrapers. Mesas turn white and untextured in c9 (757-823). Steam shows as white boxes with ink edges (c2). Rails look like white or salmon plastic strips. Tie plates look like oversized stair blocks (c11-c13). On the plus side, the office set and the trestles are good. |
| 3 | Characters | 7/10 | Bean heads, plum ink and expressions are on target, and boss, engineer and rival are clearly different people. The purple-face beat works. Problems: in c10 the boss head is a shaded sphere with no body, in c13 the coin hangs in mid-air, and the engineer turns up on the rival's bridge (c16/c17). |
| 4 | Lighting | 5/10 | Day is fine: median luma .52-.60 against the .57 target. But blacks are crushed: non-ink p5 is .03-.12 in many frames (c5_480 .07, c8_687 .03, c14 .03, c19 .06) against the .23 target. In golden hour the shadows are maroon or brown, not violet-blue (#444380). Canyon shots run at median saturation .80-.85, so everything is orange and nothing is targeted. The blue steel loses its identity under the golden grade. |
| 5 | Camera | 4/10 | Moves are smooth and screen direction (blue left, rust right) mostly holds. But the camera misses the story subject in c1, c5, c9, c12, c14, c15 and c16 (details below). |
| 6 | Style (ink, flat, two-tone) | 6/10 | World ink is present and fairly consistent. Characters carry their own ink. The ink is wrong on transparent volumes (steam, white boxes). Bloom and halo on the c16/c17 truss is soft. Dissolves leave double-exposure frames at nearly every cut (c6_489, c9_696, c10_828, c11_960, c12_1028, c14_1143, c16_1268, c18_1478, c19_1553), where the reference uses hard cuts. |
| 7 | Readability | 4/10 | Character beats read (purple face, thrilled boss, sad boss with newspapers). The physical story does not: the gap, the shrinking gap, the paper in the gap and the heat stress are never shown when the caption says them. c9 shows the wrong train for "his go clickety clack". |
| | **Total** | **36/70** | |

## Blocker found by full-frame scan

Thirty-six frames are corrupted. In each one the picture is a strip from the top of the frame repeated about 5x vertically and about 3x horizontally, with the caption still drawn on top. I confirmed this visually for the first 15 frames below and for 12 more. The rest are scan hits with the same signature.

Corrupted frames:
1, 398, 427, 428, 487, 488, 511, 564, 565, 613, 674, 682, 683, 689, 692, 790, 826, 827, 831, 851, 964, 1029, 1142, 1159, 1169, 1192, 1205, 1241, 1419, 1424, 1471, 1506, 1513, 1551, 1631, 1691

On playback these show as single-frame flashes. Frame 1, the second frame of the video, is one of them.

## Numbered fix list

### Technical and global

1. **ALL scenes, frames listed above: 36 tiled/garbage frames.**
   - Wrong: the frame capture is corrupted, and the scan threshold (vertical self-similarity < 3/255) flags 2.1 % of frames.
   - Fix:
     - Find why the render returns a tiled buffer, for example a frame grabbed before the composer draws, or a resize/dpr change mid-render. Make the render wait for the composer's final pass.
     - Re-render the affected frames and re-run the scan until it finds 0 frames.
   - Owner: **post** (Rail.tsx and the render pipeline).
2. **c2 120-214 and c9 757-823: transparent volumes drawn as white boxes with black ink edges.**
   - Wrong: the steam trail is a hard-edged white box. In c9 two mesas behind the trestles render pure white and untextured with ink edges, and the steam is a flat white cone.
   - Fix:
     - Put steam and FX meshes on the NOINK layer and exclude transparent materials from the depth/normal prepass.
     - Fix the mesa material that drops its texture (likely a material/LOD swap or a culler replacing the mesh).
   - Owner: **post** (ink.ts NOINK mask) for the ink. **mat** (railprops.ts/build.ts) for the white mesas and the steam mesh.
3. **Global: rails look like white or lavender plastic by day and glowing salmon strips at golden hour.**
   - Examples: c1, c7, c16_1341 (a full-height salmon band).
   - Fix: dark desaturated steel rails (about #4a4a52) with a narrow polished top strip (about #cfcfd6) and darker web shading. Keep the gap readable by contrast against the ties.
   - Owner: **mat** (railprops.ts).
4. **Global: canyon mesas are stacked axis-aligned boxes with stripe texture and read as a city skyline.**
   - Examples: c4_302, c11, c13, c18.
   - Fix: taper and erode the silhouettes (talus slopes, uneven tops), break the vertical edges, and add 2-3 blue-violet haze layers for distance.
   - Owner: **mat** (build.ts) for the geometry. **world** (fog) for the haze.
5. **Crushed blacks.**
   - Wrong: non-ink p5 is .03 in c8_687 and c14_1173/1204, .06 in c19, .07 in c5_480. The target is about .23.
   - Fix: lift the shadow floor in grade.ts (toe/lift +.06), and lift hats and coats a little in cardshade so they are not near-black masses.
   - Owner: **world** (grade.ts), plus **char** for the hat albedo.
6. **Golden scenes c11-c19: shadows are maroon or brown.**
   - Examples: c13_1107 ties and ground, c18 ballast. The target is violet-blue (#444380), with saturation p50 at .70-.84.
   - Fix: push the golden shade tint to violet in shade.ts/lights.ts and cut the global golden saturation by about 15 %, so the warm key and the cool shade separate.
   - Owner: **world**.
7. **c16-c19: the "perfect" blue-steel railroad no longer reads blue at golden hour.**
   - Examples: c16 truss is grey-pink, c19 trestle is dark brown/grey. Viewers lose which track is which.
   - Fix: keep the left steel at a saturated blue albedo (about #3d6fb0) that survives the golden grade, or exempt it from the warm grade.
   - Owner: **mat** (albedo), **world** (grade).
8. **Dissolves at almost every cut leave double exposures.**
   - Examples: c6_489 has a ghost boss over the two-shot. c10_828 is half office, half trestle.
   - Fix: hard cuts per the target ("hard cuts on big jumps"). Keep a dissolve only for c11 (time jump to summer) and c16 ("meanwhile").
   - Owner: **post** (Rail.tsx transitions).

### Camera and story logic (one item per problem)

9. **c1 0-89, "He sawed gaps into a railroad every thirty-nine feet": the gap is not the subject.**
   - Wrong: the only rail joint sits at the bottom-right edge (c1_44 x≈600/640, y≈520/640), out of focus and cropped. The hook frame shows a man on a track and no gap.
   - Fix: low camera at rail height about 0.3 m with the sawn joint in the lower third, centred (x 0.35-0.5), and the engineer behind it in focus. Alternatively, add a 15-20 f insert on the gap at the "GAPS" word (f 15-30).
   - Owner: **cam**.
10. **c2 90-218, "two companies racing ... across a canyon": only one railway is legible.**
    - Wrong: the red train on the rust trestle fills the frame, and the blue track is a sliver at the left edge (c2_154/214).
    - Fix: aim between the tracks at about x=0, not 4.5, and raise or pull back so both trestles and the drop read. Keep blue on screen-left and rust on screen-right.
    - Owner: **cam**.
11. **c5 353-484, "when his boss sees a finger-wide gap between every single rail": the gap is never shown.**
    - Wrong: the shot is a 0.3 m low angle up at the boss against the sky. The rails are a white blur at the frame bottom.
    - Fix: add an insert cut (about 400-430, on "GAP BETWEEN EVERY SINGLE RAIL") of the rail joint in close-up, with a finger or a caliper in the gap. Then cut back to the boss turning purple on "PURPLE".
    - Owner: **cam** (cut + keys), **char** (finger/hand prop).
12. **c9 692-823, "Their trains glide ... while HIS go clickety clack over every gap": wrong train.**
    - Wrong: at 757-823 the moving train is on the LEFT blue trestle (the rival's). The right rust trestle, his, is empty the whole time. At 696-740 ("THEIR trains glide") no train is visible at all.
    - Fix:
      - Show the rival's train on the left trestle during 692-750.
      - Then pan or cut to HIS train on the right rust trestle at about 750-823, with a bounce/kick on each joint and "clack" FX.
    - Owner: **cam** (keys/cut), **mat/world** (train path timing in railworld.ts), **char** (clack FX).
13. **c9 696: a lamp post sits in mid-frame foreground.**
    - Wrong: at x≈0.5 of the frame it stands right where the two trestles start, and blocks the subject.
    - Fix: move it out of the sight line or move the camera.
    - Owner: **cam**.
14. **c10 824-955, "newspapers start calling it the clickety clack line": the newspaper headline is unreadable and the frame is bottom-heavy.**
    - Wrong: the desk front fills y≈0.55-1.0 of the frame. The boss is a disembodied head and the papers are illegible.
    - Fix: raise the camera to about 1.7 m and tilt down slightly. Put a newspaper with a large, readable "CLICKETY CLACK LINE" headline (unlit material) in the foreground, held by the boss.
    - Owner: **cam** (framing), **mat** (newspaper texture).
15. **c12 1024-1076, "His gaps start shrinking in May": no gap visible.**
    - Wrong: a medium shot of the engineer, with only a rail end at the bottom-left.
    - Fix: CU insert of the joint, with the gap visibly narrowing over the shot (animate the gap from finger width to coin width) and a "MAY" calendar or tag if wanted.
    - Owner: **cam** (shot), **mat** (animated rail-joint gap in railprops.ts).
16. **c13 1077-1138, "You can fit a coin in them by July": the coin hangs in mid-air for about 55 f.**
    - Wrong: the coin moves from y≈370 to y≈395 of 640 across the whole shot. The joint is visible (good), but the coin never drops into it.
    - Fix: drop the coin with gravity into the gap within about 10 f and land it standing in the slot. Keep the camera framing (it is the best story shot).
    - Owner: **char** (coin FX).
17. **c14 1139-1208, "Barely a sheet of paper and his boss is thrilled": no paper in the gap, and the hat is cropped.**
    - Wrong: the hat goes past the frame top at 1190-1208.
    - Fix:
      - Start on an insert of a sheet of paper slid into the joint (1139-1165).
      - Then the boss MCU with headroom: hat top at y ≥ 0.06 of the frame. Pull back about 15 % or lower the look-at by about 0.2 m.
    - Owner: **cam** (framing/insert), **char** (paper prop).
18. **c15 1209-1263, "See, even your gaps know you were wrong": the subjects leave frame.**
    - Wrong: at 1213 the boss is half off the left edge and the engineer is cut at the right edge. At 1236 and 1259 there are no characters at all, only an empty track (the camera slides from x 3.4 to 6.4).
    - Fix: hold a two-shot (boss gloating on the left, engineer on the right) with the closed-up joint between them in the foreground. A slow push-in only, no lateral move.
    - Owner: **cam**.
19. **c16 1264-1418, "Meanwhile on the perfect railroad the rails started groaning ... pushing against each other": no stress is shown.**
    - Wrong: 155 f inside a straight, perfect truss corridor. The rails are straight with no heat shimmer, no strain and no compressed joints. The engineer, who belongs on the right track, appears standing on this left bridge (1300, 1341).
    - Fix:
      - Show the left rails with a heat shimmer and small creeping bows.
      - Add a CU of a tight joint with rails pushing, plus a creak FX.
      - Remove the engineer from this bridge, or put him clearly on the far right track.
      - Cut the shot into 2-3 shots instead of one 5 s corridor.
    - Owner: **cam** (cuts), **world** (heat shimmer), **mat** (rail bow), **char** (cast placement in railcast.ts).
20. **c17 1419-1473, "On the hottest day anyone can remember": no heat cue, and staging problems.**
    - Wrong:
      - A foreground vertical post and a horizontal railing cross the engineer's torso (c17_1469, railing at chest height).
      - A big blurred brown post sits at the right edge (x≈0.97).
      - Both rival and engineer stand on the rival's bridge.
    - Fix:
      - Lens at about 2.5 m, so the railing crosses the legs, not the torso.
      - Remove the near post.
      - Add a heat cue: bright sun disc, shimmer, sweat drops, or a thermometer prop.
      - Put the engineer on his own track, or justify his presence.
    - Owner: **cam**, **world** (shimmer/sun), **char** (sweat).
21. **c18 1474-1548, "His gaps finally close. Rail touching rail": the sparkle hides the joint.**
    - Wrong: the closing gap is never seen, only a yellow star burst at the rail end.
    - Fix: tighter insert on the joint showing the last sliver closing at "TOUCHING", with a small tick FX. Put the sparkle after contact and at about half its current size.
    - Owner: **cam** (insert), **char** (FX size/timing), **mat** (animated joint).
22. **c19 1549-1700, "Halfway across ... kicks sideways like a snake right as a train rolls onto it": the beat works, but it needs clean-up.**
    - What works: the S-kink is visible from about 1650, and the train reaches it at about 1688.
    - Wrong:
      - The trestle reads brown/grey, not blue (see item 7).
      - The yellow dashed rail glow reads as lights, not heat.
      - The kink sits near the far end, not "halfway across": the train has already crossed most of the gorge.
      - Frames 1631 and 1691 are corrupted (item 1).
    - Fix:
      - Place the buckle at mid-span.
      - Glow the rails orange-red with a continuous gradient.
      - Start the train on the canyon rim at 1549 and let it roll onto the trestle as the snake happens.
    - Owner: **mat/world** (buckle position, glow), **cam** (frame mid-span).
23. **c3 and c10 office: the chart behind the boss shows a falling line in both scenes.**
    - Wrong: in c3 (the big-business promise) a falling line contradicts the beat. It only fits c10.
    - Fix: rising chart in c3, falling chart in c10.
    - Owner: **mat**.
24. **c8 687: the rival's top hat touches the frame top (y≈0.03).**
    - Fix: lower the look-at 0.15 m or end the push-in about 10 % earlier.
    - Owner: **cam**.

## Scene-by-scene camera and logic review

| Scene | Frames | Caption | Camera / logic verdict |
|---|---|---|---|
| c1 | 0-89 | "He sawed gaps into a railroad every 39 feet" | Track and engineer are fine. Screen direction is fine. The gap is not shown (item 9). |
| c2 | 90-218 | Two companies, canyon | Train and trestle and the drop read well. Only one track is legible (item 10). Steam boxes (item 2). |
| c3 | 219-297 | "Whoever finishes first gets the whole country's business" | Office is fine and the boss is clear. Chart direction is wrong (item 23). |
| c4 | 298-352 | "He's the youngest engineer on the job" | OK. |
| c5 | 353-484 | "When his boss sees a finger-wide gap ... face turns purple" | The purple beat is good. The gap is not shown (item 11). Blue on the left and rust on the right is consistent. |
| c6 | 485-524 | "You're wrecking my railroad" | Clear two-shot. Ghost dissolve at the start (item 8). |
| c7 | 525-576 | "But he won't close a single one" | The gap is visible at the bottom-left at 529, then pans out of frame. Acceptable, but better to keep it. |
| c8 | 577-691 | "The other one lays rails end to end perfectly smooth" | Correct: the rival is on the blue left track and the rust bridge is on screen-right. Hat touches the frame top (item 24). |
| c9 | 692-823 | "Their trains glide ... while his go clickety clack" | Wrong train and track (item 12). Lamp post blocks the subject (item 13). White mesas (item 2). |
| c10 | 824-955 | "Newspapers start calling it the clickety clack line" | Bottom-heavy framing, unreadable paper (item 14). |
| c11 | 956-1023 | "Then summer comes and something weird happens" | Acceptable transition to golden. No summer cue. |
| c12 | 1024-1076 | "His gaps start shrinking in May" | Fails: no gap (item 15). |
| c13 | 1077-1138 | "You can fit a coin in them by July" | Best story shot. Floating coin (item 16). |
| c14 | 1139-1208 | "Barely a sheet of paper ... boss is thrilled" | No paper, hat cropped (item 17). |
| c15 | 1209-1263 | "See, even your gaps know you were wrong" | Characters leave frame, empty track (item 18). |
| c16 | 1264-1418 | "Meanwhile on the perfect railroad ... groaning" | No stress shown, engineer on the wrong bridge, 5 s static corridor (item 19). |
| c17 | 1419-1473 | "Hottest day" | Railing through the torso, no heat cue (item 20). |
| c18 | 1474-1548 | "His gaps finally close" | Readable-ish, but the sparkle hides the joint (item 21). |
| c19 | 1549-1700 | Buckle + train | The kink is visible and works. Colour, glow and position need fixing (item 22). |

Left/right consistency: blue on the left and rust on the right holds in every day shot (c5, c8, c9). In the golden scenes the left track can only be identified by camera position, because its colour is lost.

## First frame, last frame, order

- **First frame:** frame 0 is a usable hook (engineer on the track). But frame 1 is a corrupted tiled frame, so the video opens with a flash. The hook also does not show the gap.
- **Last frame:** frame 1699 (c19) shows the train on the buckled trestle. It is coherent as a cliffhanger, and it sits under the last caption "ONTO IT".
- **Scene order:** coherent and matches the caption script: setup, boss, rival, trains, newspapers, summer shrinking, heat, buckle.

## Ready for final render?

**NO.** Four reasons:

- 36 corrupted tiled frames (item 1) are an absolute blocker.
- The main logic error in c9 (item 12): it shows the wrong railway's train.
- The core visual promise of the story, the gap and how it changes, is not shown in c1, c5, c12, c14 or c18 (items 9, 11, 15, 17, 21).
- The empty or cut-off subject shots in c15 and c16 (items 18, 19).

Fix items 1, 2, 12, 15, 17 and 18 at minimum before a final render. Items 3-7 are look polish.
