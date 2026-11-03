"""Flat 2D bean-head faces drawn in code (vector style: white head, thin dark outline, ring eyes with a dot pupil,
tiny brows and mouths, sweat drops, freckles, stubble, mustache). Every expression is a few numbers, so the same
character can show any expression in any shot with no AI picture. Used for the face test and later by the 2D shot engine."""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from PIL import Image, ImageDraw, ImageFilter

INK = (30, 28, 36)
SKIN = (246, 246, 248)
SHADE = (222, 224, 232)
SCLERA = (222, 226, 230)
S = 4  # supersampling


@dataclass
class Face:
    """eye: 'ring' (grey ring + dot), 'dot', 'closed' (arc down), 'happy' (arc up), 'half' (lid over ring), 'wide'
    look: pupil offset (-1..1, -1..1). brow: (height -1..1, tilt -1..1 where + = inner end up/worried, - = angry, asym)
    mouth: 'line','smile','frown','wavy','open','o','grit','laugh','smirk'"""
    eye: str = "ring"
    look: tuple[float, float] = (0, 0)
    pupil: float = 1.0
    brow: tuple[float, float] = (0.0, 0.0)
    brow_asym: float = 0.0
    mouth: str = "line"
    sweat: bool = False
    freckles: bool = False
    stubble: bool = False
    mustache: bool = False
    blush: bool = False


EXPRESSIONS: dict[str, Face] = {
    "neutral": Face(),
    "worried": Face(brow=(0.15, 0.7), mouth="wavy", sweat=True, pupil=0.8),
    "angry": Face(brow=(-0.1, -0.8), mouth="grit", pupil=0.9),
    "surprised": Face(eye="wide", brow=(0.5, 0.1), mouth="o", pupil=0.45),
    "smug": Face(eye="half", brow=(0.0, 0.0), brow_asym=0.6, mouth="smirk"),
    "happy": Face(eye="happy", brow=(0.2, 0.2), mouth="laugh"),
    "sad": Face(brow=(0.1, 0.8), mouth="frown", pupil=0.8),
    "scared": Face(eye="wide", brow=(0.4, 0.8), mouth="wavy", sweat=True, pupil=0.35),
    "sleepy": Face(eye="closed", brow=(0.0, 0.1), mouth="line"),
    "suspicious": Face(eye="half", look=(0.8, 0.0), brow=(-0.1, -0.3), mouth="line"),
    "smile": Face(brow=(0.15, 0.1), mouth="smile"),
    "determined": Face(brow=(-0.1, -0.5), mouth="line", pupil=1.0),
    "dizzy": Face(eye="dot", brow=(0.0, 0.5), mouth="wavy", pupil=1.0),
    "cry": Face(eye="closed", brow=(0.2, 0.9), mouth="frown", sweat=True),
}


def _line(d, pts, w, fill=INK):
    d.line(pts, fill=fill, width=w, joint="curve")
    for p in (pts[0], pts[-1]):
        d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=fill)


def draw_face(f: Face, size: int = 420, hat: str | None = None, tint: tuple[int, int, int] | None = None) -> Image.Image:
    """A head on a transparent square. size = head diameter in pixels."""
    N = size * S
    pad = int(N * 0.2)
    im = Image.new("RGBA", (N + 2 * pad, N + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    R = N / 2
    c = (pad + R, pad + R)
    skin = tint or SKIN
    # head with soft shade on the lower-left
    d.ellipse([c[0] - R, c[1] - R, c[0] + R, c[1] + R], fill=skin)
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
    sd.ellipse([c[0] - R * 1.05, c[1] - R * 0.8, c[0] + R * 0.95, c[1] + R * 1.25], fill=(*tuple(max(0, v - 26) for v in skin), 255))
    mask = Image.new("L", im.size, 0); ImageDraw.Draw(mask).ellipse([c[0] - R, c[1] - R, c[0] + R, c[1] + R], fill=255)
    sh.putalpha(Image.eval(Image.composite(Image.new("L", im.size, 255), Image.new("L", im.size, 0), mask), lambda v: v))
    inner = Image.new("RGBA", im.size, (0, 0, 0, 0)); ImageDraw.Draw(inner).ellipse([c[0] - R * 0.98, c[1] - R * 0.98, c[0] + R * 0.98, c[1] + R * 0.98], fill=skin)
    base = Image.new("RGBA", im.size, (0, 0, 0, 0)); base.paste(sh, (0, 0), mask)
    base.paste(inner, (0, 0), inner.split()[3])
    im = Image.alpha_composite(im, base); d = ImageDraw.Draw(im)
    if f.stubble:
        for i in range(260):
            a = math.pi * (0.1 + 0.8 * ((i * 0.61803) % 1)); r = R * (0.62 + 0.33 * ((i * 0.37) % 1))
            x, y = c[0] + math.cos(a) * r, c[1] + math.sin(a) * r * 0.92
            if y > c[1] + R * 0.2: d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(150, 150, 158))
    ex = R * 0.36; ey = c[1] - R * 0.02; er = R * 0.15
    for side in (-1, 1):
        x0 = c[0] + side * ex
        look = (f.look[0] * er * 0.35, f.look[1] * er * 0.35)
        if f.eye == "closed":
            d.arc([x0 - er, ey - er * 0.4, x0 + er, ey + er * 0.9], 10, 170, fill=INK, width=int(R * 0.035))
        elif f.eye == "happy":
            d.arc([x0 - er, ey - er * 0.3, x0 + er, ey + er * 1.2], 190, 350, fill=INK, width=int(R * 0.04))
        elif f.eye == "dot":
            d.ellipse([x0 - er * 0.42, ey - er * 0.42, x0 + er * 0.42, ey + er * 0.42], fill=INK)
        else:
            rr = er * (1.25 if f.eye == "wide" else 1.0)
            d.ellipse([x0 - rr, ey - rr, x0 + rr, ey + rr], fill=SCLERA, outline=INK, width=int(R * 0.03))
            pr = rr * 0.42 * f.pupil
            px, py = x0 + look[0] * 1.2, ey + look[1] * 1.2
            d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=INK)
            if f.eye == "half":
                d.pieslice([x0 - rr - 4, ey - rr - 4, x0 + rr + 4, ey + rr + 4], 180, 360, fill=skin)
                d.line([x0 - rr, ey - rr * 0.05, x0 + rr, ey - rr * 0.05], fill=INK, width=int(R * 0.03))
        # brows
        h, t = f.brow
        asym = f.brow_asym if side == 1 else 0
        by = ey - er * (1.9 + 0.8 * h + 0.9 * asym)
        bl = er * 1.1
        inner_y = by - side * 0 - t * er * 0.7
        outer_y = by + t * er * 0.35
        xi, xo = x0 - side * bl, x0 + side * bl
        _line(d, [(xi, inner_y), ((xi + xo) / 2, by - er * 0.12 + (0 if t < 0 else -er * 0.1)), (xo, outer_y)], int(R * 0.035))
    my = c[1] + R * 0.42; mw = R * 0.26; lw = int(R * 0.035)
    m = f.mouth
    if m == "line": _line(d, [(c[0] - mw * 0.6, my), (c[0] + mw * 0.6, my)], lw)
    elif m == "smile": d.arc([c[0] - mw, my - mw * 0.7, c[0] + mw, my + mw * 0.5], 15, 165, fill=INK, width=lw)
    elif m == "frown": d.arc([c[0] - mw * 0.8, my, c[0] + mw * 0.8, my + mw * 1.2], 200, 340, fill=INK, width=lw)
    elif m == "wavy":
        pts = [(c[0] - mw * 0.7 + i * mw * 1.4 / 12, my + math.sin(i / 12 * math.pi * 3) * R * 0.025) for i in range(13)]; _line(d, pts, lw)
    elif m == "o": d.ellipse([c[0] - mw * 0.35, my - mw * 0.4, c[0] + mw * 0.35, my + mw * 0.55], fill=INK)
    elif m == "laugh":
        d.pieslice([c[0] - mw * 0.9, my - mw * 0.55, c[0] + mw * 0.9, my + mw * 0.75], 0, 180, fill=INK)
        d.pieslice([c[0] - mw * 0.45, my + mw * 0.05, c[0] + mw * 0.45, my + mw * 0.7], 0, 180, fill=(205, 90, 100))
    elif m == "smirk":
        _line(d, [(c[0] - mw * 0.6, my + R * 0.01), (c[0] + mw * 0.2, my + R * 0.01), (c[0] + mw * 0.75, my - R * 0.05)], lw)
    elif m == "grit":
        d.rounded_rectangle([c[0] - mw * 0.75, my - mw * 0.3, c[0] + mw * 0.75, my + mw * 0.3], radius=8, fill=SKIN, outline=INK, width=lw)
        for k in range(1, 4): d.line([c[0] - mw * 0.75 + k * mw * 1.5 / 4, my - mw * 0.3, c[0] - mw * 0.75 + k * mw * 1.5 / 4, my + mw * 0.3], fill=INK, width=lw // 2)
        d.line([c[0] - mw * 0.75, my, c[0] + mw * 0.75, my], fill=INK, width=lw // 2)
    if f.mustache:
        d.pieslice([c[0] - mw * 0.9, my - mw * 1.0, c[0], my - mw * 0.05], 180, 360, fill=INK); d.pieslice([c[0], my - mw * 1.0, c[0] + mw * 0.9, my - mw * 0.05], 180, 360, fill=INK)
    if f.freckles:
        for side in (-1, 1):
            for dx, dy in ((0, 0), (0.18, 0.06), (-0.16, 0.08), (0.04, 0.14)):
                x = c[0] + side * ex * 1.15 + dx * R * 0.5; y = ey + er * 2.2 + dy * R * 0.5
                d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(226, 140, 110))
    if f.sweat:
        x, y = c[0] + R * 0.82, c[1] - R * 0.35
        d.polygon([(x, y - R * 0.16), (x - R * 0.07, y), (x + R * 0.07, y)], fill=(150, 205, 245)); d.ellipse([x - R * 0.07, y - R * 0.06, x + R * 0.07, y + R * 0.08], fill=(150, 205, 245))
    # outline last
    d.ellipse([c[0] - R, c[1] - R, c[0] + R, c[1] + R], outline=INK, width=int(R * 0.03))
    if hat == "ushanka":
        d.pieslice([c[0] - R * 1.05, c[1] - R * 1.15, c[0] + R * 1.05, c[1] + R * 0.75], 180, 360, fill=(160, 130, 96), outline=INK, width=int(R * 0.03))
        d.rounded_rectangle([c[0] - R * 1.1, c[1] - R * 0.5, c[0] - R * 0.82, c[1] + R * 0.45], radius=30, fill=(160, 130, 96), outline=INK, width=int(R * 0.03))
        d.rounded_rectangle([c[0] + R * 0.82, c[1] - R * 0.5, c[0] + R * 1.1, c[1] + R * 0.45], radius=30, fill=(160, 130, 96), outline=INK, width=int(R * 0.03))
        d.rectangle([c[0] - R * 1.05, c[1] - R * 0.62, c[0] + R * 1.05, c[1] - R * 0.34], fill=(150, 120, 88), outline=INK, width=int(R * 0.03))
        sx, sy, sr = c[0], c[1] - R * 0.78, R * 0.14
        d.polygon([(sx + sr * math.cos(math.pi * (0.5 + 0.4 * k)), sy - sr * math.sin(math.pi * (0.5 + 0.4 * k)) * -1) for k in range(0, 5)], fill=(200, 40, 40))
    return im.resize((im.width // S, im.height // S), Image.LANCZOS)


def sheet(names: list[str], cols: int = 5, size: int = 220, hat: str | None = None, **kw) -> Image.Image:
    tiles = [draw_face(EXPRESSIONS[n], size, hat=hat, **kw) for n in names]
    w, h = tiles[0].size
    rows = math.ceil(len(tiles) / cols)
    out = Image.new("RGB", (cols * w, rows * (h + 26)), (200, 214, 226))
    dd = ImageDraw.Draw(out)
    for i, (n, t) in enumerate(zip(names, tiles)):
        x, y = (i % cols) * w, (i // cols) * (h + 26)
        out.paste(t, (x, y), t); dd.text((x + 8, y + h + 4), n, fill=(30, 30, 40))
    return out
