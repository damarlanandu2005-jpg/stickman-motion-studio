---
name: ricksclips-short-style
description: The channel skill for @ricksclips3000-style animated Shorts - flat 2D doodle characters living in a sunlit 3D world, built entirely in code. Use it whenever the user wants to make, plan, render or check a vertical Short in this style, mentions "the channel skill", or asks for any step of it - generate the main character, an emotion sheet, slice a character into layers or rig a puppet, hand-painted textures, a 3D model of a prop, a background, the voiceover or music, "build the full 3D scene in code", a stop-frame check, a numbers comparison with a reference frame, or pastes a script and asks for the video. Generates every asset through the Higgsfield connector and assembles, checks and renders the video with the bundled three.js stage.
---

# @ricksclips3000 Short style

Make a vertical Short where flat 2D characters stand in a real 3D set: the sun casts their shadows on the ground, the set carries painted textures and an ink outline, the light follows the story and the camera glides from shot to shot. Higgsfield generates what has to be designed (characters, textures, 3D props, background, voice, music). The bundled stage builds, checks and renders the scene in code.

The style rules behind every default were measured frame by frame from 20 Shorts. The short version is at the end; the full numbers are in `references/style-rules.md`.

## What is in the package

| Path | Use it for |
| --- | --- |
| `scripts/stage/puppet.py` | Cut a character cutout into layers and rig it; cut an emotion sheet into faces |
| `scripts/stage/render.mjs` | Stop-frame check (`--stills`) and the full render to MP4 |
| `scripts/stage/stage.js`, `index.html` | The three.js stage that `render.mjs` drives |
| `scripts/stage/shortkit.py` | Word timings for a voiceover, numbers comparison with a reference, style measuring, camera check |
| `references/formats.md` | The `short.json` scene format, `rig.json`, `words.json`, time values, poses and actions |
| `references/prompts.md` | Prompt templates for every generated asset |
| `references/style-rules.md`, `rules.json` | The measured rules, camera math and QA ranges |
| `examples/demo/` | A small finished project to copy from |

## Setup, once

```bash
cd scripts/stage
npm install                       # three + playwright (versions pinned in package.json)
npx playwright install chromium   # or pass --chrome to use an installed Chrome
pip install numpy pillow scipy opencv-python-headless
# ffmpeg and ffprobe must be on PATH
```

The Higgsfield connector must be on. If its tools are missing, say so and stop: the assets cannot be generated without it. Rendering alone works without it.

## Project folder

Keep one folder per channel and reuse it for every video. Everything except `short.json` and the audio is a library you build once.

```
my-channel/
  puppets/<character>/   rig.json, layer PNGs, faces/
  textures/              wood.png, stone.png ...
  models/                windmill.glb ...
  bg/                    mountains.png
  audio/                 voice.mp3, music.mp3, script.txt, words.json
  short.json             the scene for this video
```

## The workflow, request by request

Users drive this in short requests. Each one maps to a step below; do the step, show the result, and say what the next step is. When the user pastes a script and nothing else, run steps 7 to 10 with the existing library and ask nothing first.

Download a finished generation with `curl -o <file> <result url>`. If the sandbox cannot reach the URL, ask the user to drop the file into the project folder.

### 1. "Generate our main character"

Generate one image with the character template in `references/prompts.md` (Nano Banana Pro, 2:3, 2k), remove the background, and save the cutout as `puppets/<id>/source.png`. Show it. The proportion to protect is the head: about as wide as the torso. A small head on a realistic body is the usual reason the look fails, so regenerate instead of accepting it.

### 2. "Generate an emotion sheet"

Generate the sheet with the template in `references/prompts.md`, using the character's image job as the reference, then remove the background. Save it as `puppets/<id>/emotions.png`. If the request lists fewer than six expressions, fill the grid with a neutral face.

### 3. "Slice the character into layers and rig a puppet"

```bash
python3 scripts/stage/puppet.py slice puppets/hero/source.png puppets/hero
python3 scripts/stage/puppet.py faces puppets/hero/emotions.png puppets/hero --names happy,nervous,shocked,shouting,confused,neutral
```

`slice` writes head, body, arm and leg layers with their pivots into `rig.json` and a `preview.png` with four panels: original, layers apart, re-assembled, posed. Open the preview and check the posed panel: limbs must swing from the shoulders and hips, and the head must tilt on the neck with no gap. `faces` needs the names in the sheet's order, left to right and top to bottom; check `faces_preview.png` the same way. If a cut is wrong, regenerate the character with the limbs further from the body instead of editing the layers by hand.

From here the character is a puppet driven by code. The stage adds breathing, shoulder bobs, a slight head tilt and blinking on its own, and actions in `short.json` set poses, faces, walking, hops and shaking.

### 4. "Generate hand-painted textures"

One 1:1 image per surface with the texture template, saved into `textures/`. Use them on the ground and on props (`"texture"`, `"wall"`, `"roofTexture"`, with `"repeat"`). Painted textures in place of flat colours are a large part of why the result reads as finished.

### 5. "Generate a 3D model of ..."

For the few big props, follow "Hero objects" in `references/prompts.md` (an image of the prop, then image-to-3D; or text-to-3D in one call), download the GLB into `models/`, and place it with `{"type": "model", "file": ..., "height": ...}`. Small props such as crates, barrels, posts and walls are stage primitives: write them straight into `short.json` and generate nothing.

### 6. Background

The sky and the far distance are one flat painting (background template, 21:9), saved into `bg/` and set as `"backdrop"`. The stage wraps it around the world and blurs it. It needs no geometry.

### 7. Script, voice, music, timing

Write the script with the formula, and fact-check every date, name and number before writing:
1. a paradox in the first line, with no intro;
2. two or three escalating details;
3. the pivot, "You see...", where the explanation starts;
4. a twist in the last line, right before the loop.

About four words a second, no dead air. Then generate the voice and the music (see `references/prompts.md`), save them into `audio/` together with the script as `script.txt`, and get the word timings:

```bash
python3 scripts/stage/shortkit.py words audio/voice.mp3 audio/script.txt -o audio/words.json
```

Check that the voice is in the language you asked for before building on it.

### 8. "Build the full 3D scene in code"

Write `short.json`. Read `references/formats.md` first; `examples/demo/short.json` is a working example to copy. Decisions to make:

- **Shots.** One per beat of the script, each starting on a spoken phrase (`"start": "say:..."`), so the picture stays locked to the voice. Most shots last one to four seconds. Every shot moves; most push in (`zoom` 3 to 8).
- **Framing.** `headWidth` 0.2 is the house close-up; 0.08 to 0.12 is a wide shot. Vary `yaw` between shots so the glide between them reads as a camera move.
- **Light.** Define a warm `day` mood and a cool `night` mood, and switch on the pivot: `{"t": "say:You see", "mood": "night"}`.
- **Acting.** Give each shot one clear action: a face, a pose, a walk. The idle motion covers the rest.
- **Layout.** The camera looks from +z toward -z by default. Put the set behind the characters (negative z) and leave open ground in front. Separate locations go 60 or more units apart in the same world.

### 9. Stop-frame check, before every full render

```bash
node scripts/stage/render.mjs short.json out.mp4 --stills
```

This renders three stills per shot into `out_stills/` with a contact sheet `sheet.jpg` and checks each one. Look at the sheet yourself as well: the flags catch the mechanical failures, not a dull composition.

| Flag | Meaning | Usual fix |
| --- | --- | --- |
| `CAMERA_INSIDE_PROP` | The camera sits inside a house, wall or model | Change the shot's `yaw` or `headWidth`, or move the prop |
| `TARGET_HIDDEN_BEHIND_SET` | Something stands between the camera and the character's head | Change `yaw`, or move the prop or the character |
| `TARGET_OFF_SCREEN` | The character left the frame | Lower `pan`, check `frameX` / `frameY` |
| `FLAT_FRAME` | The frame is nearly one colour, usually a wall filling the lens | As for `CAMERA_INSIDE_PROP` |
| `TOO_DARK`, `TOO_BRIGHT` | Mean brightness outside the style's range | Mood `sun.intensity`, `fill.intensity`, `exposure` |
| `PURE_BLACK` | Pure black areas | Lighten `fill.ground`; never use `#000000` |

Fix `short.json` and run the check again until it reports no problems. Only then render.

### 10. Render

```bash
node scripts/stage/render.mjs short.json out.mp4            # 1080x1920, 30 fps, captions, voice + music
node scripts/stage/render.mjs short.json preview.mp4 --scale 0.5 --from 0 --to 8   # fast partial preview
```

Software rendering in a sandbox takes roughly half a second per frame; a machine with a GPU is many times faster. Use `--scale` and `--from/--to` while iterating.

### 11. "Compare it with the original"

Compare with numbers, not by eye:

```bash
python3 scripts/stage/shortkit.py compare out_stills/shot02_b.jpg reference_frame.png
python3 scripts/stage/shortkit.py check out.mp4
```

`compare` prints contrast, shadow depth and colour, saturation, warm and cool shares and ink density for both pictures, and names the fields in `short.json` to change for the largest gaps. `check` measures camera speed and zoom against the style's ranges. Two fixes come up most:

- **Floating characters.** The soft contact shadow under the feet pins a character to the ground. It is on by default (`contactShadow`); raise it if feet still look detached, and make sure the character's `pos` y is on the ground.
- **Flat, pale picture.** Raise `sun.intensity`, deepen `fill.ground`, and use textures instead of plain colours.

### 12. The next video

Reuse the project folder: the puppets, textures, models and background stay. A new video is a new `audio/` set and a new `short.json`.

### Measuring another style

To study reference videos the way these rules were made:

```bash
python3 scripts/stage/shortkit.py measure path/to/videos out_dir
```

It writes one reference sheet per two seconds of video and `measured.json` with cut timing, camera speed and zoom, brightness, shadow colour and saturation. Measure every frame, then decide; an opinion about a video cannot be reproduced, a number can.

## Working with sub-agents

If you split the work across agents, give each one its own files: one owns `short.json` lighting and moods, one owns shots and camera, one owns asset generation and the library folders. Two agents writing the same file at the same time overwrite each other, and parts of the scene vanish.

## The four rules

1. **Characters** are flat 2D cutouts with big round heads, about a fifth of the frame wide in a close-up, standing in real 3D space: light tints them and they cast real shadows.
2. **Lines** are thick, even and plum-black (`#271925`), never pure black.
3. **Colour** sets warm sunlight against cool shadow; shadows are tinted red-brown, blue or violet and lifted off black.
4. **The camera** moves in every shot, mostly pushing in, and travels to the next shot instead of cutting. Hard cuts are under 1%.

Format: 1080x1920, 30 fps, about 60 seconds, captions of one or two words centred at 70% of the height.

## Limits

- The puppet is a cutout rig: limbs rotate at the shoulder and hip, with no elbows or knees and no lip sync. For acting beyond that, add faces to the emotion sheet or generate extra poses as separate characters.
- `shortkit.py words` uses Whisper when it is installed; otherwise it estimates timings from the loudness of the track, good to about 0.15 s.
- The far background is blurred, but the stage has no lens depth of field.
- The rules describe 20 videos of one channel, not what performs best.
