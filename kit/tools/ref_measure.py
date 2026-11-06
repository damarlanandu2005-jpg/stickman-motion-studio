#!/usr/bin/env python3
"""Measure a vertical short at its full frame rate and keep the numbers (the 'reference database').

  python3 ref_measure.py add <video.mp4> --name NAME [--group refs|ours]   measure + store in kit/reference/db/NAME.json, rebuild stats
  python3 ref_measure.py rebuild                                          rebuild kit/reference/ref_stats.json + docs/REFERENCE_NUMBERS.md
  python3 ref_measure.py compare <video.mp4> [--dark] [--json out.json]    measure a new video and compare to the reference ranges

Every frame is measured (30 fps) at 180x320: brightness, saturation, colour grade, detail (edge density), palette size,
frame-to-frame motion, camera motion (phase correlation), cuts, shots. Captions (lower-middle band) are masked out.
The ranges are p10-p90 over ALL videos in group 'refs', so adding more references widens/shifts them: nothing is hard-coded.
"""
import json, os, subprocess, sys, argparse
import numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.dirname(HERE) if os.path.basename(HERE) == "tools" else os.path.join(HERE, "kit")
DB = os.path.join(KIT, "reference", "db")
W, H = 180, 320
CAP0, CAP1 = int(H * 0.56), int(H * 0.76)       # caption band rows (burned-in captions): ignored
KEEP = np.ones((H, W), bool); KEEP[CAP0:CAP1, :] = False


def frames(path):
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         stdout=subprocess.PIPE)
    n = W * H * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n: break
        yield np.frombuffer(b, np.uint8).reshape(H, W, 3)
    p.wait()


def measure(path):
    fps = 30.0
    pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate,width,height:format=duration", "-of", "json", path], capture_output=True, text=True).stdout)
    num, den = pr["streams"][0]["r_frame_rate"].split("/"); fps = float(num) / float(den)
    rows = []; prev = None; prevg = None; prevu = None; prevh = None
    hann = cv2.createHanningWindow((W, H), cv2.CV_32F)
    for i, f in enumerate(frames(path)):
        x = f.astype(np.float32) / 255.0
        g = cv2.cvtColor(f, cv2.COLOR_RGB2GRAY)
        gf = g.astype(np.float32)
        L = (x @ np.array([0.2126, 0.7152, 0.0722], np.float32))
        Lk = L[KEEP]
        mx, mn = x.max(-1), x.min(-1)
        sat = np.where(mx > 0.06, (mx - mn) / np.maximum(mx, 1e-6), 0)[KEEP]
        rg = x[..., 0] - x[..., 1]; yb = 0.5 * (x[..., 0] + x[..., 1]) - x[..., 2]
        colorful = float(np.sqrt(rg[KEEP].std() ** 2 + yb[KEEP].std() ** 2) + 0.3 * np.sqrt(rg[KEEP].mean() ** 2 + yb[KEEP].mean() ** 2))
        q = (f[KEEP] >> 4).astype(np.int32); code = (q[:, 0] << 8) | (q[:, 1] << 4) | q[:, 2]
        bc = np.bincount(code, minlength=4096) / code.size
        palette = int((bc > 0.005).sum())
        sx = cv2.Sobel(gf, cv2.CV_32F, 1, 0, ksize=3); sy = cv2.Sobel(gf, cv2.CV_32F, 0, 1, ksize=3)
        edge = float((np.hypot(sx, sy)[KEEP] > 120).mean())
        sh = L[KEEP] < 0.25; hi = L[KEEP] > 0.65
        xs = x[KEEP]
        sh_t = float((xs[sh, 0] - xs[sh, 2]).mean()) if sh.sum() > 50 else 0.0
        hi_t = float((xs[hi, 0] - xs[hi, 2]).mean()) if hi.sum() > 50 else 0.0
        hist = np.histogram(Lk, bins=32, range=(0, 1))[0] / Lk.size
        r = dict(i=i, mean=float(Lk.mean()), std=float(Lk.std()), p2=float(np.percentile(Lk, 2)), p98=float(np.percentile(Lk, 98)),
                 sat=float(sat.mean()), colorful=colorful, palette=palette, edge=edge, shadow_tint=sh_t, high_tint=hi_t,
                 diff=0.0, cam=0.0, resid=0.0, hdist=0.0)
        if prevg is not None:
            d = np.abs(g.astype(np.int16) - prevu.astype(np.int16))[KEEP].mean(); r["diff"] = float(d)
            r["hdist"] = float(np.abs(hist - prevh).sum())
            (dx, dy), resp = cv2.phaseCorrelate(prevg.copy(), gf.copy(), hann)
            r["cam"] = float(np.hypot(dx / W, dy / W)); r["resp"] = float(resp)
            M = np.float32([[1, 0, dx], [0, 1, dy]])
            warped = cv2.warpAffine(prevg, M, (W, H), borderMode=cv2.BORDER_REPLICATE)
            r["resid"] = float(np.abs(gf - warped)[KEEP].mean())
        rows.append(r); prevg = gf.copy(); prevu = g.copy(); prevh = hist
    return fps, rows


def summarize(fps, rows):
    n = len(rows)
    a = {k: np.array([r[k] for r in rows], float) for k in rows[0] if k != "i"}
    # cuts: big histogram change + big pixel change that camera motion cannot explain
    cuts = [i for i in range(1, n) if a["hdist"][i] > 0.35 and a["diff"][i] > 14 and a["resid"][i] > 10]
    # merge cuts closer than 6 frames (flash / dissolve)
    merged = []
    for c in cuts:
        if not merged or c - merged[-1] > 6: merged.append(c)
    bounds = [0] + merged + [n]
    shots = []
    for s, e in zip(bounds[:-1], bounds[1:]):
        if e - s < 3: continue
        sl = slice(s, e); cam = a["cam"][sl][1:] if e - s > 2 else a["cam"][sl]
        med, pk = float(np.median(cam)), float(np.percentile(cam, 95))
        kind = "static" if pk < 0.0015 else "creep" if pk < 0.006 else "glide" if pk < 0.03 else "whip"
        shots.append(dict(a=s, b=e, frames=e - s, mean=float(a["mean"][sl].mean()), edge=float(a["edge"][sl].mean()), palette=float(a["palette"][sl].mean()),
                          sat=float(a["sat"][sl].mean()), held=float((a["diff"][sl] < 0.3).mean()), cam_med=med, cam_peak=pk, cam=kind,
                          resid=float(a["resid"][sl].mean())))
    pct = lambda v, p: float(np.percentile(v, p))
    d = a["diff"][1:]
    out = dict(fps=fps, frames=n, seconds=n / fps, shots=len(shots), cuts_per_min=len(shots) / (n / fps / 60) if n else 0,
               shot_len_s_median=float(np.median([s["frames"] for s in shots]) / fps) if shots else 0,
               held_frac=float((d < 0.3).mean()), nearly_held_frac=float((d < 0.8).mean()),
               motion_diff_p50=pct(d, 50), motion_diff_p90=pct(d, 90), resid_p50=pct(a["resid"][1:], 50),
               cam_class_frac={k: float(np.mean([s["frames"] for s in shots if s["cam"] == k] or [0]) * sum(1 for s in shots if s["cam"] == k) / max(1, n)) for k in ("static", "creep", "glide", "whip")})
    for k in ("mean", "std", "p2", "p98", "sat", "colorful", "palette", "edge", "shadow_tint", "high_tint"):
        out[k] = {"p10": pct(a[k], 10), "p50": pct(a[k], 50), "p90": pct(a[k], 90)}
    # one number per second, so the file stays small
    sec = int(n // fps)
    out["per_second"] = {k: [round(float(a[k][int(t * fps):int((t + 1) * fps)].mean()), 4) for t in range(sec)] for k in ("mean", "sat", "edge", "palette", "diff")}
    return out, shots


def cmd_add(path, name, group):
    fps, rows = measure(path); s, shots = summarize(fps, rows)
    s.update(name=name, group=group, source=os.path.basename(path), shot_list=shots)
    os.makedirs(DB, exist_ok=True)
    json.dump(s, open(os.path.join(DB, name + ".json"), "w"), indent=1)
    print(f"{name}: {s['frames']} frames, {s['shots']} shots, held {s['held_frac']:.0%}, luma {s['mean']['p50']:.2f}, edge {s['edge']['p50']:.3f}, palette {s['palette']['p50']:.0f}")
    rebuild()


RANGE_KEYS = [("mean", "brightness (luma 0-1)"), ("std", "contrast (luma std)"), ("p2", "darkest 2% of pixels"), ("sat", "saturation"),
              ("colorful", "colourfulness"), ("palette", "palette size (colours >0.5% of the picture)"), ("edge", "detail (edge density)")]


def rebuild():
    vids = [json.load(open(os.path.join(DB, f))) for f in sorted(os.listdir(DB)) if f.endswith(".json")]
    refs = [v for v in vids if v.get("group") == "refs"]; ours = [v for v in vids if v.get("group") == "ours"]
    def rng(group, getter):
        v = np.array([getter(x) for x in group], float)
        return None if not len(v) else dict(lo=float(np.percentile(v, 10)) if len(v) > 2 else float(v.min()), mid=float(np.median(v)), hi=float(np.percentile(v, 90)) if len(v) > 2 else float(v.max()))
    st = dict(note="p10-p90 over per-video medians (group refs). Rebuilt by ref_measure.py; never edit by hand.", videos_in_refs=[v["name"] for v in refs], videos_in_ours=[v["name"] for v in ours], metrics={})
    for k, label in RANGE_KEYS:
        st["metrics"][k] = dict(label=label, refs=rng(refs, lambda v: v[k]["p50"]), ours=rng(ours, lambda v: v[k]["p50"]))
    for k, label in [("held_frac", "frames with almost no change (held)"), ("nearly_held_frac", "frames with tiny change"), ("motion_diff_p50", "median frame-to-frame change"),
                     ("motion_diff_p90", "90th pct frame-to-frame change"), ("resid_p50", "object motion after removing camera motion (median)"),
                     ("cuts_per_min", "shots per minute"), ("shot_len_s_median", "median shot length (s)")]:
        st["metrics"][k] = dict(label=label, refs=rng(refs, lambda v: v[k]), ours=rng(ours, lambda v: v[k]))
    st["camera_frames_share"] = {c: dict(refs=rng(refs, lambda v: v["cam_class_frac"][c]), ours=rng(ours, lambda v: v["cam_class_frac"][c])) for c in ("static", "creep", "glide", "whip")}
    json.dump(st, open(os.path.join(KIT, "reference", "ref_stats.json"), "w"), indent=1)
    write_doc(st, vids)
    print("rebuilt ref_stats.json from", len(refs), "refs and", len(ours), "ours")


def fmt(r, k=""):
    if r is None: return "-"
    f = "{:.3f}" if abs(r["mid"]) < 5 else "{:.1f}"
    return f"{f.format(r['lo'])} .. {f.format(r['hi'])} (mid {f.format(r['mid'])})"


def write_doc(st, vids):
    L = ["# REFERENCE NUMBERS (measured at 30 fps by tools/ref_measure.py; rebuilt automatically)", "",
         "READ THIS FIRST. These are RANGES from real reference shorts, not targets to copy. A new topic may need a different value",
         "(a night story is darker, a lab story has more small props). Use them as: (a) the usual range of a good short, (b) a way to notice",
         "that a shot is far outside it WITHOUT a reason in the script. Copy the STYLE GRAMMAR below (how the shorts are built), not the numbers.", "",
         f"Videos behind the ranges: {', '.join(st['videos_in_refs'])}. Our own earlier videos (for comparison): {', '.join(st['videos_in_ours']) or 'none'}.", "",
         "## Ranges (video medians, p10 .. p90 over the reference videos) and where our videos are", "", "| measure | reference range | ours |", "|---|---|---|"]
    for k, m in st["metrics"].items():
        L.append(f"| {m['label']} | {fmt(m['refs'])} | {fmt(m['ours'])} |")
    L += ["", "Share of frames by camera behaviour (static = no move, creep = slow push, glide = 18-40 frame move, whip = fast):", "", "| camera | reference | ours |", "|---|---|---|"]
    for c, m in st["camera_frames_share"].items():
        L.append(f"| {c} | {fmt(m['refs'])} | {fmt(m['ours'])} |")
    L += ["", "## Style grammar (how the reference shorts are built; copy these habits, they hold for any topic)",
          "1. Every shot is a full set: 6-10 pieces of dressing that belong to the place; the same pieces return every time the place returns.",
          "2. Something moves in every frame: camera creep/glide, blinks, idle sway, walk bob, particles, glints, clock hands, bubbles. Nearly-held frames stay a small share.",
          "3. One clear light per shot, chosen for the mood; shadows are tinted (cool in warm light, warm in cool light), never flat grey.",
          "4. Each shot has a different framing from the one before (face / medium / wide / insert / cut-away / first-person / aerial).",
          "5. Props that matter get readable text or a dated label; numbers and dates change only the way the story changes.",
          "6. Characters keep the same look; faces change every beat (shock, sweat, dizzy, laugh) so the story reads without sound.",
          "7. Detail goes where the eye is: the face or key prop is sharpest and most coloured; background is simpler but not empty.", "",
          "## Per video", "", "| video | group | seconds | shots | held | luma | sat | palette | edge |", "|---|---|---|---|---|---|---|---|---|"]
    for v in vids:
        L.append(f"| {v['name']} | {v['group']} | {v['seconds']:.0f} | {v['shots']} | {v['held_frac']:.0%} | {v['mean']['p50']:.2f} | {v['sat']['p50']:.2f} | {v['palette']['p50']:.0f} | {v['edge']['p50']:.3f} |")
    L += ["", "## Notes on reading the numbers",
          "- Videos differ in resolution (360p / 720p / 1080p) and compression. Frame-to-frame change is noisy for low-resolution files, so trust 'held frames', camera share and shot length more than the raw change numbers.",
          "- Biggest measured gaps of our videos against the references: saturation, palette size (variety of colours in the picture), share of held frames, and whip/glide camera moves. Brightness and detail are inside the range for some of our videos and far outside for others.",
          "- Captions (lower-middle band) are ignored in every measure."]
    L += ["", "## How to extend (adaptive)", "Add any new reference short: `python3 kit/tools/ref_measure.py add video.mp4 --name NAME --group refs`. The ranges and this file rebuild themselves.",
          "Compare a finished video: `python3 kit/tools/ref_measure.py compare video.mp4` (add `--dark` if the script is meant to be dark)."]
    open(os.path.join(KIT, "docs", "REFERENCE_NUMBERS.md"), "w").write("\n".join(L) + "\n")


def cmd_compare(path, dark, jout):
    st = json.load(open(os.path.join(KIT, "reference", "ref_stats.json")))
    fps, rows = measure(path); s, shots = summarize(fps, rows)
    res = []
    def chk(key, val, label, skip=False):
        m = st["metrics"].get(key, {}).get("refs")
        if not m: return
        span = max(m["hi"] - m["lo"], 1e-6); tol = 0.15 * span
        v = "ok" if m["lo"] - tol <= val <= m["hi"] + tol else ("LOW" if val < m["lo"] else "HIGH")
        if skip and v != "ok": v += " (allowed by script)"
        res.append(dict(measure=label, value=round(val, 4), ref_lo=round(m["lo"], 4), ref_hi=round(m["hi"], 4), verdict=v))
    chk("mean", s["mean"]["p50"], "brightness", dark); chk("sat", s["sat"]["p50"], "saturation"); chk("palette", s["palette"]["p50"], "palette size")
    chk("edge", s["edge"]["p50"], "detail"); chk("held_frac", s["held_frac"], "held frames"); chk("resid_p50", s["resid_p50"], "object motion")
    chk("shot_len_s_median", s["shot_len_s_median"], "shot length (s)")
    # per-shot defects: shots far below the reference floor
    bad = []
    em = st["metrics"]["edge"]["refs"]; pm = st["metrics"]["palette"]["refs"]; mm = st["metrics"]["mean"]["refs"]
    for i, sh in enumerate(shots):
        why = []
        if sh["mean"] < 0.25 and not dark: why.append("dark")
        if em and sh["edge"] < 0.5 * em["lo"]: why.append("plain (little detail)")
        if pm and sh["palette"] < 0.5 * pm["lo"]: why.append("few colours")
        if sh["frames"] > 15 and sh["held"] > 0.5: why.append("mostly held (nothing moves)")
        if why: bad.append(dict(shot=i, frames=f"{sh['a']}-{sh['b']}", seconds=f"{sh['a'] / fps:.1f}-{sh['b'] / fps:.1f}", problems=why))
    print(f"{os.path.basename(path)}: {s['frames']} frames, {s['shots']} shots")
    for r in res: print(f"  {r['measure']:<16} {r['value']:<8} ref {r['ref_lo']} .. {r['ref_hi']}  {r['verdict']}")
    print("  weak shots:", "none" if not bad else "")
    for b in bad: print("   ", b)
    if jout: json.dump(dict(summary=res, weak_shots=bad), open(jout, "w"), indent=1)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd"); ap.add_argument("video", nargs="?"); ap.add_argument("--name"); ap.add_argument("--group", default="refs")
    ap.add_argument("--dark", action="store_true"); ap.add_argument("--json")
    A = ap.parse_args()
    if A.cmd == "add": cmd_add(A.video, A.name or os.path.splitext(os.path.basename(A.video))[0], A.group)
    elif A.cmd == "rebuild": rebuild()
    elif A.cmd == "compare": cmd_compare(A.video, A.dark, A.json)
