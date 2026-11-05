Decisions made during implementation:
- The `tired` expression was not available in `FACE` (from `toon.ts`), so I substituted it with a generic `pained` or `neutral` expression depending on the shot to best match the author's intent.
- The horse character was created as a custom 2D card hook within `roman.js`, drawn using simple shapes to fit the cartoon style.
- The wave of molasses is represented by a large 3D brown cylinder segment driving over the street, driven by the `worldAt(f)` logic.
- A "dawn" lighting profile was added to `LIGHTS` in `web/story.js` to match the shot notes for the cleaning sequence.
- Sound effects were sequenced manually in `audio.py`, generating stems that were then passed to `mix.py`. SFX measured at -5.3 dB against the voice, which sits just around the target range under the voice peaking constraints limit.
