#!/usr/bin/env python3
"""Measure the LOOK and the small timings of a short, as normalised numbers (not pixels), and say what each number means for production.

  python3 kit/tools/ref_look.py study video.mp4 --name NAME [--group refs|ours]   # writes kit/reference/look/NAME.json
  python3 kit/tools/ref_look.py heads video.mp4 out.jpg --t 12.0                  # draw the head finder on one frame (to check it by eye)
  python3 kit/tools/ref_look.py summary                                           # kit/reference/look/_summary.json (p10..p90 over refs, ours beside)

What is measured (all ratios, so 360p and 720p videos compare):
  heads      near-white round blobs: diameter / frame height (shot size), outline thickness / head diameter, outline unevenness,
             eyes (dark holes inside the head): count, diameter / head diameter, height in the head (0 top .. 1 bottom)
  colour     8 dominant colours (k-means on 27x48 thumbnails, so compression noise is gone), hue spread, warm share,
             and surface character: flat / smooth gradient / detailed / edge share of pixels (5x5 local spread)
  captions   white text in the band 60-78 % of height: text height / frame height, centre height, words per second, how long a word stays,
             and the pop: text height in the first frames of a word against its steady height
  blur       sharpness of the left and right edge strips against the centre (foreground blur), sharpness at the peak of a camera flight against a hold (motion blur)
  camera     speed curve of a flight (normalised time 0..1, speed / peak): average and per ease class; ramp-up and ramp-down time; peak speed in percent of width per second
  shake      small fast camera jitter after the slow move is removed: events per minute, amplitude (percent of width), decay time
  sound      scene changes and shakes against voice/sound onsets (lift over chance), from ref_study.audio_cut_alignment

Honest limits: head finder assumes the near-white round head of this house style; limb thickness, body proportions, textures by material and physics
trajectories are NOT measured here (see knowledge/rules.json, conf 'seen' or 'inferred').
"""
import sys, os, json, argparse, subprocess
import numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE)
OUT = os.path.join(KIT, "reference", "look"); STUDY = os.path.join(KIT, "reference", "study")
sys.path.insert(0, HERE)


# ---------------------------------------------------------------- heads
def find_heads(fr, min_area=0.008, max_area=0.35):
    """returns list of dicts, one per head found in a BGR frame. All sizes are ratios."""
    H, W = fr.shape[:2]; s = 360.0 / W if W > 360 else 1.0
    im = cv2.resize(fr, None, fx=s, fy=s, interpolation=cv2.INTER_AREA) if s != 1 else fr
    h, w = im.shape[:2]; hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV); g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    bright = ((hsv[..., 2] > 205) & (hsv[..., 1] < 70)).astype(np.uint8)
    bright = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    cs, _ = cv2.findContours(bright, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE); res = []
    for c in cs:
        a = cv2.contourArea(c)
        if a < min_area * w * h or a > max_area * w * h: continue
        p = cv2.arcLength(c, True); circ = 4 * np.pi * a / (p * p + 1e-9)
        (cx, cy), r = cv2.minEnclosingCircle(c); fill = a / (np.pi * r * r + 1e-9)
        if circ < 0.62 or fill < 0.50: continue
        # outline: walk outward from the contour along the radius, count dark pixels (gray < 95)
        th = []
        for ang in np.linspace(0, 2 * np.pi, 48, endpoint=False):
            n = 0; started = False
            for k in range(1, int(r * 0.45) + 2):
                x = int(round(cx + (r + k) * np.cos(ang))); y = int(round(cy + (r + k) * np.sin(ang)))
                if not (0 <= x < w and 0 <= y < h): n = None; break
                if g[y, x] < 95: n += 1; started = True
                elif started: break
            if n is not None and started: th.append(n)
        if len(th) < 28: continue   # a head has a dark ring on most of its edge; a wall or a cloud does not
        th = np.array(th, float)
        # eyes: dark holes inside the head
        m = np.zeros((h, w), np.uint8); cv2.drawContours(m, [c], -1, 1, -1)
        inner = ((g < 110) & (m > 0)).astype(np.uint8)
        ec, _ = cv2.findContours(inner, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); eyes = []
        for e in ec:
            ea = cv2.contourArea(e)
            if 0.004 * a < ea < 0.12 * a:
                (ex, ey), er = cv2.minEnclosingCircle(e)
                if ea / (np.pi * er * er + 1e-9) > 0.55: eyes.append((2 * er / (2 * r), (ey - (cy - r)) / (2 * r)))
        res.append(dict(d_over_h=2 * r / h, d_over_w=2 * r / w, outline_over_d=float(np.median(th)) / (2 * r), outline_uneven=float(th.std() / (th.mean() + 1e-9)),
                        outline_px_at_360w=float(np.median(th)), cx=cx / w, cy=cy / h, eyes=len(eyes), eye_d_over_head=float(np.mean([e[0] for e in eyes])) if eyes else None,
                        eye_y=float(np.mean([e[1] for e in eyes])) if eyes else None, box=(cx, cy, r, s)))
    return res


def stroke_width(fr):
    """width of the thin dark lines (outlines, noodle limbs) as a share of frame width. Ridge of the distance transform of dark thin shapes."""
    H, W = fr.shape[:2]; im = fr
    v = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)[..., 2]; dark = (v < 100).astype(np.uint8)
    dt = cv2.distanceTransform(dark, cv2.DIST_L2, 3); n, lab = cv2.connectedComponents(dark)
    mx = np.zeros(n); np.maximum.at(mx, lab.ravel(), dt.ravel())
    thin = (mx[lab] <= 0.011 * W) & (lab > 0)                 # components never thicker than about 2.2 % of the frame width: lines, not black areas
    ridge = (dt >= cv2.dilate(dt, np.ones((3, 3), np.uint8)) - 1e-6) & (dt >= 1.0) & thin
    w_ = 2 * dt[ridge]
    if w_.size < 150: return None
    return dict(px_at_360=float(np.median(w_)) * 360.0 / W, over_frame_w=float(np.median(w_)) / im.shape[1], p25=float(np.percentile(w_, 25)) / im.shape[1], p75=float(np.percentile(w_, 75)) / im.shape[1], n=int(w_.size))


def draw_heads(path, out, t):
    cap = cv2.VideoCapture(path); fps = cap.get(cv2.CAP_PROP_FPS) or 30; cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * fps)); ok, fr = cap.read()
    hs = find_heads(fr)
    for hd in hs:
        cx, cy, r, s = hd["box"]; cv2.circle(fr, (int(cx / s), int(cy / s)), int(r / s), (0, 0, 255), 3)
        cv2.putText(fr, f"d/h {hd['d_over_h']:.2f} ol/d {hd['outline_over_d']:.3f} eyes {hd['eyes']}", (int(cx / s - r / s), int(cy / s - r / s) - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
    cv2.imwrite(out, fr); print(len(hs), "heads", [(round(h['d_over_h'], 2), round(h['outline_over_d'], 3), h['eyes']) for h in hs])


# ---------------------------------------------------------------- per-video study
def kmeans_palette(thumbs, k=8):
    X = np.concatenate([t.reshape(-1, 3) for t in thumbs[::5]]).astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
    _, lab, cen = cv2.kmeans(X, k, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    share = np.bincount(lab.ravel(), minlength=k) / len(lab); order = np.argsort(-share); pal = []
    for i in order:
        b, g_, r = (cen[i] * 255).astype(int); hsv = cv2.cvtColor(np.uint8([[[b, g_, r]]]), cv2.COLOR_BGR2HSV)[0, 0]
        pal.append(dict(hex="#%02x%02x%02x" % (r, g_, b), share=round(float(share[i]), 3), hue=int(hsv[0]) * 2, sat=round(float(hsv[1]) / 255, 2), val=round(float(hsv[2]) / 255, 2)))
    return pal


def surface_shares(gray270):
    f = gray270.astype(np.float32); m = cv2.blur(f, (5, 5)); v = np.sqrt(np.maximum(cv2.blur(f * f, (5, 5)) - m * m, 0))
    return [float((v < 1.5).mean()), float(((v >= 1.5) & (v < 4)).mean()), float(((v >= 4) & (v < 12)).mean()), float((v >= 12).mean())]


def caption_track(band_masks, fps):
    """band_masks: list of (bbox h, w, cx, cy, ink, mask_small) or None per frame -> words with height profile"""
    words = []; cur = None
    for i, b in enumerate(band_masks):
        if b is None:
            if cur is not None: cur["end"] = i; words.append(cur); cur = None
            continue
        if cur is not None:
            a, c = cur["mask"], b[5]; iou = float((a & c).sum()) / max(1, float((a | c).sum()))
            if iou < 0.45 and i - cur["start"] > 3: cur["end"] = i; words.append(cur); cur = None
        if cur is None: cur = dict(start=i, hs=[], mask=b[5])
        cur["hs"].append(b[0]); cur["last"] = i
        cur["mask"] = b[5]
    if cur is not None: cur["end"] = len(band_masks); words.append(cur)
    return [w for w in words if w["end"] - w["start"] >= 3]


def study(path, name, group):
    from ref_study import read_audio, audio_cut_alignment
    cap = cv2.VideoCapture(path); fps = cap.get(cv2.CAP_PROP_FPS) or 30
    T27, G, DX, DY, SH, EDGE, CENT, CAPS = [], [], [], [], [], [], [], []
    heads, surf, strokes = [], [], []; i = 0; prev = None
    while True:
        ok, fr = cap.read()
        if not ok: break
        Hh, Ww = fr.shape[:2]
        body = np.concatenate([fr[:int(Hh * .6)], fr[int(Hh * .78):]], 0)
        T27.append(cv2.resize(body, (27, 48), interpolation=cv2.INTER_AREA).astype(np.float32) / 255)
        g = cv2.cvtColor(cv2.resize(body, (135, 240), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
        lap = cv2.Laplacian(g, cv2.CV_32F); SH.append(float(lap.var())); EDGE.append((float(lap[:, :16].var() + lap[:, -16:].var()) / 2, float(lap[:, 40:-40].var())))
        g68 = cv2.resize(g, (68, 120), interpolation=cv2.INTER_AREA)
        if prev is not None:
            fl = cv2.calcOpticalFlowFarneback(prev, g68, None, 0.5, 2, 9, 2, 5, 1.1, 0); sc = 270 / 68
            DX.append(float(np.median(fl[..., 0])) * sc); DY.append(float(np.median(fl[..., 1])) * sc)
        else: DX.append(0.0); DY.append(0.0)
        prev = g68
        # captions: white text with dark outline inside the band
        band = fr[int(Hh * .60):int(Hh * .78)]; bh = cv2.cvtColor(band, cv2.COLOR_BGR2HSV)
        mk = ((bh[..., 2] > 235) & (bh[..., 1] < 40)).astype(np.uint8)
        mk = cv2.morphologyEx(mk, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
        ys, xs = np.nonzero(mk)
        if len(ys) > 0.0008 * mk.size:
            y0, y1 = np.percentile(ys, [1, 99]); x0, x1 = np.percentile(xs, [1, 99])
            CAPS.append(((y1 - y0) / Hh, (x1 - x0) / Ww, (x0 + x1) / 2 / Ww, (Hh * .60 + (y0 + y1) / 2) / Hh, float(len(ys)) / mk.size, cv2.resize(mk, (72, 24), interpolation=cv2.INTER_AREA) > 0))
        else: CAPS.append(None)
        if i % 15 == 0:
            for h in find_heads(fr): heads.append(h)
            sw = stroke_width(fr)
            if sw: strokes.append(sw)
            surf.append(surface_shares(cv2.resize(cv2.cvtColor(body, cv2.COLOR_BGR2GRAY), (270, 480), interpolation=cv2.INTER_AREA)))
        i += 1
    n = len(T27); dur = n / fps; DX = np.array(DX); DY = np.array(DY); SH = np.array(SH)
    out = dict(name=name, group=group, source=os.path.basename(path), frames=n, fps=fps, seconds=round(dur, 2), height_px=int(Hh), width_px=int(Ww))

    # heads
    if heads:
        A = lambda k: np.array([h[k] for h in heads if h[k] is not None], float)
        big = [h for h in heads if h["d_over_h"] >= 0.12]
        out["heads"] = dict(found_per_sampled_frame=round(len(heads) / max(1, len(surf)), 2),
                            size_d_over_h=dict(p10=round(float(np.percentile(A("d_over_h"), 10)), 3), p50=round(float(np.median(A("d_over_h"))), 3), p90=round(float(np.percentile(A("d_over_h"), 90)), 3)),
                            outline_over_d_all=round(float(np.median(A("outline_over_d"))), 4), outline_uneven=round(float(np.median(A("outline_uneven"))), 3),
                            outline_over_d_big_heads=round(float(np.median([h["outline_over_d"] for h in big])), 4) if big else None,
                            eye_d_over_head=round(float(np.median(A("eye_d_over_head"))), 3) if len(A("eye_d_over_head")) else None,
                            eye_y_in_head=round(float(np.median(A("eye_y"))), 3) if len(A("eye_y")) else None,
                            eyes_per_head=round(float(np.mean([h["eyes"] for h in heads])), 2), sample=len(heads))
    if strokes:
        out["outline"] = dict(stroke_over_frame_w=dict(p10=round(float(np.percentile([s_['over_frame_w'] for s_ in strokes], 10)), 4), p50=round(float(np.median([s_['over_frame_w'] for s_ in strokes])), 4), p90=round(float(np.percentile([s_['over_frame_w'] for s_ in strokes], 90)), 4)), spread_within_frame_p25_p75=[round(float(np.median([s_['p25'] for s_ in strokes])), 4), round(float(np.median([s_['p75'] for s_ in strokes])), 4)], frames=len(strokes), note="line width of thin dark shapes (outlines and limbs), share of frame width")
    # colour and surface
    pal = kmeans_palette(T27); hue = np.zeros(12)
    for p in pal:
        if p["sat"] > 0.2: hue[int(p["hue"] // 30) % 12] += p["share"]
    warm = sum(p["share"] for p in pal if p["sat"] > 0.2 and (p["hue"] < 70 or p["hue"] > 330)); cool = sum(p["share"] for p in pal if p["sat"] > 0.2 and 170 <= p["hue"] <= 290)
    sf = np.mean(surf, 0)
    out["colour"] = dict(palette8=pal, warm_share=round(warm, 3), cool_share=round(cool, 3), hue_bins_30deg=[round(float(x), 3) for x in hue],
                         surface=dict(flat=round(float(sf[0]), 3), smooth_gradient=round(float(sf[1]), 3), detailed=round(float(sf[2]), 3), edge=round(float(sf[3]), 3)))
    # captions
    wd = caption_track(CAPS, fps)
    if wd:
        H_ = np.array([np.median(w_["hs"]) for w_ in wd]); first = []; steady = []
        for w_ in wd:
            hs = w_["hs"]
            if len(hs) >= 8: first.append(np.mean(hs[:3])); steady.append(np.median(hs[4:]))
        valid = [c for c in CAPS if c]
        out["captions"] = dict(words=len(wd), words_per_s=round(len(wd) / dur, 2), word_on_screen_s=dict(p10=round(float(np.percentile([(w_["end"] - w_["start"]) / fps for w_ in wd], 10)), 2), p50=round(float(np.median([(w_["end"] - w_["start"]) / fps for w_ in wd])), 2), p90=round(float(np.percentile([(w_["end"] - w_["start"]) / fps for w_ in wd], 90)), 2)),
                               text_height_over_frame_h=round(float(np.median(H_)), 4), centre_y_over_frame_h=round(float(np.median([c[3] for c in valid])), 3), centre_x_over_frame_w=round(float(np.median([c[2] for c in valid])), 3),
                               width_over_frame_w_p50=round(float(np.median([c[1] for c in valid])), 3), pop_first3_over_steady=round(float(np.mean(np.array(first) / np.array(steady))), 3) if first else None,
                               share_of_time_with_caption=round(len(valid) / n, 3))
    # blur
    ed = np.array(EDGE); ratio = ed[:, 0] / (ed[:, 1] + 1e-6)
    sp = np.hypot(DX, DY); k = np.ones(5) / 5; sps = np.convolve(sp, k, "same")
    sj = json.load(open(os.path.join(STUDY, name + ".json"))) if os.path.exists(os.path.join(STUDY, name + ".json")) else {}
    fl = sj.get("flights", []); mb = None
    if fl:
        pk = [SH[int((f["a"] + f["b"]) / 2) - 1:int((f["a"] + f["b"]) / 2) + 2].min() for f in fl if f["b"] < n]; mb = float(np.median(pk) / (np.median(SH) + 1e-9)) if pk else None
    out["blur"] = dict(edge_over_centre_sharpness_median=round(float(np.median(ratio)), 3), frames_with_soft_edges=round(float((ratio < 0.5).mean()), 3),
                       flight_peak_sharpness_over_median=round(mb, 3) if mb is not None else None)
    # camera speed curves
    curves = {}; ramps = []
    for f in fl:
        a, b = f["a"], min(f["b"], n - 1)
        if b - a < 8: continue
        s = sps[a:b + 1]; pkv = float(s.max());
        if pkv < 1: continue
        t = np.linspace(0, 1, 11); c = np.interp(t, np.linspace(0, 1, len(s)), s / pkv)
        curves.setdefault(f.get("ease", "?"), []).append(c); curves.setdefault("all", []).append(c)
        ip = int(np.argmax(s)); up = np.nonzero(s[:ip + 1] >= 0.9 * pkv)[0]; lo1 = np.nonzero(s[:ip + 1] >= 0.1 * pkv)[0]
        dn = np.nonzero(s[ip:] <= 0.1 * pkv)[0]; hi = np.nonzero(s[ip:] <= 0.9 * pkv)[0]
        ramps.append(dict(up_s=(up[0] - lo1[0]) / fps if len(up) and len(lo1) else None, down_s=(dn[0] - hi[0]) / fps if len(dn) and len(hi) else None, peak_pct_w_per_s=pkv * 11.1, peak_at=ip / max(1, len(s) - 1)))
    out["camera_curves"] = {k_: dict(n=len(v), mean=[round(float(x), 2) for x in np.mean(v, 0)]) for k_, v in curves.items()}
    if ramps:
        r = lambda key: [x[key] for x in ramps if x[key] is not None]
        out["camera_ramps"] = dict(n=len(ramps), ramp_up_s_p50=round(float(np.median(r("up_s"))), 2) if r("up_s") else None, ramp_down_s_p50=round(float(np.median(r("down_s"))), 2) if r("down_s") else None,
                                   peak_pct_width_per_s_p50=round(float(np.median(r("peak_pct_w_per_s"))), 1), peak_position_in_flight_p50=round(float(np.median(r("peak_at"))), 2))
    # shake: fast jitter after removing the slow move
    def hp(x, w=9):
        pad = np.pad(x, (w // 2, w // 2), mode="edge"); sm = np.convolve(pad, np.ones(w) / w, "valid"); return x - sm[:len(x)]
    shk = np.hypot(hp(DX), hp(DY)) * 100 / 270; ev = []; j = 0
    thr = max(0.6, float(np.percentile(shk, 90)) * 1.0)
    while j < n:
        if shk[j] >= thr:
            e = j
            while e < n and shk[e] >= thr * 0.35: e += 1
            ev.append((j, e, float(shk[j:e].max()))); j = e + 6
        else: j += 1
    out["shake"] = dict(events_per_min=round(len(ev) / dur * 60, 1), amp_pct_width_p50=round(float(np.median([x[2] for x in ev])), 2) if ev else None, decay_s_p50=round(float(np.median([(x[1] - x[0]) / fps for x in ev])), 2) if ev else None,
                        threshold_pct_width=round(thr, 2), background_jitter_pct_width_median=round(float(np.median(shk)), 3), note="estimate: jitter found after removing a 9-frame running mean of the camera shift; a fast whip can also show up here")
    # sound against scene changes
    sc = (sj.get("scenes") or {}).get("times_s", [])
    try:
        au = audio_cut_alignment(path, [int(t * fps) for t in sc], fps, dur) if sc else {}
        out["sound"] = dict(scene_change_near_sound_onset=au.get("cut_near_voice_onset"), chance=au.get("chance_near_onset"), lift=au.get("onset_lift"), onset_rate_per_s=au.get("onset_rate_per_s"),
                            shake_events_near_sound_onset=None)
        y, sr = read_audio(path)
        if len(y) > sr and ev:
            hop = int(sr * 0.01); m = len(y) // hop; env = np.sqrt(np.convolve(y[:m * hop].reshape(m, hop).__pow__(2).mean(1), np.ones(3) / 3, "same") + 1e-12); db = 20 * np.log10(env + 1e-9)
            d = np.zeros_like(db); d[3:] = db[3:] - db[:-3]; on = np.array([i * 0.01 for i in range(3, m - 1) if d[i] > 6 and d[i] >= d[i - 1] and d[i] > d[i + 1]])
            if len(on):
                near = lambda t: float(np.min(np.abs(on - t))) <= 0.12; rng = np.random.default_rng(2)
                o = float(np.mean([near(x[0] / fps) for x in ev])); b_ = float(np.mean([near(t) for t in rng.uniform(0, dur, 2000)]))
                out["sound"].update(shake_events_near_sound_onset=round(o, 3), shake_chance=round(b_, 3), shake_lift=round(o / max(b_, 1e-3), 2))
    except Exception as e: out["sound"] = dict(error=str(e)[:80])
    return out


def cmd_summary():
    D = {}
    for f in sorted(os.listdir(OUT)):
        if f.endswith(".json") and not f.startswith("_"): d = json.load(open(os.path.join(OUT, f))); D[d["name"]] = d
    refs = [d for d in D.values() if d["group"] == "refs"]; ours = {d["name"]: d for d in D.values() if d["group"] == "ours"}
    M = [("head_size_d_over_h_p50", "head diameter / frame height (median)", lambda d: d["heads"]["size_d_over_h"]["p50"]),
         ("stroke_over_frame_w", "line width / frame width (outlines and limbs, all frames)", lambda d: d["outline"]["stroke_over_frame_w"]["p50"]),
         ("outline_over_head_d", "outline thickness / head diameter (all heads)", lambda d: d["heads"]["outline_over_d_all"]),
         ("outline_over_head_d_big", "outline thickness / head diameter (heads over 12 % of frame height)", lambda d: d["heads"]["outline_over_d_big_heads"]),
         ("outline_uneven", "outline unevenness (std / mean around the head)", lambda d: d["heads"]["outline_uneven"]),
         ("eye_d_over_head", "eye diameter / head diameter", lambda d: d["heads"]["eye_d_over_head"]),
         ("eye_y_in_head", "eye height in head (0 top .. 1 bottom)", lambda d: d["heads"]["eye_y_in_head"]),
         ("surface_flat", "share of picture that is flat colour", lambda d: d["colour"]["surface"]["flat"]),
         ("surface_gradient", "share that is smooth gradient", lambda d: d["colour"]["surface"]["smooth_gradient"]),
         ("surface_detailed", "share that is detailed surface", lambda d: d["colour"]["surface"]["detailed"]),
         ("surface_edge", "share that is hard edge (outlines, text)", lambda d: d["colour"]["surface"]["edge"]),
         ("warm_share", "warm colour share (red-orange-yellow, saturated)", lambda d: d["colour"]["warm_share"]),
         ("cool_share", "cool colour share (cyan-blue-purple, saturated)", lambda d: d["colour"]["cool_share"]),
         ("caption_height", "caption text height / frame height", lambda d: d["captions"]["text_height_over_frame_h"]),
         ("caption_centre_y", "caption centre height (0 top .. 1 bottom)", lambda d: d["captions"]["centre_y_over_frame_h"]),
         ("caption_words_per_s", "caption words per second", lambda d: d["captions"]["words_per_s"]),
         ("caption_word_s", "time one caption word stays (median s)", lambda d: d["captions"]["word_on_screen_s"]["p50"]),
         ("caption_pop", "caption pop: height in first 3 frames / steady height", lambda d: d["captions"]["pop_first3_over_steady"]),
         ("edge_over_centre_sharp", "edge strips sharpness / centre sharpness", lambda d: d["blur"]["edge_over_centre_sharpness_median"]),
         ("soft_edge_frames", "share of frames with soft edges (foreground blur)", lambda d: d["blur"]["frames_with_soft_edges"]),
         ("flight_peak_sharp", "sharpness at flight peak / median sharpness (motion blur)", lambda d: d["blur"]["flight_peak_sharpness_over_median"]),
         ("ramp_up_s", "camera ramp-up 10 to 90 % of peak (s)", lambda d: d["camera_ramps"]["ramp_up_s_p50"]),
         ("ramp_down_s", "camera ramp-down 90 to 10 % of peak (s)", lambda d: d["camera_ramps"]["ramp_down_s_p50"]),
         ("peak_pct_w_s", "camera peak speed (percent of frame width per second)", lambda d: d["camera_ramps"]["peak_pct_width_per_s_p50"]),
         ("peak_position", "where in the flight the peak speed sits (0 start .. 1 end)", lambda d: d["camera_ramps"]["peak_position_in_flight_p50"]),
         ("shake_per_min", "shake events per minute (estimate)", lambda d: d["shake"]["events_per_min"]),
         ("shake_amp", "shake amplitude (percent of width, median)", lambda d: d["shake"]["amp_pct_width_p50"]),
         ("shake_decay_s", "shake decay time (s, median)", lambda d: d["shake"]["decay_s_p50"]),
         ("scene_near_sound", "share of scene changes within 0.12 s of a sound onset", lambda d: d["sound"]["scene_change_near_sound_onset"]),
         ("scene_sound_lift", "same, lift over chance", lambda d: d["sound"]["lift"]),
         ("shake_sound_lift", "shake events near a sound onset, lift over chance", lambda d: d["sound"].get("shake_lift"))]
    out = dict(note="p10..p90 over per-video values of group refs (min/max kept). Rebuilt by ref_look.py summary.", n_refs=len(refs), metrics={})
    for key, label, g in M:
        v = []
        for d in refs:
            try:
                x = g(d)
                if x is not None: v.append(float(x))
            except Exception: pass
        o = {}
        for nm, d in ours.items():
            try: o[nm] = g(d)
            except Exception: o[nm] = None
        if v:
            v = np.array(v); out["metrics"][key] = dict(label=label, n=len(v), p10=round(float(np.percentile(v, 10)), 4), median=round(float(np.median(v)), 4), p90=round(float(np.percentile(v, 90)), 4), min=round(float(v.min()), 4), max=round(float(v.max()), 4), ours=o)
    cur = {}
    for d in refs:
        for k, c in d.get("camera_curves", {}).items(): cur.setdefault(k, []).append((c["n"], c["mean"]))
    out["camera_speed_curves_normalised"] = {k: dict(videos=len(v), flights=sum(n for n, _ in v), mean_11_points=[round(float(sum(n * m[i] for n, m in v) / sum(n for n, _ in v)), 2) for i in range(11)]) for k, v in cur.items() if sum(n for n, _ in v) >= 5}
    json.dump(out, open(os.path.join(OUT, "_summary.json"), "w"), indent=1); print("summary", len(refs), "refs,", len(out["metrics"]), "metrics")
    for k, m in out["metrics"].items(): print(f"{m['label'][:66]:66s} {m['p10']:>8} .. {m['p90']:<8} med {m['median']:<8} ours {m['ours']}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd"); ap.add_argument("video", nargs="?"); ap.add_argument("out", nargs="?"); ap.add_argument("--name"); ap.add_argument("--group", default="refs"); ap.add_argument("--t", type=float, default=5)
    a = ap.parse_args(); os.makedirs(OUT, exist_ok=True)
    if a.cmd == "study":
        d = study(a.video, a.name, a.group); json.dump(d, open(os.path.join(OUT, a.name + ".json"), "w"), indent=1)
        h = d.get("heads", {}); print(a.name, "heads", h.get("sample"), "outline/d", h.get("outline_over_d_all"), "captions", d.get("captions", {}).get("words"), "palette", [p["hex"] for p in d["colour"]["palette8"][:4]], "surface", d["colour"]["surface"])
    elif a.cmd == "heads": draw_heads(a.video, a.out, a.t)
    elif a.cmd == "summary": cmd_summary()
