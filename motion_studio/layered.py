"""Layered story -> finished short: library backgrounds + library objects + the same cast, voice, code-made sounds, captions.

story json: {"voice": "am_fenrir", "speed": 1.12, "shots": [{"id", "text" (*word* = red), "bg": library id, "objects": [{"lib","x","feet","height","pop"}],
             "actors": [{"pose","x","feet","height","faces":[[t,expr]], "x1":..}], "cam": "push|pull|drift|rise", "sfx": [...] (optional), "cap_y": 0.7}]}

    python -m motion_studio.layered story.json models_dir out.mp4
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from . import shot2d, sfx
from .scene_plan import auto_sfx
from .short_story import CAMS, captions, speak


def build(story: dict, durs: list[float]) -> list[dict]:
    shots = []
    for s, d in zip(story["shots"], durs):
        cam = s.get("cam", "push")
        shots.append({"id": s["id"], "dur": d, "bg": "lib:" + s["bg"], "objects": [dict(o, lib=o["lib"]) for o in s.get("objects", [])],
                      "actors": s.get("actors", []), "cam": CAMS[cam] if isinstance(cam, str) else cam,
                      "caps": captions(s["text"], d), "cap_y": s.get("cap_y", 0.68), "sfx": s["sfx"] if "sfx" in s else auto_sfx(s)})
    return shots


def main(argv: list[str]) -> int:
    story = json.loads(Path(argv[0]).read_text())
    models, out = Path(argv[1]), Path(argv[2])
    out.parent.mkdir(parents=True, exist_ok=True)
    wav = out.with_suffix(".voice.wav")
    durs = speak([s["text"] for s in story["shots"]], models, story.get("voice", "am_fenrir"), story.get("speed", 1.12), wav)
    shots = build(story, durs)
    mixed = sfx.mix(shots, wav, out.with_suffix(".mix.wav"))
    print(shot2d.render_video(shots, out, audio=mixed))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
