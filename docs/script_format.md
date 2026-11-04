# How to write a script (simple)

One script = one text file in `scripts_in/`. One block per scene. See `scripts_in/example_bomb.txt`.

```
TITLE: your title
VOICE: am_fenrir
CAST: animation/cast/your_story.json

SCENE
bg: bomb squad office, inside
who: arthur, chief
pose: stand
props: bomb, clock
say: Arthur was a *normal* man.
text: 41 BOMBS
sound: tick
camera: push

CHANGE: arthur -> squad

SCENE
...
```

| Field | Needed | Meaning |
|---|---|---|
| `say:` | yes | What the voice says. Put `*stars*` around the word that must be RED in the caption. |
| `bg:` | yes | Words for the background. The reader looks in the library; if nothing fits, it is listed to be drawn. |
| `from:` | no | Only with `bg:`. Draw this background FROM an earlier one (same place, same camera, same layout) and change only what `bg:` says. Example: `bg: rooftop, the sun is up` + `from: rooftop at sunset`. Not needed for look words (see below). |
| `who:` | no | Characters in the scene, e.g. `arthur@normal` (a stage) or just `arthur` (his current stage). |
| `pose:` | no | Free words for now (stand, point, run...). The next step maps them. |
| `props:` | no | Objects in the scene. Missing ones are listed to be drawn. |
| `text:` | no | Big text or number drawn by code on the picture. |
| `sound:` | no | Object sound for this scene (made by code). |
| `camera:` | no | `push`, `pull`, `pan` or `still`. Leave out to let the machine choose. |
| `CHANGE: arthur -> squad` | no | From the next scene on, Arthur wears his `squad` costume. |

**Continuation scenes (same place, one thing changes).** If a background has the same place words as a picture that exists (or is drawn earlier in
the script) but a different look word (`day`, `night`, `morning`, `sunset`, `sunrise`, `rain`, `snow`, `fog`, `dark`, `bright`, `sun`, `moon` ...), the reader
draws it FROM that picture: the earlier picture goes in as the reference and the model is told to keep the place and change only the named thing.
For any other change write `from:`. A picture drawn this way is checked by code for: same layout kept, and a visible change.

Lines starting with `#` are notes. Nothing else is needed.

# The cast file (once per story)

`animation/cast/<name>.json`: who is in the story, which costume each stage uses, and a `look` + `colour` for any costume the machine must draw.

```
{"characters": {"arthur": {"default_stage": "normal", "stages": {"normal": {"costume": "civ"}, "squad": {"costume": "bombsuit"}}}},
 "costumes": {"bombsuit": {"look": "a thick padded olive-green bomb disposal suit with a chest plate and heavy black boots", "colour": "olive green"}}}
```

Colours the automatic check understands: green, olive green, yellow, blue, light blue, navy, purple, red. Another colour is refused (not guessed).

# Check a script

```
python -m motion_studio.script_reader scripts_in/your_script.txt --out build/your_script.json --write-specs animation/costume_specs
```

It prints plain errors with the line number, the costume status (ready / bodies_only / spec_only / missing), and what must be drawn. Status here means: code written and unit tested. It does not plan shots, timing or camera yet.
