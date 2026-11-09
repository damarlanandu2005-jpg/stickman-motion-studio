# Reuse report: mromidev/claude-animated-shorts vs Stickman Motion Studio (read-only audit, no code changed)

Source read: SKILL.md (166 lines), templates/bridge (12 TS files, ~4,600 lines), templates/audio, templates/scripts, references/ (STYLE_BIBLE, 7 reports, 38 frames, 20 sheets).

## Key facts
- His project is React Three Fiber + Remotion (TypeScript). Ours is plain three.js in headless Chromium (JS). Files cannot be copied across unchanged; they must be ported.
- His bridge world is built from Kenney CC0 GLB props (trees, lanterns, stalls) recoloured and reshaped, plus HD painted textures (paint.ts 720 lines), build.ts 703, world.ts 578. Ours: main.js ~660, paint.js 154. We have no prop-kit and far less texture work.
- His look values (SKILL.md "Final look values") came from 4 verifier rounds, 5/3/4/5/4/7/4/6 -> 7/5-6/5-6/6/5-6/7/6-7/6-7.
- His process: measure references -> 5 sandboxes with one file owner each (cam, world, mat, char, post) -> merge -> independent Opus verifier on side-by-side sheets -> numbered fix list -> repeat.
- Our toon.js/toonbase.js (character library) come from his toon.ts: keep.

## Classification
A. Reuse unchanged (docs/data, language independent): STYLE_BIBLE.md + 7 reports (reference numbers), look values and light presets (as numbers), readability traps list, verifier workflow, scripts/sbs_sheet.py, short_qa.py, audio templates (Python).
B. Reuse with adapter (port TS->plain three.js): lights.ts (presets), shade.ts (two-tone shading), grade.ts, ink.ts (we have our own ink pass: compare, adopt his depth-scaled width), lensblur.ts (we have DOF pass: compare), cardshade.ts (cards lit by scene light, we do not).
C. Extend ours: paint.js -> his paint.ts techniques (HD textures, seams as dark tints); main.js world helpers -> his build.ts patterns (sight-line culling, recoloured props, foreground props); story.js camera -> his story.ts (smootherstep glides 18-40 f, creeping holds, kicks, roll, DOF table, FOREGROUND).
D. Missing, needs new work: railroad-specific world (carved canyon, bridges, train, crew poses); Kenney-style prop kit for railroad (or hand-built); sandboxes + merge script for our layout; side-by-side sheet + scoring loop wired to our renders; seated poses.

## Plan (no code until approved)
1. Port look values + camera rules into the a1 project (B/C), keep v2 and a1 untouched as baselines.
2. Author railroad world properly (D) using his build/paint patterns.
3. 3-4 rounds: render 8-10 stills, side-by-side with references, independent verifier scores, fix list, repeat. Stop early if scores reach his final level.
4. Only then render the full video (GitHub parallel render + assemble-a1 workflow).
