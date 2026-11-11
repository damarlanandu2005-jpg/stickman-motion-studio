# Script finder (design + working scorer)

Goal: choose topics and write scripts that this engine can actually draw, so a short reaches a good score in few rounds.
The rail test short taught us the rule: **a story beat the viewer cannot see in the picture is a script bug, not an art bug.**

## Stages
1. **Collect** candidate stories (real history/science anecdotes, 50-65 s of narration, one clear turn). Web research, several sources each.
2. **Beat sheet**: split into scenes; for each scene write the caption line, the ONE thing the viewer must see, and tag it
   with engine tags from `capabilities.json` (place, chars, prop, action, fx, light, camera, state).
3. **Score** with `score_idea.py` (difficulty 0-100, expected rounds, expected /70, which tags are missing or risky).
   Calibrated on two shorts: the bridge template (his: about 40-47/70) and our rail test (34/70 after 7 rounds). Re-fit after each new short.
4. **Rewrite to fit**: if a scene needs a missing/risky tag, change the idea (cut the beat, move it to narration, replace the prop)
   before any code. Scenes needing new art are allowed only if the art task is added to the plan first.
5. **Lint the beat sheet** (rules below). Only then generate the story file (`new_short.py`) and start the five owners.

## Script rules (from the rail short)
- Max 8-10 scenes, 55-65 s, one place, 1-3 characters, day light first (golden hour only as a short final scene).
- Every caption beat has a visible subject in the same shot (if the line says "a finger-wide gap", the gap is the subject, large, in the lower third).
- No tool-use, fights, weather, night, water, animals, or explosions until the engine has them (status "missing").
- Text props (newspaper, sign, chart): one per short, big, upright, facing camera, the words short.
- A moving object (train, cart) crosses the frame once and is framed full; do not rely on it for the story beat.
- Insert shots of small objects: close camera, exaggerated size (a coin is 1/4 scale of a hand, not 1/40).
- Keep left/right positions of the two sides of the story fixed across scenes; never swap the sides.
- Voice: word timings first; every visual reaction lands 0-3 frames before its word.

## Files
- `capabilities.json`: tags, cost, status, evidence (edit as the engine grows).
- `score_idea.py`: `python score_idea.py ideas/*.json`
- `ideas/`: two calibration ideas (bridge, rail) and sample candidates.

## Next to build
- Candidate generator (research agent writes idea JSON from web sources, with source links).
- Beat tagger + the lint above as a script (flags a caption whose "must see" thing has no tag, scenes > 10, missing tags).
- After each finished short: re-fit costs from the verifier's per-area scores.
