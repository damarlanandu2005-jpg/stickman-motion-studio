# v3 recreation (layered method), honest report

Status words: **written** (code), **unit tested**, **executed** (ran), **rendered** (video made), **looked at by Claude** (frames/sheets viewed), **human reviewed** (owner watched).
Nothing here is human reviewed. Nobody has listened to the voice.

## What was built (all executed and rendered once)
- Real v3 cuts measured with ffmpeg scene detection: **50 segments, 73.10 s** (`animation/scenes/ref_v3_cuts.json`). The older saved list (40 shots, 71.44 s) was wrong.
- Kaggle run 1 (23 pictures: 11 empty backgrounds, 12 objects) and run 2 (11 pictures: 10 variants edited from base pictures + 1 blank card). 34 of 34 drawn, 0 failed. No people, no faces, no readable text, except tiny garbled digits on the hospital height chart.
- Roles = recoloured explorer sprites (`motion_studio/roles.py`). No faces drawn.
- Text and numbers drawn by code (`shot2d.draw_text`): countdown timers, "12", "74!", "FIRED", sign and note labels, check marks.
- Voice: Kokoro am_fenrir in 38 chunks timed to v3's caption starts (OCR of v3 captions; the wording of the last 10 s is my reading, not a transcript). Base speed 1.0, each chunk stretched 0.8x to 1.4x. Loudness normalised.
- Unit tests: 98 of 98 pass.

## Measured comparison (our video vs v3)
| Item | v3 | Ours | Note |
|---|---|---|---|
| Duration | 73.10 s | 73.10 s | same by construction |
| Shots | 50 | 50 | durations copied exactly |
| Visible cuts found by ffmpeg scene detection | 49 | 46 | 47 of 49 v3 cut times have a cut in ours; missing: 27.93 s (same picture, gray) and 59.13 s (same picture, zoom). The 0.07 s and 0.10 s flash shots exist but are too short to detect |
| Caption centre height | 0.695 | 0.695 | same |
| Caption text width / height (px) | 390 / 170 | 385 / 157 | close |
| Voice loudness | -15.9 LUFS | -16.8 LUFS | close |
| True peak | -4.2 dBFS | -1.9 dBFS | a little hotter |
| Silences longer than 0.3 s | 0 | 6 | pauses where v3 words are stretched; total pause about 6.7 s |
| Boom / timer ticks | none found | none added | v3 audio shows no boom in the explosion window and no regular ticks |

## Differences that remain (honest)
1. **Characters (biggest).** v3 has about 6 distinct looks (hair, headset, mustache, glasses, bomb-suit visor). Ours: one cast, recoloured. Every head has the safari helmet. **Doctor and chief are both white, only the cap differs.** Cops share one look. Daughter is missing.
2. Bomb-suit technician stands next to the bomb. In v3 he kneels with hands on it. No small officers in the background of shot 1.
3. Small props missing: heart card, exam paper, thought bubble with check, "74" plate in the chief's hand, pliers and fingers on the wires (shots 42, 43), paint bucket tipping (ours is a static bucket), blueprint labels are tiny.
4. Plate "12" is a white disc with a digit, v3 has an orange dot plate and a small clock.
5. Pictures: ours are cleaner and simpler than v3. Outlines and style differ (known). 4 colour cards instead of 5, 3 wires instead of 5, 3 batteries instead of 4.
6. Camera: ours is push by default, pan on some shots. v3 per-shot camera moves were not measured.
7. Voice: Kokoro is a different voice from v3, and reads the reconstructed text. Caption times inside a chunk are estimated from letter counts.
8. Shot 24 reuses the picture of shot 23 in grey. Shot 43 reuses shot 42 with a closer zoom.
9. Outline thickness, sprite shadow and head size differ from v3.

## Still missing for a fully automatic pipeline
Costume sprite sets (bomb suit, doctor, cop with hair and headset, chief with mustache), kneel/sit/walk-front poses, automatic floor line per background, planner choosing library items by tag, real language model planner, upscaling of 576x1024, text-free check of pictures, a gate that checks the story match.
