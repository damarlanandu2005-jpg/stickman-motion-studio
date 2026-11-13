#!/usr/bin/env python3
"""Flicker / half-drawn-frame check: count blocks that pop out for a single frame and return (A B A pattern).
usage: flicker.py video.mp4   -> prints JSON. Exit 2 if flicker is high (likely a GPU-readback bug), 0 otherwise."""
import sys, json
import cv2, numpy as np
f = sys.argv[1]
c = cv2.VideoCapture(f); fr = []; pops = 0; frames_bad = 0; n = 0
while True:
    ok, im = c.read()
    if not ok: break
    g = cv2.cvtColor(cv2.resize(im, (270, 480)), cv2.COLOR_BGR2GRAY).astype(np.float32)
    fr.append(g.reshape(48, 10, 27, 10).mean((1, 3)))          # 48x27 blocks
    if len(fr) >= 3:
        a, m, z = fr[-3], fr[-2], fr[-1]
        pop = (np.abs(m - a) > 14) & (np.abs(m - z) > 14) & (np.abs(a - z) < 5)
        k = int(pop.sum()); pops += k
        if k >= 3: frames_bad += 1
    n += 1
    if len(fr) > 3: fr.pop(0)
ppf = round(pops / max(1, n), 1)        # pops per frame: a clean render (CPU or fixed GPU) sits near 6; the GPU readback bug pushed it past 20
res = {"frames": n, "pop_blocks": pops, "pops_per_frame": ppf, "frames_with_flicker": frames_bad, "ok": ppf < 13}
print(json.dumps(res))
sys.exit(0 if res["ok"] else 2)   # bar 13 = ~2x a clean render, set from measured CPU-vs-GPU evidence
