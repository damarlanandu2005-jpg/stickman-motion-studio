"""Measure a reference short and our recreation with the same simple numbers, side by side.
Measured: shots/cuts, shot length, brightness, colourfulness, outline (edge) density, caption row presence.
Not measured: how good the pictures look (look at the contact sheets for that).

    python -m motion_studio.compare ref.mp4 ours.mp4
"""
from __future__ import annotations

import subprocess
import sys

import numpy as np

W, H = 180, 320


def stats(path: str) -> dict:
    n = W * H * 3
    pr = subprocess.Popen(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", path, "-vf", f"fps=30,scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    prev, i, cuts, lum, sat, edge, caprow = None, 0, [0], [], [], [], []
    while True:
        b = pr.stdout.read(n)
        if len(b) < n:
            break
        a = np.frombuffer(b, np.uint8).reshape(H, W, 3)
        f = a.astype(np.int16)
        if prev is not None and (np.abs(f - prev).max(2) > 50).mean() > 0.5:
            cuts.append(i)
        prev = f
        if i % 5 == 0:
            g = f.mean(2)
            lum.append(g.mean())
            sat.append((f.max(2) - f.min(2)).mean())
            edge.append((np.abs(np.diff(g, axis=1)) > 40).mean())
            band = a[int(H * 0.62):int(H * 0.76)]  # caption band: pure white-ish pixels
            caprow.append(float(((band.min(2) > 235)).mean()))
        i += 1
    cuts.append(i)
    d = np.diff(cuts) / 30
    d = d[d > 0.25]
    return {"seconds": round(i / 30, 1), "shots": len(d), "mean_shot_s": round(float(d.mean()), 2), "median_shot_s": round(float(np.median(d)), 2),
            "brightness": round(float(np.mean(lum)), 1), "colourfulness": round(float(np.mean(sat)), 1),
            "outline_density": round(float(np.mean(edge)), 3), "white_caption_band": round(float(np.mean(caprow)), 4)}


if __name__ == "__main__":
    a, b = stats(sys.argv[1]), stats(sys.argv[2])
    print(f"{'':22}{'reference':>12}{'ours':>12}")
    for k in a:
        print(f"{k:22}{a[k]:>12}{b[k]:>12}")
