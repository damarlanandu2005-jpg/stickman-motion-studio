# Handoff: how to make the next shorts with this engine

Read this first in a new chat. Then read `engine/README.md`, `engine/CONTRACT.md`, `engine/TRAPS.md`, `engine/ROUNDS.md`.
Owner: Nandu (YouTube "Stickman Thoughts"). Short, simple sentences. Be honest. Never touch `main`.

## Where everything is (all pushed)
- Branch `engine-pipeline` (work here): pipeline docs, tools, workflows, the Remotion project `mine/railroads_remotion`
  (src in `src/videos/rail/`, Kenney CC0 models in `public/`), the audio and captions used by the test
  (`tools/a1_assets/audio.m4a`, `cap.ass`), and the test result `results_engine/RailShort/RailShort.mp4`.
- Branch `gemini-cartoon`: old rail test notes, `docs/railroad_rounds/*` (rounds 3-7 and verifier reports).
- Secrets `KAGGLE_USERNAME` and `KAGGLE_KEY` exist only as GitHub secrets. The sandbox cannot read them. Start renders with the
  GitHub workflow `engine-render` (workflow_dispatch). The kernel clones the public repo branch when it runs.
- Not in the repo (public repo): reference videos, frames and sheets. His reports are the look source (private study material).

## What is proven and what is not
- Proven by me: ONE short, Railroads. 1,701 frames, 56.7 s, 19 scenes, 3 characters (2 on screen), canyon + two bridges + trains,
  office, day / golden / indoor light. Blind verifier score 34/70. It took 7 rounds and a lot of hand-written code.
- The engine does NOT read a script. Every new short needs new story, cast, world and props code.
- Never tried: crowds, town buildings, streets, markets, palaces, walking, night, weather, water, boats, animals, fire,
  mouth moving with speech, more than 3 characters, more than 57 s.
- WRONG in `engine/scriptfinder/capabilities.json`: tags street, bridge_river, crowd, walk are marked "proven". They are not.
  They came from the template's claims, not my renders. Treat them as "never tried".
- WRONG in the script brief and scorer: they assume 130-165 words. The rendered short has 212 words in 56.7 s.
- The scorer is not validated against real results. Its numbers are guesses.
- Claude usage per short is not measured. Rounds for a new topic are not measured.
- Known look problems in the test short: golden scenes read pink/purple and dark; canyon tops can read as a city skyline;
  several story beats are hard to see; no mouth sync; captions are burned in, but his SKILL says no captions (no decision made).

## Steps for a new short
1. Get the script from Nandu (JSON template: title, logline, profile, sources, scenes[id, caption, shots[id, timecode, visual, action, camera, assets]]).
   Get the voiceover audio from him. Time the captions to the audio.
2. Write down, per scene: place, light, who is on screen and on which side, one subject, one prop the viewer must see.
3. `python engine/tools/new_short.py <name>` (copies the working project, renames folder and composition). Run `npx tsc --noEmit`.
4. Write the story file (scene table, camera keys, STATE, inserts), then world, props, cast. Owners and files are in `CONTRACT.md`.
5. Render a few stills on CPU (`still.mjs`) for the hard shots only. Look at them. Fix.
6. Run `engine-render` with mode=full (project, comp, total frames, parts=8, audio, captions). About 7 min on Kaggle T4 for 1,701 frames.
7. QA: `short_qa.py`, `framecheck.py`. Look at the frames. Do not dismiss a "pop" before looking.
8. Blind verifier on side-by-side sheets (7 criteria /70). Fix by owner. Repeat until the score stops rising.
9. Ship under 100 MB (the kernel re-encodes to under ~92 MB). Never claim animation quality from still frames.

## What fails and what to retry
- Tiled strips or white frames on the GPU: one tab (CONC=1), no preserveDrawingBuffer, no per-frame wait guard. The kernel finds bad frames, re-renders only those, splices. If bad frames remain after 3 attempts, rerun the workflow.
- Last 2 frames missing: pad audio with `-af apad`.
- File over 100 MB: re-encode at higher CRF (done by the kernel).
- GitHub CPU render: about 1 h per 85-frame part. Use Kaggle for full renders. Check the Kaggle weekly GPU quota first (not checked yet).
- Remotion timeout on CPU: CONC 1-2, timeout 600000 ms.
- Sub-agent HTTP 429: wait for the reset, then resume it with SendMessage.
- Do not add random effects, characters, props or camera moves. Do not optimise a metric over how it looks.

## Rules that stop logic errors (from the Railroads mistakes)
- Each character keeps the same side and the same outfit in every scene.
- Each scene lists who is on screen and where. Camera never crosses to the other side of the action.
- Each shot has one subject and the camera keeps it in frame.
- A beat only counts if a close-up insert shows it. Hard cuts, not dissolves.
- Light does not change inside a scene.

## Topics chosen for the next four shorts (not trending-proven; search found no live ranking)
1. Bell's first phone call, 1876 (150th this year). Indoor, 2 characters. Risk: low. Reuses office + indoor light.
2. The Golden Spike, 1869. Trains + canyon + golden light exist. Crowd of workers is NEW. Risk: medium.
3. Tulip mania, 1637. Chart prop exists. Market crowd and town buildings are NEW. Risk: medium to high.
4. The Emperor's New Clothes (Andersen, 1837, public domain). Palace, street, big crowd are NEW. Risk: high.
Option if wanted: Washington crossing the Delaware, 25 Dec 1776 (250th). Needs water, ice, boats, night: all new. Risk: very high.
Order: build 1, then 2, then 3, then 4. Crowd and buildings need several fix rounds; I am not sure how many.
Copyright: events and the old story are free. Write all words fresh. No brand logos. No real likeness of living people.

## First job in the new chat
Do NOT build yet. First fix `capabilities.json` and the brief (word count, "proven" tags), run the scorer on the four scripts,
then start topic 1 and measure rounds and usage.
