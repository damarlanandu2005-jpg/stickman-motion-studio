#!/usr/bin/env python3
"""Find the two eyes in every face image of a rigged character so the stage can blink on face images.
usage: find_eyes.py <character_dir> [--sheet out.jpg]   Writes rig.json faces[*].eyes = [{c:[x,y], r}], faces[*].skin. Faces where no clean pair is found get no eyes (no blink)."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

def eyes_of(path):
    im = np.array(Image.open(path).convert("RGBA")).astype(int); h, w = im.shape[:2]
    a = im[..., 3] > 60; lum = im[..., :3].mean(2)
    if a.sum() < 500: return None, None
    ys, xs = np.where(a); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max(); W, H = x1 - x0, y1 - y0
    bright = a & (lum > 200); skin = [int(np.median(im[..., c][bright])) for c in range(3)] if bright.sum() > 50 else [244, 241, 232]
    dark = a & (lum < 95); lab, n = ndi.label(dark); cand = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        bh, bw = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start; cy, cx = (sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2
        area = (lab[sl] == i).sum(); fy, fx = (cy - y0) / H, (cx - x0) / W
        if not (0.30 <= fy <= 0.72 and 0.14 <= fx <= 0.86): continue
        if not (0.018 * W <= max(bw, bh) <= 0.30 * W): continue
        if not (0.55 <= bw / max(bh, 1) <= 1.8): continue
        if area < 0.35 * bw * bh * 0.5 and max(bw, bh) < 0.08 * W: continue
        cand.append((cx, cy, max(bw, bh) / 2, fx, fy))
    best = None
    for l in cand:
        for r in cand:
            if l[3] >= 0.5 or r[3] <= 0.5: continue
            if abs(l[1] - r[1]) > 0.07 * H: continue
            if abs((0.5 - l[3]) - (r[3] - 0.5)) > 0.12: continue
            if not (0.6 <= l[2] / r[2] <= 1.67): continue
            if not (0.16 <= r[3] - l[3] <= 0.6): continue
            score = l[2] + r[2] - abs(l[1] - r[1])
            if best is None or score > best[0]: best = (score, l, r)
    if not best: return None, skin
    return [{"c": [round(e[0], 1), round(e[1], 1)], "r": round(e[2] * 1.2 + 2, 1)} for e in best[1:]], skin

def main():
    d = sys.argv[1]; rp = os.path.join(d, "rig.json"); rig = json.load(open(rp)); ok = 0; tiles = []
    for name, F in sorted(rig.get("faces", {}).items()):
        e, skin = eyes_of(os.path.join(d, F["file"]))
        if e: F["eyes"] = e; F["skin"] = "#%02x%02x%02x" % tuple(skin); ok += 1
        else: F.pop("eyes", None)
        if "--sheet" in sys.argv:
            im = Image.open(os.path.join(d, F["file"])).convert("RGBA"); bg = Image.new("RGBA", im.size, (150, 150, 160, 255)); bg.alpha_composite(im); dr = ImageDraw.Draw(bg)
            for q in e or []:
                dr.ellipse([q["c"][0] - q["r"] * 1.25, q["c"][1] - q["r"] * 1.3, q["c"][0] + q["r"] * 1.25, q["c"][1] + q["r"] * 1.3], fill=F["skin"])
                dr.line([q["c"][0] - q["r"], q["c"][1] + q["r"] * 0.15, q["c"][0] + q["r"], q["c"][1] + q["r"] * 0.15], fill=(39, 25, 37), width=max(3, int(q["r"] * 0.3)))
            tiles.append(bg.convert("RGB").resize((150, 150)))
    json.dump(rig, open(rp, "w"), indent=1)
    if tiles:
        S = Image.new("RGB", (150 * 9, 150 * ((len(tiles) + 8) // 9)), "white")
        for i, t in enumerate(tiles): S.paste(t, ((i % 9) * 150, (i // 9) * 150))
        S.save(sys.argv[sys.argv.index("--sheet") + 1])
    print(os.path.basename(d), "eyes found in", ok, "of", len(rig.get("faces", {})), "faces")
if __name__ == "__main__": main()
