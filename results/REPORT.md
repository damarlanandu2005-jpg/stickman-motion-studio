# Report: Gemini (3.1-pro-preview) vs Claude, 3 heavy videos (code checks + contact sheets only; human review pending)

| Video | Gemini time | Gemini result | Claude result |
|---|---|---|---|
| Emu War (19.9 s) | ~25 min | Sparse world, camera inside a wall in later shots, no emu herd | Truck, big emu flock, scoreboard, birds, day card |
| Dance Plague (28.8 s) | ~20-25 min | Plaza + outfits OK, no dancing/crowd, 1 black shot | Full plaza, crowd of hundreds, stage, council hall |
| Molasses Flood (31.5 s) | ~20 min | Mostly white walls/empty space, flood hard to see | Brick street, train, tank, brown wave, house, plaque |

Gemini notes: substitutes missing faces (angry->stern, sad->nervous), simplifies hard 3D things, no crowds.
Cloud credit used: NOT measured (Gemini CLI prints no tokens; Billing not read). Check Google Cloud Billing.
Models: gemini-3.1-pro-preview works. 3.8-flash (400 error), 3.5-flash (no finish), 2.5-pro (not found) unusable here.
