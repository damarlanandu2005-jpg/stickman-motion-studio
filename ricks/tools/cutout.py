#!/usr/bin/env python3
"""Remove a flat backdrop: cutout.py in.png out.png
Backdrop colour = median of the image border; pixels close to it that connect to the border are removed, everything else
stays (so white heads and the holes between legs are handled), then the edge is softened a little.
Prints the share of the image kept so a failed cut (everything or nothing removed) is obvious."""
import sys, numpy as np, cv2
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = np.array(Image.open(src).convert("RGB"))
h, w = im.shape[:2]
edge = np.concatenate([im[:6].reshape(-1, 3), im[-6:].reshape(-1, 3), im[:, :6].reshape(-1, 3), im[:, -6:].reshape(-1, 3)])
ref = np.median(edge, axis=0)
d = np.linalg.norm(im.astype(np.float32) - ref, axis=2)
bgish = (d < 26).astype(np.uint8)
# keep only background that touches the border
n, lab = cv2.connectedComponents(bgish)
border_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(border_labels))
fg = (~bg).astype(np.uint8)
# drop small specks
n, lab, st, _ = cv2.connectedComponentsWithStats(fg)
keep = np.zeros_like(fg)
for i in range(1, n):
    if st[i, 4] > 0.0015 * fg.size: keep[lab == i] = 1
a = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 0.9)
out = np.dstack([im, (np.clip(a, 0, 1) * 255).astype(np.uint8)])
Image.fromarray(out, "RGBA").save(dst)
print("%s -> %s  kept %.1f%% of pixels, backdrop colour %s" % (src, dst, 100 * keep.mean(), ref.astype(int).tolist()))
