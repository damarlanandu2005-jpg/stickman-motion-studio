"""shots.json + a folder of scene pictures (pose_<id>.png from the Kaggle scene batch) -> reel mp4.

    python -m motion_studio.assemble shots.json pictures_dir out.mp4 [voice.wav]
A shot whose picture is missing is reported and replaced by a flat grey frame, never hidden.
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

from PIL import Image

from . import sfx
from .reel import render_reel


def assemble(shots: list[dict], pictures: Path, out: Path, voice: Path | None = None) -> dict:
    missing = []
    grey = Path(tempfile.gettempdir()) / "grey_missing.png"
    Image.new("RGB", (576, 1024), (90, 90, 90)).save(grey)
    for s in shots:
        p = pictures / f"pose_{s['id']}.png"
        if p.exists():
            s["image"] = str(p)
        else:
            s["image"] = str(grey)
            missing.append(s["id"])
    audio = None
    if voice or any(s.get("sfx") for s in shots):
        audio = sfx.mix(shots, voice, out.with_suffix(".wav"))
    info = render_reel(shots, out, audio=audio)
    info["missing_pictures"] = missing
    return info


if __name__ == "__main__":
    shots = json.loads(Path(sys.argv[1]).read_text())
    print(assemble(shots, Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]) if len(sys.argv) > 4 else None))
