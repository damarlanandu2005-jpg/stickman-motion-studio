"""Pose sheet (12 headless bodies, 4 columns x 3 rows, white background) + the 20-face head sheet -> a sprite folder the renderer uses.

Pose order on the sheet = the explorer order: stand, point right, point left, arms up / hands on hips, arms crossed, think, hold map /
walk, run, kneel, fall.  Heads: bare round heads (no hat) from animation/reference_art/headhat/heads_20.png (4 x 5 faces).

    python -m motion_studio.make_sprites animation/reference_art/walkcycle/doctor_poses.png animation/assets2d/doctor
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from .costume_check import cutout

ROOT = Path(__file__).resolve().parents[1]
HEADS = ROOT / "animation" / "reference_art" / "headhat" / "heads_20.png"
# (row, column) of each face on heads_20.png -> head name used by the renderer
FACES = {"neutral": (0, 0), "happy": (0, 1), "laugh": (0, 2), "smug": (0, 3), "surprised": (1, 0), "scared": (1, 1), "worried": (1, 2),
         "sad": (1, 3), "angry": (2, 0), "annoyed": (2, 1), "sly": (2, 2), "sleepy": (2, 3), "dizzy": (4, 0), "crying": (4, 1),
         "shocked": (4, 2), "blush": (4, 3)}
STAND_H = 308                      # same size as the explorer bodies


def cells(img: Image.Image, cols: int, rows: int):
    w, h = img.size
    for r in range(rows):
        for c in range(cols):
            yield img.crop((c * w // cols, r * h // rows, (c + 1) * w // cols, (r + 1) * h // rows))


def tight(rgba: Image.Image) -> Image.Image:
    bb = rgba.getchannel("A").getbbox()
    return rgba.crop(bb) if bb else rgba


def make(sheet: Path, out: Path, heads: Path = HEADS) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    bodies = [tight(cutout(c)) for c in cells(Image.open(sheet).convert("RGB"), 4, 3)]
    k = STAND_H / bodies[0].height                                      # one scale for all poses: a kneeling body stays shorter
    for i, b in enumerate(bodies):
        b.resize((max(int(b.width * k), 1), max(int(b.height * k), 1)), Image.LANCZOS).save(out / f"body_{i:02d}.png")
    hs = list(cells(Image.open(heads).convert("RGB"), 4, 5))
    for name, (r, c) in FACES.items():
        h = tight(cutout(hs[r * 4 + c]))
        h.resize((600, int(600 * h.height / h.width)), Image.LANCZOS).save(out / f"head_{name}.png")
    info = {"from_sheet": str(sheet.name), "bodies": len(bodies), "heads": sorted(FACES), "note": "made by code from the reference sheets; not reviewed by a person"}
    (out / "sprites.json").write_text(json.dumps(info, indent=1))
    return info


if __name__ == "__main__":
    print(make(Path(sys.argv[1]), Path(sys.argv[2])))
