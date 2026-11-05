# Script format (the same format that made the Pig War video)

Full worked example: `docs/pig_war_script_and_shot_plan.md`. Copy `scripts/TEMPLATE.txt` for a new story.

A script file has three parts:
1. `TITLE:` one line.
2. `NARRATION:` the exact words the voice says (about 3.7 words per second; 40 s is about 150 words).
   Order: HOOK (the strange fact) > SETUP (place) > INCIDENT > ESCALATION > STANDOFF / TIME JUMP > RESOLUTION > TWIST (the last words).
   Numbers as words. No stage directions in the narration.
3. `SHOTS:` one block per shot. You do NOT write frame numbers: the voice timing gives them.

```
SHOT 1
WORDS:      "the exact phrase spoken in this shot"
PLACE:      where it is, what is in the frame
LIGHT:      day | dawn | golden | night | indoor | cycle
CAMERA:     start framing > end framing; push-in / pull-back / orbit / static / snap-zoom; wide or tight; tilt; shake on impact
CHARACTERS: who | outfit | pose (arms) | face | where they stand / which way they face
EFFECTS:    bubbles, smoke, stars, steam, flash, props that change
SFX:        what you hear and on which word
MUSIC:      what the music does (starts, stops, changes)
```

Rules: one visual idea per sentence, cut on sentence breaks, one camera move and one face change per shot,
loudest sound on the key action with the music silent just before it, the biggest picture on the last three words.
You write the scenes; the AI only writes the code for them and must follow your shots exactly. (If you leave a field empty, it picks something simple and notes it.) A CAST section (who wears what) at the top of SHOTS helps keep characters the same.
