# Report: Gemini (3.1-pro-preview) vs Claude, 3 heavy videos (code checks + contact sheets only; human review pending)

| Video | Gemini time | Gemini result | Claude result |
|---|---|---|---|
| Emu War (19.9 s) | ~25 min | Sparse world, camera inside a wall in later shots, no emu herd | Truck, big emu flock, scoreboard, birds, day card |
| Dance Plague (28.8 s) | ~20-25 min | Plaza + outfits OK, no dancing/crowd, 1 black shot | Full plaza, crowd of hundreds, stage, council hall |
| Molasses Flood (31.5 s) | ~20 min | Mostly white walls/empty space, flood hard to see | Brick street, train, tank, brown wave, house, plaque |

Gemini notes: substitutes missing faces (angry->stern, sad->nervous), simplifies hard 3D things, no crowds.
Cloud credit used: NOT measured (Gemini CLI prints no tokens; Billing not read). Check Google Cloud Billing.
Models: gemini-3.1-pro-preview works. 3.8-flash (400 error), 3.5-flash (no finish), 2.5-pro (not found) unusable here.

## Round 2: API pipeline (tools/gen_api.py, direct Vertex calls, stills feedback loop, 3 fix rounds)
| Video | Calls | Input tok | Output tok | Thinking tok | Result |
|---|---|---|---|---|---|
| Emu War | 4 | 240k | 35k | 37k | ~ my version (kit example IS Emu War: not a fair test) |
| Dance Plague | 4 | 248k (155k cached) | 37k | 68k | much better than CLI version: crowd, stage, council; some dark/black shots, odd roofs |
| Molasses | 4 | 243k (0 cached) | 34k | 65k | weak: dark, giant grey walls, missing street/train/horse; fix loop did not repair it |
CLI version used ~6M input tokens per video. Cost estimate (unverified, check Billing): ~$1-1.5 per video.

## Round 3: new pipeline (asset test + per-shot PASS/FAIL checklist + brightness metrics)
| Video | Calls | Input tok (cached) | Output | Thinking | Result |
|---|---|---|---|---|---|
| Bomb/Colorblind (writer's script) | 9 | 722k (115k) | 37k | 45k | readable story: suit, bomb, circuit, 6 wires, crowd; rooms plain grey, timer static |
| SEALs airstrike (writer's script) | 9 | 729k (270k) | 63k | 57k | dark night scenes, radio, explosion smoke, helicopter; characters generic (no helmet/vest) |
| Molasses | 6 | 436k (0) | 43k | 54k | better than before (tank, houses, horse, wave) but dark shots + dull tank |
Estimated cost ~ $2-2.5 per video (unverified; check Billing). Still below Claude-made versions in richness.
