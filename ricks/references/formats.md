# File formats

Three JSON files connect the tools. `puppet.py` writes `rig.json`, `shortkit.py words` writes `words.json`, and you write `short.json`, which `render.mjs` turns into the video.

Contents: [rig.json](#rigjson) · [words.json](#wordsjson) · [short.json](#shortjson) · [Time values](#time-values) · [Poses and actions](#poses-and-actions)

## rig.json

One folder per character: `rig.json` plus one PNG per layer. Written by `puppet.py slice`, extended by `puppet.py faces`.

```json
{
  "version": 2,
  "name": "official",
  "size": [812, 1490],
  "feetY": 1488,
  "head": {"center": [406, 300], "diameter": 420},
  "skin": "#f1eee6",
  "layers": {
    "body": {"file": "body.png", "box": [250, 470, 330, 520], "pivot": [410, 985]},
    "head": {"file": "head.png", "box": [150, 0, 520, 540],  "pivot": [406, 500]},
    "armL": {"file": "armL.png", "box": [120, 560, 140, 330], "pivot": [255, 575]},
    "armR": {"file": "armR.png", "box": [575, 560, 150, 320], "pivot": [578, 572]},
    "legL": {"file": "legL.png", "box": [330, 980, 40, 510],  "pivot": [352, 985]},
    "legR": {"file": "legR.png", "box": [450, 980, 40, 510],  "pivot": [468, 985]}
  },
  "order": ["legL", "legR", "armL", "armR", "body", "head"],
  "eyes": [{"c": [340, 310], "r": 14}, {"c": [470, 310], "r": 14}],
  "faces": {
    "shocked": {"file": "faces/shocked.png", "size": [540, 560], "pivot": [270, 540],
                "center": [270, 300], "diameter": 430}
  }
}
```

- All coordinates are pixels in the cropped cutout (`size`), origin top-left, y down.
- `L` / `R` mean image-left and image-right, as the viewer sees the character.
- `box` is `[x, y, w, h]` of the layer PNG inside the cutout. `pivot` is where the layer attaches and rotates: the neck for the head, the shoulder for an arm, the hip for a leg and for the body.
- `head.center` / `head.diameter` describe the round face ball without the hat. The stage frames shots with them.
- A layer can be missing (an arm hidden behind the body). The stage skips it.
- `eyes` is optional. With it the puppet blinks.
- `faces` are whole replacement heads cut from an emotion sheet. The stage scales each so its `diameter` matches `head.diameter` and puts its `pivot` on the head pivot.

## words.json

Written by `shortkit.py words voice.mp3 script.txt`.

```json
{"audio": "voice.mp3", "duration": 58.17, "method": "whisper",
 "words": [{"w": "They", "t0": 0.12, "t1": 0.31}, {"w": "buried", "t0": 0.31, "t1": 0.66}]}
```

`method` is `whisper` when a Whisper package was available and `energy` for the built-in estimate (words spread over the voiced parts of the track; good to about ±0.15 s).

## short.json

Paths are relative to the folder that holds `short.json`.

```json
{
  "fps": 30,
  "audio": {"voice": "audio/voice.mp3", "music": "audio/music.mp3", "musicDb": -18},
  "words": "audio/words.json",
  "captions": {"wordsPer": 1},
  "font": "fonts/Montserrat-ExtraBold.ttf",

  "moods": {
    "day":   {"sun": {"azimuth": 35, "elevation": 50, "color": "#ffe0b5", "intensity": 2.4},
              "sky": {"top": "#5f86d8", "horizon": "#f2b98a"},
              "fill": {"sky": "#8ea2ff", "ground": "#6a3b6e", "intensity": 1.1}},
    "night": {"sun": {"azimuth": -40, "elevation": 35, "color": "#8fa8ff", "intensity": 0.9},
              "sky": {"top": "#101a44", "horizon": "#3b3f7a"},
              "fill": {"sky": "#4a5cc0", "ground": "#2a2350", "intensity": 0.9}}
  },
  "lighting": [{"t": 0, "mood": "day"}, {"t": "say:You see", "mood": "night", "fade": 0.8}],

  "ground": {"texture": "textures/dirt.png", "repeat": [40, 40], "color": "#c98a55"},
  "backdrop": {"image": "bg/mountains.png", "blur": 5},
  "ink": {"set": 4},

  "characters": [
    {"id": "hero", "puppet": "puppets/hero", "pos": [0, 0, 0], "height": 1.8, "face": "smug"}
  ],
  "props": [
    {"type": "house", "pos": [-3, 0, -7], "size": [5, 3.2, 4], "wall": "textures/stone.png", "roofTexture": "textures/shingles.png"},
    {"type": "model", "file": "models/windmill.glb", "pos": [6, 0, -14], "height": 9, "rotY": 20},
    {"type": "crate", "pos": [2, 0, -1], "size": 0.7, "texture": "textures/wood.png"},
    {"type": "barrel", "pos": [2.9, 0, -1.2]}
  ],

  "shots": [
    {"start": 0, "target": "hero", "headWidth": 0.2, "yaw": 18, "zoom": 6, "pan": [-30, 10],
     "actions": [{"at": 0.4, "who": "hero", "face": "smug", "pose": {"armR": -60}}]},
    {"start": "say:You see", "target": "hero", "headWidth": 0.3, "yaw": -10, "zoom": 4, "out": "dissolve"}
  ],
  "end": "audio"
}
```

### Top level

| Field | Meaning |
| --- | --- |
| `fps` | 30. |
| `audio` | `voice` and `music` files. `musicDb` sets the music level under the voice (default -18). |
| `words` | A `words.json`. Needed for `say:` times and word-timed captions. |
| `captions` | `wordsPer` 1 or 2. Without `words`, give `text` and `framesPer` (default 10). `false` turns captions off. |
| `moods` | Named lighting set-ups: `sun`, `sky`, `fill`, optional `exposure` and `cutoutTint`. |
| `lighting` | Mood keyframes. The stage eases from one mood to the next over `fade` seconds (default 0.8), starting at `t`. Without it the first mood (or the top-level `sun` / `sky` / `fill`) holds for the whole video. |
| `ground` | `color`, or a `texture` with `repeat`. |
| `backdrop` | A flat image far behind the set: `image`, `blur` (px, default 5), optional `repeat` (how many times the painting wraps around the horizon, default 4), `height`, `distance`, `y`. |
| `ink` | `set`: outline width in px on the 3D set (default 4, 0 = off). `color` defaults to `#271925`. |
| `contactShadow` | Darkness of the soft shadow under each character's feet, 0-1 (default 0.55). |
| `end` | `"audio"` ends the video with the voice track; a number is the length in seconds. Without it the last shot runs for its `dur`. |

### Characters

`puppet` is a rig folder. Without it the stage draws a placeholder figure (`shirt`, `head`, `hair`, `smile`), which is enough to block a scene before the real characters exist.

`pos` is `[x, y, z]` of the feet, `height` the figure height in world units (1.8 is a person), `face` the starting face, `flip: true` mirrors the figure, `idle: false` turns off breathing and blinking.

### Props

| Type | Fields |
| --- | --- |
| `house` | `size` [w, h, d], `color` or `wall` texture, `roof` colour or `roofTexture` |
| `box`, `crate` | `size` (number or [w, h, d]), `color` or `texture` |
| `barrel` | `r`, `h`, `color` or `texture` |
| `wall` | `size` [w, h, d], `color` or `texture`, `repeat` |
| `tree` | `scale`, `color` |
| `post` | `h`, `color` |
| `plane` | A flat image card: `image`, `size` [w, h], `rotY` |
| `model` | A GLB file: `file`, and `height` (scales the model to that height) or `scale` |

Every prop takes `pos` and `rotY` (degrees).

### Shots

| Field | Meaning |
| --- | --- |
| `start` | When the shot begins (a [time value](#time-values)). Without it shots follow each other by `dur`. |
| `dur` | Length in seconds when the next shot has no `start`. |
| `target` | Character id; the camera anchors on its head. Or `anchor` [x, y, z]. |
| `headWidth` | Target head as a fraction of frame width (default 0.20). Or `distance`. |
| `yaw`, `pitch` | Camera direction around the anchor, degrees. |
| `frameX`, `frameY` | Where the anchor sits, as a fraction from the centre (+y is up; default y 0.12 keeps faces above the captions). |
| `fov` | Lens, degrees (default 40). |
| `zoom`, `pan` | Camera drift: %/s and [x, y] px/s. |
| `glide` | `lens` (default) or `dolly`. |
| `out` | How this shot hands over to the next: `glide` (default; the camera travels there over 0.8 s, eased in and out), `dissolve` or `cut`. `outDur` changes the 0.8 s. |
| `actions` | What the characters do in this shot. |

## Time values

Any time (`start`, `t`, `at` in lighting) is one of:

- a number: seconds from the start of the video;
- `"say:You see"`: the moment that phrase starts in `words.json` (first match, case and punctuation ignored); `"say:You see#2"` is the second match;
- `"w:57"`: the start of word number 57 (counting from 0).

An action's `at` is seconds from the start of its shot.

## Poses and actions

An action changes one character from `at` onward. Changes ease in over `ease` seconds (default 0.3).

```json
{"at": 0.4, "who": "hero", "face": "shocked", "pose": {"armR": -110, "armL": 20, "head": 6},
 "to": [1.5, 0, 0], "walk": true, "over": 1.2, "hop": 0.15, "shake": 0.5, "flip": true}
```

- `face`: switch to a face from the rig's `faces` (or `"default"`).
- `pose`: angles in degrees, each relative to the pose in the cutout. `armL`, `armR`, `legL`, `legR` swing a limb around its pivot (positive is clockwise on screen); `head` tilts the head; `body` leans the whole figure.
- `to`: move the feet to `[x, y, z]` over `over` seconds. With `walk: true` the legs swing and the body bobs.
- `hop`: a single jump of that height (world units).
- `shake`: tremble for that many seconds (anger, fear, cold).
- `flip`: mirror the figure.

On top of the actions every puppet breathes, bobs its shoulders, tilts its head a little and blinks, so it never freezes.
