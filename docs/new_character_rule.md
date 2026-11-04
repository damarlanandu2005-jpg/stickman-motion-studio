# Rule: a new character / costume is drawn from references of the OLD ones

Status: tested once (bomb suit, Kaggle FLUX.2 klein 4B). Code checks written and unit tested. Human review: NOT done yet.

1. Look in the library first (cast file stage). If found, use it.
2. Else make a colour change by code (roles.py). If the person accepts it, stop.
3. Else Kaggle draws it. References, in this order:
   - the old character's 12-pose body sheet (same poses, size, outline),
   - any ALREADY ACCEPTED sheet of the same new costume (same suit design in every pose).
4. Code checks every pose (costume_check.py): height, width, centre, head-leftover, outline, costume colour, old colour left.
5. A person accepts the sheet once. Then it is saved under animation/reference_art/cast/ and reused.
6. If checks fail: redraw the failed poses only; after 3 tries, flag it for a person.

Test result (bomb suit): see the A-vs-B picture in the chat report. Checks cannot see odd shapes (a stray bone-like leg in the crouch pose); a person must look.
