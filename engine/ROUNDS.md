# Round protocol

1. Render the full video on Kaggle. Run `short_qa.py` and `framecheck.py`. Zero bad frames before the verifier sees it.
2. `make_sheets.py` -> 3 frames per scene vs the reference. Give the verifier the sheets, the video path, the shot table, the captions,
   and nothing about earlier scores (blind). Verifier: 7 criteria /10 (Composition, Environment, Characters, Lighting, Camera, Style,
   Readability), total /70, numbered fix list (scene + frame + what + fix + owner), camera/story-logic review per scene, ready YES/NO.
3. Map every fix to its owner. Owners fix in their sandbox and report. Merge, tsc, re-sync.
4. Record the round in `docs/<short>_rounds/roundN.md`: scores, fix list, what changed, what is still open. Commit text only.
5. Stop when scores stop rising for two rounds or the verifier says ready. Ship the best clean render.

## Score record (rail test short)
| round | total /70 | note |
|---|---|---|
| 3 | 28 | first Remotion look |
| 4-5 | 32 | plateau, reviewer: not ready |
| 6 | 36 | 36 corrupted GPU frames found |
| 7 | 34 | clean render, golden hour tinted, story beats not readable |
