# Preview checks for beats.selected.json

Tiles: drawn from the plan (NOT a render). Sheets: preview_01.jpg, preview_02.jpg, preview_03.jpg.

| id | class | check | status | detail |
|---|---|---|---|---|
| PV-A1 | automatic | main subject does not cover the caption band | pass |  |
| PV-A2 | automatic | every thing the words name is in the frame (or listed as not shown) | pass | beat s2: the narration names 'bomb' and it is in the beat, but it is not in val; beat s3: the narration names 'device' and it is in the beat, but it is not in v; beat s4: the narration names 'he' and it is in the beat, but it is not in valid; beat s6: the narration names 'them' and it is in the beat, but it is not in val |
| PV-A3 | automatic | every beat lists what must be visible | pass |  |
| PV-A4 | automatic | each character has one fixed identity (outfit, hat, identity_lock) and no unresolved NEW: placeholder | fail | ARTHUR-SUIT |
| PV-A5 | automatic | deliberate appearance changes are recorded as continuity_change | pass | 0 recorded:  |
| PV-A6 | automatic | consecutive tiles are not near-identical compositions | pass |  |
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
