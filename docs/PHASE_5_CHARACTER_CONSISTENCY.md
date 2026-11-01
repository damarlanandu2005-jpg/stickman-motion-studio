# Phase 5 — Character reference and consistency

## Scope

This phase prepares the canonical Stickman Thoughts mascot specification and a reproducible 14-prompt reference pack. It does **not** start animation, upload videos, or mark generated images as approved.

## Canonical mascot

- Large round white head, roughly one third of total character height.
- Thick, clean, dark outline; two small black oval eyes; expressive black eyebrows; small mouth.
- Thin black stick arms and legs.
- No bulky torso, clothes, gloves or shoes.
- Flat 2D vector-cartoon finish with soft muted colours and simple shading.

The machine-readable specification lives in `motion_studio/characters.py`. The workspace command writes a copy into each video project's reference folder so the project remains self-contained.

## Create the workspace

Run from the repository root:

```powershell
python -m motion_studio character-init --project projects/first-short
python -m motion_studio character-validate --project projects/first-short
```

This creates:

- `artwork/references/characters/stickman_thoughts_mascot/character.json`
- `artwork/references/characters/stickman_thoughts_mascot/prompt-pack.json`
- `artwork/work/characters/stickman_thoughts_mascot/` for unapproved candidates
- `artwork/approved/characters/stickman_thoughts_mascot/` for assets approved later

The prompt pack contains 14 separate prompt entries: three views, six expressions and five poses. Each prompt explicitly bans common identity drift (torso, clothing, gloves, shoes, duplicate characters and collage layouts).

## Generation requirements

The Phase 4 benchmark established that FLUX.2 [klein] 4B can generate images on the tested Kaggle T4 setup. It did **not** establish image-reference conditioning, editing support, or identity consistency.

Before generating the master sheet, inspect the exact installed Diffusers pipeline and its supported call signature. Do not assume that passing an image to a text-to-image pipeline performs reference conditioning. Do not silently substitute a different model or download another large checkpoint. If a supported reference/editing route is not present, report that blocker rather than presenting unrelated text-to-image outputs as a consistency test.

Use the pinned model revision in the prompt pack. Record for every candidate: model ID and revision, pipeline class/version, reference image path and SHA-256 (if used), prompt, negative prompt, seed, dimensions, generation settings, output SHA-256 and run identifier. Keep all generated candidates in the work folder. Never overwrite the reference specification or any approved image.

## Human acceptance gate

A master is not approved by code or by a successful Kaggle run. Human review must confirm:

1. Front, side and three-quarter views depict the same mascot.
2. All six expressions preserve head shape, eye spacing, outline and limbs.
3. All five poses preserve the same identity and body construction.
4. The same mascot remains recognisable in at least five different scene backgrounds.
5. No torso, clothes, gloves or shoes have appeared unless explicitly accepted as a deliberate redesign.

Only after review should an exact candidate be copied to the approved folder and its SHA-256 recorded as the approved master. A failed test must remain visible in the report; do not hide it by regenerating until it looks successful.

## Current implementation boundary

Implemented in this repository change:
- Canonical mascot specification.
- Deterministic prompt-pack generation and validation.
- Safe workspace initialisation that refuses to overwrite existing reference files.
- CLI commands and unit tests for the character workspace.

Not yet demonstrated:
- Running the prompt pack through Kaggle.
- A verified reference-image/editing workflow for FLUX.2 [klein] 4B.
- Generated reference images, five-scene consistency results, or a human-approved master.

These are intentionally reported as pending rather than claimed complete.
