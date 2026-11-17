#!/usr/bin/env python3
"""Stage 7 QA for a rendered film. A render can finish with ok:true and still be broken (blank white frames, or
fills frozen while outlines move). Usage: qa_video.py VIDEO [FILM_JSON]   -> exit 0 pass, 1 fail, report on stdout.
Checks (picture band only, so captions/tags do not hide a blank frame):
  blank   >97% near-white (or near-black) pixels for more than 3 consecutive frames
  frozen  at every shot cut in FILM_JSON the picture must change; if the frame just after a cut is nearly the
          same as the frame just before it, the fills did not update
  stuck   three or more consecutive shots whose low-frequency picture (outlines blurred away) barely changes from
          one shot to the next: the fills froze while only the outlines kept moving (ghost render)"""
import json, subprocess, sys
import numpy as np
W, H, FPS = 108, 192, 30
def frames(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"fps={FPS},scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
def main(path, film=None):
    a = frames(path); band = a[:, 30:150, :]; n = len(a); problems = []
    white = (band > 240).mean(axis=(1, 2)); black = (band < 15).mean(axis=(1, 2)); blank = (white > .97) | (black > .97)
    i = 0
    while i < n:
        if blank[i]:
            j = i
            while j < n and blank[j]: j += 1
            if j - i > 3: problems.append(f"blank picture {i / FPS:.2f}s-{j / FPS:.2f}s ({j - i} frames)")
            i = j
        else: i += 1
    if film:
        f = json.load(open(film)); cuts = sorted({round(x["t0"] * FPS) for s in f["scenes"] for x in s["shots"]})[1:]
        for c in cuts:
            if 2 <= c < n - 2:
                d = float(np.abs(band[c + 2] - band[c - 2]).mean())
                if d < 4.0 and not (blank[c - 2] or blank[c + 2]): problems.append(f"frozen: no picture change at the cut at {c / FPS:.2f}s (mean diff {d:.1f})")
        sh = [(x["id"], (x["t0"] + x["t1"]) / 2) for s in f["scenes"] for x in s["shots"]]
        low = [a[min(n - 1, int(t * FPS)), 30:150, :].reshape(12, 10, 12, 9).mean(axis=(1, 3)) for _, t in sh]
        d = [float(np.abs(low[k + 1] - low[k]).mean()) for k in range(len(low) - 1)]
        k = 0
        while k < len(d):
            if d[k] < 10 and not blank[min(n - 1, int(sh[k][1] * FPS))] and not blank[min(n - 1, int(sh[k + 1][1] * FPS))]:
                j = k
                while j < len(d) and d[j] < 10: j += 1
                if j - k >= 3: problems.append(f"stuck picture: shots {sh[k][0]}..{sh[j][0]} look the same as {sh[k][0]} (fills froze)")
                k = j
            else: k += 1
    return n, problems
if __name__ == "__main__":
    n, p = main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print(f"{sys.argv[1]}: {n} frames, " + ("PASS" if not p else f"FAIL ({len(p)})"))
    for x in p: print("  -", x)
    sys.exit(1 if p else 0)
