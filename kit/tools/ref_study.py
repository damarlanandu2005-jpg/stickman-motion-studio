#!/usr/bin/env python3
"""Study HOW a reference short is made, shot by shot (not only global averages).

  python3 ref_study.py study <video.mp4> --name NAME [--group refs|ours]   -> kit/reference/study/NAME.json
  python3 ref_study.py rules                                             -> kit/reference/study/_summary.json (all refs vs ours)

What it measures for EVERY shot (30 fps, 270x480, caption band masked out):
  camera   : tracked feature points -> similarity transform per frame -> zoom (%), pan x/y (fraction of width), roll (deg),
             speed per second, easing shape (constant / ease_in_out / decelerate / accelerate / hold_then_move ...), jitter
  kind     : static | push_in | pull_out | pan | tilt | push+pan ... (named from the totals over the shot)
  subjects : share of tracked points that move on their own (not with the camera) = how busy the shot is
  look     : brightness, saturation, palette size, edge detail, 5 dominant colours
  cut      : frame, hard/soft, and how the audio lines up with it (voice onset, pause)
Then per video: shot-length rhythm, share of shots by camera kind, zoom size/speed, how often the camera repeats the same
move in a row, how many shots have NO camera move, and the audio/cut alignment.
Nothing here is a target. It is the measured habit of the reference shorts, kept as numbers so a model can compare.
"""
import json, os, subprocess, sys, argparse
import numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.dirname(HERE) if os.path.basename(HERE) == "tools" else os.path.join(HERE, "kit")
OUT = os.path.join(KIT, "reference", "study")
W, H = 270, 480
CAP0, CAP1 = int(H * 0.60), int(H * 0.78)          # burned-in caption band (static on screen: must not steer the camera estimate)
MASK = np.full((H, W), 255, np.uint8); MASK[CAP0:CAP1, :] = 0
KEEP = MASK > 0


def read_frames(path):
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    n = W * H * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n: break
        yield np.frombuffer(b, np.uint8).reshape(H, W, 3)
    p.wait()


def read_audio(path, sr=16000):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True)
    return np.frombuffer(r.stdout, np.float32), sr


def affine_flow(flow, ys, xs, keep):
    """robust affine fit of a dense flow field (units: fraction of width).  returns tx, ty, zoom(log scale), roll(rad), residual rms (px at W), flow rms (px at W)"""
    fh, fw = flow.shape[:2]
    u = flow[ys, xs, 0][keep] / fw; v = flow[ys, xs, 1][keep] / fw
    x = (xs[keep] - fw / 2) / fw; y = (ys[keep] - fh / 2) / fw
    A = np.stack([np.ones_like(x), x, y], 1)
    w = np.ones_like(x)
    for _ in range(3):
        Aw = A * w[:, None]
        cu = np.linalg.lstsq(Aw.T @ A, Aw.T @ u, rcond=None)[0]; cv_ = np.linalg.lstsq(Aw.T @ A, Aw.T @ v, rcond=None)[0]
        r = np.hypot(u - A @ cu, v - A @ cv_)
        c = max(1.5 / fw, 1.4826 * np.median(r))
        w = 1.0 / (1.0 + (r / c) ** 2)
    res = float(np.sqrt((w * r ** 2).sum() / w.sum())) * W
    fl = float(np.sqrt((u ** 2 + v ** 2).mean())) * W
    return float(cu[0]), float(cv_[0]), float((cu[1] + cv_[2]) / 2), float((cv_[1] - cu[2]) / 2), res, fl


def per_frame(path):
    rows = []; prev = None; prevhist = None; prevs = None
    FW, FH = W // 2, H // 2
    ys, xs = np.mgrid[0:FH:3, 0:FW:3]; ys, xs = ys.ravel(), xs.ravel()
    keep = ~((ys >= int(FH * 0.60)) & (ys < int(FH * 0.78)))
    for i, f in enumerate(read_frames(path)):
        g = cv2.cvtColor(f, cv2.COLOR_RGB2GRAY)
        x = f.astype(np.float32) / 255.0
        L = x @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        mx, mn = x.max(-1), x.min(-1)
        sat = np.where(mx > 0.06, (mx - mn) / np.maximum(mx, 1e-6), 0)
        q = (f[KEEP] >> 4).astype(np.int32); code = (q[:, 0] << 8) | (q[:, 1] << 4) | q[:, 2]
        palette = int(((np.bincount(code, minlength=4096) / code.size) > 0.005).sum())
        gf = g.astype(np.float32)
        edge = float((np.hypot(cv2.Sobel(gf, cv2.CV_32F, 1, 0, ksize=3), cv2.Sobel(gf, cv2.CV_32F, 0, 1, ksize=3))[KEEP] > 120).mean())
        hist = np.histogram(L[KEEP], bins=32, range=(0, 1))[0] / KEEP.sum()
        small = cv2.GaussianBlur(cv2.resize(g, (FW, FH), interpolation=cv2.INTER_AREA), (0, 0), 1.0)
        r = dict(i=i, luma=float(L[KEEP].mean()), sat=float(sat[KEEP].mean()), palette=palette, edge=edge,
                 diff=0.0, hdist=0.0, ncc=1.0, tx=0.0, ty=0.0, ls=0.0, rot=0.0, res=0.0, flow=0.0)
        if prev is not None:
            r["diff"] = float(np.abs(g.astype(np.int16) - prev.astype(np.int16))[KEEP].mean())
            r["hdist"] = float(np.abs(hist - prevhist).sum())
            a_, b_ = prevs.astype(np.float32).ravel(), small.astype(np.float32).ravel()
            a_ -= a_.mean(); b_ -= b_.mean()
            r["ncc"] = float((a_ * b_).sum() / (np.sqrt((a_ ** 2).sum() * (b_ ** 2).sum()) + 1e-6))
            fl = cv2.calcOpticalFlowFarneback(prevs, small, None, 0.5, 4, 21, 3, 5, 1.1, 0)
            tx, ty, ls, rot, res, flm = affine_flow(fl, ys, xs, keep)
            r.update(tx=tx, ty=ty, ls=ls, rot=rot, res=res, flow=flm)
        rows.append(r); prev = g; prevhist = hist; prevs = small
    return rows


def find_cuts(rows):
    """hard cut = the picture is no longer the same picture: frame similarity (ncc) collapses, or the colour histogram jumps.
    A fast camera move keeps ncc high on most frames, so it does not count (checked by eye on a 63 s reference)."""
    n = len(rows); ncc = np.array([r["ncc"] for r in rows]); hd = np.array([r["hdist"] for r in rows]); keep = []
    for i in range(1, n):
        if ncc[i] < 0.55 or (ncc[i] < 0.75 and hd[i] > 0.2):
            lo, hi = max(1, i - 4), min(n, i + 5)
            if ncc[i] <= ncc[lo:hi].min() + 1e-9: keep.append(i)
    out = []
    for c in keep:
        if not out or c - out[-1] > 3: out.append(c)
    return out


def find_flights(rows, fps=30.0, hi=2.5, lo=1.5, min_frames=8):
    """a flight = a span where the whole picture moves fast (camera swing / dolly / orbit / zoom). Returns list of dicts."""
    fl = np.array([r["flow"] for r in rows]); sm = np.array([np.median(fl[max(0, i - 2):i + 3]) for i in range(len(fl))])
    spans = []; i = 0; n = len(fl)
    while i < n:
        if sm[i] >= hi:
            j = i
            while j < n and sm[j] >= lo: j += 1
            if j - i >= min_frames: spans.append((i, j))
            i = j
        else: i += 1
    out = []
    for a, b in spans:
        seg = rows[a:b]
        ls = np.array([r["ls"] for r in seg]); tx = np.array([r["tx"] for r in seg]); ty = np.array([r["ty"] for r in seg]); fl_ = np.array([r["flow"] for r in seg])
        res = np.array([r["res"] for r in seg]); ncc_min = float(min(r["ncc"] for r in seg))
        out.append(dict(a=a, b=b, seconds=round((b - a) / fps, 2), peak_px_per_frame=round(float(fl_.max()), 1), mean_px_per_frame=round(float(fl_.mean()), 1),
                        zoom_pct=round(float((np.exp(ls.sum()) - 1) * 100), 1), cam_x=round(float(-tx.sum()), 3), cam_y=round(float(-ty.sum()), 3),
                        parallax_ratio=round(float(np.sqrt((res ** 2).mean()) / max(np.sqrt((fl_ ** 2).mean()), 1e-6)), 2), ease=label_ease(fl_),
                        has_cut_inside=bool(ncc_min < 0.55)))
    return out


def label_ease(m):
    """m: speed curve over the shot -> shape of the move"""
    m = np.asarray(m, float)
    if len(m) < 8 or m.max() < 1e-9: return "none"
    q = np.array([c.mean() for c in np.array_split(cv2.GaussianBlur(m.reshape(-1, 1), (1, 9), 0).ravel(), 4)])
    pk = q.max()
    if pk < 1e-9: return "none"
    q = q / pk
    cv = float(np.std(q) / max(np.mean(q), 1e-9))
    if cv < 0.28: return "constant"
    if q[0] >= 0.99 and q[3] < 0.55: return "decelerate"        # fast start, settles (ease-out)
    if q[3] >= 0.99 and q[0] < 0.55: return "accelerate"
    if max(q[1], q[2]) >= 0.99 and q[0] < 0.7 and q[3] < 0.7: return "ease_in_out"
    if q[0] < 0.35 and q[3] >= 0.6: return "hold_then_move"
    if q[3] < 0.35 and q[0] >= 0.6: return "move_then_hold"
    return "varying"


def shot_report(rows, a, b, fps, cuts_soft=False):
    seg = rows[a + 2:b] if b - a > 6 else rows[a:b]
    if not seg: seg = rows[a:b]
    ls = np.array([r["ls"] for r in seg]); tx = np.array([r["tx"] for r in seg]); ty = np.array([r["ty"] for r in seg]); rot = np.array([r["rot"] for r in seg])
    res = np.array([r["res"] for r in seg]); flo = np.array([r["flow"] for r in seg])
    secs = (b - a) / fps
    zoom = float(np.exp(ls.sum())); zoom_pct = (zoom - 1) * 100
    camx, camy = float(-tx.sum()), float(-ty.sum())            # the camera moves opposite to the picture
    travel = float(np.hypot(camx, camy)); roll = float(-np.degrees(rot.sum()))
    zspd, pspd = np.abs(ls), np.hypot(tx, ty)
    moving = (zspd > 0.0008) | (pspd > 0.0008)
    flow_rms = float(np.sqrt((flo ** 2).mean())); res_rms = float(np.sqrt((res ** 2).mean()))
    ratio = res_rms / max(flow_rms, 1e-6)
    # 3d move = the picture moves a lot AND one flat transform cannot explain it (depth parallax: orbit / dolly / crane)
    if flow_rms >= 1.6 and ratio >= 0.6: kind = "move_3d"
    else:
        zk = "push_in" if zoom_pct >= 4 else "pull_out" if zoom_pct <= -4 else ""
        if travel >= 0.04:
            ax = "pan" if abs(camx) > 1.5 * abs(camy) else "tilt" if abs(camy) > 1.5 * abs(camx) else "drift"
            kind = (zk + "+" + ax) if zk else ax
        else: kind = zk or ("static" if moving.mean() < 0.35 else "creep")
        if abs(roll) >= 3 and kind in ("static", "creep"): kind = "roll"
    src = zspd if abs(zoom_pct) * 0.01 > travel else pspd
    if kind == "move_3d": src = np.maximum(flo, 1e-6)
    jit = float(np.mean(np.abs(np.diff(tx, 2))) + np.mean(np.abs(np.diff(ty, 2)))) if len(tx) > 4 else 0.0
    return dict(a=a, b=b, frames=b - a, seconds=round(secs, 3), kind=kind, zoom_pct=round(zoom_pct, 2), zoom_pct_per_s=round(zoom_pct / max(secs, 1e-3), 2),
                cam_x=round(camx, 4), cam_y=round(camy, 4), travel=round(travel, 4), travel_per_s=round(travel / max(secs, 1e-3), 4), roll_deg=round(roll, 2),
                ease=label_ease(src) if kind not in ("static",) else "none", moving_frac=round(float(moving.mean()), 2), jitter=round(jit, 5),
                flow_px_per_frame=round(flow_rms, 2), parallax_ratio=round(ratio, 2),
                luma=round(float(np.mean([r["luma"] for r in rows[a:b]])), 3), sat=round(float(np.mean([r["sat"] for r in rows[a:b]])), 3),
                palette=round(float(np.mean([r["palette"] for r in rows[a:b]])), 1), edge=round(float(np.mean([r["edge"] for r in rows[a:b]])), 4))


def audio_cut_alignment(path, cut_frames, fps, total_s):
    y, sr = read_audio(path)
    if len(y) < sr: return {}
    hop = int(sr * 0.01); n = len(y) // hop
    env = np.sqrt(np.convolve(y[:n * hop].reshape(n, hop).__pow__(2).mean(1), np.ones(3) / 3, "same") + 1e-12)
    db = 20 * np.log10(env + 1e-9)
    d = np.zeros_like(db); d[3:] = db[3:] - db[:-3]
    on = [i for i in range(3, n - 1) if d[i] > 6 and d[i] >= d[i - 1] and d[i] > d[i + 1]]
    sel = []
    for i in on:
        if not sel or i - sel[-1] > 10: sel.append(i)
    onsets = np.array(sel) * 0.01
    thr = np.percentile(db, 98) - 32
    quiet = db < thr
    pauses = []; i = 0
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]: j += 1
            if (j - i) * 0.01 >= 0.15: pauses.append((i * 0.01, j * 0.01))
            i = j
        else: i += 1
    cut_t = np.array([c / fps for c in cut_frames], float)
    res = dict(onset_rate_per_s=round(len(onsets) / max(total_s, 1), 2), pauses_per_min=round(len(pauses) / max(total_s, 1) * 60, 1),
               silent_share=round(float(quiet.mean()), 3))
    if len(onsets) and len(cut_t):
        near = lambda t: float(np.min(np.abs(onsets - t)))
        obs = float(np.mean([near(t) <= 0.12 for t in cut_t]))
        rng = np.random.default_rng(1); rt = rng.uniform(0, total_s, 2000)
        base = float(np.mean([near(t) <= 0.12 for t in rt]))
        res.update(cut_near_voice_onset=round(obs, 3), chance_near_onset=round(base, 3), onset_lift=round(obs / max(base, 1e-3), 2))
        pe = np.array([p[0] for p in pauses] + [p[1] for p in pauses]) if pauses else np.array([])
        if len(pe):
            pn = lambda t: float(np.min(np.abs(pe - t)))
            res["cut_near_pause_edge"] = round(float(np.mean([pn(t) <= 0.15 for t in cut_t])), 3)
            res["chance_near_pause_edge"] = round(float(np.mean([pn(t) <= 0.15 for t in rng.uniform(0, total_s, 2000)])), 3)
    return res


def runs(seq):
    out = []; prev = None
    for s in seq:
        if s == prev: out[-1] += 1
        else: out.append(1); prev = s
    return out


def summarize(shots, fps, total_s):
    k = [s["kind"] for s in shots]; n = max(1, len(shots))
    share = {u: round(sum(1 for x in k if x == u) / n, 3) for u in sorted(set(k))}
    lens = np.array([s["seconds"] for s in shots])
    cam_any = [s for s in shots if s["kind"] != "static"]
    zoomy = [s for s in shots if s["kind"].startswith(("push_in", "pull_out"))]
    base = lambda x: x.split("+")[0] if x.startswith(("push_in", "pull_out")) else x
    pairs = list(zip(k[:-1], k[1:]))
    same_next = float(np.mean([base(a) == base(b) for a, b in pairs])) if pairs else 0.0
    rl = runs([base(x) for x in k])
    p = lambda v, q: round(float(np.percentile(v, q)), 3) if len(v) else None
    zp = np.array([abs(s["zoom_pct"]) for s in zoomy]); zs = np.array([abs(s["zoom_pct_per_s"]) for s in zoomy])
    tr = np.array([s["travel"] for s in shots if s["kind"] in ("pan", "tilt", "drift") or "+" in s["kind"]])
    ease = {u: round(sum(1 for s in cam_any if s["ease"] == u) / max(1, len(cam_any)), 3) for u in sorted(set(s["ease"] for s in cam_any))}
    return dict(seconds=round(total_s, 2), shots=len(shots), cuts_per_min=round(len(shots) / total_s * 60, 1),
                shot_len_s=dict(min=p(lens, 0), p10=p(lens, 10), p50=p(lens, 50), p90=p(lens, 90), max=p(lens, 100), std=round(float(lens.std()), 3)),
                kind_share=share, static_or_creep_share=round(share.get("static", 0) + share.get("creep", 0), 3), move_3d_share=share.get("move_3d", 0),
                push_pull_share=round(len(zoomy) / n, 3),
                zoom_pct_abs=dict(p10=p(zp, 10), p50=p(zp, 50), p90=p(zp, 90)), zoom_pct_per_s_abs=dict(p10=p(zs, 10), p50=p(zs, 50), p90=p(zs, 90)),
                push_vs_pull=dict(push=sum(1 for s in zoomy if s["zoom_pct"] > 0), pull=sum(1 for s in zoomy if s["zoom_pct"] < 0)),
                pan_travel_frac_width=dict(p50=p(tr, 50), p90=p(tr, 90)),
                ease_share_of_moving_shots=ease,
                camera_repeat_next_shot=round(same_next, 3), camera_run_len_mean=round(float(np.mean(rl)), 2), camera_run_len_max=int(max(rl)),
                flow_px_per_frame_mean=round(float(np.mean([s["flow_px_per_frame"] for s in shots])), 2),
                jitter_mean=round(float(np.mean([s["jitter"] for s in shots])), 5))


def build_study(path, name, group):
    rows = per_frame(path); fps = 30.0; n = len(rows); total_s = n / fps
    cuts = find_cuts(rows); bounds = [0] + cuts + [n]
    shots = [shot_report(rows, a, b, fps) for a, b in zip(bounds[:-1], bounds[1:]) if b - a >= 3]
    sm = summarize(shots, fps, total_s)
    fls = find_flights(rows, fps)
    fl_all = np.array([r["flow"] for r in rows[1:]])
    sm["hard_cuts_per_min"] = round(len(cuts) / total_s * 60, 1)
    sm["pure_push_pull_share"] = round(sm["kind_share"].get("push_in", 0) + sm["kind_share"].get("pull_out", 0), 3)
    sm["flights"] = dict(count=len(fls), per_min=round(len(fls) / total_s * 60, 1), seconds_p50=round(float(np.median([f["seconds"] for f in fls])), 2) if fls else None,
                         seconds_p90=round(float(np.percentile([f["seconds"] for f in fls], 90)), 2) if fls else None,
                         peak_px_p50=round(float(np.median([f["peak_px_per_frame"] for f in fls])), 1) if fls else None,
                         with_cut_inside=round(float(np.mean([f["has_cut_inside"] for f in fls])), 2) if fls else None,
                         parallax_ratio_p50=round(float(np.median([f["parallax_ratio"] for f in fls])), 2) if fls else None,
                         ease_share={u: round(sum(1 for f in fls if f["ease"] == u) / len(fls), 2) for u in sorted(set(f["ease"] for f in fls))} if fls else {})
    gaps = [(fls[i + 1]["a"] - fls[i]["b"]) / fps for i in range(len(fls) - 1)]
    sm["flights"]["gap_between_s"] = dict(p10=round(float(np.percentile(gaps, 10)), 2), p50=round(float(np.median(gaps)), 2), p90=round(float(np.percentile(gaps, 90)), 2)) if gaps else {}
    sm["time_share"] = dict(moving_fast=round(float((fl_all >= 2.5).mean()), 3), moving_some=round(float(((fl_all >= 1.0) & (fl_all < 2.5)).mean()), 3), nearly_still=round(float((fl_all < 1.0).mean()), 3))
    au = audio_cut_alignment(path, cuts, fps, total_s)
    au_f = audio_cut_alignment(path, [f["a"] for f in fls], fps, total_s)
    au["flight_start_near_voice_onset"] = au_f.get("cut_near_voice_onset"); au["flight_onset_lift"] = au_f.get("onset_lift")
    return dict(name=name, group=group, source=os.path.basename(path), frames=n, fps=fps, cuts=cuts, summary=sm, audio=au, flights=fls, shots=shots)


def add_scenes(d, path):
    """scene changes incl. dissolves and fly-throughs (kit/tools/ref_scenes.py); stored beside the hard-cut numbers"""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import ref_scenes
    d["scenes"] = ref_scenes.scenes(path); d["summary"]["scenes_per_min"] = d["scenes"]["per_min"]; d["summary"]["scene_median_s"] = d["scenes"]["median_scene_s"]


def cmd_study(path, name, group):
    d = build_study(path, name, group); s = d["summary"]; au = d["audio"]; add_scenes(d, path)
    os.makedirs(OUT, exist_ok=True)
    json.dump(d, open(os.path.join(OUT, name + ".json"), "w"), indent=1)
    print(f"{name}: {d['frames']} frames, {s['shots']} shots, hard cuts/min {s['hard_cuts_per_min']}, flights/min {s['flights']['per_min']}, fast-move time {s['time_share']['moving_fast']:.0%}, "
          f"pure push/pull shots {s['pure_push_pull_share']:.0%}, same-move-next {s['camera_repeat_next_shot']:.0%}")


# the numbers that describe HOW the camera and cuts behave (one value per video)
METRICS = [
    ("hard_cuts_per_min", "hard cuts per minute", lambda s: s["hard_cuts_per_min"]),
    ("shot_len_median_s", "median length between hard cuts (s)", lambda s: s["shot_len_s"]["p50"]),
    ("flights_per_min", "camera flights per minute", lambda s: s["flights"]["per_min"]),
    ("flight_seconds_median", "length of a camera flight (s, median)", lambda s: s["flights"]["seconds_p50"]),
    ("flight_peak_px", "peak flight speed (px per frame at 270 px width)", lambda s: s["flights"]["peak_px_p50"]),
    ("hold_gap_median_s", "pause between flights (s, median)", lambda s: s["flights"]["gap_between_s"].get("p50")),
    ("parallax_ratio", "depth parallax in flights (0 flat .. 1 strong)", lambda s: s["flights"]["parallax_ratio_p50"]),
    ("time_moving_fast", "share of time the picture moves fast", lambda s: s["time_share"]["moving_fast"]),
    ("time_nearly_still", "share of time nearly still", lambda s: s["time_share"]["nearly_still"]),
    ("pure_push_pull_share", "share of shots that are only a zoom (no pan/tilt/orbit)", lambda s: s["pure_push_pull_share"]),
    ("camera_repeat_next_shot", "share of shots whose move repeats in the next shot", lambda s: s["camera_repeat_next_shot"]),
    ("scenes_per_min", "scene changes per minute (new place or set-up, incl. dissolves and fly-throughs)", lambda s: s.get("scenes_per_min")),
    ("scene_median_s", "median length of a scene (s)", lambda s: s.get("scene_median_s")),
]


def cmd_rules():
    D = {}
    for f in sorted(os.listdir(OUT)):
        if f.endswith(".json") and not f.startswith("_"):
            d = json.load(open(os.path.join(OUT, f))); D[d["name"]] = d
            if d.get("scenes"): d["summary"]["scenes_per_min"] = d["scenes"]["per_min"]; d["summary"]["scene_median_s"] = d["scenes"]["median_scene_s"]
    refs = [d for d in D.values() if d["group"] == "refs"]; ours = [d for d in D.values() if d["group"] == "ours"]
    out = dict(note="Rebuilt by ref_study.py rules. Ranges are p10..p90 over the per-video values of group refs (min/max kept too). Not targets: habits of the references.",
               videos_in_refs=[d["name"] for d in refs], videos_in_ours=[d["name"] for d in ours], metrics={}, flights_pooled={})
    for key, label, g in METRICS:
        v = np.array([g(d["summary"]) for d in refs if g(d["summary"]) is not None], float)
        o = {d["name"]: g(d["summary"]) for d in ours}
        out["metrics"][key] = dict(label=label, refs=dict(min=round(float(v.min()), 3), p10=round(float(np.percentile(v, 10)), 3), median=round(float(np.median(v)), 3),
                                                          p90=round(float(np.percentile(v, 90)), 3), max=round(float(v.max()), 3)) if len(v) else None, ours=o)
    fl = [f for d in refs for f in d["flights"]]
    if fl:
        P = lambda k, q: round(float(np.percentile([f[k] for f in fl], q)), 2)
        out["flights_pooled"] = dict(count=len(fl), seconds=dict(p10=P("seconds", 10), p50=P("seconds", 50), p90=P("seconds", 90)),
                                     peak_px_per_frame=dict(p10=P("peak_px_per_frame", 10), p50=P("peak_px_per_frame", 50), p90=P("peak_px_per_frame", 90)),
                                     zoom_pct=dict(p10=P("zoom_pct", 10), p50=P("zoom_pct", 50), p90=P("zoom_pct", 90)),
                                     ease_share={u: round(sum(1 for f in fl if f["ease"] == u) / len(fl), 2) for u in sorted(set(f["ease"] for f in fl))})
    json.dump(out, open(os.path.join(OUT, "_summary.json"), "w"), indent=1)
    print("summary written:", len(refs), "refs,", len(ours), "ours")


def cmd_compare(path):
    sm = json.load(open(os.path.join(OUT, "_summary.json")))
    d = build_study(path, "candidate", "ours"); add_scenes(d, path); s = d["summary"]
    print(f"{'measure':58s} {'this video':>10s}   reference p10..p90 (min..max)")
    bad = 0
    for key, label, g in METRICS:
        r = sm["metrics"][key]["refs"]; v = g(s)
        if r is None or v is None: continue
        span = max(r["p90"] - r["p10"], 1e-6); tol = 0.15 * span
        flag = "ok" if r["p10"] - tol <= v <= r["p90"] + tol else ("LOW" if v < r["p10"] else "HIGH")
        bad += flag != "ok"
        print(f"{label:58s} {v:10.3f}   {r['p10']:.3f} .. {r['p90']:.3f}  ({r['min']:.3f} .. {r['max']:.3f})  {flag}")
    print(f"{bad} measure(s) outside the reference habit. Hard cuts: {s['hard_cuts_per_min']}/min, camera kinds: {s['kind_share']}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest="cmd")
    s = sub.add_parser("study"); s.add_argument("video"); s.add_argument("--name", required=True); s.add_argument("--group", default="refs")
    sub.add_parser("rules")
    c = sub.add_parser("compare"); c.add_argument("video")
    a = ap.parse_args()
    if a.cmd == "study": cmd_study(a.video, a.name, a.group)
    elif a.cmd == "rules": cmd_rules()
    elif a.cmd == "compare": cmd_compare(a.video)
    else: ap.print_help()
