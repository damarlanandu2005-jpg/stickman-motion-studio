# The pipeline (locked 2026-11-13)

Owner gives narration scripts. Everything else is automatic. No approval gates. Picture: Ricks stage (flat 2D puppets in a lit 3D world).
Planning and checking: the owner's earlier method (shot plan, measured reference rules, blind verifier). One owner per file.

## Stages (per script)
1. **Script adapter** - fact-check; tighten into filmable beats without changing the meaning; reject or adapt beats that need an
   untested capability (`library/catalog.json` -> `capabilities`); voice (Kokoro) and word timings.
2. **Director** - `breakdown.json`: period, places, cast, and one entry per spoken line: place, camera move, who is on screen with
   face and motion, props, and a **proof** (the prop, action or label that shows what the line says). `tools/breakdown.py check`.
3. **Casting and assets** - `tools/library.py` lookup. Missing: code-built (furniture, buildings, simple props, hand-held props) or
   Gemini (characters, 18 faces, hats, textures, backdrops). Every generated image is looked at full size against its reference;
   at most 2 regenerations, then drop it (a face) or use the nearest one. Rejected images are not registered.
4. **Set dressing** - the static world for each place, from a place kit (`library/kits/*.json`). What a place needs is decided
   from the place, period and story. Reference range from the study: 6-10 dressing pieces per place (a check, not a quota).
5. **Background life** - what would normally be alive in that place and period (people, vehicles, animals, moving things).
   Optional: an empty place stays empty when the story wants it. Reusable behaviours only (`behaviours` in the catalogue).
6. **Camera / light / acting / sound** - separate sections of the breakdown, compiled by `tools/breakdown.py build` into `short.json`.
7. **Checks** (max 4 rounds): stop-frame gate; full-size frames of every shot looked at; per-line check (planned character, face,
   place on screen); camera numbers; sharpness; loudness.
8. **Blind verifier** - an agent that did not see the build scores sheets on 7 criteria (/70) and returns a numbered fix list.
9. **Render once** on Kaggle T4; save every new asset to the library; write rules learned into this file.

## Rules (from the failures of earlier work)
- A beat only counts if the picture shows it: every line has a proof; hold it in frame while the words are spoken.
- Every shot has one subject and the camera keeps it in frame. Every shot moves in 3D (orbit, crane, push); no pure zoom, no static hold.
- Location change = dissolve or fly-through, never a glide across empty ground.
- Each character keeps the same outfit and the same side in a place. Each place keeps its dressing every time it returns.
- Each place has its own backdrop. Assets carry a period tag; never mix periods.
- Background life never crosses between the camera and the subject and never stands closer to the camera than the subject.
- Do not add effects, props or characters at random: dressing and background life come from the place kit for that place and period.
- Generated character: stick arms clear of the torso and the full costume in the FIRST image. No arm redraws (they lose the costume).
- Faces: every face is compared with the reference head at full size; hair, moustache, glasses and hat must match.
- Never judge from thumbnails. Look at full-size frames, and at several frames across each moving shot.
- Encode once. If the file is over ~95 MB, lower the quality in the render itself, not by re-compressing.
- Do not optimise a number over how the picture looks.

## Verifier criteria (10 each): composition, environment, characters, lighting, camera, style, readability.
Earlier engine: 34/70 (Railroads, 7 rounds). Bar before unattended daily runs: 45/70.

## Not possible yet (say so, do not fake): elbows and knees, lip sync, sitting poses, crowds over ~12 puppets, water, animals.
