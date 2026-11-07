#!/usr/bin/env python3
"""Say HOW each scene change is made, and check the detector against hand-checked times.

  python3 kit/tools/ref_transitions.py classify video.mp4 --name NAME     # adds "transitions" to kit/reference/study/NAME.json
  python3 kit/tools/ref_transitions.py sheet video.mp4 out.jpg --t0 0 --t1 30   # plain 0.5 s picture sheet (no marks) for hand labelling
  python3 kit/tools/ref_transitions.py strip video.mp4 out.jpg --t 12.4 --span 1.6   # 0.1 s strip around one time
  python3 kit/tools/ref_transitions.py validate                            # detector vs kit/reference/knowledge/scene_truth.json
  python3 kit/tools/ref_transitions.py table                               # per-video numbers (mean, median) for all studied videos

Words (kept apart on purpose):
  shot          = stretch between two HARD cuts (ref_study.py)
  camera flight = fast whole-picture camera motion (ref_study.py), not an edit
  scene change  = the place or set-up in the picture becomes a different one (ref_scenes.py); made in one of these ways:
     hard_cut      the picture jumps between two frames (frame-similarity rule of ref_study.py)
     dissolve      two pictures blend: middle frames fit  (1-a)*A + a*B  with a going 0 to 1
     whip          camera motion so fast that the picture blurs (median flow >= 25 px/frame at 270 px width, or a sharpness drop)
     camera_move   fly-through, orbit, crane or dolly: the camera travels (flow >= 5) and the picture ends up somewhere else, no cut, no blend
     in_place      the picture changes with little camera motion (a prop or flash or character change)
  size of the change: location_change (the whole layout is new) or angle_change (same set, different view); estimate from colour layout, not exact.
"""
import sys, os, json, argparse
import numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE)
STUDY = os.path.join(KIT, "reference", "study"); TRUTH = os.path.join(KIT, "reference", "knowledge", "scene_truth.json")
SRC = {}   # name -> video path, filled from argv when needed


def read(path):
    """per frame: 27x48 colour thumb, 8x12 colour thumb, 68x120 gray for flow, sharpness; caption band 60-78 % removed"""
    cap = cv2.VideoCapture(path); fps = cap.get(cv2.CAP_PROP_FPS) or 30
    T27, T8, G, S = [], [], [], []
    while True:
        ok, fr = cap.read()
        if not ok: break
        h = fr.shape[0]; fr = np.concatenate([fr[:int(h * .6)], fr[int(h * .78):]], 0)
        T27.append(cv2.resize(fr, (27, 48), interpolation=cv2.INTER_AREA).astype(np.float32) / 255)
        T8.append(cv2.resize(fr, (8, 12), interpolation=cv2.INTER_AREA).astype(np.float32) / 255)
        g = cv2.cvtColor(cv2.resize(fr, (135, 240), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
        S.append(float(cv2.Laplacian(g, cv2.CV_32F).var())); G.append(cv2.resize(g, (68, 120), interpolation=cv2.INTER_AREA))
    return np.array(T27), np.array(T8), G, np.array(S), fps


def flow_series(G):
    f = np.zeros(len(G)); sc = 270 / 68
    for i in range(1, len(G)):
        fl = cv2.calcOpticalFlowFarneback(G[i - 1], G[i], None, 0.5, 2, 9, 2, 5, 1.1, 0)
        f[i] = float(np.median(np.hypot(fl[..., 0], fl[..., 1]))) * sc
    return f


def dissolve_score(T27, c, fps):
    """best (a,b) around frame c: middle frames explained by a mix of frame a and frame b; returns (score, a, b). score small = dissolve"""
    best = (9.0, None, None); n = len(T27)
    for a in range(max(0, c - 24), c, 2):
        for L in range(6, 34, 3):
            b = a + L
            if b >= n: break
            A, B = T27[a], T27[b]; d = np.abs(A - B).mean()
            if d < 0.10: continue
            D = (B - A).ravel(); den = float(D @ D) + 1e-9
            mids = range(a + 2, b - 1, 1); res = []; al = []
            for i in mids:
                x = (T27[i] - A).ravel(); alpha = float(np.clip((x @ D) / den, 0, 1)); al.append(alpha)
                res.append(np.abs(x - alpha * D).mean() / d)
            if not res: continue
            al = np.array(al); mono = np.corrcoef(al, np.arange(len(al)))[0, 1] if len(al) > 2 and al.std() > 1e-6 else 0
            if al.max() - al.min() < 0.5 or mono < 0.85: continue
            sc = float(np.mean(res))
            if sc < best[0]: best = (sc, a, b)
    return best


def classify(path, name=None):
    T27, T8, G, S, fps = read(path); fl = flow_series(G); n = len(T27)
    sj = json.load(open(os.path.join(STUDY, name + ".json"))) if name and os.path.exists(os.path.join(STUDY, name + ".json")) else {}
    cuts = [int(c["frame"]) if isinstance(c, dict) else int(c) for c in sj.get("cuts", [])] if sj else []
    times = (sj.get("scenes") or {}).get("times_s", [])
    ev = []
    for t in times:
        c = int(round(t * fps)); lo, hi = max(1, c - 20), min(n - 1, c + 20)
        cut = next((k for k in cuts if lo <= k <= hi), None)
        pk = float(fl[lo:hi].max()); sharp = S[lo:hi].min() / (np.median(S[max(0, c - 45):c + 45]) + 1e-9)
        d8 = float(np.abs(T8[min(n - 1, c + 15)] - T8[max(0, c - 15)]).mean())
        kind = None; extra = {}
        if cut is not None: kind = "hard_cut"
        else:
            ds, a, b = dissolve_score(T27, c, fps)
            if ds < 0.20 and pk < 25: kind = "dissolve"; extra = {"dissolve_frames": b - a, "fit": round(ds, 2)}
            elif pk >= 25 or (sharp < 0.45 and pk >= 12): kind = "whip"
            elif pk >= 5: kind = "camera_move"
            else: kind = "in_place"
        ev.append(dict(t=round(t, 2), kind=kind, size="location_change" if d8 >= 0.12 else "angle_change", peak_flow=round(pk, 1), sharp_ratio=round(float(sharp), 2), d_layout=round(d8, 3), **extra))
    dur = n / fps; kinds = ["hard_cut", "dissolve", "whip", "camera_move", "in_place"]
    cnt = {k: sum(1 for e in ev if e["kind"] == k) for k in kinds}
    out = dict(events=ev, per_min={k: round(v / dur * 60, 1) for k, v in cnt.items()}, count=cnt,
               location_changes_per_min=round(sum(1 for e in ev if e["size"] == "location_change") / dur * 60, 1),
               angle_changes_per_min=round(sum(1 for e in ev if e["size"] == "angle_change") / dur * 60, 1),
               note="types are rules on frame data, estimate +-20 %; see kit/tools/ref_transitions.py header")
    return out


def sheet(path, out, t0, t1, step=0.5, cols=10, w=110):
    cap = cv2.VideoCapture(path); fps = cap.get(cv2.CAP_PROP_FPS) or 30; ims = []
    t = t0
    while t < t1 - 1e-6:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t * fps))); ok, fr = cap.read()
        if not ok: break
        h = int(fr.shape[0] * w / fr.shape[1]); im = cv2.resize(fr, (w, h), interpolation=cv2.INTER_AREA)
        cv2.putText(im, f"{t:.1f}", (2, 12), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 255), 1, cv2.LINE_AA); ims.append(im); t += step
    if not ims: return
    h, w_ = ims[0].shape[:2]; rows = (len(ims) + cols - 1) // cols
    canvas = np.zeros((rows * h, cols * w_, 3), np.uint8)
    for i, im in enumerate(ims): canvas[(i // cols) * h:(i // cols + 1) * h, (i % cols) * w_:(i % cols + 1) * w_] = im
    cv2.imwrite(out, canvas, [cv2.IMWRITE_JPEG_QUALITY, 80]); print("sheet", out, len(ims), "frames")


def cmd_validate(tol=0.75):
    T = json.load(open(TRUTH)); tp = fp = fn = 0; rows = []
    for name, v in T["videos"].items():
        sj = json.load(open(os.path.join(STUDY, name + ".json"))); det = [e for e in (sj.get("scenes") or {}).get("times_s", []) if v["from_s"] <= e <= v["to_s"]]
        tr = v["scene_changes_s"]; used = set(); m = 0; miss = []
        for x in tr:
            j = min(((abs(x - d), k) for k, d in enumerate(det) if k not in used), default=(9, None))
            if j[0] <= tol: used.add(j[1]); m += 1
            else: miss.append(x)
        extra = [d for k, d in enumerate(det) if k not in used]
        tp += m; fn += len(miss); fp += len(extra)
        rows.append((name, v["from_s"], v["to_s"], len(tr), len(det), m, miss, extra))
        print(f"{name:20s} {v['from_s']}-{v['to_s']} s  truth {len(tr):2d}  detector {len(det):2d}  matched {m:2d}  missed {miss}  extra {extra}")
    P = tp / max(1, tp + fp); R = tp / max(1, tp + fn)
    print(f"TOTAL matched {tp}, missed {fn}, extra {fp}; precision {P:.2f}, recall {R:.2f} (tolerance +-{tol} s)")
    return dict(tp=tp, fp=fp, fn=fn, precision=round(P, 2), recall=round(R, 2), tol_s=tol)


def cmd_table():
    rows = []
    for f in sorted(os.listdir(STUDY)):
        if f.startswith("_") or not f.endswith(".json"): continue
        d = json.load(open(os.path.join(STUDY, f)))
        if d.get("group") != "refs" or "scenes" not in d: continue
        s = d["scenes"]; t = d.get("transitions", {}).get("per_min", {})
        rows.append((d["name"], s["duration_s"], s["count"], s["per_min"], 60 / s["per_min"] if s["per_min"] else 0, s["median_scene_s"], t))
    print(f"{'video':20s} {'sec':>5s} {'n':>3s} {'/min':>5s} {'mean gap s':>10s} {'median gap s':>12s}   hard  diss  whip  cam  inplace (per min)")
    for r in rows:
        t = r[6]; print(f"{r[0]:20s} {r[1]:5.1f} {r[2]:3d} {r[3]:5.1f} {r[4]:10.2f} {r[5]:12.2f}   " + ("  ".join(f"{t.get(k, 0):4.1f}" for k in ("hard_cut", "dissolve", "whip", "camera_move", "in_place")) if t else "-"))
    a = np.array([r[3] for r in rows]); g = np.array([r[4] for r in rows]); m = np.array([r[5] for r in rows])
    print(f"per min: mean {a.mean():.1f} median {np.median(a):.1f} min {a.min()} max {a.max()} | mean gap mean {g.mean():.2f} s | median gap median {np.median(m):.2f} s")


def cmd_audit():
    """one file with everything about scene changes: per-video table, type shares, hard cuts that are NOT scene changes (angle cuts inside a scene), detector accuracy"""
    acc = cmd_validate(); rows = {}; tot = {}
    for f in sorted(os.listdir(STUDY)):
        if f.startswith("_") or not f.endswith(".json"): continue
        d = json.load(open(os.path.join(STUDY, f)))
        if "transitions" not in d or "scenes" not in d: continue
        fps = d["fps"]; dur = d["scenes"]["duration_s"]; st = d["scenes"]["times_s"]
        cuts = [c / fps for c in d.get("cuts", [])]
        inside = [c for c in cuts if not any(abs(c - s) <= 0.75 for s in st)]
        tr = d["transitions"]; cnt = tr["count"]; n = max(1, sum(cnt.values()))
        gaps = np.diff([0] + st + [dur])
        r = dict(group=d["group"], seconds=round(dur, 1), scene_changes=len(st), scene_changes_per_min=d["scenes"]["per_min"], mean_gap_s=round(float(gaps.mean()), 2), median_gap_s=round(float(np.median(gaps)), 2),
                 hard_cuts_per_min=round(len(cuts) / dur * 60, 1), hard_cuts_inside_a_scene_per_min=round(len(inside) / dur * 60, 1), by_type_per_min=tr["per_min"], by_type_share={k: round(v / n, 2) for k, v in cnt.items()})
        rows[d["name"]] = r
        if d["group"] == "refs":
            for k, v in cnt.items(): tot[k] = tot.get(k, 0) + v
    refs = [r for r in rows.values() if r["group"] == "refs"]; A = lambda k: np.array([r[k] for r in refs], float)
    S = sum(tot.values())
    out = dict(note="Audit of the scene-change counter (ref_scenes.py) and its type labels (ref_transitions.py). Words: shot = between hard cuts; scene change = new place or set-up (any way of making it); camera flight = camera motion, not an edit.",
               detector_accuracy_vs_hand_labels=acc, hand_label_file="kit/reference/knowledge/scene_truth.json (4 videos, first 30 s, 43 changes, +-0.75 s)",
               type_label_spot_check="6 events checked on 0.1 s strips: grave_bell 10.08 dissolve ok, grave_bell 13.28 dissolve ok, vp3 10.55 dissolve ok, perfect_railroads 21.32 whip ok, pirate 23.05 camera_move ok, slot_machines 13.68 labelled whip but the real change is a dissolve 0.5 s later (time off). 5 of 6 right.",
               refs_summary=dict(videos=len(refs), scene_changes_per_min=dict(mean=round(float(A("scene_changes_per_min").mean()), 1), median=round(float(np.median(A("scene_changes_per_min"))), 1), min=float(A("scene_changes_per_min").min()), max=float(A("scene_changes_per_min").max())),
                                 mean_gap_s_mean=round(float(A("mean_gap_s").mean()), 2), median_gap_s_median=round(float(np.median(A("median_gap_s"))), 2),
                                 hard_cuts_per_min_median=round(float(np.median(A("hard_cuts_per_min"))), 1), hard_cuts_inside_scene_per_min_median=round(float(np.median(A("hard_cuts_inside_a_scene_per_min"))), 1),
                                 type_share_of_all_scene_changes={k: round(v / S, 2) for k, v in tot.items()}),
               per_video=rows,
               limits=["Types are rules on frame data, about +-20 %. Dissolve length (6-12 frames) is the fitted window, real blends look 0.2-0.4 s on the strips.",
                       "'angle change inside the same scene' is NOT counted as a scene change (the layout filter removes it); hard cuts that are not scene changes are counted separately as hard_cuts_inside_a_scene.",
                       "Hand labels are mine and subjective for 'new framing' cases; labelled 4 of 17 videos, 30 s each."])
    json.dump(out, open(os.path.join(KIT, "reference", "knowledge", "transition_audit.json"), "w"), indent=1)
    print(json.dumps(out["refs_summary"], indent=1)); print("ours", rows.get("claude_bomb_v21"))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd"); ap.add_argument("video", nargs="?"); ap.add_argument("out", nargs="?"); ap.add_argument("--name")
    ap.add_argument("--t0", type=float, default=0); ap.add_argument("--t1", type=float, default=30); ap.add_argument("--t", type=float); ap.add_argument("--span", type=float, default=1.6)
    a = ap.parse_args()
    if a.cmd == "classify":
        r = classify(a.video, a.name); print(a.name, r["count"], "per min", r["per_min"], "location", r["location_changes_per_min"], "angle", r["angle_changes_per_min"])
        p = os.path.join(STUDY, a.name + ".json"); j = json.load(open(p)); j["transitions"] = r; json.dump(j, open(p, "w"), indent=1)
    elif a.cmd == "sheet": sheet(a.video, a.out, a.t0, a.t1)
    elif a.cmd == "strip": sheet(a.video, a.out, a.t - a.span / 2, a.t + a.span / 2, step=0.1, cols=8, w=130)
    elif a.cmd == "validate": cmd_validate()
    elif a.cmd == "table": cmd_table()
    elif a.cmd == "audit": cmd_audit()
