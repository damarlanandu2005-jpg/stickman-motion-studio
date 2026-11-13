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
im, d = canvas(330, 150)
for x in (6, 170):          # two pointed medieval shoes, side view
    d.polygon([(x * S, 118 * S), ((x + 10) * S, 60 * S), ((x + 60) * S, 52 * S), ((x + 78) * S, 84 * S), ((x + 150) * S, 104 * S), ((x + 150) * S, 124 * S), (x * S, 128 * S)], fill=(200, 44, 44, 255), outline=INK)
    d.line([(x * S, 118 * S), ((x + 10) * S, 60 * S), ((x + 60) * S, 52 * S), ((x + 78) * S, 84 * S), ((x + 150) * S, 104 * S), ((x + 150) * S, 124 * S), (x * S, 128 * S), (x * S, 118 * S)], fill=INK, width=7 * S, joint="curve")
    d.rectangle([x * S, 122 * S, (x + 150) * S, 134 * S], fill=(92, 62, 44, 255), outline=INK, width=4 * S)
    d.ellipse([(x + 12) * S, 44 * S, (x + 58) * S, 70 * S], fill=(120, 24, 28, 255), outline=INK, width=5 * S)
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
def paper(name, lines, desc, period, w=230, h=290, seal=True, big=None):
    im, d = canvas(w, h); rr(d, [8, 8, w - 8, h - 8], 5, (243, 236, 214, 255), 6); f = font(30); y = 30
    for t in lines:
        tw = d.textlength(t, font=f); d.text(((w * S - tw) / 2, y * S), t, font=f, fill=INK); y += 40
    if big:
        fb = font(54); tw = d.textlength(big, font=fb); d.text(((w * S - tw) / 2, (y + 10) * S), big, font=fb, fill=(170, 40, 40, 255))
    if seal: d.ellipse([(w - 70) * S, (h - 72) * S, (w - 28) * S, (h - 30) * S], fill=(178, 48, 48, 255), outline=INK, width=4 * S)
    fin(im, name, desc, period)
def stack(name, label, rows, w, desc):
    h = 60 + 26 * rows; im, d = canvas(w, h)
    for i in range(rows): rr(d, [8, h - 40 - 26 * i, w - 8, h - 8 - 26 * i], 5, (86, 150, 96, 255) if i % 2 else (104, 172, 112, 255), 5)
    f = font(30); tw = d.textlength(label, font=f); rr(d, [(w - tw / S) / 2 - 12, h - 44 - 26 * (rows - 1) - 2, (w + tw / S) / 2 + 12, h - 44 - 26 * (rows - 1) + 40], 6, (243, 236, 214, 255), 4)
    d.text(((w * S - tw) / 2, (h - 42 - 26 * (rows - 1)) * S), label, font=f, fill=INK); fin(im, name, desc, "any")
paper("verdict", ["VERDICT", "", "HOT"], "a physician's written verdict: HOT BLOOD", "1500s", big="BLOOD")
paper("bill", ["REPAIR BILL", "", "TOWER"], "a huge repair bill for the tower", "1920s", big="!!!")
stack("cash_50k", "$50,000", 6, 300, "a tall stack of banknotes labelled $50,000")
stack("cash_5k", "$5,000", 1, 210, "one small bundle labelled $5,000")
sign("sign_expo", ["EXPO 1889"], (58, 92, 150, 255), (246, 236, 214, 255), "a blue World's Fair banner", "1880s", w=460)
sign("sign_20ans", ["PERMIT:", "20 YEARS"], (236, 226, 200, 255), INK, "a notice: permit for 20 years", "1880s")
sign("sign_7000", ["7000", "TONNES"], (90, 74, 80, 255), (246, 236, 214, 255), "an iron-grey weight plate", "1920s", post=False)
sign("sign_newyork", ["NEW YORK"], (38, 92, 80, 255), (246, 236, 214, 255), "a harbour sign", "1930s")
sign("sign_no_bread", ["NO BREAD"], (236, 226, 200, 255), (150, 30, 30, 255), "a notice on an empty stall", "1500s", post=False)
sign("sign_hated", ["UGLY!", "TEAR IT DOWN"], (236, 226, 200, 255), (150, 30, 30, 255), "a protest placard", "1880s", w=460)
# ocean liner
im, d = canvas(620, 330)
d.polygon([(20 * S, 190 * S), (600 * S, 190 * S), (540 * S, 290 * S), (70 * S, 290 * S)], fill=(52, 56, 78, 255), outline=INK, width=8 * S)
d.rectangle([20 * S, 176 * S, 600 * S, 196 * S], fill=(170, 52, 48, 255), outline=INK, width=5 * S)
rr(d, [110, 120, 500, 180], 6, (243, 236, 214, 255), 6)
for x in (140, 190, 240, 290, 340, 390, 440): d.ellipse([(x) * S, 138 * S, (x + 22) * S, 160 * S], fill=(120, 170, 210, 255), outline=INK, width=4 * S)
for x in (200, 300, 400): rr(d, [x, 40, x + 46, 122], 4, (200, 70, 50, 255), 6); d.rectangle([x * S, 40 * S, (x + 46) * S, 60 * S], fill=INK)
for x in range(20, 600, 60): d.arc([x * S, 286 * S, (x + 60) * S, 326 * S], 180, 360, fill=(90, 150, 200, 255), width=8 * S)
fin(im, "ship", "an ocean liner with three funnels", "1920s")
# apparition of an angry saint (pale, with a halo)
im, d = canvas(360, 520); pale = (214, 226, 255, 255)
d.ellipse([90 * S, 6 * S, 270 * S, 60 * S], outline=(250, 226, 130, 255), width=9 * S)
d.polygon([(180 * S, 150 * S), (330 * S, 510 * S), (30 * S, 510 * S)], fill=pale, outline=INK, width=7 * S)
d.ellipse([105 * S, 40 * S, 255 * S, 190 * S], fill=(236, 240, 255, 255), outline=INK, width=7 * S)
d.line([128 * S, 96 * S, 168 * S, 112 * S], fill=INK, width=9 * S); d.line([232 * S, 96 * S, 192 * S, 112 * S], fill=INK, width=9 * S)
d.ellipse([146 * S, 116 * S, 160 * S, 130 * S], fill=INK); d.ellipse([200 * S, 116 * S, 214 * S, 130 * S], fill=INK)
d.arc([150 * S, 146 * S, 210 * S, 180 * S], 200, 340, fill=INK, width=7 * S)
d.line([250 * S, 250 * S, 330 * S, 170 * S], fill=INK, width=9 * S); d.ellipse([318 * S, 150 * S, 346 * S, 178 * S], fill=INK)
fin(im, "saint", "a pale apparition of an angry saint with a halo, pointing", "1500s")
C = json.load(open(os.path.join(LIB, "catalog.json"))); C["props2d"] = REG; json.dump(C, open(os.path.join(LIB, "catalog.json"), "w"), indent=1, sort_keys=True)
S2 = Image.new("RGB", (7 * 260, 4 * 260), (150, 150, 160))
for i, n in enumerate(sorted(REG)):
    t = Image.open(os.path.join(OUT, n + ".png")); t.thumbnail((240, 240)); S2.paste(t, ((i % 7) * 260 + 10, (i // 7) * 260 + 10), t)
S2.save(os.path.join(OUT, "_sheet.jpg")); print(len(REG), "props")
