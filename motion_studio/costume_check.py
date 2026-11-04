"""New-costume bodies: build the old character's pose sheet (the reference) and check a drawn sheet against it, in plain code.

Method (same as the older soldier / doctor / sailor sheets): the OLD character's 12 headless body poses are laid out on a white sheet
(4 columns x 3 rows). That sheet is the image reference, so a new costume is drawn with the same poses, proportions and outline
thickness. The drawn sheet is cut into 12 cells, each cell is cut out from the white background, and each pose is measured against
the same pose of the old character. A pose that fails is redrawn; one that passes is saved.

    build_pose_sheet(old_sprite_dir, out_png)  ->  cell info (json-able)
    check_sheet(drawn_png, ref_png, target_hue_range) -> list of per-pose measurements and pass flags

The checks measure size, shape, outline and colour. They cannot tell whether a face or a costume 'looks right': a person decides that once
per new character.
"""
from __future__ import annotations

import colorsys
from pathlib import Path

import numpy as np
from PIL import Image

SHEET_W, SHEET_H, COLS, ROWS = 1440, 1088, 4, 3


def cell_box(i: int) -> tuple[int, int, int, int]:
    c, r = i % COLS, i // COLS
    return (c * SHEET_W // COLS, r * SHEET_H // ROWS, (c + 1) * SHEET_W // COLS, (r + 1) * SHEET_H // ROWS)


def build_pose_sheet(sprite_dir: Path, out: Path, n: int = 12) -> list[dict]:
    """Old character's headless bodies (body_00 .. body_11) on white, one per cell, feet on a common baseline, all at ONE scale."""
    sprite_dir = Path(sprite_dir)
    bodies = [Image.open(sprite_dir / f"body_{i:02d}.png").convert("RGBA") for i in range(n)]
    cw, ch = SHEET_W // COLS, SHEET_H // ROWS
    k = min((cw * 0.86) / max(b.width for b in bodies), (ch * 0.86) / max(b.height for b in bodies))
    sheet = Image.new("RGB", (SHEET_W, SHEET_H), "white")
    info = []
    for i, b in enumerate(bodies):
        x0, y0, x1, y1 = cell_box(i)
        s = b.resize((max(int(b.width * k), 1), max(int(b.height * k), 1)), Image.LANCZOS)
        px, py = x0 + (cw - s.width) // 2, y1 - int(ch * 0.07) - s.height
        sheet.paste(s, (px, py), s)
        info.append({"pose": i, "cell": [x0, y0, x1, y1], "pos": [px, py], "size": [s.width, s.height], "scale": round(k, 4)})
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    return info


def cutout(img: Image.Image, white: int = 232) -> Image.Image:
    """White background to transparent: flood from the border so white INSIDE the figure (hands, legs, neck) stays."""
    from scipy import ndimage as ndi
    a = np.asarray(img.convert("RGB")).astype(int)
    lab, _ = ndi.label(a.min(2) > white)
    edge = (set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])) - {0}
    fg = ~np.isin(lab, list(edge))
    fg = ndi.binary_opening(fg, iterations=1)
    lab2, n = ndi.label(fg)                      # keep the biggest blob only (drops stray specks)
    if n > 1:
        sizes = ndi.sum(fg, lab2, range(1, n + 1))
        fg = lab2 == (1 + int(np.argmax(sizes)))
    return Image.fromarray(np.dstack([a.astype(np.uint8), (fg * 255).astype(np.uint8)]), "RGBA")


def measure(rgba: Image.Image) -> dict:
    a = np.asarray(rgba)
    m = a[:, :, 3] > 0
    if not m.any():
        return {"empty": True}
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    h, w = y1 - y0 + 1, x1 - x0 + 1
    rows = m.sum(1)
    top = rows[y0:y0 + max(int(h * 0.06), 2)]
    rgb = a[:, :, :3].astype(np.float32)[m] / 255.0
    mx, mn = rgb.max(1), rgb.min(1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    dark = float((mx < 0.24).mean())
    col = (sat > 0.18) & (mx > 0.2)
    hues = np.array([colorsys.rgb_to_hsv(*p)[0] for p in rgb[col][::7]]) if col.any() else np.zeros(0)
    return {"h": int(h), "w": int(w), "cx": float((xs.mean() - x0) / w), "top_w": float(top.mean()), "dark": dark,
            "coloured": float(col.mean()), "hues": hues, "area": int(m.sum())}


def _share(hues: np.ndarray, lo: float, hi: float) -> float:
    return float(((hues >= lo) & (hues <= hi)).mean()) if len(hues) else 0.0


def check_sheet(drawn: Path, ref: Path, info: list[dict], target_hue: tuple[float, float], leftover_hue: tuple[float, float] = (0.06, 0.14)) -> list[dict]:
    """Per pose: size ratios against the old pose, headless check, outline ratio, share of target-coloured pixels, share of left-over old colour."""
    im, rf = Image.open(drawn).convert("RGB").resize((SHEET_W, SHEET_H), Image.LANCZOS), Image.open(ref).convert("RGB")
    out = []
    for i, c in enumerate(info):
        box = tuple(c["cell"])
        new, old = measure(cutout(im.crop(box))), measure(cutout(rf.crop(box)))
        if new.get("empty") or old.get("empty"):
            out.append({"pose": i, "pass": False, "why": ["empty cut-out"]}); continue
        r = {"pose": i, "h_ratio": round(new["h"] / old["h"], 3), "w_ratio": round(new["w"] / old["w"], 3),
             "cx_shift": round(abs(new["cx"] - old["cx"]), 3), "top_ratio": round(new["top_w"] / max(old["top_w"], 1), 2),
             "outline_ratio": round(new["dark"] / max(old["dark"], 1e-6), 2),
             "target_share": round(_share(new["hues"], *target_hue), 2), "leftover_share": round(_share(new["hues"], *leftover_hue), 2)}
        why = []
        if not 0.88 <= r["h_ratio"] <= 1.12: why.append("height")
        if not 0.78 <= r["w_ratio"] <= 1.3: why.append("width")
        if r["cx_shift"] > 0.12: why.append("off-centre")
        if r["top_ratio"] > 1.7: why.append("head or hat on top")
        if not 0.55 <= r["outline_ratio"] <= 1.7: why.append("outline")
        if r["target_share"] < 0.45: why.append("costume colour")
        if r["leftover_share"] > 0.12: why.append("old outfit colour left")
        r["pass"], r["why"] = not why, why
        out.append(r)
    return out


def save_cutouts(drawn: Path, info: list[dict], out_dir: Path, prefix: str) -> list[Path]:
    im = Image.open(drawn).convert("RGB").resize((SHEET_W, SHEET_H), Image.LANCZOS)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for i, c in enumerate(info):
        cut = cutout(im.crop(tuple(c["cell"])))
        bb = cut.getchannel("A").getbbox()
        p = out_dir / f"{prefix}_{i:02d}.png"
        (cut.crop(bb) if bb else cut).save(p)
        paths.append(p)
    return paths
