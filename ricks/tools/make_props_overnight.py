#!/usr/bin/env python3
"""Extra code-drawn 2D props for the overnight shorts (db_cooper, jungle_fall, lightning_man). Same doodle style as make_props.py.
Adds to ricks/library/props and registers in catalog.json (kind props2d). Does not touch existing props."""
import json, os
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); LIB = os.path.join(HERE, "..", "library"); OUT = os.path.join(LIB, "props")
INK = (39, 25, 37, 255); S = 4; REG = {}
def canvas(w, h): im = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0)); return im, ImageDraw.Draw(im)
def fin(im, name, desc, period="any"):
    im = im.resize((im.width // S, im.height // S), Image.LANCZOS); im.save(os.path.join(OUT, name + ".png")); REG[name] = {"path": "props/%s.png" % name, "desc": desc, "period": period, "size": list(im.size)}
def font(sz):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"):
        if os.path.exists(p): return ImageFont.truetype(p, sz * S)
    return ImageFont.load_default()
def rr(d, box, r, fill, w=7): d.rounded_rectangle([b * S for b in box], r * S, fill=fill, outline=INK, width=w * S)
def poly(d, pts, fill, w=6): d.polygon([(x * S, y * S) for x, y in pts], fill=fill); d.line([(x * S, y * S) for x, y in pts + [pts[0]]], fill=INK, width=w * S, joint="curve")
def sign(name, lines, fill, fg, desc, period="any", w=420, post=False):
    h = 70 + 62 * len(lines); im, d = canvas(w, h + (150 if post else 0))
    if post: d.rectangle([(w / 2 - 9) * S, (h - 10) * S, (w / 2 + 9) * S, (h + 150) * S], fill=(110, 78, 58, 255), outline=INK, width=5 * S)
    rr(d, [6, 6, w - 6, h - 6], 14, fill); f = font(46 if len(max(lines, key=len)) < 11 else 34 if len(max(lines, key=len)) < 17 else 28)
    for i, t in enumerate(lines): tw = d.textlength(t, font=f); d.text(((w * S - tw) / 2, (30 + 62 * i) * S), t, font=f, fill=fg)
    fin(im, name, desc, period)
CREAM = (243, 236, 214, 255); NAVY = (38, 52, 92, 255); RED = (178, 48, 48, 255); GREEN = (60, 110, 70, 255); BROWN = (110, 78, 58, 255)
# --- hijacking
im, d = canvas(300, 200); poly(d, [(20, 90), (280, 90), (270, 190), (30, 190)], (88, 70, 60, 255), 7); poly(d, [(20, 90), (280, 90), (250, 40), (50, 40)], (120, 98, 82, 255), 7)
for x in (80, 130, 180, 220):   # red sticks + wires
    d.rounded_rectangle([x * S, 100 * S, (x + 22) * S, 160 * S], 6 * S, fill=RED, outline=INK, width=4 * S)
d.line([(70 * S, 96 * S), (110 * S, 70 * S), (150 * S, 120 * S), (200 * S, 70 * S), (240 * S, 110 * S)], fill=(40, 40, 200, 255), width=5 * S, joint="curve")
d.line([(70 * S, 130 * S), (130 * S, 175 * S), (190 * S, 125 * S), (240 * S, 170 * S)], fill=(230, 190, 40, 255), width=5 * S, joint="curve")
fin(im, "briefcase_wires", "an open briefcase packed with red sticks and coloured wires", "any")
im, d = canvas(230, 250); rr(d, [8, 8, 222, 242], 5, CREAM, 6); f = font(34)
for i, t in enumerate(("I HAVE", "A BOMB.", "SIT", "NEXT TO", "ME.")): d.text((26 * S, (20 + 44 * i) * S), t, font=f, fill=INK)
fin(im, "note_bomb", "a hand-written note: I have a bomb", "1970s")
im, d = canvas(220, 250); poly(d, [(40, 60), (180, 60), (205, 230), (15, 230)], (176, 150, 96, 255), 7); d.ellipse([60 * S, 30 * S, 160 * S, 80 * S], fill=(150, 126, 76, 255), outline=INK, width=7 * S)
f = font(26); d.text((34 * S, 130 * S), "$200,000", font=f, fill=INK); fin(im, "money_bag", "a canvas bag marked $200,000", "1970s")
im, d = canvas(260, 230)
for k, c in enumerate(((200, 60, 50, 255), (240, 240, 236, 255), (200, 60, 50, 255), (240, 240, 236, 255))): poly(d, [(130, 20), (20 + k * 60, 70 + (0 if k in (1, 2) else 16)), (80 + k * 60, 70 + (0 if k in (1, 2) else 16))], c, 5)
for x in (40, 100, 160, 220): d.line([(x * S, 90 * S), (130 * S, 190 * S)], fill=INK, width=3 * S)
rr(d, [105, 188, 155, 226], 6, GREEN, 6); fin(im, "parachute", "a red-and-white parachute with its pack", "any")
sign("sign_1971", ["NOV 24", "1971"], CREAM, INK, "a date card: November 24 1971", "1970s")
sign("sign_mexico", ["MEXICO"], GREEN, (246, 236, 214, 255), "a green MEXICO sign", "any", post=True)
sign("sign_wanted", ["WANTED", "DAN COOPER", "NEVER FOUND"], CREAM, RED, "a wanted poster", "1970s", w=470)
sign("sign_1980", ["1980"], CREAM, INK, "a date card: 1980", "1980s", w=300)
sign("sign_flight305", ["FLIGHT 305", "PORTLAND - SEATTLE"], NAVY, (240, 240, 236, 255), "a flight board", "1970s", w=470)
# jet side view
im, d = canvas(520, 170); poly(d, [(20, 80), (60, 40), (440, 36), (500, 70), (440, 110), (60, 112)], (236, 236, 232, 255), 7)
poly(d, [(20, 80), (50, 10), (90, 10), (110, 40)], (236, 236, 232, 255), 7)
for x in range(110, 420, 32): d.ellipse([x * S, 56 * S, (x + 16) * S, 72 * S], fill=NAVY, outline=INK, width=2 * S)
d.rectangle([60 * S, 84 * S, 440 * S, 92 * S], fill=RED); poly(d, [(230, 100), (330, 150), (350, 150), (310, 100)], (200, 200, 196, 255), 6)
fin(im, "jet", "a side view of a white airliner with a red stripe", "any")
# --- lightning
im, d = canvas(160, 420); pts = [(95, 6), (30, 190), (82, 190), (44, 414), (140, 150), (88, 150), (128, 6)]
poly(d, pts, (255, 238, 120, 255), 8); poly(d, [(95, 40), (58, 180), (100, 180), (70, 330), (118, 150), (80, 150), (110, 40)], (255, 255, 235, 255), 1)
fin(im, "bolt", "a big yellow lightning bolt", "any")
# --- Peru
sign("sign_peru", ["24 DEC 1971", "PERU"], CREAM, INK, "a date card: 24 December 1971, Peru", "1970s", w=440)
sign("sign_lansa", ["LANSA", "FLIGHT 508"], NAVY, (240, 240, 236, 255), "a plaque: LANSA flight 508", "1970s")
for n in (1, 10, 11): sign("sign_day%d" % n, ["DAY", str(n)], CREAM, INK, "day counter %d" % n, "any", w=300)
im, d = canvas(200, 200); poly(d, [(100, 10), (180, 60), (180, 150), (100, 190), (20, 150), (20, 60)], (60, 140, 200, 255), 7); d.line([(100 * S, 30 * S), (100 * S, 170 * S)], fill=(230, 245, 255, 255), width=8 * S)
for y in (60, 100, 140): d.line([(50 * S, y * S), (150 * S, y * S)], fill=(230, 245, 255, 255), width=5 * S)
fin(im, "water_drop", "a blue water drop with ripples (water leads to people)", "any")
# --- Virginia
for i, y in enumerate((1942, 1969, 1970, 1972, 1973, 1976, 1977)): sign("sign_strike%d" % (i + 1), ["STRIKE %d" % (i + 1), str(y)], (250, 226, 90, 255), INK, "strike counter %d" % (i + 1), "any", w=360)
sign("sign_guinness", ["GUINNESS", "WORLD RECORDS", "7 STRIKES"], RED, (250, 246, 230, 255), "a record plaque: seven strikes", "1970s", w=470)
sign("sign_odds", ["THE ODDS?", "? ? ? ? ?"], CREAM, INK, "an odds card", "any", w=380)
sign("sign_roy", ["ROY SULLIVAN", "1912 - 1983"], (150, 150, 146, 255), INK, "a memorial plaque", "1980s", w=440)
im, d = canvas(230, 220); poly(d, [(60, 20), (140, 20), (150, 120), (215, 150), (215, 205), (40, 205), (40, 120)], (120, 82, 54, 255), 7)
d.ellipse([150 * S, 168 * S, 200 * S, 198 * S], fill=(40, 30, 30, 255)); d.rectangle([40 * S, 192 * S, 215 * S, 210 * S], fill=INK)
fin(im, "boot", "a brown work boot with a scorched hole at the toe", "any")
im, d = canvas(200, 260); poly(d, [(100, 8), (160, 90), (188, 170), (150, 244), (100, 252), (52, 244), (14, 170), (48, 100), (66, 60), (86, 100)], (240, 110, 30, 255), 8)
poly(d, [(100, 90), (136, 160), (120, 226), (100, 232), (80, 226), (66, 160)], (255, 205, 70, 255), 3); fin(im, "flame", "a cartoon flame", "any")
json.dump(REG, open(os.path.join(OUT, "_registry_overnight.json"), "w"), indent=1)
C = json.load(open(os.path.join(LIB, "catalog.json"))); C["props2d"].update(REG); json.dump(C, open(os.path.join(LIB, "catalog.json"), "w"), indent=1, sort_keys=True)
print(len(REG), "props written")
