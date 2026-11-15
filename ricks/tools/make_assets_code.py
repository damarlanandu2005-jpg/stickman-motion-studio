#!/usr/bin/env python3
"""Code-drawn replacements for the Gemini assets (used when Gemini billing is unavailable): doodle characters (rigged layers +
12 faces), hats, seamless textures and wide backdrops. Writes into ricks/library and registers in catalog.json.
usage: make_assets_code.py [chars|hats|tex|bd ...]"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter
HERE = os.path.dirname(os.path.abspath(__file__)); LIB = os.path.normpath(os.path.join(HERE, "..", "library"))
INK = (30, 20, 30, 255); SS = 2
def hx(c, a=255): c = c.lstrip("#"); return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), a)
def shade(c, f): return tuple(max(0, min(255, int(v * f))) for v in c[:3]) + (255,)
def S(v): return [int(round(x * SS)) for x in v] if isinstance(v, (list, tuple)) else int(round(v * SS))
class Cv:
    def __init__(s, w, h): s.w, s.h = w, h; s.im = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    def mask(s, fn):
        m = Image.new("L", s.im.size, 0); fn(ImageDraw.Draw(m)); return m
    def fill(s, m, col, ow=6, clip=None):
        if clip is not None: from PIL import ImageChops; m = ImageChops.multiply(m, clip)
        if ow:
            ink = m.filter(ImageFilter.MaxFilter(2 * S(ow) // 2 * 2 + 1)); s.im.paste(Image.new("RGBA", s.im.size, INK), (0, 0), ink)
        s.im.paste(Image.new("RGBA", s.im.size, col), (0, 0), m)
    def ell(s, box, col, ow=6): s.fill(s.mask(lambda d: d.ellipse(S(box), fill=255)), col, ow)
    def poly(s, pts, col, ow=6): s.fill(s.mask(lambda d: d.polygon([tuple(S(p)) for p in pts], fill=255)), col, ow)
    def rrect(s, box, r, col, ow=6): s.fill(s.mask(lambda d: d.rounded_rectangle(S(box), S(r), fill=255)), col, ow)
    def line(s, pts, w=8, col=INK):
        d = ImageDraw.Draw(s.im); pp = [tuple(S(p)) for p in pts]; d.line(pp, fill=col, width=S(w), joint="curve")
        for p in (pp[0], pp[-1]): r = S(w) / 2; d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=col)
    def arc(s, box, a0, a1, w=8, col=INK): ImageDraw.Draw(s.im).arc(S(box), a0, a1, fill=col, width=S(w))
    def out(s): return s.im.resize((s.w, s.h), Image.LANCZOS)

# ---------------- characters ----------------
FACE_NAMES = ["happy", "nervous", "shocked", "shouting", "confused", "neutral", "sad", "angry", "scared", "laughing", "smug", "crying"]
EX = {  # eyes, brows (inner dy, outer dy) left/right, mouth, extra
 "neutral": ("dot", (0, 0), (0, 0), "flat", None), "happy": ("arc_up", (-10, -4), (-10, -4), "smile", None), "nervous": ("dot", (-16, 2), (-16, 2), "wavy", "sweat"),
 "shocked": ("wide", (-26, -26), (-26, -26), "o", None), "shouting": ("dot", (10, -6), (10, -6), "shout", None), "confused": ("dot", (-4, -4), (-24, -24), "squig", None),
 "sad": ("dot", (-16, 6), (-16, 6), "frown", None), "angry": ("dot", (14, -8), (14, -8), "grit", None), "scared": ("wide", (-22, -8), (-22, -8), "tremble", "sweat"),
 "laughing": ("arc_up", (-12, -6), (-12, -6), "laugh", None), "smug": ("half", (-2, -10), (-2, -10), "smirk", None), "crying": ("arc_down", (-16, 6), (-16, 6), "cry", "tears")}
def draw_head(sp, ex):
    W, H = 440, 420; c = Cv(W, H); skin = hx(sp.get("skin", "#fcf7e8")); hair = hx(sp.get("hair", "#2a2028")); E = (4, 14, 436, 404)
    hs = sp.get("hairstyle", "short")
    if hs in ("bob", "long"):       # back hair behind the head
        bot = 270 if hs == "bob" else 420
        for x0, x1 in ((-2, 90), (350, 442)): c.rrect([x0, 90, x1, bot], 45, hair, 6)
    c.ell(E, skin, 7)
    em = c.mask(lambda d: d.ellipse(S(E), fill=255)); sh = c.mask(lambda d: d.ellipse(S((E[0] - 40, E[1], E[2] - 40, E[3])), fill=255))
    from PIL import ImageChops
    c.fill(ImageChops.subtract(em, sh), shade(skin, 0.86), 0)
    # hair cap
    if hs in ("short", "bob", "long", "messy", "bun", "grey_sides"):
        cut = 125 if hs != "grey_sides" else 150
        cap = c.mask(lambda d: (d.ellipse(S((E[0] - 8, E[1] - 12, E[2] + 8, E[3] + 6)), fill=255), d.rectangle(S((0, cut + 70, W, H)), fill=0)))
        if hs == "grey_sides": cap = c.mask(lambda d: (d.ellipse(S((E[0] - 6, E[1] - 6, E[2] + 6, E[3] + 4)), fill=255), d.ellipse(S((70, 60, 370, 400)), fill=0)))
        else:
            cap2 = c.mask(lambda d: d.polygon([tuple(S(p)) for p in [(0, 0), (W, 0), (W, cut + 5), (330, cut + 25), (250, cut - 5), (150, cut + 25), (80, cut + 20), (0, cut + 55)]], fill=255))
            cap = ImageChops.multiply(cap, cap2)
        c.fill(ImageChops.multiply(cap, c.mask(lambda d: d.ellipse(S((E[0] - 8, E[1] - 12, E[2] + 8, E[3] + 6)), fill=255))), hair, 6)
        if hs == "messy":
            for x in (110, 190, 270, 340): c.poly([(x - 25, 60), (x + 5, 0), (x + 30, 62)], hair, 5)
        if hs == "bun": c.ell((160, -20, 280, 70), hair, 6)
    # sunglasses / glasses / eyes
    for sx in (-1, 1):
        cx = 220 + sx * 72; ey = 218; k = ex
        eyes = EX[k][0]
        if sp.get("sunglasses"): continue
        if eyes == "dot": c.ell((cx - 14, ey - 14, cx + 14, ey + 14), INK, 0)
        elif eyes == "wide": c.ell((cx - 30, ey - 32, cx + 30, ey + 32), (255, 255, 255, 255), 5); c.ell((cx - 8, ey - 8, cx + 8, ey + 8), INK, 0)
        elif eyes == "arc_up": c.arc((cx - 26, ey - 18, cx + 26, ey + 30), 200, 340, 9)
        elif eyes == "arc_down": c.arc((cx - 26, ey - 30, cx + 26, ey + 14), 20, 160, 9)
        elif eyes == "half": c.ell((cx - 14, ey - 14, cx + 14, ey + 14), INK, 0); c.line([(cx - 24, ey - 7), (cx + 24, ey - 7)], 8)
    if sp.get("sunglasses"):
        for sx in (-1, 1): c.rrect([220 + sx * 72 - 56, 190, 220 + sx * 72 + 56, 252], 22, (20, 16, 24, 255), 6)
        c.line([(165, 205), (275, 205)], 8)
    if sp.get("glasses"):
        for sx in (-1, 1): c.arc((220 + sx * 72 - 46, 172, 220 + sx * 72 + 46, 264), 0, 360, 6)
        c.line([(266, 218), (174, 218)], 6)
    # brows
    bw = sp.get("brow", 11); bc = hx(sp.get("browc", "#1b141b")) if sp.get("browc") else INK
    ee = EX[ex]
    for sx, (di, do) in ((-1, ee[1]), (1, ee[2])):
        by = 168 - (6 if sp.get("sunglasses") else 0); xin, xout = 220 + sx * 24, 220 + sx * 108
        c.line([(xout, by + do), (xin, by + di)], bw, bc)
    # mouth
    my = 312 + (8 if sp.get("moustache") else 0); m = ee[3]
    if sp.get("beard"): c.fill(c.mask(lambda d: d.ellipse(S((70, 250, 370, 440)), fill=255)), hx(sp["beard"]), 0, clip=em); c.line([(150, 262), (290, 262)], 0)
    if m == "flat": c.line([(190, my), (250, my)], 8)
    elif m == "smile": c.arc((165, my - 50, 275, my + 22), 20, 160, 9)
    elif m == "frown": c.arc((175, my - 10, 265, my + 50), 200, 340, 9)
    elif m == "o": c.ell((198, my - 18, 242, my + 34), (110, 30, 40, 255), 6)
    elif m == "shout": c.ell((165, my - 40, 275, my + 40), (110, 30, 40, 255), 7)
    elif m == "laugh": c.fill(c.mask(lambda d: d.pieslice(S((140, my - 55, 300, my + 40)), 0, 180, fill=255)), (110, 30, 40, 255), 7)
    elif m == "wavy": c.line([(165 + i * 10, my + (6 if i % 2 else -6)) for i in range(0, 10)], 7)
    elif m == "squig": c.line([(190 + i * 8, my + 8 * math.sin(i * 1.3)) for i in range(0, 9)], 7)
    elif m == "tremble": c.ell((190, my - 12, 250, my + 28), (110, 30, 40, 255), 6)
    elif m == "grit": c.rrect([170, my - 14, 270, my + 20], 8, (255, 255, 255, 255), 6); c.line([(170, my + 3), (270, my + 3)], 4); [c.line([(x, my - 14), (x, my + 20)], 3) for x in (195, 220, 245)]
    elif m == "smirk": c.line([(185, my + 4), (240, my + 2), (275, my - 22)], 8)
    elif m == "cry": c.arc((165, my - 4, 275, my + 60), 200, 340, 10); c.line([(185, my + 14), (255, my + 14)], 0)
    if sp.get("moustache"):
        mc = hx(sp["moustache"]); c.poly([(220, 292), (150, 296), (132, 318), (168, 306), (220, 302), (272, 306), (308, 318), (290, 296)], mc, 5)
    if ee[4] == "sweat": c.poly([(372, 120), (392, 160), (372, 182), (352, 160)], (140, 200, 240, 255), 5)
    if ee[4] == "tears":
        for sx in (-1, 1): c.poly([(220 + sx * 82, 250), (220 + sx * 100, 300), (220 + sx * 82, 330), (220 + sx * 64, 300)], (140, 200, 240, 255), 5)
    return c.out()

def torso(sp):
    w, h = 420, 358; c = Cv(w, h); col = hx(sp["torso"]); dk = shade(col, 0.82); k = sp.get("kind", "plain")
    c.rrect([2, 2, w - 2, h - 2], 120, col, 8)
    m = c.mask(lambda d: d.rounded_rectangle(S((2, 2, w - 2, h - 2)), S(120), fill=255)); from PIL import ImageChops
    sh = c.mask(lambda d: d.rounded_rectangle(S((-70, 2, w - 70, h - 2)), S(120), fill=255)); c.fill(ImageChops.subtract(m, sh), dk, 0)
    sec = hx(sp.get("second", "#ffffff"))
    if k in ("suit", "tie"):
        c.poly([(160, 4), (260, 4), (210, 100)], (250, 250, 246, 255), 5); c.poly([(200, 40), (222, 40), (232, 190), (211, 222), (190, 190)], sec, 5)
        c.line([(160, 4), (140, 110), (210, 220)], 5); c.line([(260, 4), (280, 110), (210, 220)], 5)
        for y in (200, 250): c.ell((196, y, 214, y + 18), (210, 210, 200, 255), 3)
    if k == "pilot":
        c.poly([(165, 4), (255, 4), (210, 90)], (250, 250, 246, 255), 5); c.poly([(202, 34), (219, 34), (226, 160), (210, 176), (194, 160)], (20, 20, 28, 255), 4)
        for x in (150, 270):
            for y in (140, 210, 280): c.ell((x - 9, y, x + 9, y + 18), hx("#e8c040"), 3)
        for y in (310, 322): c.line([(40, y), (380, y)], 8, hx("#e8c040"))
    if k == "stripes":
        for y in range(40, 340, 52): c.line([(18, y), (402, y)], 22, hx(sp["second"]))
    if k == "plaid":
        for y in range(30, 340, 56): c.line([(14, y), (406, y)], 12, hx(sp["second"]))
        for x in range(60, 400, 66): c.line([(x, 20), (x, 340)], 12, hx(sp["second"]))
    if k == "apron":
        c.poly([(80, 140), (340, 140), (360, 340), (60, 340)], (250, 248, 240, 255), 6); c.line([(120, 140), (140, 20)], 6); c.line([(300, 140), (280, 20)], 6)
    if k == "dress":
        c.poly([(150, 4), (270, 4), (210, 70)], (250, 250, 246, 255), 5)
    if k == "dots":
        for i, (x, y) in enumerate([(70, 60), (130, 110), (200, 50), (280, 100), (340, 60), (100, 190), (190, 200), (290, 190), (350, 250), (60, 280), (160, 290), (260, 290)]): c.ell((x - 12, y - 12, x + 12, y + 12), hx(["#d8603a", "#ffffff", "#b04080"][i % 3]), 0)
    if k == "ranger":
        c.poly([(160, 4), (260, 4), (210, 90)], (240, 236, 200, 255), 5); c.poly([(200, 34), (220, 34), (230, 170), (210, 188), (190, 170)], hx(sp.get("second", "#5a3a22")), 4); c.ell((290, 70, 326, 106), hx("#e8c040"), 4)
        for x in (80, 270): c.rrect([x, 120, x + 70, 180], 6, dk, 4)
    if k == "khaki":
        for x in (80, 270): c.rrect([x, 90, x + 70, 150], 6, dk, 4)
        c.poly([(160, 4), (260, 4), (210, 70)], shade(col, 1.15), 5); c.line([(210, 70), (210, 340)], 4)
    if k == "scarf":
        c.poly([(150, 4), (270, 4), (210, 90)], (250, 250, 246, 255), 5); c.poly([(180, 20), (240, 20), (222, 70), (198, 70)], hx(sp.get("second", "#d33")), 4)
    if k == "overall":
        c.poly([(160, 4), (260, 4), (210, 80)], (250, 250, 246, 255), 5)
    if k == "agent":
        c.poly([(160, 4), (260, 4), (210, 100)], (250, 250, 246, 255), 5); c.poly([(204, 36), (218, 36), (222, 200), (211, 226), (200, 200)], sec, 4); c.line([(160, 4), (140, 110), (210, 220)], 5); c.line([(260, 4), (280, 110), (210, 220)], 5)
    grown = m.filter(ImageFilter.MaxFilter(2 * S(8) // 2 * 2 + 1)); a = ImageChops.multiply(c.im.getchannel("A"), grown); c.im.putalpha(a)
    return c.out()

def limb(pts, pad=22, w=12, hand=True):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; x0, y0, x1, y1 = int(min(xs) - pad), int(min(ys) - pad), int(max(xs) + pad), int(max(ys) + pad)
    c = Cv(x1 - x0, y1 - y0); q = [(x - x0, y - y0) for x, y in pts]; c.line(q, w)
    if hand: r = 15; c.ell((q[-1][0] - r, q[-1][1] - r, q[-1][0] + r, q[-1][1] + r), INK, 0)
    return c.out(), [x0, y0, x1 - x0, y1 - y0]

def make_char(cid, sp, desc):
    d = os.path.join(LIB, "characters", cid); os.makedirs(os.path.join(d, "faces"), exist_ok=True)
    rig = {"version": 2, "name": cid, "size": [614, 957], "feetY": 949, "head": {"center": [307, 209], "diameter": 432}, "skin": sp.get("skin", "#fcf7e8"), "layers": {}, "order": ["legL", "legR", "armL", "armR", "body", "head"], "faces": {}}
    def put(name, im, box, pivot): im.save(os.path.join(d, name + ".png")); rig["layers"][name] = {"file": name + ".png", "box": box, "pivot": pivot}
    tb = torso(sp); put("body", tb, [102, 385, 420, 358], [312, 743.0])
    sl, sr = (135, 468), (489, 468)
    im, bx = limb([sl, (82, 560), (34, 640)]); put("armL", im, bx, [sl[0] - bx[0] + bx[0], sl[1]])
    im, bx = limb([sr, (542, 560), (590, 640)]); put("armR", im, bx, [sr[0], sr[1]])
    for nm, hip, ft, dx in (("legL", (240, 740), (232, 946), -28), ("legR", (384, 740), (392, 946), 28)):
        im, bx = limb([hip, ft, (ft[0] + dx, ft[1])], pad=20, hand=False); put(nm, im, bx, [hip[0], hip[1]])
    for n in FACE_NAMES:
        im = draw_head(sp, n); im.save(os.path.join(d, "faces", n + ".png"))
        rig["faces"][n] = {"file": "faces/%s.png" % n, "size": [440, 420], "pivot": [220, 400], "center": [220, 209], "diameter": 432}
    hd = draw_head(sp, "neutral"); put("head", hd, [87, 5, 440, 420], [307, 405])
    rig["layers"]["armL"]["pivot"] = [sl[0], sl[1]]
    json.dump(rig, open(os.path.join(d, "rig.json"), "w"), indent=1)
    prev = Image.new("RGBA", (614, 957), (150, 150, 160, 255))
    for n in rig["order"]:
        L = rig["layers"][n]; im = Image.open(os.path.join(d, L["file"])); prev.alpha_composite(im, (L["box"][0], L["box"][1]))
    prev.save(os.path.join(d, "preview.png"))
    C = json.load(open(os.path.join(LIB, "catalog.json")))
    C["characters"][cid] = {"bare_head": True, "desc": desc, "faces": sorted(FACE_NAMES), "limbs": ["armL", "armR", "legL", "legR"], "path": "characters/" + cid, "period": "1970s", "sheets": [], "tags": ["1970s"] + desc.split()[:6]}
    json.dump(C, open(os.path.join(LIB, "catalog.json"), "w"), indent=1, sort_keys=True)

CHARS = {
 "cooper": (dict(torso="#34363f", kind="suit", second="#15151a", hair="#2a2028", sunglasses=True), "1971 passenger in a charcoal suit, thin black tie, dark sunglasses"),
 "attendant": (dict(torso="#8b2a35", kind="scarf", second="#e8e0d0", hair="#7a4a2a", hairstyle="bob"), "1971 flight attendant in a dark red uniform dress with white collar"),
 "pilot": (dict(torso="#1f2f55", kind="pilot", hair="#a8a8a8", hairstyle="short"), "1971 airline captain, navy jacket with gold stripes, grey hair"),
 "boy": (dict(torso="#d84a3a", kind="stripes", second="#f4f0e4", hair="#b98a52", hairstyle="messy"), "an eight year old boy in a red and white striped t-shirt"),
 "agent": (dict(torso="#7a7f88", kind="agent", second="#22262e", hair="#1f1a22", hairstyle="short"), "1970s FBI agent in a grey suit and narrow tie"),
 "juliane": (dict(torso="#9ccbe6", kind="dress", hair="#e3c46a", hairstyle="long"), "17 year old girl in a pale yellow summer dress with long blond hair"),
 "father": (dict(torso="#a89a64", kind="khaki", hair="#a8a8a8", hairstyle="grey_sides", glasses=True, beard="#bdbdbd"), "biologist in a khaki field shirt, round glasses, grey beard"),
 "logger": (dict(torso="#4a6fa0", kind="overall", hair="#1f1a22", hairstyle="short", skin="#efd6ad", moustache="#1f1a22"), "rainforest logger in a faded blue work shirt with a black moustache"),
 "roy": (dict(torso="#6b7a3d", kind="ranger", second="#5a3a22", hair="#9a9a9a", hairstyle="short", browc="#8a8a8a", brow=15), "park ranger in an olive uniform shirt with a badge, grey hair"),
 "wife": (dict(torso="#e8c24a", kind="apron", hair="#8a7a6a", hairstyle="bun"), "1970s housewife in a yellow housedress with a white apron, hair in a bun"),
 "neighbor": (dict(torso="#b83a30", kind="plaid", second="#2a2024", hair="#6a4a2a", hairstyle="short"), "mountain neighbour in a red and black plaid shirt"),
}
# ---------------- hats ----------------
def make_hats():
    os.makedirs(os.path.join(LIB, "hats"), exist_ok=True); C = json.load(open(os.path.join(LIB, "catalog.json")))
    def reg(n, im, scale, sit, desc): im.save(os.path.join(LIB, "hats", n + ".png")); C["hats"][n] = {"desc": desc, "path": "hats/%s.png" % n, "scale": scale, "sit": sit, "size": list(im.size)}
    c = Cv(420, 200); c.poly([(90, 130), (330, 130), (310, 20), (110, 20)], hx("#7a8444"), 7)
    for x in (150, 210, 270): c.line([(x, 30), (x + 6, 120)], 4, shade(hx("#7a8444"), 0.7))
    c.rrect([84, 108, 336, 140], 6, hx("#5a3a22"), 5); c.ell((8, 126, 412, 190), hx("#8a9450"), 7); c.line([(110, 160), (310, 160)], 0)
    c.rrect([84, 108, 336, 138], 6, hx("#5a3a22"), 5); reg("ranger_hat", c.out(), 1.3, 0.2, "flat-brimmed olive park ranger hat")
    c = Cv(340, 190); c.ell((30, 20, 310, 150), hx("#1f2f55"), 7); c.rrect([20, 110, 320, 150], 10, hx("#1f2f55"), 7); c.line([(24, 130), (316, 130)], 10, hx("#e8c040"))
    c.ell((100, 130, 240, 184), hx("#15151a"), 6); c.ell((150, 86, 190, 124), hx("#e8c040"), 4); reg("pilot_cap", c.out(), 1.08, 0.2, "navy airline captain cap with gold band")
    c = Cv(500, 200); c.ell((130, 20, 370, 150), hx("#e6c878"), 7); c.ell((6, 100, 494, 190), hx("#e6c878"), 7)
    for x in range(40, 470, 36): c.line([(x, 130), (x + 12, 170)], 3, shade(hx("#e6c878"), 0.7))
    c.rrect([138, 100, 362, 128], 5, hx("#5a3a22"), 5); reg("straw_hat", c.out(), 1.5, 0.2, "wide woven straw hat")
    json.dump(C, open(os.path.join(LIB, "catalog.json"), "w"), indent=1, sort_keys=True)

# ---------------- textures ----------------
def tile_noise(n, sig, seed): r = np.random.default_rng(seed); a = gaussian_filter(r.standard_normal((n, n)), sig, mode="wrap"); return (a - a.mean()) / (a.std() + 1e-9)
def to_img(a): return Image.fromarray(np.clip(a, 0, 255).astype("uint8"), "RGB")
def make_tex():
    os.makedirs(os.path.join(LIB, "textures"), exist_ok=True); C = json.load(open(os.path.join(LIB, "catalog.json"))); n = 512
    def reg(name, im, desc): im.save(os.path.join(LIB, "textures", name + ".png")); C["textures"][name] = {"desc": desc, "path": "textures/%s.png" % name}
    y, x = np.mgrid[0:n, 0:n]
    base = np.array([96, 112, 138.]); a = np.ones((n, n, 3)) * base; d = (np.abs(((x % 64) - 32)) + np.abs(((y % 64) - 32)) < 20); a[d] = [118, 132, 158]
    a += tile_noise(n, 6, 1)[..., None] * 5; reg("carpet", to_img(a), "blue-grey airliner carpet with diamonds")
    a = np.ones((n, n, 3)) * 92 + tile_noise(n, 1.2, 2)[..., None] * 9 + tile_noise(n, 8, 3)[..., None] * 5; a[..., 2] += 3; reg("asphalt", to_img(a), "grey asphalt")
    f = tile_noise(n, 9, 4); a = np.zeros((n, n, 3)); a[...] = [86, 62, 40]; a += f[..., None] * [14, 10, 6]; g = tile_noise(n, 5, 5) > 0.6; a[g] = [52, 104, 52] + tile_noise(n, 2, 6)[g][:, None] * [8, 10, 6]; reg("jungle_floor", to_img(a), "jungle floor soil leaves ferns")
    a = np.zeros((n, n, 3)); a[...] = [96, 112, 78]; a += tile_noise(n, 10, 7)[..., None] * [10, 10, 8]; r = np.sin((y + tile_noise(n, 14, 8) * 14) / 512 * 2 * np.pi * 24); a += (r > 0.9)[..., None] * 22; reg("water", to_img(a), "muddy green river water")
    json.dump(C, open(os.path.join(LIB, "catalog.json"), "w"), indent=1, sort_keys=True)

# ---------------- backdrops ----------------
def ridge(W, base, amp, seed, per=(2, 5, 11)):
    r = np.random.default_rng(seed); x = np.arange(W) / W * 2 * np.pi; y = np.zeros(W)
    for k, p in enumerate(per): y += np.sin(x * p + r.uniform(0, 6.28)) * amp / (k + 1)
    return base + y
def backdrop(name, top, hor, layers, extra=None, W=2100, H=900, seed=1):
    ys = np.linspace(0, 1, H)[:, None, None]; t = np.array(top, float); h = np.array(hor, float); a = (t * (1 - ys) + h * ys) * np.ones((H, W, 3))
    a += gaussian_filter(np.random.default_rng(seed).standard_normal((H, W)), 40, mode="wrap")[..., None] * 9
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8"), "RGB").convert("RGBA")
    if extra: extra(im)
    for col, base, amp, sd, kind in layers:
        r = ridge(W, base, amp, sd); m = Image.new("L", (W, H), 0); d = ImageDraw.Draw(m)
        if kind == "pines":
            pts = []
            for xi in range(0, W, 26): hh = 46 + (xi * 7919 % 40); y0 = r[xi]; d.polygon([(xi - 18, y0 + 4), (xi, y0 - hh), (xi + 18, y0 + 4)], fill=255)
        if kind == "bumps":
            for xi in range(0, W, 30): rr = 34 + (xi * 104729 % 26); d.ellipse([xi - rr, r[xi] - rr * 0.9, xi + rr, r[xi] + rr * 0.6], fill=255)
        d.polygon([(0, H)] + [(i, r[i]) for i in range(0, W)] + [(W, H)], fill=255)
        im.paste(Image.new("RGBA", (W, H), tuple(col) + (255,)), (0, 0), m)
    return im.filter(ImageFilter.GaussianBlur(1.2))
def make_bd():
    os.makedirs(os.path.join(LIB, "backdrops"), exist_ok=True); C = json.load(open(os.path.join(LIB, "catalog.json")))
    def cloud(col, spots):
        def f(im):
            L = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(L)
            for x, y, rw, rh in spots: d.ellipse([x - rw, y - rh, x + rw, y + rh], fill=tuple(col) + (150,))
            im.alpha_composite(L.filter(ImageFilter.GaussianBlur(38)))
        return f
    def reg(n, im, desc): im.convert("RGB").save(os.path.join(LIB, "backdrops", n + ".png")); C["backdrops"][n] = {"desc": desc, "path": "backdrops/%s.png" % n}
    def bld(im):
        d = ImageDraw.Draw(im)
        for i, x in enumerate(range(60, 2100, 330)):
            wd = 150 + (i * 37 % 70); d.rectangle([x, 640, x + wd, 730], fill=(150, 156, 166, 255))
        d.rectangle([980, 540, 1010, 730], fill=(140, 146, 156, 255)); d.rectangle([950, 520, 1040, 548], fill=(120, 128, 140, 255))
        for x in (400, 1500): d.polygon([(x, 700), (x + 220, 700), (x + 190, 668), (x + 50, 668), (x + 20, 684)], fill=(232, 232, 228, 255)); d.rectangle([x + 20, 684, x + 200, 692], fill=(190, 50, 50, 255))
    reg("airport", backdrop("airport", (150, 196, 236), (226, 232, 238), [((176, 188, 200), 690, 25, 3, "bumps"), ((120, 130, 142), 760, 4, 4, "flat"), ((100, 108, 118), 830, 3, 5, "flat")], lambda im: (cloud((255, 255, 255), [(300, 160, 260, 40), (1100, 120, 320, 50), (1750, 220, 240, 36)])(im), bld(im))), "flat airport with terminal and jets")
    reg("night_forest", backdrop("nf", (10, 14, 34), (36, 44, 72), [((20, 30, 52), 620, 60, 2, "flat"), ((14, 24, 36), 700, 22, 3, "pines"), ((8, 18, 26), 790, 16, 4, "pines"), ((6, 12, 18), 860, 8, 5, "pines")], lambda im: ImageDraw.Draw(im).line([(0, 0)], fill=0)), "night, dark pine forest")
    reg("river_forest", backdrop("rf", (176, 186, 194), (214, 218, 218), [((150, 164, 180), 600, 50, 6, "flat"), ((86, 118, 96), 700, 20, 7, "pines"), ((62, 98, 78), 760, 12, 8, "pines"), ((118, 138, 150), 835, 3, 9, "flat")], cloud((235, 238, 240), [(500, 140, 400, 50), (1500, 200, 460, 60)])), "overcast river with fir forest")
    reg("storm_sky", backdrop("ss", (46, 44, 66), (120, 112, 136), [((60, 58, 82), 700, 60, 10, "bumps"), ((44, 42, 62), 790, 40, 11, "bumps")], cloud((20, 18, 34), [(300, 160, 380, 90), (1000, 260, 500, 110), (1800, 180, 420, 100)])), "thunderstorm clouds")
    reg("jungle", backdrop("jg", (168, 206, 190), (226, 236, 214), [((118, 160, 170), 560, 40, 12, "flat"), ((70, 130, 84), 640, 30, 13, "bumps"), ((44, 104, 62), 720, 28, 14, "bumps"), ((30, 82, 48), 800, 20, 15, "bumps")], cloud((255, 255, 255), [(600, 200, 520, 60), (1600, 280, 480, 70)])), "amazon canopy")
    reg("blue_ridge", backdrop("br", (112, 170, 232), (216, 228, 240), [((150, 178, 214), 560, 40, 16, "flat"), ((120, 156, 196), 640, 34, 17, "flat"), ((84, 128, 136), 730, 26, 18, "bumps"), ((54, 100, 86), 810, 18, 19, "bumps")], cloud((255, 255, 255), [(400, 150, 300, 40), (1300, 120, 360, 50), (1850, 230, 260, 36)])), "blue ridge mountains")
    json.dump(C, open(os.path.join(LIB, "catalog.json"), "w"), indent=1, sort_keys=True)

if __name__ == "__main__":
    what = sys.argv[1:] or ["chars", "hats", "tex", "bd"]
    if "tex" in what: make_tex()
    if "bd" in what: make_bd()
    if "hats" in what: make_hats()
    if "chars" in what:
        for k, (sp, desc) in CHARS.items():
            if os.environ.get("ONLY") and k not in os.environ["ONLY"].split(","): continue
            make_char(k, sp, desc); print("char", k, flush=True)
