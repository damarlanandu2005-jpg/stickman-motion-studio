# Bell round 1 (blind verifier, no reference images)
Scores: camera 5, story 4, characters 6, set 5, light/post 6, captions 7, polish 4 = 37/70. Ready: NO.
Fix list (owner): c2 empty pan (cam); Watson in dark void not at doorway (cam); spill unreadable (world, char card); Bell face fills frame, captions over mouth (cam, post); Watson cropped behind door slab c6a/c6b (cam); horn close-up static (cam, not fixed in round 2); street lime green, no phones (mat, world; grass muted only); ending jar unexplained (cam); Bell tiny in c1 (cam); captions small (post).
Machine checks: framecheck 0 bad frames; short_qa no black/white/frozen spans.
Render: 276 s render on 2 T4 (about 11 min workflow), 15.2 MB.
Round 2 changes: cameras c1,c2,c3,c5,c6a,c6b,c9 reworked; stain bigger/brighter; puddle bigger/brighter; grass muted; captions 64->78 pt and lower.

# Round 2 (render 2)
Scores: camera 6, story 4, characters 7, set 5, light/post 6, captions 7, polish 5 = 40/70. Ready: NO. Machine checks clean (0 bad frames).
Open: Watson in a dark void with no doorway visible (cam/world); spill cause not shown (jar tipping); static horn close-up; final insert unclear; town too lime.
Round 3 changes: cameras c3, c4a, c6a, c6b, c7, c9 widened so the doorway frame shows (checked on a CPU still); receiver moved out to the ear.

# Round 3
Scores: camera 6, story 5, characters 7, set 6, light/post 7, captions 7, polish 6 = 44/70. Ready: NO. 0 bad frames.
Open: jar/knock not seen (jar out of frame), Bell cropped at left in c4b/c5, caption over the acid, final insert unclear, doorway room is just dark.
Round 4 changes: cameras c4a (jar and Bell both in frame), c4b, c5 (more headroom), c9 (pulled back to show jar and puddle).

# Round 4
Scores: camera 6, story 5, characters 6, set 6, light/post 6, captions 7, polish 5 = 41/70. Ready: NO. 0 bad frames.
Score did not rise (37, 40, 44, 41), so the stop rule ended the loop after 4 rounds. Best by the verifier: round 3 (44). Both files are kept in results_engine/Bell/. The verifier is another AI looking at stills; its scores moved by about 3 between near-identical renders, so a 3-point drop is within noise (not sure).
Still wrong: the jar knock is never shown in motion (only before and after), the doorway room is a dark opening, Watson's run is a slide, the town is a different, brighter look, the voice is a placeholder, and captions must be re-timed for a real voiceover.
