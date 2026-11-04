"""Role looks made by RECOLOURING the explorer cast sprites in code (no new drawing, no faces drawn).

The explorer heads all carry a safari helmet and the body is a khaki shirt with brown shorts, boots and backpack.
A role keeps the same silhouettes and faces; only the hue / saturation / brightness of the coloured parts change.
White parts (skin, face, hands, legs) are left alone. This is an honest limit: roles share the same shapes.

    python -m motion_studio.roles animation/assets2d          # writes animation/assets2d/role_<name>/
"""
from __future__ import annotations

import colorsys
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# name -> (hue 0..1, saturation gain, value gain, sat floor). Hue None keeps the original hue.
ROLES = {
    "tech": (0.25, 0.75, 0.62, 0.0),     # olive green bomb suit
    "civ": (0.11, 1.35, 1.05, 0.0),      # mustard sweater, brown trousers
    "doc": (None, 0.0, 1.45, 0.0),       # white coat (colours become near white)
    "chief": (None, 0.0, 1.5, 0.0),      # white uniform
    "cop": (0.62, 1.1, 0.5, 0.45),       # navy uniform
    "radio": (0.57, 0.9, 0.95, 0.30),    # light blue uniform
}


def recolour(im: Image.Image, hue: float | None, sat_gain: float, val_gain: float, sat_floor: float, keep_white: bool = True) -> Image.Image:
    a = np.asarray(im.convert("RGBA")).astype(np.float32) / 255.0
    rgb, alpha = a[:, :, :3], a[:, :, 3]
    mx, mn = rgb.max(2), rgb.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    coloured = (sat > 0.18) & (mx > 0.18)          # khaki, brown, tan hat; not white skin, not black outline
    h = np.zeros_like(sat); s = np.zeros_like(sat); v = mx.copy()
    flat = rgb.reshape(-1, 3)
    hs = np.array([colorsys.rgb_to_hsv(*p) for p in flat[coloured.reshape(-1)]], np.float32) if coloured.any() else np.zeros((0, 3), np.float32)
    out = rgb.copy().reshape(-1, 3)
    idx = np.nonzero(coloured.reshape(-1))[0]
    new = []
    for (hh, ss, vv) in hs:
        hh2 = hh if hue is None else hue
        ss2 = min(max(ss * sat_gain, sat_floor if sat_gain > 0 else 0), 1.0)
        vv2 = min(vv * val_gain, 1.0)
        new.append(colorsys.hsv_to_rgb(hh2, ss2, vv2))
    if len(idx):
        out[idx] = np.array(new, np.float32)
    res = np.dstack([out.reshape(rgb.shape), alpha])
    return Image.fromarray((np.clip(res, 0, 1) * 255).astype(np.uint8), "RGBA")


HEAD_FROM = {"chief": "cop"}  # chief: white uniform with the navy cap of the cop heads (so chief and doctor differ)


def make_roles(root: Path, outfit: str = "explorer", roles: dict | None = None) -> list[str]:
    root = Path(root)
    made = []
    for name, (hue, sg, vg, sf) in (roles or ROLES).items():
        dst = root / f"role_{name}"
        dst.mkdir(exist_ok=True)
        for f in sorted((root / outfit).glob("*.png")):
            if f.name.startswith(("body_", "head_", "walk_", "run_")):
                recolour(Image.open(f), hue, sg, vg, sf).save(dst / f.name)
        made.append(dst.name)
    import shutil
    for name, src in HEAD_FROM.items():
        for f in (root / f"role_{src}").glob("head_*.png"):
            shutil.copy(f, root / f"role_{name}" / f.name)
    return made


if __name__ == "__main__":
    print(make_roles(Path(sys.argv[1])))
