#!/usr/bin/env python3
"""fix_hands.py <rig_dir>
puppet.py slice can leave the round hand dots in the body layer (a dot is thick, so it counts as torso). This moves every piece of the
body layer that is not joined to the torso into the nearest arm layer, so the hands swing with the arms. Run it after `puppet.py slice`."""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
d = sys.argv[1]; rig = json.load(open(os.path.join(d, "rig.json"))); W, H = rig["size"]; L = rig["layers"]
def full(k):
    x, y, w, h = L[k]["box"]; im = Image.open(os.path.join(d, L[k]["file"])).convert("RGBA"); f = Image.new("RGBA", (W, H), (0, 0, 0, 0)); f.paste(im, (x, y)); return np.array(f)
def save(k, a):
    ys, xs = np.where(a[..., 3] > 0); box = [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]
    Image.fromarray(a[box[1]:box[1] + box[3], box[0]:box[0] + box[2]]).save(os.path.join(d, L[k]["file"])); L[k]["box"] = box
body = full("body"); arms = {k: full(k) for k in ("armL", "armR") if k in L}
lab, n = ndi.label(body[..., 3] > 0, structure=np.ones((3, 3)))
if n < 2: print("body is one piece: nothing to move"); sys.exit(0)
sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1)); main = int(np.argmax(sizes)) + 1
dist = {k: ndi.distance_transform_edt(a[..., 3] == 0) for k, a in arms.items()}
moved = []
for i in range(1, n + 1):
    if i == main: continue
    m = lab == i; cy, cx = [int(v.mean()) for v in np.where(m)]
    k = min(dist, key=lambda q: dist[q][cy, cx])
    if dist[k][cy, cx] > 60: continue                      # far from any arm: leave it alone
    arms[k][m] = body[m]; body[m] = 0; moved.append((k, int(m.sum())))
for k, a in arms.items(): save(k, a)
save("body", body); json.dump(rig, open(os.path.join(d, "rig.json"), "w"), indent=1)
print("moved into arms:", moved or "nothing")
