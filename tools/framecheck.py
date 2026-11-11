# Find broken frames in a video: tiled strips (render glitch), all-white/black frames, and 1-3 frame flashes.
# Usage: python framecheck.py video.mp4 [out.json]   -> prints and saves {"bad":[...], "reasons":{...}}
import sys, json, subprocess, os
import numpy as np
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
W, H = 108, 192
def load(path):
    p = subprocess.run([FFMPEG, "-v", "error", "-i", path, "-vf", f"scale={W}:{H}:flags=area,format=gray", "-f", "rawvideo", "-"], capture_output=True)
    a = np.frombuffer(p.stdout, np.uint8); n = a.size // (W * H)
    return a[: n * W * H].reshape(n, H, W).astype(np.float32) / 255
def find(g):
    n = len(g); bad = {}
    mean = g.mean((1, 2)); std = g.std((1, 2))
    sv = np.abs(g[:, :-38] - g[:, 38:]).mean((1, 2))   # similarity under a 38-row shift (tile period H/5)
    sh = np.abs(g[:, :, :-36] - g[:, :, 36:]).mean((1, 2))  # and a 36-col shift (tile period W/3)
    tile = np.maximum(sv, sh)
    for i in range(n):
        if mean[i] > 0.96 and std[i] < 0.06: bad[i] = "white"
        elif mean[i] < 0.03: bad[i] = "black"
    d = lambda a, b: float(np.abs(g[a] - g[b]).mean())
    for i in range(n):
        if i in bad: continue
        lo, hi = max(0, i - 3), min(n - 1, i + 3)
        nb = np.median(tile[[j for j in range(lo, hi + 1) if j != i]])
        if tile[i] < 0.5 * nb and tile[i] < 0.05 and nb > 0.06: bad[i] = "tiled"
    # flashes: 1-3 frames that differ a lot from both sides while the sides match each other
    for L in (1, 2, 3):
        for i in range(1, n - L):
            if any(j in bad for j in range(i, i + L)): continue
            a, b = i - 1, i + L
            if b >= n: continue
            side = d(a, b); inn = min(d(a, i), d(i + L - 1, b))
            if inn > 0.06 and side < 0.35 * inn:
                for j in range(i, i + L): bad[j] = "flash"
    return bad
if __name__ == "__main__":
    g = load(sys.argv[1]); bad = find(g)
    out = {"frames": len(g), "bad": sorted(bad), "reasons": {str(k): v for k, v in sorted(bad.items())}}
    print(json.dumps({"frames": len(g), "n_bad": len(bad), "bad": sorted(bad)}))
    if len(sys.argv) > 2: json.dump(out, open(sys.argv[2], "w"))

def image_ok(path):
    """Absolute check for one re-rendered still: not white/black, not tiled."""
    from PIL import Image
    im = Image.open(path).convert("L").resize((W, H)); g = np.asarray(im, dtype=np.float32)[None] / 255
    if g.mean() > 0.96 and g.std() < 0.06: return False
    if g.mean() < 0.03: return False
    sv = np.abs(g[:, :-38] - g[:, 38:]).mean(); sh = np.abs(g[:, :, :-36] - g[:, :, 36:]).mean()
    return not (max(sv, sh) < 0.045 and g.std() > 0.05)
