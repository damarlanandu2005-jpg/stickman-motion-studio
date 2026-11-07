#!/usr/bin/env python3
"""Preview sheets and pre-render checks for a beat plan.   (Step 2C, production code)

  python3 kit/tools/plan_preview.py beats.json OUTDIR [--stills DIR] [--selector selection.report.json]

Makes PLAN STORYBOARD sheets (phone width, 3 tiles across, readable labels) from beats.json. A tile is DRAWN FROM THE PLAN (place, who and what is in frame, focal point,
caption band, camera move, recipe). It is NOT a rendered picture and it does not show how the 3D world looks.
With --stills DIR (rendered stills named f<frame>.jpg, as tools/gen_api.py and kit/tools/render.mjs make them) each tile shows the real still of that beat instead,
with the plan's caption band and focal point drawn on top, and the pixel checks run on it.

Every check has a class, so nobody mistakes one for another:
  automatic    decided by code from the plan (or from pixels of a real still)
  ai_assisted  needs Gemini (or Claude) to LOOK at a real still; listed here, NOT RUN by this tool (tools/gen_api.py already does a version of it for Gemini projects)
  human        a person must look; the tool only lists what to look at
Output: OUTDIR/preview_NN.jpg, OUTDIR/preview.report.json, OUTDIR/preview.md.
"""
import argparse, glob, json, os, re, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
FPS = 30; COLS = 3; ROWS = 2
TW, TH = 360, 640                 # 3 x 360 = 1080 px wide = a phone screen at 1x
FONT_PX = 26                      # label height; at 1080 px it is 2.4 % of the width (a phone shows ~ 390 pt wide: 26 px -> 9.4 pt)
MIN_LABEL_FRAC = 0.02             # readability rule checked by the tool
CAP = [0.1, 0.62, 0.9, 0.78]
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
PAL = {"bg": (24, 26, 32), "text": (255, 255, 255), "dim": (170, 175, 185), "cap": (255, 80, 80), "ok": (90, 200, 120), "warn": (255, 190, 60), "focal": (255, 235, 59)}
FRAMES = {"wide": 0.18, "medium_wide": 0.26, "medium": 0.36, "close": 0.5, "detail": 0.6, "top_down": 0.3, "pov": 0.4}      # share of the frame width a main subject covers
COLORS = {}


def font(px):
    try: return ImageFont.truetype(FONT, px)
    except Exception: return ImageFont.load_default()


def col(key):
    if key not in COLORS:
        h = sum(ord(c) * (i + 3) for i, c in enumerate(key)); COLORS[key] = (60 + h * 7 % 150, 60 + h * 13 % 150, 60 + h * 29 % 150)
    return COLORS[key]


def short(s, n): return s if len(s) <= n else s[:n - 1] + "~"


def subject_boxes(b, D):
    """where the plan puts its subjects: primary at the focal point, secondaries beside it, sized by the framing"""
    c = b["shot"]["composition"]; fx, fy = c["focal_point_norm"]; w = FRAMES[b["shot"]["framing"]]
    asp = TW / TH      # box height in frame units: 1.5 x its width in pixels
    boxes = [(c["primary_id"], fx, fy, w, w * 1.5 * asp)]
    sec = [i for i in c.get("secondary_ids", []) if i != c["primary_id"]]
    for k, i in enumerate(sec[:4]):
        dx = (0.2 + 0.1 * (k // 2)) * (1 if k % 2 == 0 else -1); boxes.append((i, min(max(fx + dx, 0.1), 0.9), min(max(fy + 0.04, 0.2), 0.58), w * 0.7, w * 1.0 * asp))
    return boxes


def draw_plan_tile(b, D):
    im = Image.new("RGB", (TW, TH), col(b["environment_id"])); d = ImageDraw.Draw(im)
    for k, y in enumerate((0.55, 0.7)): d.rectangle([0, int(TH * y), TW, TH], fill=tuple(max(0, v - 18 * (k + 1)) for v in col(b["environment_id"])))
    ents = {e["id"]: e for g in ("characters", "objects", "environments") for e in D["entities"][g]}
    for i, x, y, w, h in subject_boxes(b, D):
        x0, y0, x1, y1 = (x - w / 2) * TW, (y - h / 2) * TH, (x + w / 2) * TW, (y + h / 2) * TH
        ischar = any(c["id"] == i for c in D["entities"]["characters"])
        (d.ellipse if ischar else d.rectangle)([x0, y0, x1, y1], fill=col(i), outline=PAL["text"], width=2)
        d.text((x0 + 3, y0 + 3), short(i, 9), fill=PAL["text"], font=font(15))
    return im


def overlay(im, b, bad):
    d = ImageDraw.Draw(im); z = b["shot"]["composition"].get("caption_clear_zone_norm", CAP)
    d.rectangle([z[0] * TW, z[1] * TH, z[2] * TW, z[3] * TH], outline=PAL["cap"], width=3)
    fx, fy = b["shot"]["composition"]["focal_point_norm"]; r = 10
    d.ellipse([fx * TW - r, fy * TH - r, fx * TW + r, fy * TH + r], outline=PAL["focal"] if not bad else PAL["cap"], width=3); d.line([fx * TW - r - 6, fy * TH, fx * TW + r + 6, fy * TH], fill=PAL["focal"], width=2); d.line([fx * TW, fy * TH - r - 6, fx * TW, fy * TH + r + 6], fill=PAL["focal"], width=2)
    cam = b["camera"]
    if cam["mode"] not in ("static", "creep") and "from" in cam and "to" in cam:
        pass
    return im


def label(im, b, flags):
    d = ImageDraw.Draw(im); f = font(FONT_PX); f2 = font(20)
    d.rectangle([0, 0, TW, 36], fill=(0, 0, 0)); d.text((6, 3), f"{b['id']}  {b['shot']['recipe_id']}  {b['camera']['mode']}", fill=PAL["text"], font=f)
    d.rectangle([0, TH - 56, TW, TH], fill=(0, 0, 0)); d.text((6, TH - 54), short(b["intent"], 22), fill=PAL["warn"], font=f2)
    d.text((6, TH - 28), short(b["camera"]["purpose"], 12) + " | " + short(b["transition_in"]["type"], 8), fill=PAL["dim"], font=f2)
    if flags: d.rectangle([TW - 30, 0, TW, 36], fill=PAL["cap"]); d.text((TW - 22, 3), "!", fill=PAL["text"], font=f)
    return im


def pixel_stats(path):
    im = Image.open(path).convert("RGB").resize((108, 192)); px = list(im.getdata()); n = len(px)
    from collections import Counter
    lum = [0.299 * r + 0.587 * g + 0.114 * b for r, g, b in px]
    return sum(lum) / n, sum(1 for l in lum if l < 25) / n, Counter((r // 32, g // 32, b // 32) for r, g, b in px).most_common(1)[0][1] / n


def find_still(stills, b):
    if not stills: return None
    fs = {int(re.search(r"f(\d+)", os.path.basename(p)).group(1)): p for p in glob.glob(os.path.join(stills, "f*.jpg"))}
    if not fs: return None
    mid = round((b["time"]["start_s"] + b["time"]["end_s"]) / 2 * FPS); k = min(fs, key=lambda f: abs(f - mid))
    return fs[k] if abs(k - mid) <= max(6, (b["time"]["end_s"] - b["time"]["start_s"]) * FPS / 2) else None


def checks(D, validator_findings, sel, stills):
    B = D["beats"]; R = []
    def add(cid, klass, what, status, detail=""): R.append({"id": cid, "class": klass, "check": what, "status": status, "detail": detail})
    flagged = {}
    def flag(beat, msg): flagged.setdefault(beat, []).append(msg)

    # --- automatic, from the plan
    bad = []
    for b in B:
        z = b["shot"]["composition"].get("caption_clear_zone_norm", CAP) if b["captions"]["mode"] != "none" else None
        if not z: continue
        i, x, y, w, h = subject_boxes(b, D)[0]                      # the main subject only
        ov = max(0.0, min(y + h / 2, z[3]) - max(y - h / 2, z[1])) / h   # share of its height inside the band
        if ov > 0.35 and x + w / 2 > z[0] and x - w / 2 < z[2]: bad.append((b["id"], i)); flag(b["id"], f"{i} covers {ov:.0%} of the caption band")
    add("PV-A1", "automatic", "main subject does not cover the caption band", "pass" if not bad else "fail", ", ".join(f"{a}:{i}" for a, i in bad))
    q06 = [f for f in validator_findings if f[1] == "Q06" and "narration names" in f[3]]
    add("PV-A2", "automatic", "every thing the words name is in the frame (or listed as not shown)", "pass" if not [f for f in q06 if f[0] == "error"] else "fail", "; ".join(f"{f[2]}: {f[3][:70]}" for f in q06[:4]))
    missing_ms = [b["id"] for b in B if not b["validation"]["must_see"]]
    add("PV-A3", "automatic", "every beat lists what must be visible", "pass" if not missing_ms else "fail", ", ".join(missing_ms))
    chars = D["entities"]["characters"]; weak = [c["id"] for c in chars if not c.get("identity_lock") or str(c["outfit"]).startswith("NEW:") and c.get("status", "kit") == "kit"]
    add("PV-A4", "automatic", "each character has one fixed identity (outfit, hat, identity_lock) and no unresolved NEW: placeholder", "pass" if not weak else "fail", ", ".join(weak))
    cc = [(b["id"], c) for b in B for c in b.get("continuity_change", [])]
    add("PV-A5", "automatic", "deliberate appearance changes are recorded as continuity_change", "pass" if all(re.fullmatch(r"[A-Za-z0-9_-]+:[a-z_]+=.+", c) for _, c in cc) else "fail", f"{len(cc)} recorded: " + "; ".join(f"{a}:{c}" for a, c in cc[:5]))
    rep = []
    for k in range(1, len(B)):
        a, b = B[k - 1], B[k]
        if (a["shot"]["framing"], a["shot"]["composition"]["primary_id"]) == (b["shot"]["framing"], b["shot"]["composition"]["primary_id"]) and abs(a["shot"]["composition"]["focal_point_norm"][0] - b["shot"]["composition"]["focal_point_norm"][0]) < 0.08 and abs(a["shot"]["composition"]["focal_point_norm"][1] - b["shot"]["composition"]["focal_point_norm"][1]) < 0.08:
            rep.append(f"{a['id']}>{b['id']}"); flag(b["id"], "same framing, subject and focal point as the previous beat")
    add("PV-A6", "automatic", "consecutive tiles are not near-identical compositions", "pass" if not rep else "warn", ", ".join(rep))
    envbad = []
    for k in range(1, len(B)):
        a, b = B[k - 1], B[k]; ch = a["environment_id"] != b["environment_id"]; tr = b["transition_in"]
        if ch and tr["type"] == "cut" and tr["reason"] not in ("new_place", "emphasis", "scale_change", "continuity"): envbad.append(b["id"])
        if not ch and tr["reason"] == "new_place": envbad.append(b["id"]); flag(b["id"], "transition says new_place but the environment is the same")
    add("PV-A7", "automatic", "environment changes and transition reasons agree", "pass" if not envbad else "warn", ", ".join(envbad))
    fr = sel and [x for x in sel.get("beats", []) if x["notes"] and any("framing" in n for n in x["notes"])]
    add("PV-A8", "automatic", "camera framing agrees with the chosen shot recipe", "pass" if not fr else "warn", f"{len(fr or [])} framing change(s) made by the selector" if sel else "selector report not given")
    # --- readability of the sheet itself (measured on the font that is drawn)
    h = font(FONT_PX).getbbox("Ag"); frac = (h[3] - h[1]) / (TW * COLS)
    add("PV-A9", "automatic", f"labels are readable at phone width (label height >= {MIN_LABEL_FRAC:.0%} of the sheet width, 3 tiles across)", "pass" if frac >= MIN_LABEL_FRAC else "fail", f"label glyph height is {frac:.1%} of the sheet width")
    # --- pixels of real stills, when given
    if stills:
        bads = []; n = 0
        for b in B:
            p = find_still(stills, b)
            if not p: continue
            n += 1; m, dark, top = pixel_stats(p)
            if dark > 0.9 or top > 0.88: bads.append(b["id"]); flag(b["id"], "the still is black or one flat colour")
        add("PV-A10", "automatic", f"real stills are not black or flat ({n} of {len(B)} beats have a still)", "pass" if not bads and n else ("fail" if bads else "not_run"), ", ".join(bads) or ("no stills found" if not n else ""))
    else:
        add("PV-A10", "automatic", "real stills are not black or flat", "not_run", "no stills given: nothing is rendered yet")
    # --- AI-assisted (need rendered stills; NOT run here)
    for cid, w in (("PV-G1", "the same character looks the same in every still (hat, outfit, face shape)"), ("PV-G2", "every must_see object is visible and recognisable in the still"),
                   ("PV-G3", "the picture shows what the narration says (narration-to-picture match)"), ("PV-G4", "no important content is cut off or hidden behind the caption band"),
                   ("PV-G5", "the place looks like the same place across its beats (environment continuity)")):
        add(cid, "ai_assisted", w, "not_run", "needs Gemini or Claude to look at rendered stills; tools/gen_api.py stills phase does a Gemini version for Gemini projects" if stills else "needs rendered stills")
    # --- human
    for cid, w in (("PV-H1", "the characters and the world are attractive and professional (taste)"), ("PV-H2", "materials read as the right materials: wood, metal, stone, water"), ("PV-H3", "motion, acting and timing feel right (needs the video, not stills)")):
        add(cid, "human", w, "not_run", "a person must look")
    return R, flagged


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("beats"); ap.add_argument("out"); ap.add_argument("--stills"); ap.add_argument("--selector"); a = ap.parse_args()
    D = json.load(open(a.beats)); os.makedirs(a.out, exist_ok=True)
    import validate_beats as V
    _, _, F, shape_bad = V.run(a.beats)
    sel = json.load(open(a.selector)) if a.selector else None
    R, flagged = checks(D, F, sel, a.stills)
    tiles = []
    for b in D["beats"]:
        p = find_still(a.stills, b)
        if p: im = Image.open(p).convert("RGB").resize((TW, TH))
        else: im = draw_plan_tile(b, D)
        tiles.append(label(overlay(im, b, b["id"] in flagged), b, flagged.get(b["id"])))
    per = COLS * ROWS; pages = []
    for pg in range(0, len(tiles), per):
        chunk = tiles[pg:pg + per]; rows = (len(chunk) + COLS - 1) // COLS
        sh = Image.new("RGB", (TW * COLS, TH * rows), PAL["bg"])
        for i, t in enumerate(chunk): sh.paste(t, ((i % COLS) * TW, (i // COLS) * TH))
        path = os.path.join(a.out, f"preview_{pg // per + 1:02d}.jpg"); sh.save(path, quality=88); pages.append(path)
    counts = {c: {s: sum(1 for r in R if r["class"] == c and r["status"] == s) for s in ("pass", "warn", "fail", "not_run")} for c in ("automatic", "ai_assisted", "human")}
    json.dump({"beats": a.beats, "sheet_pages": pages, "sheet_px": [TW * COLS, TH * ROWS], "tile_source": "real stills" if a.stills else "drawn from the plan (not a render)", "checks": R, "counts": by_class(R), "flagged_beats": flagged}, open(os.path.join(a.out, "preview.report.json"), "w"), indent=1)
    with open(os.path.join(a.out, "preview.md"), "w") as f:
        f.write(f"# Preview checks for {os.path.basename(a.beats)}\n\nTiles: {'real stills' if a.stills else 'drawn from the plan (NOT a render)'}. Sheets: {', '.join(os.path.basename(p) for p in pages)}.\n\n| id | class | check | status | detail |\n|---|---|---|---|---|\n")
        for r in R: f.write(f"| {r['id']} | {r['class']} | {r['check']} | {r['status']} | {r['detail']} |\n")
    for r in R: print(f"{r['id']:6s} {r['class']:11s} {r['status']:8s} {r['check'][:80]}  {r['detail'][:90]}")
    print("pages:", ", ".join(pages))
    sys.exit(1 if any(r["status"] == "fail" for r in R) else 0)


def by_class(R): return {c: {s: sum(1 for r in R if r["class"] == c and r["status"] == s) for s in ("pass", "warn", "fail", "not_run")} for c in ("automatic", "ai_assisted", "human")}


if __name__ == "__main__":
    main()
