#!/usr/bin/env python3
"""Code-drawn 2D props in the doodle style (thick plum outline, flat colour, one shadow tone): hand-held things and signs.
usage: make_props.py   -> writes ricks/library/props/*.png and registers them in the catalogue (kind props2d)."""
import json, os, math
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); LIB = os.path.join(HERE, "..", "library"); OUT = os.path.join(LIB, "props")
INK = (39, 25, 37, 255); S = 4
def canvas(w, h): im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0)); return im, ImageDraw.Draw(im)
def fin(im, name, desc, period):
    im = im.resize((im.width // S, im.height // S), Image.LANCZOS); im.save(os.path.join(OUT, name + ".png")); REG[name] = {"path": "props/%s.png" % name, "desc": desc, "period": period, "size": list(im.size)}
def font(sz):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"):
        if os.path.exists(p): return ImageFont.truetype(p, sz * S)
    return ImageFont.load_default()
def rr(d, box, r, fill, w=7): d.rounded_rectangle([b * S for b in box], r * S, fill=fill, outline=INK, width=w * S)
def sign(name, lines, fill, fg, desc, period, w=420, h=None, post=True):
    h = h or (70 + 62 * len(lines)); im, d = canvas(w, h + (150 if post else 0))
    if post: d.rectangle([(w / 2 - 9) * S, (h - 10) * S, (w / 2 + 9) * S, (h + 150) * S], fill=(110, 78, 58, 255), outline=INK, width=5 * S)
    rr(d, [6, 6, w - 6, h - 6], 14, fill); f = font(46 if len(max(lines, key=len)) < 11 else 36)
    for i, t in enumerate(lines):
        tw = d.textlength(t, font=f); d.text(((w * S - tw) / 2, (30 + 62 * i) * S), t, font=f, fill=fg)
    fin(im, name, desc, period)
REG = {}
os.makedirs(OUT, exist_ok=True)
# hand-held
im, d = canvas(200, 130)
for i, dy in enumerate((34, 18, 2)): rr(d, [8, 30 + dy, 192, 92 + dy], 6, (86, 150, 96, 255) if i < 2 else (104, 172, 112, 255), 6)
d.ellipse([78 * S, 44 * S, 122 * S, 82 * S], fill=(196, 228, 190, 255), outline=INK, width=5 * S); rr(d, [86, 20, 114, 108], 3, (236, 222, 170, 255), 5)
fin(im, "cash", "a bundle of banknotes with a paper band", "any")
im, d = canvas(170, 220); rr(d, [8, 8, 162, 212], 5, (243, 236, 214, 255), 6)
d.ellipse([62 * S, 20 * S, 108 * S, 62 * S], fill=(60, 80, 140, 255), outline=INK, width=4 * S)
for y in (84, 108, 132, 156): d.line([28 * S, y * S, 142 * S, y * S], fill=INK, width=5 * S)
d.ellipse([104 * S, 166 * S, 140 * S, 202 * S], fill=(178, 48, 48, 255), outline=INK, width=4 * S)
fin(im, "letter", "an official letter with a crest and a red wax seal", "any")
im, d = canvas(300, 70); rr(d, [6, 22, 294, 48], 12, (176, 132, 84, 255), 6)
for x in (70, 110, 150, 190, 230): d.ellipse([(x - 7) * S, 28 * S, (x + 7) * S, 42 * S], fill=INK)
rr(d, [270, 14, 296, 56], 8, (150, 108, 66, 255), 6); fin(im, "pipe", "a wooden shawm / pipe for a street musician", "1500s")
im, d = canvas(260, 150)
for x in (10, 136):
    d.pieslice([x * S, 40 * S, (x + 112) * S, 150 * S], 180, 360, fill=(196, 44, 44, 255), outline=INK, width=6 * S); rr(d, [x, 90, x + 112, 118], 8, (160, 30, 36, 255), 6)
    d.line([(x + 56) * S, 56 * S, (x + 56) * S, 86 * S], fill=(250, 240, 220, 255), width=6 * S); d.line([(x + 42) * S, 70 * S, (x + 70) * S, 70 * S], fill=(250, 240, 220, 255), width=6 * S)
fin(im, "red_shoes", "a pair of red shoes with painted crosses", "1500s")
im, d = canvas(210, 150); rr(d, [10, 44, 200, 142], 12, (124, 86, 58, 255), 7); d.arc([70 * S, 10 * S, 140 * S, 70 * S], 180, 360, fill=INK, width=8 * S)
rr(d, [10, 82, 200, 96], 2, (92, 62, 44, 255), 4); fin(im, "suitcase", "a brown leather suitcase", "1920s")
# signs
sign("sign_for_sale", ["À VENDRE", "FOR SALE"], (236, 204, 96, 255), INK, "a yellow FOR SALE sign on a post", "1920s")
sign("sign_crillon", ["HÔTEL DE", "CRILLON"], (38, 52, 92, 255), (240, 214, 140, 255), "a navy and gold hotel plaque", "1920s", post=False)
sign("sign_alcatraz", ["ALCATRAZ", "20 YEARS"], (70, 74, 86, 255), (240, 240, 236, 255), "a grey prison sign", "1930s")
sign("sign_police", ["POLICE"], (38, 52, 92, 255), (240, 240, 236, 255), "a police sign", "1920s")
sign("sign_chicago", ["CHICAGO"], (150, 62, 48, 255), (246, 236, 214, 255), "a brick-red city sign", "1930s")
sign("sign_guildhall", ["GUILD", "HALL"], (120, 84, 56, 255), (246, 232, 200, 255), "a wooden guild hall sign", "1500s")
sign("sign_no_music", ["NO MUSIC", "BY ORDER"], (236, 226, 200, 255), (150, 30, 30, 255), "a council notice banning music", "1500s")
sign("sign_shrine", ["ST VITUS"], (236, 226, 200, 255), INK, "a shrine sign", "1500s")
sign("sign_1518", ["STRASBOURG", "JULY 1518"], (236, 226, 200, 255), INK, "a date card", "1500s", post=False)
im, d = canvas(120, 150); d.ellipse([34 * S, 96 * S, 74 * S, 130 * S], fill=INK); d.line([72 * S, 112 * S, 72 * S, 22 * S], fill=INK, width=9 * S); d.polygon([(72 * S, 22 * S), (108 * S, 44 * S), (72 * S, 60 * S)], fill=INK)
fin(im, "note", "a music note (floats above musicians)", "any")
C = json.load(open(os.path.join(LIB, "catalog.json"))); C["props2d"] = REG; json.dump(C, open(os.path.join(LIB, "catalog.json"), "w"), indent=1, sort_keys=True)
S2 = Image.new("RGB", (5 * 260, 3 * 260), (150, 150, 160))
for i, n in enumerate(sorted(REG)):
    t = Image.open(os.path.join(OUT, n + ".png")); t.thumbnail((240, 240)); S2.paste(t, ((i % 5) * 260 + 10, (i // 5) * 260 + 10), t)
S2.save(os.path.join(OUT, "_sheet.jpg")); print(len(REG), "props")
