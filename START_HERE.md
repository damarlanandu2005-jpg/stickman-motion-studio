# START HERE — read this first, every new chat

Repo: `damarlanandu2005-jpg/stickman-motion-studio` · working branch: **`ricks-stage-kaggle`**.
The owner gives narration scripts and wants finished 40-60 s vertical animated Shorts with no hand-fixing.

## Status on 2026-11-16 (read this before anything else)

The project is mid-rebuild. Follow **`BLUEPRINT.md`** (v2.1, approved by the owner and an outside reviewer).
Do not go back to patching single videos or the bean engine.

| Blueprint stage | State |
|---|---|
| 1 Script, fact-check, Kokoro voice, word timings | Works (in `ricks/tools`, `ricks/projects/<name>/audio`) |
| 2 Story director | **Done, owner approved the three plans.** `director/DIRECTOR.md`, `director/plan_tool.py`, `director/plans/` |
| 4 Scene data format + inkbeat adapter | **Done for db_cooper.** `scene/vocab.json`, `scene/adapters/inkbeat.json`, `scene/ir_tool.py`, `scene/ir/`, gap list `scene/GAPS.md` |
| 3 Set and character library (in inkbeat) | **First version built** (see below) |
| 6 Compiler (generic inkbeat composition driven by scene data) | **Built; output not yet watchable** (see below) |
| 5, 7 Geometry gate, sampled-stills gate, final-video QA | **NEXT TO BUILD** (stage 5 first) |
| 8 Three-script benchmark | Not run |

### Stage 6 (compiler) status and next task
Built: `scene/compile.py <name>` turns story plan + scene IR + resolve file + word timings into
`inkbeat/src/film/data/<name>.ts`; `inkbeat/src/film/Film.tsx` is the one generic composition that mounts it
(kit, pieces, cast, crowd, held props, tags, captions, audio, a camera computed from shot type and subject).
Composition id `Film-db-cooper`. db_cooper renders end to end from data on Kaggle (about 4 min render).
The resolve file now also carries cast looks, per-set slots, explicit piece positions and a view angle.
**The result is not watchable yet.** Of 31 shots roughly a third are framed acceptably. Seen in the render:
cameras inside furniture or fuselage (cockpit, tail), held papers and props too large and in front of faces,
a seated character hidden by seat backs, close-ups cropped, the rear stairs shown before they open, the note
still held in later shots. These are exactly what stage 5 must catch and fix, so it is next.
Lessons: (1) one canvas for the whole film; remounting `View` per scene exhausts WebGL contexts on the GPU.
(2) Anything passing through the lens (a crowd walker) blows the picture to white for the rest of the film.
(3) A failed render used to delete the previous mp4; the workflow now keeps it.
Library status: see `scene/GAPS.md` (157 items: 146 exact, 9 stand-ins, 2 missing). Staging/IR exist only
for db_cooper. `scene/vocab.json` set slots are still the pre-kit names (aliased in the resolve file).
**Next: stage 5, the pre-render gate**: from the compiled film data, check every shot at start, middle and
end: subject head and proof inside the frame with margin, nothing between camera and subject, camera not
inside any piece or kit wall, held items not covering a face, minimum subject size. Auto-fix by moving the
camera (distance, side, height) and re-check; block what cannot be fixed. Then sampled stills.
Ask the owner before starting.

### Owner decisions already made
- inkbeat's 3D toon figure is the working look (provisional until three automated films exist).
- 40 s films are allowed.
- lightning_man: change "Twice." to "again and again" (voice must be regenerated); other fact warnings stay
  flagged as unverified in the plans.
- The bean engine (`ricks/stage`) is kept until the benchmark passes, then retired.
- Deliver only videos that pass the checks. Never hand over a video with a list of known defects.
- Tell the owner what you will do and wait for "go" before building.

### Hard-won facts (do not re-derive, do not contradict)
- **inkbeat renders fast on Kaggle.** Needs the NVIDIA userspace driver install and `--gl=angle-egl`; see
  `kaggle/inkbeat-gpu/inkbeat_gpu.py`. Measured: 40 s film in about 4 min render, under 9 min end to end.
  Dispatch: `gh workflow run inkbeat-kaggle.yml --ref ricks-stage-kaggle -f comp=<CompId> -f blur=0`;
  result lands in `results_inkbeat/` (`inkbeat_pilot.mp4`, `inkbeat_result.json`).
- **Kaggle always runs T4 x2.** The P100 is retired and silently substituted; `machine_shape` does nothing.
  Queues happen (one run sat over an hour) and cannot be predicted. Send one run at a time.
- **Local inkbeat stills** work in the container with software GL (about 2 min each, run one at a time;
  parallel runs give black frames): `npx remotion still ... --gl=swangle`.
- **inkbeat `aim(from, to, fov, face)`**: the 4th argument is where the subject sits in the frame
  (about 0.36-0.44), not roll. Passing 0 puts heads off the top of the frame.
- inkbeat has interior moods (`cold`, `lamp`) and `sky={false}`; valid textures and face states are typed,
  so run `npx tsc --noEmit` in `inkbeat/` before any render.
- Hand-made inkbeat reference film: `inkbeat/src/cooper/CooperFull.tsx` (8 scenes, voice, music). The last
  version sent to the owner is `results_inkbeat/inkbeat_pilot.mp4` unless a later run replaced it; a re-render
  with scene tags was dispatched and never reviewed.
- Always confirm a GitHub run really produced output; "success" can hide a failed Kaggle kernel.

## Read in this order
1. This file. 2. `BLUEPRINT.md`. 3. `director/DIRECTOR.md`. 4. `ricks/ENGINE_STRATEGY.md` (history; its
correction banner is right, the body below it is superseded).

---

# Legacy notes (bean engine, kept for reference until it is retired)


You are picking up an animated-Shorts pipeline. The owner gives **narration scripts**; everything else
is automatic. This file is the entry point: read it, then the two docs it points to, then run the
procedure. Do **not** re-derive the design or re-learn the lessons below — they cost real time to find.

Repo: `damarlanandu2005-jpg/stickman-motion-studio` · working branch: **`ricks-stage-kaggle`** · default branch: `main`.

## Read in this order
1. **This file** — how to run, what works, what fails.
2. **`ricks/PIPELINE.md`** — the locked pipeline design (the 9 stages, the rules, the verifier criteria).
3. **`ricks/ENGINE_STRATEGY.md`** — engine findings: Ricks vs inkbeat, how to render, what NOT to retry.
4. `ricks/SKILL.md` — the channel skill (style rules, asset prompts, formats).

## What this is
Flat 2D "doodle" characters standing in a lit 3D world, built entirely in code (three.js), rendered
headless on a Kaggle GPU. Voice = Kokoro (free, offline). Designed assets (characters, faces, hats,
textures, backdrops) = Gemini. The look: painted textures, ink outlines, sun shadows, a camera that
glides shot to shot. Everything the owner cares about is in `ricks/`.

## Repo layout (what lives where)
- `ricks/stage/stage.js` — the three.js engine (the "stage"). `render.mjs` drives it; `gate_render.py` wraps it.
- `ricks/projects/<name>/` — one short. Holds `short.json` (the scene), `breakdown.json` (the plan),
  `audio/`, `bg/` (backdrops), `props/ puppets/ hats/ textures/`, `review/`, `output/`.
- `ricks/library/` — reusable assets + `catalog.json` (what exists / what's buildable).
- `ricks/tools/` — `breakdown.py` (plan→short.json), `library.py`, `gen_assets.py`, `gemini_watch.py`
  (Gemini watches the rendered MP4), `sheets.py`, etc.
- `.github/workflows/` — `ricks-kaggle.yml` (render on GPU), `ricks-assets.yml` / `ricks-library.yml`
  (generate assets), `ricks-watch.yml` (Gemini verifies the video).
- `results_ricks/<name>/` — the committed render output (mp4 + stills + result json).

## The run procedure (given a script → finished video)
Follow `ricks/PIPELINE.md` for the creative stages (adapter → director → casting/assets → set dressing
→ background life → compile). The compile step produces `ricks/projects/<name>/short.json`. Then:

1. **Render on Kaggle GPU** — dispatch the workflow, which pushes a kernel that clones this branch, runs
   the engine, and commits the result to `results_ricks/<name>/`:
   ```
   gh workflow run ricks-kaggle.yml --ref ricks-stage-kaggle \
     -f mode=full -f project=ricks/projects/<name> -f scale=0 -f force=1
   ```
   `mode=stills` = stop-frame check only; `scale=0` = full 1080×1920; `scale=0.5` = quick preview.
   Poll `gh run view <id>`. **The GitHub run can report "success" while the Kaggle kernel actually
   failed** — always confirm `results_ricks/<name>/render_result.json` is real (not `{"note":"no result"}`)
   and that `short.mp4` exists and probes to the right duration.
2. **Verify** — `ricks-watch.yml` runs `gemini_watch.py`, which has Gemini *watch the actual MP4* and
   return a timestamped description + a DEFECTS list. This is proven to work (Vertex, location `global`,
   model `gemini-3.5-flash` → fallback `gemini-3.1-pro-preview`, header `x-goog-user-project`).
3. **Deliver** the mp4 and report the Gemini defects + the blind-verifier score.

## Kaggle setup (critical — this is the queue fix)
- Secrets already set on the repo: `KAGGLE_USERNAME`, `KAGGLE_KEY`, plus `GCP_*` for Gemini/Vertex.
- **SUPERSEDED: the P100 is retired; Kaggle runs T4 x2 whatever is requested.** Old text follows. `enable_gpu: true` alone provisions **GPU T4 x2** (two cards), which
  sits in a long queue. `kaggle/ricks-gpu/kernel-metadata.json` now sets
  `"machine_shape": "NvidiaTeslaP100"` → a single P100 → low demand → starts without queuing. Single-T4
  no longer exists on Kaggle. Keep the P100 setting. (Account health is fine: ~30h/week GPU quota,
  phone-verified; the queue was the 2-card request, not quota.)
- The kernel installs its own matching NVIDIA userspace driver at runtime, so it adapts to P100 vs T4.
- Don't launch ~10 GPU sessions in a burst on one account — Kaggle soft-throttles that into a queue even
  with quota free.

## What WORKS (use these, proven this session)
- Full script→video pipeline with the library/place-kit system; renders on free Kaggle GPU (~11 min/video).
- **P100 single-GPU render** — no queue (the fix above). Confirmed: renders a full 1080×1920 clip in ~13 min, gate passes.
- **Gemini-watches-the-MP4 verification** — real, via Vertex with the existing service account.
- **Look upgrades in the engine** (committed, confirmed on GPU): dehaze (fog pushed to 110–420), vivid
  colors (tint 0.28), clean blue sky (backdrop recolored), crisp buildings (backdrop un-blurred),
  stronger ink outline (set 5).
- **Shadow + AA hardening** (committed, harmless, keep): shadow texel-snap + higher bias; 1.3–1.5×
  supersample; max anisotropy + trilinear mipmaps. Good practice, but see the flicker note below — they
  did NOT fix the texture-motion flicker.

## What FAILS / do NOT retry (lessons, with proof)
- **inkbeat (Remotion/R3F) on Kaggle** — Remotion's headless Chrome can't get a WebGL context on the T4
  (crashes ~11s). CPU-only works but is ~26–60 min per 8s clip. Not viable. Don't adopt its renderer.
  (Its *look* is better — toon-shaded chars with limbs — worth copying into our engine, not switching.)
- **Validating texture/anisotropy fixes in the dev container** — the container only has software GL
  (SwiftShader), which ignores anisotropy. Texture-filter fixes only show on real GPU. Validate on Kaggle.
- **`enable_gpu: true` without `machine_shape`** — gives T4 x2 → queue. Always set P100.
- **Trusting "GitHub run success"** — the Kaggle kernel can fail while the workflow passes. Check the output.
- **Destructive save bug (open):** `ricks-kaggle.yml`'s save step overwrites the committed `short.mp4` with
  an empty file when a render produces no output — it has wiped a good video. Fix: only overwrite the mp4
  when the new render actually produced one. (Not yet fixed.)
- **Texture-motion flicker (FIXED — texture softening):** on a *panning* shot, fine high-contrast textures
  (the fleur-de-lis wallpaper, the parquet floor) **moire/twinkle** frame-to-frame. Measured + mapped:
  the flicker is entirely on those textured surfaces; plain door/carpet/character don't flicker. Spatial
  fixes (anisotropy, mipmaps, 1.5× supersample, shadow texel-snap) gave **~1% improvement — i.e. did not
  fix it** — because this is *temporal* aliasing from camera motion, not static grazing-angle aliasing.
  FIX APPLIED: `texture()` now pre-softens source images (blur + slight contrast-flatten, scaled by how
  finely they tile) via `TEX_SOFTEN` — bakes into the pixels so it works on any GL and is locally testable.
  Measured ~68% flicker reduction in the office; wallpaper/floor softer but character, outlines and the
  backdrop stay crisp (backdrop is a separate path, unaffected). Tune with `_texSoften` in short.json (0=off).

## Known engine limits (by design — say so, don't fake)
No elbows/knees, no lip-sync, no sitting poses for NAMED puppets, no water, no animals. CROWDS ARE NOW SUPPORTED: a `crowd` prop billboards dozens-200 on-style people (seated for cabins/audiences, standing for streets/stadiums) — USE it so public places aren't empty, and dress scenes with secondary/tertiary props (see PIPELINE.md 'Crowds and scene population').
The biggest visual gap vs a polished cartoon is the **character** (flat "bean" vs a modeled figure). Also: always populate scenes — crowds + secondary props — the overnight run produced EMPTY scenes because the old docs said crowds were impossible; that is fixed now.

## Scoring
Blind verifier scores /70 across 7 criteria (composition, environment, characters, lighting, camera,
style, readability). Bar for unattended daily runs: **45/70**. Earlier engine baseline: 34/70.
After this session's look + flicker work, estimate ~38–42/70 — held under 45 mainly by the character.
Run the blind verifier on each new render for the real number.
