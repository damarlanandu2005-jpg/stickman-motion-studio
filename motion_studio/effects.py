"""Live effects drawn by code on top of the finished frame: rain, snow, bubbles, ripples, dust, fog.

Every effect is a pure function of the local time, so any frame range can be rendered alone (parallel parts stay identical).
shot["fx"] = [{"type": "rain", "strength": 1.0, "t0": 0.0, "t1": None}, ...]
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

TYPES = ("rain", "snow", "bubbles", "ripples", "dust", "fog")


def _rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)


def draw(im: Image.Image, fx: list[dict], t: float, dur: float, seed: int = 0) -> Image.Image:
    """Return im (RGB) with the active effects drawn. Cheap: only lines/dots on one RGBA layer."""
    active = [e for e in fx if e.get("type") in TYPES and e.get("t0", 0.0) <= t < (e.get("t1") if e.get("t1") is not None else dur + 1)]
    if not active:
        return im
    W, H = im.size
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for k, e in enumerate(active):
        s = float(e.get("strength", 1.0)); r = _rng(seed * 31 + k * 7 + TYPES.index(e["type"])); typ = e["type"]
        if typ == "rain":
            n = int(130 * s)
            x0, ph, sp = r.uniform(0, W, n), r.uniform(0, 1, n), r.uniform(1.6, 2.6, n)      # sp: falls per second
            for i in range(n):
                y = ((ph[i] + t * sp[i]) % 1.0) * (H + 80) - 40
                x = x0[i] - y * 0.18
                d.line([(x, y), (x - 5, y + 26)], fill=(200, 215, 235, 150), width=2)
        elif typ == "snow":
            n = int(110 * s)
            x0, ph, sp, rad = r.uniform(0, W, n), r.uniform(0, 1, n), r.uniform(0.08, 0.22, n), r.uniform(2, 5.5, n)
            for i in range(n):
                y = ((ph[i] + t * sp[i]) % 1.0) * (H + 20) - 10
                x = x0[i] + math.sin(t * 1.3 + i) * 18
                d.ellipse([x - rad[i], y - rad[i], x + rad[i], y + rad[i]], fill=(255, 255, 255, 215))
        elif typ == "bubbles":
            n = int(26 * s)
            x0, ph, sp, rad = r.uniform(0.1 * W, 0.9 * W, n), r.uniform(0, 1, n), r.uniform(0.18, 0.4, n), r.uniform(5, 18, n)
            for i in range(n):
                y = H - (((ph[i] + t * sp[i]) % 1.0) * (H + 40)) + 20
                x = x0[i] + math.sin(t * 2 + i * 1.7) * 10
                d.ellipse([x - rad[i], y - rad[i], x + rad[i], y + rad[i]], outline=(235, 248, 255, 230), width=2, fill=(210, 235, 255, 45))
                d.ellipse([x - rad[i] * 0.45, y - rad[i] * 0.55, x - rad[i] * 0.15, y - rad[i] * 0.25], fill=(255, 255, 255, 200))
        elif typ == "ripples":
            cx, cy = e.get("x", 0.5) * W, e.get("y", 0.72) * H
            for j in range(3):
                u = (t * 0.7 + j / 3) % 1.0
                rx = 20 + u * 220 * s
                d.ellipse([cx - rx, cy - rx * 0.28, cx + rx, cy + rx * 0.28], outline=(240, 250, 255, int(210 * (1 - u))), width=3)
        elif typ == "dust":
            n = int(40 * s)
            x0, y0, ph = r.uniform(0, W, n), r.uniform(0, H, n), r.uniform(0, 6.28, n)
            for i in range(n):
                x = x0[i] + math.sin(t * 0.6 + ph[i]) * 30; y = (y0[i] - t * 14) % H
                d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(255, 245, 220, 110))
        elif typ == "fog":
            a = int(60 * s * (0.8 + 0.2 * math.sin(t * 0.8)))
            for j in range(4):
                y = H * (0.45 + 0.12 * j) + math.sin(t * 0.3 + j) * 25
                d.ellipse([-W * 0.3 + math.sin(t * 0.2 + j) * 60, y - 90, W * 1.3, y + 90], fill=(235, 240, 245, a))
    return Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")
