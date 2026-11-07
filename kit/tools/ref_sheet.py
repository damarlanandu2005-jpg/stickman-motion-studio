#!/usr/bin/env python3
"""Contact sheet of a video for studying it by eye.  One frame every STEP seconds, with the time written on it,
a RED bar when a hard cut happened in that step and a GREEN bar when the camera was in a fast flight (from ref_study.py's json).

  python3 ref_sheet.py video.mp4 study.json out_prefix [--step 1.0] [--cols 8] [--rows 4] [--w 150]
Writes out_prefix_1.jpg, out_prefix_2.jpg ... (cols*rows frames each).
"""
import json, subprocess, sys, argparse
import numpy as np, cv2


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("video"); ap.add_argument("study"); ap.add_argument("out")
    ap.add_argument("--step", type=float, default=1.0); ap.add_argument("--cols", type=int, default=8); ap.add_argument("--rows", type=int, default=4); ap.add_argument("--w", type=int, default=150)
    a = ap.parse_args(); h = int(a.w * 16 / 9)
    d = json.load(open(a.study)); fps = d["fps"]
    cuts = d["cuts"]; fls = [(f["a"], f["b"]) for f in d.get("flights", [])]
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", a.video, "-vf", f"fps={1 / a.step},scale={a.w}:{h}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    ims = []; k = 0
    while True:
        b = p.stdout.read(a.w * h * 3)
        if len(b) < a.w * h * 3: break
        im = np.frombuffer(b, np.uint8).reshape(h, a.w, 3).copy()
        t0, t1 = k * a.step, (k + 1) * a.step; f0, f1 = int(t0 * fps), int(t1 * fps)
        if any(f0 <= c < f1 for c in cuts): cv2.rectangle(im, (0, h - 7), (a.w, h), (0, 0, 255), -1)
        if any(x < f1 and y > f0 for x, y in fls): cv2.rectangle(im, (0, 0), (a.w, 5), (0, 200, 0), -1)
        cv2.putText(im, f"{t0:.0f}s", (4, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 3); cv2.putText(im, f"{t0:.0f}s", (4, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
        ims.append(im); k += 1
    p.wait()
    per = a.cols * a.rows; blank = np.zeros((h, a.w, 3), np.uint8)
    for s in range(0, len(ims), per):
        chunk = ims[s:s + per]; chunk += [blank] * (per - len(chunk))
        sheet = np.vstack([np.hstack(chunk[r * a.cols:(r + 1) * a.cols]) for r in range(a.rows)])
        cv2.imwrite(f"{a.out}_{s // per + 1}.jpg", sheet, [cv2.IMWRITE_JPEG_QUALITY, 86])
    print(len(ims), "frames,", (len(ims) + per - 1) // per, "sheets")


if __name__ == "__main__":
    main()
