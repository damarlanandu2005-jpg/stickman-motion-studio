# Preview checks for beats.selected.json

Tiles: drawn from the plan (NOT a render). Sheets: preview_01.jpg, preview_02.jpg, preview_03.jpg, preview_04.jpg.

| id | class | check | status | detail |
|---|---|---|---|---|
| PV-A1 | automatic | main subject does not cover the caption band | pass |  |
| PV-A2 | automatic | every thing the words name is in the frame (or listed as not shown) | pass | beat s1: the narration names 'he' and it is in the beat, but it is not in valid; beat s5: the narration names 'his' and it is in the beat, but it is not in vali; beat s7: the narration names 'one' and it is in the beat, but it is not in vali; beat s10: the narration names 'his' and it is in the beat, but it is not in vali |
| PV-A3 | automatic | every beat lists what must be visible | pass |  |
| PV-A4 | automatic | each character has one fixed identity (outfit, hat, identity_lock) and no unresolved NEW: placeholder | pass |  |
| PV-A5 | automatic | deliberate appearance changes are recorded as continuity_change | pass | 1 recorded: s5:BOSS:face_colour=purple |
| PV-A6 | automatic | consecutive tiles are not near-identical compositions | warn | s5>s6, s18>s19, s21>s22 |
| PV-A7 | automatic | environment changes and transition reasons agree | pass |  |
| PV-A8 | automatic | camera framing agrees with the chosen shot recipe | warn | 1 framing change(s) made by the selector |
| PV-A9 | automatic | labels are readable at phone width (label height >= 2% of the sheet width, 3 tiles across) | pass | label glyph height is 2.2% of the sheet width |
| PV-A10 | automatic | real stills are not black or flat | not_run | no stills given: nothing is rendered yet |
| PV-G1 | ai_assisted | the same character looks the same in every still (hat, outfit, face shape) | not_run | needs rendered stills |
| PV-G2 | ai_assisted | every must_see object is visible and recognisable in the still | not_run | needs rendered stills |
| PV-G3 | ai_assisted | the picture shows what the narration says (narration-to-picture match) | not_run | needs rendered stills |
| PV-G4 | ai_assisted | no important content is cut off or hidden behind the caption band | not_run | needs rendered stills |
| PV-G5 | ai_assisted | the place looks like the same place across its beats (environment continuity) | not_run | needs rendered stills |
| PV-H1 | human | the characters and the world are attractive and professional (taste) | not_run | a person must look |
| PV-H2 | human | materials read as the right materials: wood, metal, stone, water | not_run | a person must look |
| PV-H3 | human | motion, acting and timing feel right (needs the video, not stills) | not_run | a person must look |
