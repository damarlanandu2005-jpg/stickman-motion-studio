#!/usr/bin/env python3
"""Count SCENE CHANGES (new place / new set-up) including dissolves, whips and fly-throughs, not only hard cuts.
  python3 kit/tools/ref_scenes.py video.mp4 [--name NAME] [--group refs|ours] [--show]
Why: hard-cut counting (ref_study.py) misses a change made with a cross-dissolve or a fast fly-through, so the references look like
'1 shot' while they really change place every 3-5 s. This tool compares the picture now with the picture 0.5 s earlier
(8x8 colour thumbnail, caption band masked) and counts peaks at least 1.2 s apart. Result is merged into kit/reference/study/NAME.json under "scenes".
"""
import sys, os, json, argparse, subprocess
import numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE)
STUDY = os.path.join(KIT, "reference", "study")


def thumbs(path):
    cap = cv2.VideoCapture(path); fps = cap.get(cv2.CAP_PROP_FPS) or 30; T = []
    while True:
        ok, fr = cap.read()
        if not ok: break
        h = fr.shape[0]; fr = np.concatenate([fr[:int(h * .6)], fr[int(h * .78):]], 0)   # drop caption band 60-78 %
        T.append(cv2.resize(fr, (8, 12), interpolation=cv2.INTER_AREA).astype(np.float32) / 255)
    return np.array(T), fps


def scenes(path, lag_s=0.5, thr=0.075, min_gap_s=1.2):
    T, fps = thumbs(path); n = len(T); lag = max(2, int(round(lag_s * fps)))
    d = np.zeros(n)
    for i in range(lag, n): d[i] = np.abs(T[i] - T[i - lag]).mean()
    k = np.ones(5) / 5; ds = np.convolve(d, k, "same")
    peaks = []
    for i in range(1, n - 1):
        if ds[i] >= thr and ds[i] >= ds[i - 1] and ds[i] > ds[i + 1]: peaks.append(i)
    keep = []
    for i in peaks:
        if keep and (i - keep[-1]) < min_gap_s * fps:
            if ds[i] > ds[keep[-1]]: keep[-1] = i
        else: keep.append(i)
    t = [round((i - lag / 2) / fps, 2) for i in keep]    # centre of the 0.5 s window
    dur = n / fps; gaps = np.diff([0] + t + [dur])
    return {"count": len(t), "per_min": round(len(t) / dur * 60, 1), "times_s": t, "median_scene_s": round(float(np.median(gaps)), 2),
            "p10_scene_s": round(float(np.percentile(gaps, 10)), 2), "p90_scene_s": round(float(np.percentile(gaps, 90)), 2), "thr": thr, "lag_s": lag_s, "duration_s": round(dur, 2)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("video"); ap.add_argument("--name"); ap.add_argument("--thr", type=float, default=0.075); ap.add_argument("--show", action="store_true")
    a = ap.parse_args(); r = scenes(a.video, thr=a.thr)
    print(a.name or a.video, r["count"], "scene changes,", r["per_min"], "/min, median", r["median_scene_s"], "s", r["times_s"] if a.show else "")
    if a.name:
        p = os.path.join(STUDY, a.name + ".json")
        if os.path.exists(p):
            j = json.load(open(p)); j["scenes"] = r; json.dump(j, open(p, "w"), indent=1)
