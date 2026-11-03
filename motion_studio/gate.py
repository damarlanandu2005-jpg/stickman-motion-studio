"""Automatic picture checks before a video is built. Cheap, measured checks only; they catch broken pictures, not ugly ones.
Checks: file exists and opens, right size, not blank, not too dark / too bright, not a near-copy of another shot,
and (for shots that should have no character) no big white round blob with two dark dots inside (a stray face).
NOT checked: costume match, hat fit, anatomy, whether the picture matches the story. Those still need a person or a vision model.

    python -m motion_studio.gate jobs.json pictures_dir        # prints flagged ids
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def _hash(a: np.ndarray) -> np.ndarray:
    g = np.asarray(Image.fromarray(a).convert("L").resize((16, 16)), float)
    return (g > g.mean()).ravel()


def stray_face(a: np.ndarray) -> bool:
    """A big white blob that is roughly round and has two small dark holes inside it."""
    g = a.mean(2)
    white = g > 235
    lab, n = ndi.label(white)
    if n == 0:
        return False
    sizes = ndi.sum(white, lab, range(1, n + 1))
    h, w = white.shape
    for i in np.argsort(sizes)[::-1][:3]:
        if sizes[i] < 0.01 * h * w or sizes[i] > 0.6 * h * w:
            continue
        m = lab == i + 1
        ys, xs = np.nonzero(m)
        bh, bw = int(np.ptp(ys)) + 1, int(np.ptp(xs)) + 1
        fill = sizes[i] / (bh * bw)
        if 0.6 < bw / bh < 1.4 and 0.55 < fill < 0.9:  # a circle fills pi/4 = 0.78 of its box
            holes, k = ndi.label(ndi.binary_fill_holes(m) & ~m)
            small = [j for j in range(1, k + 1) if 20 < (holes == j).sum() < 0.03 * sizes[i]]
            if len(small) >= 2:  # two eyes
                return True
    return False


def check(jobs: list[dict], pictures: Path) -> dict[str, list[str]]:
    flagged: dict[str, list[str]] = {}
    hashes: dict[str, np.ndarray] = {}
    for j in jobs:
        jid, why = j["id"], []
        p = pictures / f"pose_{jid}.png"
        if not p.exists():
            flagged[jid] = ["missing"]
            continue
        try:
            a = np.asarray(Image.open(p).convert("RGB"))
        except Exception as exc:  # noqa: BLE001
            flagged[jid] = [f"unreadable: {exc}"]
            continue
        if a.shape[:2] != (j.get("height", 1024), j.get("width", 576)):
            why.append(f"wrong size {a.shape[1]}x{a.shape[0]}")
        if a.std() < 12:
            why.append("blank")
        m = a.mean()
        if m < 12 or m > 248:
            why.append("too dark or too bright")
        h = _hash(a)
        for other, ho in hashes.items():
            if (h != ho).mean() < 0.03:
                why.append(f"near-copy of {other}")
                break
        hashes[jid] = h
        if not j.get("refs") and stray_face(a):
            why.append("stray face in an object-only picture")
        if why:
            flagged[jid] = why
    return flagged


def redo_jobs(jobs: list[dict], flagged: dict, round_no: int) -> list[dict]:
    """Same prompts, new seeds, for the flagged ids (a redraw round)."""
    return [{**j, "seed": j["seed"] + 1000 * round_no} for j in jobs if j["id"] in flagged]


if __name__ == "__main__":
    jobs = json.loads(Path(sys.argv[1]).read_text())["jobs"]
    print(json.dumps(check(jobs, Path(sys.argv[2])), indent=1))
