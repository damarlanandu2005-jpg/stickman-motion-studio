"""Cut a walk/run cycle sheet (frames in one row, white background) into frame pictures with transparent background.

All frames share one vertical range, so the feet baseline (and any jump) is kept. Frames are scaled so the sheet is `height` px tall.

    python -m motion_studio.cut_cycle sheet.png out_dir prefix [height]
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def cut(sheet: Path, out_dir: Path, prefix: str, height: int = 300, gap: int = 15) -> list[str]:
    a = np.array(Image.open(sheet).convert("RGB")).astype(int)
    lab, _ = ndi.label(a.min(2) > 225)
    edge = (set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])) - {0}
    fg = ndi.binary_opening(~np.isin(lab, list(edge)), iterations=1)
    xs = np.nonzero(fg.any(0))[0]
    groups, s, p = [], xs[0], xs[0]
    for x in xs[1:]:
        if x - p > gap:
            groups.append((s, p)); s = x
        p = x
    groups.append((s, p))
    groups = [g for g in groups if g[1] - g[0] > 40]  # drop specks
    ys = np.nonzero(fg.any(1))[0]
    y0, y1 = ys[0], ys[-1] + 1
    rgba = Image.fromarray(np.dstack([a.astype(np.uint8), (fg * 255).astype(np.uint8)]))
    k = height / (y1 - y0)
    out_dir.mkdir(parents=True, exist_ok=True)
    names = []
    for i, (x0, x1) in enumerate(groups):
        c = rgba.crop((x0, y0, x1 + 1, y1))
        c = c.resize((int(c.width * k), int(c.height * k)), Image.LANCZOS)
        c.save(out_dir / f"{prefix}_{i:02d}.png")
        names.append(f"{prefix}_{i:02d}")
    return names


if __name__ == "__main__":
    print(cut(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 300))
