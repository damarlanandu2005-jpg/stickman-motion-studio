#!/usr/bin/env python3
"""shortkit - base scene code for @ricksclips3000-style Shorts.

Builds a 1080x1920 / 30 fps Short from stills (or pre-rendered frames) using
the measured house rules:
  camera  : every shot moves; default push-in +6 %/s, 44 px/s median speed,
            "arrive fast, then settle" (first third ~1.57x the rest)
  cuts    : 8-frame dissolves and 10-frame whip (camera-move) transitions,
            no hard cuts
  captions: 1-2 words, centred at (540, 1350), new caption every 10 frames,
            white heavy sans with a plum-black outline
and checks a finished video against the same numbers.

Usage
  python3 shortkit.py build scene.json out.mp4
  python3 shortkit.py check out.mp4 [step]
  python3 shortkit.py words voice.mp3 script.txt [-o words.json]
      word timestamps for the voiceover: Whisper when it is installed, else
      an estimate from the loudness of the track (references/formats.md)
  python3 shortkit.py compare ours.png ref.png [--json out.json]
      brightness, shadow, colour and outline numbers of two frames or videos
      side by side, then the largest gaps and the scene fields that fix them
  python3 shortkit.py measure <video-or-folder> out_dir
      style numbers of reference videos -> out_dir/measured.json, plus every
      frame on sheets of 2 s each -> out_dir/sheets/<video>_<NNNN>.jpg

scene.json
{
  "font": "/path/Montserrat-ExtraBold.ttf",          # any heavy sans
  "captions": "A man snuck into a family's house",    # optional
  "words_per_caption": 1,                             # 1 or 2
  "frames_per_caption": 10,
  "shots": [
    {"image": "shot1.png", "dur": 1.2, "zoom": 6, "pan": [-20, 30], "out": "whip"},
    {"image": "shot2.png", "dur": 1.6, "zoom": -8, "pan": [0, 0],   "out": "dissolve"},
    {"image": "shot3.png", "dur": 2.0}
  ]
}
  frames: folder of PNG frames to use as the shot instead of a still
          (what render.mjs writes from the three.js stage)
  dur   : seconds the shot is on screen, transitions included
  zoom  : %/s, + = push in, - = pull out             (default +6)
  pan   : [x, y] px/s of picture motion at 1080 wide;
          +x = picture moves right (camera pans left), +y = picture moves down
          (default: 44 px/s in a random direction)
  out   : transition into the next shot: "dissolve" (8 fr) | "whip" (10 fr)
          (default: whip in the first 3 s, then dissolve 40% / whip 60%)
"""
import difflib, json, math, os, random, re, subprocess, sys, time
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import uniform_filter1d

W, H, FPS = 1080, 1920, 30
LINE_RGB = (39, 25, 37)          # measured line-art colour #271925
CAPTION_Y = 1350                 # measured caption centre (of 1920)
CAPTION_PX = 70                  # font size giving a ~60 px glyph band
DISSOLVE_FR, WHIP_FR = 8, 10     # measured median transition lengths
ARRIVE_GAIN = 0.7                # speed boost early in a shot (58 vs 37 px/s)

# ---------------------------------------------------------------- camera math
def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

def speed_profile(n):
    """Per-frame speed multiplier: 1 + 0.7 early, easing to 1.0 by 40% of the
    shot. Median is 1, so the shot's median speed equals the requested speed;
    mean of the first third / rest ~ 1.57, the measured 58/37 px/s ratio."""
    u = (np.arange(n) + 0.5) / n
    return 1 + ARRIVE_GAIN * (1 - smoothstep(0.15, 0.40, u))

def camera_path(n, pan=(0.0, 0.0), zoom_pct_s=6.0):
    """Returns per-frame (dx, dy, scale): picture offset in output px and zoom
    relative to frame 0.  Pan integrates v*m(t)*dt; zoom compounds:
    scale(t) = exp(ln(1 + z/100) * integral m dt)."""
    m = speed_profile(n)
    tt = np.cumsum(m) / FPS - m[0] / FPS          # "profile time", starts at 0
    dx = pan[0] * tt
    dy = pan[1] * tt
    scale = np.exp(math.log1p(zoom_pct_s / 100.0) * tt)
    return dx, dy, scale

# ---------------------------------------------------------------- rendering
def render_shot(img, n, pan, zoom):
    """Render n frames of a camera move over a still. A global cover scale g
    is raised until every frame's window stays inside the image."""
    img = img.convert("RGB")
    iw, ih = img.size
    dx, dy, s = camera_path(n, pan, zoom)
    g = max(W / iw, H / ih)
    for _ in range(200):
        ok = True
        for i in range(n):
            k = g * s[i]
            ww, wh = W / k, H / k
            cx = iw / 2 - dx[i] / k
            cy = ih / 2 - dy[i] / k
            if cx - ww / 2 < 0 or cy - wh / 2 < 0 or cx + ww / 2 > iw or cy + wh / 2 > ih:
                ok = False; break
        if ok: break
        g *= 1.02
    frames = []
    for i in range(n):
        k = g * s[i]
        cx = iw / 2 - dx[i] / k
        cy = ih / 2 - dy[i] / k
        # output (x, y) -> source (x/k + cx - W/2k, y/k + cy - H/2k)
        a = (1 / k, 0, cx - W / (2 * k), 0, 1 / k, cy - H / (2 * k))
        frames.append(np.asarray(img.transform((W, H), Image.AFFINE, a, Image.BICUBIC)))
    return frames

def dissolve(a, b):
    """Cross-dissolve the last DISSOLVE_FR frames of a into the first of b."""
    n = min(DISSOLVE_FR, len(a), len(b))
    out = []
    for i in range(n):
        t = (i + 1) / (n + 1)
        out.append((a[len(a) - n + i] * (1 - t) + b[i] * t).astype(np.uint8))
    return a[:len(a) - n] + out + b[n:]

def whip(a, b, direction=(1, 0)):
    """Camera-move transition: both shots slide past with eased motion and a
    directional blur, WHIP_FR frames overlapped."""
    n = min(WHIP_FR, len(a), len(b))
    out = []
    ddx, ddy = direction
    for i in range(n):
        t = smoothstep(0, 1, (i + 1) / (n + 1))
        off_a = (-ddx * t * W, -ddy * t * H)
        off_b = (ddx * (1 - t) * W, ddy * (1 - t) * H)
        canvas = Image.new("RGB", (W, H))
        for fr, off in ((a[len(a) - n + i], off_a), (b[i], off_b)):
            canvas.paste(Image.fromarray(fr), (int(off[0]), int(off[1])))
        blur = int(4 + 60 * math.sin(math.pi * (i + 1) / (n + 1)))
        arr = np.asarray(canvas).astype(np.float32)
        arr = uniform_filter1d(arr, size=blur, axis=1 if ddx else 0)
        out.append(arr.clip(0, 255).astype(np.uint8))
    return a[:len(a) - n] + out + b[n:]

def draw_captions(frames, text, font_path, words_per=1, frames_per=10):
    if not text: return frames
    import os
    cands = [font_path, os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts", "Montserrat-ExtraBold.ttf"),
             "/usr/share/fonts/truetype/montserrat/Montserrat-ExtraBold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
    path = next((c for c in cands if c and os.path.exists(c)), None)
    font = ImageFont.truetype(path, CAPTION_PX) if path else ImageFont.load_default(CAPTION_PX)
    words = text.split()
    groups = [" ".join(words[i:i + words_per]) for i in range(0, len(words), words_per)]
    out = []
    for i, fr in enumerate(frames):
        g = groups[min(i // frames_per, len(groups) - 1)]
        im = Image.fromarray(fr); d = ImageDraw.Draw(im)
        d.text((W // 2, CAPTION_Y), g, font=font, fill=(255, 255, 255), anchor="mm",
               stroke_width=8, stroke_fill=LINE_RGB)
        out.append(np.asarray(im))
    return out

def encode(frames, path):
    p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                          "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264",
                          "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", path],
                         stdin=subprocess.PIPE)
    for f in frames: p.stdin.write(np.ascontiguousarray(f).tobytes())
    p.stdin.close(); p.wait()
    if p.returncode: sys.exit("ffmpeg failed")

def build(scene_path, out_path, seed=7):
    sc = json.load(open(scene_path)); rnd = random.Random(seed)
    shots = sc["shots"]; t0 = 0.0; video = []
    for k, s in enumerate(shots):
        n = max(8, round(s.get("dur", 1.2) * FPS))
        if "pan" in s: pan = s["pan"]
        else:
            a = rnd.uniform(0, 2 * math.pi); pan = (44 * math.cos(a), 44 * math.sin(a))
        if "frames" in s:   # a pre-rendered sequence (e.g. from the three.js stage)
            import glob as _g
            fr = [np.asarray(Image.open(f).convert("RGB")) for f in sorted(_g.glob(s["frames"] + "/*.png"))]
        else:
            fr = render_shot(Image.open(s["image"]), n, pan, s.get("zoom", 6.0))
        if not video: video = fr
        else:
            kind = shots[k - 1].get("out") or ("whip" if t0 < 3 or rnd.random() < 0.6 else "dissolve")
            video = whip(video, fr, rnd.choice([(1, 0), (-1, 0), (0, 1), (0, -1)])) if kind == "whip" else dissolve(video, fr)
        t0 = len(video) / FPS
    video = draw_captions(video, sc.get("captions"), sc.get("font"), sc.get("words_per_caption", 1),
                          sc.get("frames_per_caption", 10))
    encode(video, out_path)
    print(f"wrote {out_path}: {len(video)} frames, {len(video) / FPS:.2f} s")

# ---------------------------------------------------------------- checker
TARGETS = {"pan_speed_med_px_s": (13, 118), "zoom_med_pct_s": (-15.5, 26.2), "locked_shot_pct_max": 9}
_GRID = {}                       # flow sample grid per frame size

def flow_fit(prev, g):
    """Farneback flow between two small grey frames, fitted to pan + uniform
    zoom on textured grid points only. Returns (dx, dy, zoom) per frame pair:
    pan in px at the frames' own size, zoom as a fraction (0.002 = +0.2 %)."""
    import cv2
    if prev.shape not in _GRID:
        h, w = prev.shape; ys, xs = np.mgrid[8:h - 8:8, 8:w - 8:8]
        _GRID[prev.shape] = (ys, xs, (xs - (w - 1) / 2).ravel(), (ys - (h - 1) / 2).ravel())
    ys, xs, px, py = _GRID[prev.shape]
    fl = cv2.calcOpticalFlowFarneback(prev, g, None, 0.5, 4, 21, 3, 5, 1.1, 0)
    fx = fl[ys, xs, 0].ravel(); fy = fl[ys, xs, 1].ravel()
    # only trust grid points with visible texture: flat CG colour fields
    # (sky, untextured ground) report zero flow whether or not the camera moves
    gm = cv2.magnitude(cv2.Sobel(prev, cv2.CV_32F, 1, 0, ksize=3), cv2.Sobel(prev, cv2.CV_32F, 0, 1, ksize=3))
    gm = cv2.dilate(gm, np.ones((7, 7), np.uint8))[ys, xs].ravel()
    keep = gm > 20
    if keep.sum() < 30: keep = np.ones(fx.size, bool)
    for _ in range(4):
        A = np.zeros((2 * keep.sum(), 3)); A[0::2, 0] = 1; A[1::2, 1] = 1
        A[0::2, 2] = px[keep]; A[1::2, 2] = py[keep]
        y = np.empty(2 * keep.sum()); y[0::2] = fx[keep]; y[1::2] = fy[keep]
        sol = np.linalg.lstsq(A, y, rcond=None)[0]
        res = np.hypot(fx - (sol[0] + sol[2] * px), fy - (sol[1] + sol[2] * py))
        keep = keep & (res <= max(np.percentile(res[keep], 70), 0.25))
    return sol

def check(video_path, step=1):
    """Measure camera speed and zoom per frame (Farneback flow fitted to pan +
    uniform zoom, as in the rulebook, on textured grid points only) and report
    against the rule ranges. step > 1 measures flow across that many frames
    and divides back down, which steadies very slow sub-pixel moves; on the
    test renders step 1 and 4 agree within 3 px/s."""
    import cv2
    cap = cv2.VideoCapture(video_path); gs = []; sp = []; zm = []
    while True:
        ok, f = cap.read()
        if not ok: break
        gs.append(cv2.cvtColor(cv2.resize(f, (270, 480), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY))
    for i in range(step, len(gs)):
        sol = flow_fit(gs[i - step], gs[i])
        sp.append(math.hypot(sol[0], sol[1]) * 4 * FPS / step); zm.append(sol[2] * FPS * 100 / step)
    sp = np.array(sp); zm = np.array(zm)
    r = {"frames": len(gs), "step": step, "pan_speed_med_px_s": round(float(np.median(sp)), 1),
         "zoom_med_pct_s": round(float(np.median(zm)), 2),
         "static_frames_pct": round(float((sp < 15).mean() * 100), 1)}
    lo, hi = TARGETS["pan_speed_med_px_s"]
    r["pan_speed_ok"] = lo <= r["pan_speed_med_px_s"] <= hi
    lo, hi = TARGETS["zoom_med_pct_s"]
    r["zoom_ok"] = lo <= r["zoom_med_pct_s"] <= hi
    print(json.dumps(r, indent=1)); return r

# ---------------------------------------------------------------- colour numbers
SMALL = 270                      # analysis size: short side in px (a Short becomes 270x480)
SAT_MIN = 0.12                   # at or below this saturation a pixel counts as neutral
INK_LUMA = 70                    # line art is darker than this
HUES = ("red_brown", "blue", "violet", "green_other")   # hue 330-60, 180-270, 270-330, 60-180

def small(bgr):
    """Downscale a BGR frame so its short side is 270 px, whatever the source
    size (a 1080p and a 4K Short both become 270x480)."""
    import cv2
    h, w = bgr.shape[:2]; k = SMALL / min(h, w)
    return cv2.resize(bgr, (round(w * k), round(h * k)), interpolation=cv2.INTER_AREA)

class Colour:
    """Colour numbers pooled over any number of small BGR frames. Only counts
    and histograms are kept, so frames and whole videos add up.
      shadows    : the darkest 20% of each frame (by luma)
      neutral    : saturation <= 0.12, or pure black (all channels < 10)
      thin lines : dark pixels (luma < 70) too narrow to hold a 5 px disc
                   (morphological opening at 270 px, scaled for other sizes)"""
    def __init__(self):
        self.s = {k: np.zeros(256) for k in ("luma", "sat", "shadow", "r", "g", "b")}
        self.s.update(band=np.zeros(5), sband=np.zeros(5), n=np.zeros(3))   # hue bands (4 = neutral); px, black, ink
        self.frame_luma = []; self.frame_shadow = []

    def add(self, bgr):
        import cv2
        s = self.s; luma = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY); l = luma.ravel()
        hsv = cv2.cvtColor(bgr.astype(np.float32) / 255, cv2.COLOR_BGR2HSV).reshape(-1, 3)   # H 0-360, S 0-1
        val = bgr.max(axis=2).ravel(); black = val < 10; hue = hsv[:, 0]; sat = np.where(black, 0, hsv[:, 1])
        band = np.where(sat <= SAT_MIN, 4, np.where((hue >= 330) | (hue < 60), 0,
                                                    np.where(hue < 180, 3, np.where(hue < 270, 1, 2))))
        sh = np.argpartition(l, l.size // 5)[:l.size // 5]                   # this frame's darkest 20%
        dark = (luma < INK_LUMA).astype(np.uint8); k = max(3, round(5 * min(luma.shape) / SMALL)) | 1
        disc = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
        thin = (dark > 0) & (cv2.morphologyEx(dark, cv2.MORPH_OPEN, disc) == 0)
        s["luma"] += np.bincount(l, minlength=256); s["shadow"] += np.bincount(val[sh], minlength=256)
        s["sat"] += np.bincount(np.round(sat * 255).astype(int), minlength=256)
        for i, ch in enumerate("bgr"): s[ch] += np.bincount(bgr[..., i][thin], minlength=256)
        s["band"] += np.bincount(band, minlength=5); s["sband"] += np.bincount(band[sh], minlength=5)
        s["n"] += (l.size, black.sum(), thin.sum())
        self.frame_luma.append(float(l.mean())); self.frame_shadow.append(float(np.median(val[sh])))
        return self

    def merge(self, other):
        for k in self.s: self.s[k] += other.s[k]
        self.frame_luma += other.frame_luma; self.frame_shadow += other.frame_shadow
        return self

    def stats(self):
        """Numbers named after references/rules.json where it has the same one."""
        s = self.s; px = max(s["n"][0], 1); lv = np.arange(256)
        def pct(h, p): return int(min(np.searchsorted(np.cumsum(h), p / 100 * h.sum()), 255))   # percentile of a histogram
        def share(a, b): return round(float(100 * a / max(b, 1)), 1)
        mean = float((s["luma"] * lv).sum() / px); line = [pct(s[ch], 50) for ch in "rgb"] if s["n"][2] else None
        return {"luma_mean": round(mean, 1),
                "contrast_rms": round(math.sqrt(max(float((s["luma"] * lv * lv).sum() / px) - mean * mean, 0)), 1),
                "luma_p5": pct(s["luma"], 5), "luma_p95": pct(s["luma"], 95),
                "shadow_value_median_0_255": pct(s["shadow"], 50),
                "shadow_hue_share_pct": {h: share(s["sband"][i], s["sband"][:4].sum()) for i, h in enumerate(HUES)},
                "shadow_neutral_pct": share(s["sband"][4], s["sband"].sum()),
                "palette_sat_median": round(pct(s["sat"], 50) / 255, 3),
                "palette_hue_area_pct": {"warm_330_60": share(s["band"][0], s["band"][:4].sum()),
                                         "blue_180_270": share(s["band"][1], s["band"][:4].sum())},
                "pure_black_pct": round(float(100 * s["n"][1] / px), 2),
                "ink_density_pct": round(float(100 * s["n"][2] / px), 2),
                "line_rgb_median": line, "line_hex": "#%02x%02x%02x" % tuple(line) if line else None}

def load_frames(path, count=24):
    """Small BGR frames of an image (one) or a video (up to count, spread evenly)."""
    import cv2
    try: return [small(np.ascontiguousarray(np.asarray(Image.open(path).convert("RGB"))[:, :, ::-1]))]
    except Exception: pass           # not an image: read it as a video
    cap = cv2.VideoCapture(path); total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0); out = []
    if total <= 0:                   # container without a frame count: count by decoding
        while cap.grab(): total += 1
        cap.release(); cap = cv2.VideoCapture(path)
    m = min(count, total)
    for i in sorted({int((k + 0.5) * total / m) for k in range(m)}):
        cap.set(cv2.CAP_PROP_POS_FRAMES, i); ok, f = cap.read()
        if ok: out.append(small(f))
    if not out: sys.exit("cannot read " + path)
    return out

def flat(d, pre=""):
    """{"a": {"b": 1}} -> {"a.b": 1}, numbers only."""
    out = {}
    for k, v in d.items():
        if isinstance(v, dict): out.update(flat(v, pre + k + "."))
        elif isinstance(v, (int, float)): out[pre + k] = v
    return out

# what compare says about a gap: metric, scale that makes gaps comparable, group
# (one line per group), x100 for the text, "<what> N points", then the word and
# the fix when ours is lower, and the word and the fix when ours is higher
EXPO = "moods.*.exposure, or sun.intensity and fill.intensity together"
GAPS = [
    ("luma_mean", 20, "luma", 1, "the picture is", "darker", "raise " + EXPO, "brighter", "lower " + EXPO),
    ("contrast_rms", 12, "contrast", 1, "contrast is",
     "lower", "raise moods.*.sun.intensity and lower fill.intensity so lit and shaded sides differ more",
     "higher", "lower moods.*.sun.intensity or raise fill.intensity"),
    ("luma_p95", 20, "high", 1, "the brightest areas are", "dimmer", "raise moods.*.sun.intensity or exposure",
     "brighter", "lower moods.*.sun.intensity or exposure"),
    ("luma_p5", 15, "shadow", 1, "the darkest areas are", "darker", "lower contactShadow and raise moods.*.fill.intensity",
     "lighter", "raise contactShadow or lower moods.*.fill.intensity"),
    ("shadow_value_median_0_255", 15, "shadow", 1, "shadows are", "darker", "raise fill.intensity or lighten fill.ground",
     "lighter", "lower fill.intensity or darken fill.ground"),
    ("shadow_hue_share_pct.red_brown", 20, "shadow hue", 1, "shadows are",
     "less red-brown", "move fill.ground toward a warm plum or brown and warm up ground/prop colours",
     "more red-brown", "move fill.ground and fill.sky toward blue or violet"),
    ("shadow_hue_share_pct.blue", 20, "shadow hue", 1, "shadows are",
     "less blue", "make fill.sky bluer or stronger", "more blue", "move fill.sky and fill.ground toward plum or brown"),
    ("shadow_hue_share_pct.violet", 20, "shadow hue", 1, "shadows are",
     "less violet", "move fill.ground toward violet or plum (#6a3b6e is the house colour)",
     "more violet", "move fill.ground toward brown, or fill.sky toward blue"),
    ("shadow_hue_share_pct.green_other", 20, "shadow hue", 1, "shadows are",
     "less green or yellow", "let the fill.ground colour follow the ground colour a little more",
     "more green or yellow", "take the green out of fill.ground, fill.sky and the ground colour"),
    ("shadow_neutral_pct", 15, "neutral", 1, "shadows are",
     "less grey", "use weaker fill.ground and fill.sky colours",
     "more grey", "give fill.ground and fill.sky a stronger colour; they tint the shadows"),
    ("palette_sat_median", 0.10, "sat", 100, "colours are",
     "less saturated", "use stronger ground/prop colours and textures; if it looks washed out, lower moods.*.exposure",
     "more saturated", "mute the ground/prop colours and textures"),
    ("palette_hue_area_pct.warm_330_60", 20, "palette", 1, "the picture is",
     "less warm (reds, oranges, browns)", "use warmer ground/prop colours and textures, or a warmer sun colour",
     "more warm (reds, oranges, browns)", "use cooler ground/prop colours, or a bluer fill.sky"),
    ("palette_hue_area_pct.blue_180_270", 20, "palette", 1, "the picture is",
     "less blue", "use a bluer fill.sky and sky, or add blue to ground/prop colours",
     "more blue", "use warmer ground/prop colours and textures, or a less blue fill.sky"),
    ("pure_black_pct", 2, "black", 1, "the picture has",
     "less pure black", "nothing to fix unless the reference is a night scene; then lower moods.*.fill.intensity",
     "more pure black", "lower contactShadow and raise moods.*.fill.intensity; this style has almost no pure black"),
    ("ink_density_pct", 1.5, "ink", 1, "the picture has",
     "less outline", "raise ink.set, or use ground/prop textures with drawn lines; lower backdrop.blur if the backdrop is mush",
     "more outline", "lower ink.set, or raise backdrop.blur to soften a busy backdrop"),
]

def compare(ours, ref, json_path=None):
    """Colour numbers of our frame/video next to the reference, then the 3-5
    largest gaps (each gap divided by that metric's scale) with a fix."""
    def num(x): return "%d" % round(x) if abs(x) >= 10 or float(x).is_integer() else "%.1f" % x
    sides = []
    for p in (ours, ref):
        fr = load_frames(p); col = Colour()
        for f in fr: col.add(f)
        sides.append(dict(col.stats(), path=p, frames=len(fr)))
    a, b = flat(sides[0]), flat(sides[1]); keys = [k for k in a if k in b and k not in ("frames",)]
    wid = max(len(k) for k in keys)
    print("%-*s | %8s | %8s | %8s" % (wid, "metric", "ours", "ref", "diff"))
    for k in keys: print("%-*s | %8g | %8g | %+8g" % (wid, k, a[k], b[k], round(a[k] - b[k], 3)))
    ranked = sorted(((abs(a[g[0]] - b[g[0]]) / g[1], g) for g in GAPS), key=lambda t: -t[0])
    hints = []; seen = set()
    for score, (key, _, group, mul, what, lo_word, lo_fix, hi_word, hi_fix) in ranked:
        if group in seen or len(hints) == 5 or score < (0.5 if len(hints) >= 3 else 0.1): continue
        seen.add(group); d = (a[key] - b[key]) * mul; pc = "%" if "pct" in key or mul == 100 else ""
        hints.append("%s %s points %s than the reference (%s%s vs %s%s): %s" % (
            what, num(abs(d)), lo_word if d < 0 else hi_word, num(a[key] * mul), pc, num(b[key] * mul), pc,
            lo_fix if d < 0 else hi_fix))
    print("\nlargest gaps" if hints else "\nno gap worth fixing")
    for h in hints: print("- " + h)
    if json_path:
        with open(json_path, "w") as fh:
            json.dump({"ours": sides[0], "ref": sides[1], "diff": {k: round(a[k] - b[k], 3) for k in keys},
                       "hints": hints}, fh, indent=1)
    return sides, hints

# ---------------------------------------------------------------- reference measurement
VIDEO_EXT = (".mp4", ".mov", ".webm", ".mkv")
SHEET_COLS, TILE_W = 10, 108     # a sheet is 10 thumbnails = 1080 px wide

def find_cuts(d, c):
    """Frame numbers that start a new shot after a hard cut. d = mean absolute
    luma change from the previous frame, c = 1 - correlation with it. A cut
    is one frame that stops resembling the last (c >= 0.45) and stands alone:
    a dissolve or a whip spreads the change over several frames, so its
    neighbours are as high and nothing is counted."""
    cuts = []
    for i in range(len(c)):
        near = c[max(0, i - 2):i] + c[i + 1:i + 3] + [0.0]
        if c[i] >= 0.45 and d[i] >= 6 and c[i] >= 2.5 * max(near): cuts.append(i + 1)
    return cuts

def style_numbers(raw):
    """The report shared by one video and the aggregate, from per-frame speed
    (px/s at 1080 wide) and zoom (%/s), shot lengths and pooled colour."""
    def q(a, ps, nd=1): return [round(float(v), nd) for v in np.percentile(a, ps)] if len(a) else [None] * len(ps)
    def share(m): return round(float(np.mean(m)) * 100, 1) if len(m) else None
    sp, zm, shots, col = raw["sp"], raw["zm"], raw["shots"], raw["col"]; st = col.stats()
    line = {"rgb_median": st.pop("line_rgb_median"), "hex": st.pop("line_hex"), "ink_density_pct": st.pop("ink_density_pct")}
    st["frame_luma_mean"] = {"median": q(col.frame_luma, [50])[0], "p10_p90": q(col.frame_luma, [10, 90])}
    st["shadow_value_range"] = q(col.frame_shadow, [10, 90], 0)
    return {"pacing": {"hard_cuts": raw["cuts"], "shots": len(shots),
                       "hard_cuts_per_min": round(raw["cuts"] * 60 / max(raw["seconds"], 1e-6), 1),
                       "shot_len_s": {"median": q(shots, [50], 2)[0], "p10_p90": q(shots, [10, 90], 2),
                                      "min": q(shots, [0], 2)[0], "max": q(shots, [100], 2)[0]}},
            "camera": {"speed_px_s": {"median": q(sp, [50])[0], "iqr": q(sp, [25, 75]), "p90": q(sp, [90])[0]},
                       "zoom_pct_s": {"median": q(zm, [50], 2)[0], "iqr": q(zm, [25, 75], 2), "p10_p90": q(zm, [10, 90], 2)},
                       "static_frames_pct": share(sp < 15), "locked_frames_pct": share((sp < 15) & (np.abs(zm) < 2)),
                       "push_in_pct": share(zm > 1), "pull_out_pct": share(zm < -1)},
            "colour": st, "line": line}

def print_style(name, r):
    p, cam, co, li = r["pacing"], r["camera"], r["colour"], r["line"]; hue = co["shadow_hue_share_pct"]
    print(name)
    print("  cuts    %d hard cuts, %d shots, shot length median %s s (p10-p90 %s to %s)" % (
        p["hard_cuts"], p["shots"], p["shot_len_s"]["median"], *p["shot_len_s"]["p10_p90"]))
    print("  camera  speed median %s px/s (quartiles %s to %s, p90 %s); zoom median %s %%/s; static %s%%, push-in %s%%, pull-out %s%%" % (
        cam["speed_px_s"]["median"], *cam["speed_px_s"]["iqr"], cam["speed_px_s"]["p90"], cam["zoom_pct_s"]["median"],
        cam["static_frames_pct"], cam["push_in_pct"], cam["pull_out_pct"]))
    print("  colour  frame luma median %s (p10-p90 %s to %s); shadows %s, %s%% neutral, hue %s; saturation %s; warm %s%%, blue %s%%; pure black %s%%" % (
        co["frame_luma_mean"]["median"], *co["frame_luma_mean"]["p10_p90"], co["shadow_value_median_0_255"],
        co["shadow_neutral_pct"], " / ".join("%s %s%%" % (h, hue[h]) for h in HUES), co["palette_sat_median"],
        co["palette_hue_area_pct"]["warm_330_60"], co["palette_hue_area_pct"]["blue_180_270"], co["pure_black_pct"]))
    print("  line    colour %s, on %s%% of the picture" % (li["hex"], li["ink_density_pct"]))

def measure_video(path, sheet_dir):
    """One pass over a video: reference sheets, the cut signal, camera flow
    and colour. Returns (report, raw); raw feeds the aggregate."""
    import cv2
    cap = cv2.VideoCapture(path); fps = cap.get(cv2.CAP_PROP_FPS)
    if not 1 <= fps <= 240: fps = 30.0                # missing or nonsense frame rate
    per = max(1, round(2 * fps)); rows = -(-per // SHEET_COLS)   # frames and rows per 2 s sheet
    step = max(1, round(fps / 30))                    # flow is measured across ~1/30 s, so 60 fps uses every 2nd frame
    stem = os.path.splitext(os.path.basename(path))[0]; col = Colour()
    tiles = []; d = []; c = []; sp = []; zm = []; at = []; n = sheets = 0; ref = last = size = None

    def flush():
        th = tiles[0].shape[0]; sheet = np.full((rows * th, SHEET_COLS * TILE_W, 3), 40, np.uint8)
        for k, t in enumerate(tiles):
            y = k // SHEET_COLS * th; x = k % SHEET_COLS * TILE_W; sheet[y:y + th, x:x + TILE_W] = t
        Image.fromarray(cv2.cvtColor(sheet, cv2.COLOR_BGR2RGB)).save(
            os.path.join(sheet_dir, "%s_%04d.jpg" % (stem, sheets)), quality=88)

    while True:
        ok, f = cap.read()
        if not ok: break
        if size is None: size = [f.shape[1], f.shape[0]]
        s = small(f); g = cv2.cvtColor(s, cv2.COLOR_BGR2GRAY)
        tiles.append(cv2.resize(s, (TILE_W, round(TILE_W * s.shape[0] / s.shape[1])), interpolation=cv2.INTER_AREA))
        if len(tiles) == per: flush(); sheets += 1; tiles = []
        t = cv2.resize(g, (g.shape[1] // 5, g.shape[0] // 5), interpolation=cv2.INTER_AREA).astype(np.float32)
        z = t - t.mean(); sd = float(z.std())
        if last is not None:
            d.append(float(np.abs(t - last[0]).mean())); c.append(1 - float((z * last[1]).mean()) / (sd * last[2] + 1e-3))
        last = (t, z, sd)
        if n % step == 0:
            if ref is not None:
                sol = flow_fit(ref, g); at.append(n)
                sp.append(math.hypot(sol[0], sol[1]) * 1080 / g.shape[1] * fps / step); zm.append(sol[2] * 100 * fps / step)
            ref = g
        if n % 5 == 0: col.add(s)
        n += 1
    if tiles: flush(); sheets += 1
    if not n: sys.exit("no frames in " + path)
    cuts = find_cuts(d, c); at = np.array(at); keep = np.ones(len(at), bool)
    for k in cuts: keep &= ~((at - step < k) & (k <= at))          # flow across a cut means nothing
    raw = {"sp": np.repeat(np.array(sp)[keep], step), "zm": np.repeat(np.array(zm)[keep], step),
           "shots": np.diff([0] + cuts + [n]) / fps, "cuts": len(cuts), "col": col, "frames": n, "seconds": n / fps}
    rep = {"file": os.path.basename(path), "width": size[0], "height": size[1], "fps": round(fps, 3), "frames": n,
           "length_s": round(n / fps, 2), "sheets": sheets, "cut_times_s": [round(k / fps, 2) for k in cuts]}
    rep.update(style_numbers(raw))
    return rep, raw

def measure(src, out_dir):
    """Measure one video, or every .mp4/.mov/.webm/.mkv in a folder. Writes
    out_dir/sheets/<video>_<NNNN>.jpg (sheet NNNN holds every frame of seconds
    2*NNNN to 2*NNNN+2, left to right, top to bottom) and
    out_dir/measured.json: one block per video plus an aggregate that pools
    all frames, so longer videos weigh more."""
    if os.path.isdir(src):
        vids = sorted(os.path.join(src, f) for f in os.listdir(src) if f.lower().endswith(VIDEO_EXT) and not f.startswith("."))
    else: vids = [src]
    if not vids: sys.exit("no videos in " + src)
    sheet_dir = os.path.join(out_dir, "sheets"); os.makedirs(sheet_dir, exist_ok=True); reps = []; raws = []
    for v in vids:
        rep, raw = measure_video(v, sheet_dir); reps.append(rep); raws.append(raw)
        print_style("%s: %dx%d, %s fps, %d frames, %s s, %d sheets" % (
            rep["file"], rep["width"], rep["height"], rep["fps"], rep["frames"], rep["length_s"], rep["sheets"]), rep)
    agg = {k: np.concatenate([r[k] for r in raws]) for k in ("sp", "zm", "shots")}
    agg.update({k: sum(r[k] for r in raws) for k in ("cuts", "frames", "seconds")}); agg["col"] = Colour()
    for r in raws: agg["col"].merge(r["col"])
    out = {"source": "%d video(s), %d frames, %d sheets; measured %s" % (
               len(vids), agg["frames"], sum(r["sheets"] for r in reps), time.strftime("%Y-%m-%d")),
           "notes": {"camera": "speed in px/s at 1080 wide and zoom in %/s per frame, frames across a hard cut left out; "
                               "static = speed < 15 px/s, locked = static and |zoom| < 2 %/s, push-in / pull-out = zoom beyond +-1 %/s",
                     "pacing": "shots are split at hard cuts only; dissolves and camera-move transitions do not end a shot",
                     "colour": "every 5th frame at 270 px; shadows = darkest 20% of each frame; hue shares among pixels with "
                               "saturation > 0.12; frame_luma_mean is per frame (rules.json has it per shot)",
                     "line": "median RGB of thin dark line pixels (luma < 70, narrower than 5 px at 270 px)"},
           "videos": reps, "aggregate": style_numbers(agg)}
    with open(os.path.join(out_dir, "measured.json"), "w") as fh: json.dump(out, fh, indent=1)
    if len(vids) > 1: print_style("aggregate: %d videos, %d frames" % (len(vids), agg["frames"]), out["aggregate"])
    print("wrote %s and %d sheets in %s" % (os.path.join(out_dir, "measured.json"), sum(r["sheets"] for r in reps), sheet_dir))
    return out

# ---------------------------------------------------------------- word timing
SR = 16000                       # audio is analysed as mono 16 kHz
PAUSE = 0.25                     # a silence this long is a clear pause
SENT_END = re.compile(r"[.!?…][\"'”’)\]]*$")
CLAUSE_END = re.compile(r"[,;:—–][\"'”’)\]]*$")
VOWELS = "aeiouyаеёиоуыэюя"
SHORT_WORDS = {"a", "an", "the", "of", "to", "in", "on", "at", "and", "or", "is", "it", "as", "for", "by"}

def norm(w): return re.sub(r"[\W_]+", "", w.lower())

def word_weight(w):
    """Rough spoken length of a word: estimated syllables, a bit per consonant,
    and a little extra when it ends a clause or a sentence (speakers stretch
    the last word before a break)."""
    s = norm(w); syl = len(re.findall("[%s]+" % VOWELS, s)); digits = sum(ch.isdigit() for ch in s)
    if syl > 1 and re.search(r"[^aeiouyl]e$|[^aeiouy]es$|[^aeiouytd]ed$", s): syl -= 1    # make, makes, walked
    cons = len(s) - digits - sum(ch in VOWELS for ch in s)
    wt = max(syl, 1 if cons else 0) + 0.35 * cons + 2.5 * digits or 0.2      # 0.2: a lone dash or symbol
    if s in SHORT_WORDS: wt *= 0.6
    return wt + (1.0 if SENT_END.search(w) else 0.5 if CLAUSE_END.search(w) else 0)

def decode_audio(path):
    """Mono 16 kHz float samples of any audio or video file ffmpeg can read."""
    p = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(SR),
                        "-f", "s16le", "-"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode or not p.stdout:
        sys.exit("ffmpeg found no audio in %s: %s" % (path, p.stderr.decode(errors="replace").strip()[-300:]))
    return np.frombuffer(p.stdout[:len(p.stdout) // 2 * 2], np.int16).astype(np.float32) / 32768

def voiced_regions(x):
    """[(start, end)] in seconds where someone is speaking: short-time RMS
    (25 ms window, 10 ms hop) above a threshold set between the track's quiet
    level (5th percentile, at most 50 dB down) and its loud level (95th);
    gaps under 120 ms are closed and blips under 60 ms dropped."""
    hop, win = SR // 100, SR // 40
    if len(x) < win: return []
    cs = np.concatenate([[0.0], np.cumsum(x.astype(np.float64) ** 2)]); i0 = np.arange(1 + (len(x) - win) // hop) * hop
    e = 10 * np.log10((cs[i0 + win] - cs[i0]) / win + 1e-12)
    hi = np.percentile(e, 95); lo = max(np.percentile(e, 5), hi - 50)
    v = e > min(max(lo + 0.45 * (hi - lo), hi - 30), hi - 8)
    edge = np.diff(np.concatenate([[0], v.astype(np.int8), [0]])); reg = []
    for a, b in zip(np.where(edge == 1)[0], np.where(edge == -1)[0]):       # frames [a, b)
        if reg and a - reg[-1][1] < 12: reg[-1][1] = b
        else: reg.append([a, b])
    off = (win - hop) / 2 / SR
    return [(a * hop / SR + off, b * hop / SR + off) for a, b in reg if b - a >= 6]

def match_pauses(u, v, bonus, tol):
    """Pair sentence ends (expected at voiced second u[k], give or take tol[k])
    with pauses (at v[j]) in order, as many and as close as possible. Returns
    [(k, j)]."""
    best = np.zeros((len(u) + 1, len(v) + 1))
    def gain(k, j): return 1 - abs(u[k] - v[j]) / tol[k] + bonus[j] if abs(u[k] - v[j]) <= tol[k] else -1
    for k in range(len(u)):
        for j in range(len(v)):
            best[k + 1, j + 1] = max(best[k, j + 1], best[k + 1, j], best[k, j] + gain(k, j))
    out = []; k, j = len(u), len(v)
    while k and j:
        if best[k, j] == best[k - 1, j]: k -= 1
        elif best[k, j] == best[k, j - 1]: j -= 1
        else: out.append((k - 1, j - 1)); k -= 1; j -= 1
    return out[::-1]

def energy_times(script, x, dur):
    """Built-in estimate. Words are spread over the voiced seconds of the track
    in proportion to their weights. Sentence ends are pinned to clear pauses
    where the two line up in order (skipped when the counts are too far apart
    to trust), and every other clear pause takes the nearest word boundary, so
    no word runs across a silence. Returns ([(t0, t1)], note)."""
    reg = voiced_regions(x) or [(0.0, dur)]
    st = np.array([a for a, _ in reg]); en = np.array([b for _, b in reg])
    cv = np.concatenate([[0.0], np.cumsum(en - st)]); tv = cv[-1]                # voiced seconds before each region
    n = len(script); cw = np.concatenate([[0.0], np.cumsum([word_weight(w) for w in script])])
    pos = cw * tv / cw[-1]                                                       # word edges in voiced seconds
    pauses = [r for r in range(1, len(reg)) if st[r] - en[r - 1] >= PAUSE]       # pause just before region r
    ends = [i + 1 for i in range(n - 1) if SENT_END.search(script[i])]           # word edge after each sentence
    pin = {}                                                                     # pause -> word edge
    if ends and pauses and 0.5 * len(ends) <= len(pauses) <= 2 * len(ends) + 1:
        bonus = [0.3 * min(st[r] - en[r - 1], 1.0) for r in pauses]              # longer pauses are likelier sentence ends
        for _ in range(3):
            known = np.array([0.0] + [cv[r] for r in pin] + [tv]); u = pos[ends]
            tol = 0.3 + 0.3 * np.sqrt(np.abs(u[:, None] - known[None, :]).min(axis=1))   # drift grows away from a pinned point
            new = {pauses[j]: ends[k] for k, j in match_pauses(u, cv[pauses], bonus, tol)}
            if new == pin: break
            pin = new; ks = sorted(pin.items())
            pos = np.interp(cw, [0.0] + [cw[i] for _, i in ks] + [cw[-1]], [0.0] + [cv[r] for r, _ in ks] + [tv])
    snapped = len(pin)
    for r in pauses:
        if r not in pin: pin[r] = int(np.abs(pos - cv[r]).argmin())
    knots = [(0, 0.0)] + sorted((i, cv[r]) for r, i in pin.items()) + [(n, tv)]
    a = np.zeros(n); b = np.zeros(n)
    for (ka, va), (kb, vb) in zip(knots, knots[1:]):                             # words ka..kb-1 share voiced va..vb
        if kb > ka:
            seg = va + (cw[ka:kb + 1] - cw[ka]) * (vb - va) / (cw[kb] - cw[ka])
            a[ka:kb] = seg[:-1]; b[ka:kb] = seg[1:]; a[ka] = va; b[kb - 1] = vb
    ra = np.clip(np.searchsorted(cv, a, side="right") - 1, 0, len(reg) - 1)      # a word starts after a pause ...
    rb = np.clip(np.searchsorted(cv, b, side="left") - 1, 0, len(reg) - 1)       # ... and ends before one
    note = "%.1f s voiced in %d stretches, %d clear pauses, %d of %d sentence ends pinned to a pause" % (
        tv, len(reg), len(pauses), snapped, len(ends))
    return list(zip(st[ra] + a - cv[ra], st[rb] + b - cv[rb])), note

def whisper_words(path):
    """[(word, t0, t1)] from faster-whisper or openai-whisper, or None when
    neither is installed or the model cannot be loaded (nothing is installed
    or downloaded on purpose here)."""
    name = os.environ.get("SHORTKIT_WHISPER_MODEL", "base")
    try:
        from faster_whisper import WhisperModel
        segs, _ = WhisperModel(name, compute_type="int8").transcribe(path, word_timestamps=True)
        return [(w.word, w.start, w.end) for s in segs for w in (s.words or [])]
    except ImportError: pass
    except Exception as e: print("faster_whisper failed (%s)" % e, file=sys.stderr)
    try:
        import whisper
        r = whisper.load_model(name).transcribe(path, word_timestamps=True)
        return [(w["word"], w["start"], w["end"]) for s in r["segments"] for w in s.get("words", [])]
    except ImportError: return None
    except Exception as e: print("whisper failed (%s)" % e, file=sys.stderr)

def align(script, heard, dur):
    """Times for the script words from a transcript. Words that match (case
    and punctuation ignored) take the heard times; a run that does not match
    shares the stretch of whatever was heard in its place, or the gap between
    its matched neighbours, in proportion to word weight."""
    hw = [(norm(w), a, b) for w, a, b in heard if norm(w)]; t = [None] * len(script)
    ops = difflib.SequenceMatcher(None, [norm(w) for w in script], [h[0] for h in hw], autojunk=False).get_opcodes()
    for tag, i1, i2, j1, j2 in ops:
        if tag == "equal":
            for k in range(i2 - i1): t[i1 + k] = hw[j1 + k][1:]
    for tag, i1, i2, j1, j2 in ops:
        if tag in ("replace", "delete"):
            if tag == "replace": a, b = hw[j1][1], hw[j2 - 1][2]
            else:
                a = t[i1 - 1][1] if i1 else None; b = t[i2][0] if i2 < len(script) else None
                if a is None: a = max(0.0, (dur if b is None else b) - 0.3 * (i2 - i1))
                if b is None: b = min(dur, a + 0.3 * (i2 - i1))
            cw = np.cumsum([0.0] + [word_weight(w) for w in script[i1:i2]]); cw = a + cw / cw[-1] * max(b - a, 0)
            for k in range(i2 - i1): t[i1 + k] = (cw[k], cw[k + 1])
    return t

def tidy(script, times, dur):
    """Word entries with times inside [0, dur], in order, never overlapping,
    every word at least 30 ms long (less only if the track is too short)."""
    eps = min(0.03, dur / (2 * len(script) + 1)); t0 = [float(a) for a, _ in times]; t1 = [float(b) for _, b in times]; t = 0.0
    for i in range(len(script)):                      # forward: push late whatever starts too early
        t0[i] = max(t0[i], t); t1[i] = max(t1[i], t0[i] + eps); t = t1[i]
    t = dur
    for i in reversed(range(len(script))):            # backward: pull in whatever now runs past the end
        t1[i] = min(t1[i], t); t0[i] = min(t0[i], t1[i] - eps); t = t0[i]
    return [{"w": w, "t0": round(max(a, 0.0), 2), "t1": round(b, 2)} for w, a, b in zip(script, t0, t1)]

def words(audio, script_path, out=None):
    """Write words.json (references/formats.md): one entry per whitespace-
    separated word of the script, original spelling kept."""
    with open(script_path, encoding="utf-8") as fh: script = fh.read().split()
    if not script: sys.exit("no words in " + script_path)
    x = decode_audio(audio); dur = len(x) / SR; heard = whisper_words(audio)
    if heard: method, times, note = "whisper", align(script, heard, dur), "%d words heard" % len(heard)
    else: method = "energy"; times, note = energy_times(script, x, dur)
    ws = tidy(script, times, dur); out = out or os.path.join(os.path.dirname(os.path.abspath(audio)), "words.json")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write('{"audio": %s, "duration": %s, "method": "%s",\n "words": [\n  %s\n ]}\n' % (
            json.dumps(os.path.basename(audio)), round(dur, 2), method,
            ",\n  ".join(json.dumps(w, ensure_ascii=False) for w in ws)))
    print("wrote %s: %d words over %.2f s, method %s (%s)" % (out, len(ws), dur, method, note))
    return ws

def opt(args, flag):
    """Value after a flag such as -o, or None."""
    return args[args.index(flag) + 1] if flag in args[:-1] else None

if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "build": build(sys.argv[2], sys.argv[3])
    elif len(sys.argv) >= 3 and sys.argv[1] == "check":
        check(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 1)
    elif len(sys.argv) >= 4 and sys.argv[1] == "words": words(sys.argv[2], sys.argv[3], opt(sys.argv, "-o"))
    elif len(sys.argv) >= 4 and sys.argv[1] == "compare": compare(sys.argv[2], sys.argv[3], opt(sys.argv, "--json"))
    elif len(sys.argv) >= 4 and sys.argv[1] == "measure": measure(sys.argv[2], sys.argv[3])
    else: print(__doc__)
