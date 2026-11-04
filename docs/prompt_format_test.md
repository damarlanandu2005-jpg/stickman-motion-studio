# Prompt format test (run 41915652216, FLUX.2 klein 4B on Kaggle)

Same village scene asked in 4 ways (3 seeds each), and the same rooftop edited with 4 edit prompts (2 seeds each).
Pictures: `docs/prompt_test/scene.png` (rows A plain sentences, B list, C long detailed text, D JSON-like; 3 seeds per row)
and `docs/prompt_test/edit.png` (rows E1 "Make it daytime", E2 keep+change, E3 "same picture but…", E4 "do not…"; 2 seeds per row).
This was judged by Claude looking at the pictures (not by code, not by Nandu yet).

## What we saw
1. **Scene format barely matters.** Plain sentences, a list, long detail and JSON-like text all gave the same kind of picture:
   orange sky, red-roof houses on the left, one tall green tree on the right, a well in the middle, dirt road in front.
   The model does not read "machine language" better than normal words. JSON gave no gain.
2. **Positions and colours are followed. Exact counts are not.** "Three houses" came out as 2, 3 or 4 houses in every format.
   Do not rely on numbers. Use "a row of houses".
3. **More detail adds things, it does not fix things.** The long text added a roof on the well and other small items. Fine for
   richer pictures, but it is not more exact.
4. **Seeds change the layout a lot** (same prompt, 3 different compositions). A draw-again loop with code checks is the right tool.
5. **A short edit prompt breaks the style.** "Make it daytime." turned a cartoon into a realistic photo (E1).
6. **"Keep … Change only …" works best** (E2, E3): outlines and cartoon style stay, buildings stay, sun and blue sky appear.
   Small colour shifts on walls happen (pink walls in one seed). The code check (structure correlation) is there for this.
7. **"Do not …" wording is unreliable** (E4): no sun appeared, but the style drifted in one seed. Say what to do, not what to avoid.

## Rules we now use (already in the code)
- Write each element as a plain sentence with its place: "On the left: a row of small houses with red roofs."
- Put the style text (animation/style/house_style.txt) at the end of EVERY prompt, also for edits.
- Edit prompt = "Edit the reference picture. Keep exactly the same place, layout, objects and art style. Change only this: …".
- No negative sentences, no JSON, no numbers that must be exact.
- Author's detailed text goes in the scene's `draw:` line; the weekly style file carries the shared style.

## Limits
Two seeds per edit prompt and three per scene prompt is a small sample. Nandu should look at both sheets.
