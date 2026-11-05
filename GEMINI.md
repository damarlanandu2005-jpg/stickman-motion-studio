# Instructions for the AI that builds the video (Gemini CLI reads this file automatically)

You make ONE vertical animated cartoon short from a script, with the kit in `kit/` and the method in
`skills/cartoon-audio-short/SKILL.md`. Read SKILL.md fully before starting and follow its Stage 4 rules
(timing, shot plan, world, cast, motion, look check, sound). The look must match the kit's example.

This run is AUTOMATIC. Nobody is watching. Never ask a question; decide and note your decision in `work/NOTES.md`.

What is already done for you (in the project folder you are started in):
- `voice.mp3` (Kokoro voice) and `script.txt` (the narration text) exist. Do not change the voice.
- `bash kit/tools/setup.sh` already ran: `web/` has the engine, `web/story.js` and `audio.py` are the example to rewrite.
- `shot_notes.txt` holds the AUTHOR'S SHOT PLAN (CAST + one block per shot: WORDS, PLACE, LIGHT, CAMERA, CHARACTERS, EFFECTS, SFX, MUSIC).

THE AUTHOR WRITES THE SCENES. YOU ONLY WRITE THE CODE.
- Do not invent, merge, reorder or drop shots. Make exactly the shots in shot_notes.txt, in that order, each starting on its WORDS.
- Use the author's place, light, camera move, characters (outfit, pose, face, position), effects, sounds and music exactly as written.
- Your work is the code that shows it: the 3D world and props, the character outfits, camera keyframes, timing, animation and sound cues.
- Only if a field is empty, choose something simple that fits, and list every such choice in work/NOTES.md.

Your job, in order:
1. `python3 timing.py voice.mp3 script.txt --out work` and check `work/phrases.json`.
2. Write `work/PLAN.md`: the author's shots from shot_notes.txt with their frame ranges from the timing (no new shots).
3. Rewrite `web/story.js` (shots, cameras, lights, world state, actors, effects) and the world part of `web/main.js`
   (between `// ---------- world ----------` and `// ---------- cards ----------`). Add outfits/props in `web/roman.js`,
   then run `cat web/toonbase.js web/roman.js > web/toon.js`. Export `TOTAL` = round(voice duration x 30).
4. Look check: `node render.mjs stills/a "<middle frame of every shot, comma separated>"` then `python3 sheet.py stills/a stills/sheet_a.jpg`.
   Open the sheet image, look at it, fix the traps in SKILL.md 4.6, render again. At most 4 rounds.
5. Sound: rewrite the cue table in `audio.py` so it writes `music.wav` and `sfx.wav` (stems), then
   `python3 mix.py voice.mp3 music.wav sfx.wav` (writes `mix_raw.wav`).
6. Do NOT render all frames and do NOT run finish.sh: the workflow does that after you stop.
7. When done write `work/DONE.txt` with one line per shot (what it shows). If something could not be done, write it in `work/NOTES.md`.

Rules: original story and characters only, no real living people, no logos, no captions. Keep the voice untouched.
