#!/usr/bin/env python3
"""Gemini writes the scene code with DIRECT API calls (no agent CLI), tests every new object alone, looks at rendered stills and fixes the code.

usage: python3 tools/gen_api.py <project_dir> [--model gemini-3.1-pro-preview] [--asset-rounds 3] [--shot-rounds 5] [--dry]

The project dir comes from kit/tools/setup.sh + make_voice.py + timing.py (voice.mp3, script.txt, shot_notes.txt, work/words.json, work/phrases.json).
Steps: 1) one call writes story.js + world (with an ASSETS builder for every PLACE and NEW object) + cast + audio
       2) ASSET PHASE: every builder is rendered alone (3-4 views + a person card for scale, real size printed); Gemini checks each (PASS/FAIL) and fixes
       3) SHOT PHASE: 3 stills per shot + automatic brightness/emptiness metrics; Gemini checks every shot (PASS/FAIL) and fixes
       4) audio + mix
Token use of every call is written to work/usage.json (real numbers, for the cost report)."""
import argparse, json, os, re, subprocess, sys, time
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("project"); ap.add_argument("--model", default="gemini-3.1-pro-preview")
ap.add_argument("--asset-rounds", type=int, default=3); ap.add_argument("--shot-rounds", type=int, default=5); ap.add_argument("--dry", action="store_true")
A = ap.parse_args()
P = Path(A.project).resolve(); KIT = Path(__file__).resolve().parent.parent / "kit"; ROOT = KIT.parent
WEB = P / "web"; WORK = P / "work"; WORK.mkdir(exist_ok=True)
MARK_A, MARK_B = "// ---------- world ----------", "// ---------- cards ----------"


def rd(p): return Path(p).read_text(encoding="utf-8")


def log(*a): print(*a, flush=True)


# ------------------------------------------------------------------ script notes: shot table, assets
NOTES = rd(P / "shot_notes.txt")


def shot_table():
    w = json.load(open(WORK / "words.json")); ph = json.load(open(WORK / "phrases.json"))
    total = round(ph["duration"] * 30)
    shots = re.findall(r'SHOT\s+(\d+)\s*(?:\(([^)]*)\))?\s*\n\s*WORDS:\s*"(.*?)"', NOTES)
    i, st = 0, []
    for n, name, words in shots:
        k = len(words.split()); st.append((f"s{n}" + (("_" + re.sub(r"\W+", "", name)) if name else ""), round(w[min(i, len(w) - 1)]["s"] * 30), words)); i += k
    rows = []
    for j, (id_, a, words) in enumerate(st):
        b = (st[j + 1][1] - 1) if j + 1 < len(st) else total - 1
        rows.append((id_, a, b, words))
    return total, rows, i, len(w)


def section(name, nxt):
    m = re.search(rf"^\s*{name}:\s*\n(.*?)(?=^\s*(?:{nxt}):|^\s*SHOT\s+\d+|\Z)", NOTES, re.S | re.M)
    return m.group(1) if m else ""


def first_m(txt):
    m = re.search(r"([\d.]+)\s*m\b", txt)
    return float(m.group(1)) if m else None


def asset_list():
    """PLACES and NEW OBJECTS from the script -> [{name, kind, declared (m) or None, light}]"""
    light_of = {}
    for blk in re.split(r"\n(?=\s*SHOT\s+\d+)", NOTES):
        pl = re.search(r"^\s*PLACE:\s*(\S+)", blk, re.M); lg = re.search(r"^\s*LIGHT:\s*(\S+)", blk, re.M)
        if pl and lg and pl.group(1) not in light_of: light_of[pl.group(1)] = lg.group(1)
    out = []
    for line in section("PLACES", "NEW OBJECTS|CAST").splitlines():
        m = re.match(r"\s*-\s*([A-Za-z0-9\-_ ]+?)\s*\|(.*)", line)
        if m: out.append(dict(name=m.group(1).strip(), kind="place", declared=first_m(m.group(2)), light=light_of.get(m.group(1).strip(), "day")))
    for line in section("NEW OBJECTS", "PLACES|CAST").splitlines():
        m = re.match(r"\s*-\s*NEW:\s*([^|]+?)\s*\|(.*)", line)
        if m: out.append(dict(name=m.group(1).strip(), kind="asset", declared=first_m(m.group(2)), light="day"))
    return out


# ------------------------------------------------------------------ prompt
SYSTEM = """You write the CODE for ONE vertical animated cartoon short (1080x1920, 30 fps) with a fixed kit (three.js toon renderer + 2D 'bean-head' character cards).
The AUTHOR writes the scenes (shot_notes.txt); you only write code that shows them EXACTLY: same shots, same order, same places, light, camera moves, characters, effects, sounds.
Never drop, merge or reorder shots. If a field is empty choose something simple and list it in work/NOTES.md. No real living people, no logos, no captions.
Quality rules: every shot must have a visible, well-built environment (ground, sky, props that the notes name), characters standing in front of the camera, never inside walls/fences,
camera never inside objects, nothing cut off, scenes bright enough to read. Honour every MUST SEE and MUST NOT line of the notes.
Use the kit's ready-made helpers (crowd, emu, emuHerd, horseCart, hatx, FACE, OUTFITS, fx* cards) before writing custom drawing code.
The portrait frame is narrow: the picture is about 0.52 x distance wide (2 m -> 1 m wide, 6 m -> 3 m, 15 m -> 8 m). Stage characters in depth, use fov 50-58 for wide shots.
A missing face/outfit/hat/prop: ADD it (cast.js: Object.assign(FACE,{...}), Object.assign(OUTFITS,{...}), new export const card functions; world.js: ASSETS builders). Never silently substitute another one.
Poses that do not exist (crouch, kneel, run, lie, salute): use the nearest listed pose and say so in work/NOTES.md.
Crowds: draw many people per card with the crowd helper (each card canvas is large; never create hundreds of cards).

THE ASSETS RULE (most important for new topics): world.js must define  const ASSETS = { 'EXACT NAME': () => THREE.Group, ... }  BEFORE it is used, with one builder for EVERY place listed under PLACES
and EVERY object listed under NEW OBJECTS in the shot notes (the key is the exact name written there). A builder returns a THREE.Group in REAL METERS (size as declared in the notes), y up,
origin on the ground at the centre, parts added with add(geo, mat, x, y, z, group). Build the world by calling the builders and placing the results (world.add(g)); every world object
must be parented to `world` (never directly to scene). Rooms/buildings need floor, walls, ceiling or sky opening and light so the inside is readable (indoor light preset exists).
A tool renders each builder alone (3-4 views + a person card for scale, real size printed) and you must fix it until its size, shape and look match the notes.

OUTPUT FORMAT (strict): return files as blocks, nothing else inside the blocks but the file text:
<<<FILE web/story.js>>>
...full file...
<<<END>>>
Files you may write:
 - web/story.js   full file. Same exports as the example (FPS, TOTAL, DECK, SHOTS, shotAt, smooth, LIGHTS, lightFor, camAt, dofAt, worldAt, actorsAt, fxAt, ...). TOTAL is given. Shot a/b frames are given in the shot table: use them exactly.
                  LIGHTS must contain the presets the notes use (day, dawn, golden, night, indoor).
 - web/world.js   the WORLD section of main.js (replaces everything between '// ---------- world ----------' and '// ---------- cards ----------').
                  It runs inside main.js, so THREE, T (toon.js), P (paint.js), M (materials), toon(), add, box, tbox, uvScale, mergeGeos, placed, canvasTex, rnd, cloudsInit, scene are in scope.
                  It MUST define: const DECK; const ASSETS (see above); const world (THREE.Group added to scene); const waterU = {t,deep,shal,glint} (keep the line of the example); const clouds = cloudsInit();
                  and function worldState(S, f) (S = worldAt(f) from story.js; it must set waterU.t.value = f / 30). Use merged geometry for repeated meshes (instanced meshes break the ink pass).
 - web/cast.js    code APPENDED to roman.js (so it can use everything defined there and in toonbase: Pen, FACE, OUTFITS, hatOn, mul, ellPts, rrect, curve, INK, ...). Export new card-drawing functions with `export const` so story.js can call them as T.name.
 - audio.py       full file. First 3 lines exactly as in the example (they load audiolib.py). Writes music.wav and sfx.wav stems. Cue times use F(frame)=frame/30.
 - work/PLAN.md   the author's shots with frame ranges (no new shots).   - work/NOTES.md  decisions and every field you had to choose yourself.
On a first answer return all of story.js, world.js, cast.js (may be tiny), audio.py, PLAN.md, NOTES.md.

CHECK ROUNDS: you get rendered images plus measured data. Start your answer with a line-by-line checklist, ONE line for EVERY asset (or every shot) in exactly this form:
   NAME: PASS - short reason        or        NAME: FAIL - what is wrong and how you will fix it
Judge: size vs declared size, shape and look match the notes, bright enough, nothing flat/empty/black, camera outside objects, MUST SEE visible, MUST NOT absent, characters not cut off, light as written.
Be strict: a flat grey block, a huge wall, a black or empty frame, a missing named prop is a FAIL. Then return ONLY the files you fix, each in full. If every line is PASS, return no files."""


def static_context():
    sk = rd(ROOT / "skills/cartoon-audio-short/SKILL.md")
    a = sk.index("### 4.2"); b = sk.index("### 4.8"); g = sk.index("## Engine gotchas")
    main = rd(KIT / "engine/main.js"); head = main[: main.index(MARK_A)]
    parts = [
        ("SCRIPT FORMAT AND KIT NAME LIST (what the author may write)", rd(ROOT / "scripts/FORMAT.md")),
        ("LOOK RULES (quality targets: sets, light, ink, camera)", rd(KIT / "docs/LOOK_RULES.md")),
        ("REFERENCE NUMBERS (measured ranges + style grammar from real shorts; adaptive, read the notes)", rd(KIT / "docs/REFERENCE_NUMBERS.md")),
        ("PLAYBOOK (how real shorts handle camera, cuts, light, characters, props, effects, script to picture; rules with numbers and evidence, use the recipe for each beat)", rd(KIT / "docs/PLAYBOOK.md")),
        ("KIT METHOD (rules from the skill)", sk[a:b] + "\n" + sk[g:]),
        ("main.js, everything BEFORE the world section (materials M, toon(), add, tbox, helpers) - for reference, do not output", head),
        ("EXAMPLE web/world.js (works with the example story.js)", rd(KIT / "example/emu_war/world.js")),
        ("EXAMPLE web/story.js", rd(KIT / "example/emu_war/story.js")),
        ("web/motion.js (camFromKeys, easing, walk, idle, blinkAt, ...)", rd(KIT / "engine/motion.js")),
        ("web/roman.js = kit cast library (OUTFITS, FACE additions, romanFront, emu, emuHerd, crowd, horseCart, fx cards). cast.js is appended to it", rd(KIT / "engine/roman.js")),
        ("audiolib.py (synth library for audio.py)", rd(KIT / "tools/audiolib.py")),
        ("EXAMPLE audio.py", rd(KIT / "example/emu_war/audio.py")),
    ]
    return "\n\n".join(f"===== {t} =====\n{x}" for t, x in parts)


def task_text(total, rows, assets):
    tab = "\n".join(f"{id_:14s} frames {a:4d}-{b:4d}  ({(b - a + 1) / 30:.1f}s)  words: {w}" for id_, a, b, w in rows)
    al = "\n".join(f"  ASSETS key '{x['name']}'  ({x['kind']}, declared size {x['declared']} m)" for x in assets) or "  (the notes list no PLACES / NEW OBJECTS: still define ASSETS = {} )"
    return (f"===== THIS VIDEO =====\nTOTAL = {total} frames.\n\nSHOT TABLE (use these ids and frame ranges in story.js SHOTS):\n{tab}\n\n"
            f"ASSETS you must define (one builder each, exact key):\n{al}\n\n"
            f"narration (script.txt):\n{rd(P / 'script.txt')}\n\nAUTHOR'S SHOT NOTES (shot_notes.txt):\n{NOTES}\n\n"
            "Write all files now (first answer).")


# ------------------------------------------------------------------ Gemini client
from google import genai
from google.genai import types

client = None if os.environ.get("GEN_FAKE") else genai.Client(vertexai=True, project=os.environ["GOOGLE_CLOUD_PROJECT"], location=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"), http_options=types.HttpOptions(timeout=900000))
USAGE = []


def call(contents, label):
    if os.environ.get("GEN_FAKE"):   # offline test of the pipeline: first call returns the file, later calls say all PASS
        return rd(os.environ["GEN_FAKE"]) if label == "write" else "ALL: PASS - fake"
    for k in range(7):
        try:
            r = client.models.generate_content(model=A.model, contents=contents, config=types.GenerateContentConfig(
                system_instruction=SYSTEM, temperature=0.4, max_output_tokens=65000))
            break
        except Exception as e:
            s = str(e)
            log(f"[{label}] API error try {k + 1}: {s[:200]}")
            if k == 6 or any(x in s for x in ("400 ", "401", "403", "404", "INVALID_ARGUMENT", "PERMISSION_DENIED", "NOT_FOUND")): raise   # everything else (disconnects, timeouts, 429/5xx) is retried
            time.sleep(20 * (k + 1))
    u = r.usage_metadata
    rec = dict(label=label, model=A.model, prompt=u.prompt_token_count, cached=getattr(u, "cached_content_token_count", 0) or 0,
               output=u.candidates_token_count, thoughts=getattr(u, "thoughts_token_count", 0) or 0)
    USAGE.append(rec); (WORK / "usage.json").write_text(json.dumps(USAGE, indent=1)); log("usage", rec)
    return r.text or ""


def prune_images(hist):
    """keep only the newest images in the history (older ones are replaced by a text note) so input tokens stay small"""
    for c in hist:
        if c.role != "user": continue
        c.parts = [types.Part(text="[older image removed]") if getattr(p, "inline_data", None) else p for p in c.parts]


# ------------------------------------------------------------------ apply files + build
FILES = {}   # path -> text (latest version of what the model wrote)
BLOCK = re.compile(r"<<<FILE\s+(\S+?)\s*>>>\n(.*?)\n?<<<END>>>", re.S)
FAILLINE = re.compile(r"^\s*[-*]?\s*`?([^:\n]{1,80}?)`?\s*:\s*\**FAIL", re.M | re.I)


def clean(t):
    t = t.strip("\n")
    m = re.match(r"^```[a-z]*\n(.*?)\n```$", t, re.S)
    return m.group(1) if m else t


def take(text):
    got = {}
    for path, body in BLOCK.findall(text):
        path = path.strip().lstrip("./")
        if path in ("web/story.js", "web/world.js", "web/cast.js", "audio.py", "work/PLAN.md", "work/NOTES.md"): got[path] = clean(body)
    FILES.update(got); return got


# ------------------------------------------------------------------ look (colour strength, drift, push) tuned from reference ranges
import re as _re
def _refs():
    try:
        st = json.loads((KIT / "reference/ref_stats.json").read_text())["metrics"]
        return dict(sat=st["sat"]["refs"], palette=st["palette"]["refs"], edge=st["edge"]["refs"], mean=st["mean"]["refs"])
    except Exception:
        return None
REFS = _refs()
LOOKSAT = 1.0
def ensure_look():
    """story.js always exports LOOK (colour strength auto-tuned, slow drift + push so nothing is frozen). Pipeline-owned: the model need not write it."""
    t = FILES.get("web/story.js")
    if not t: return
    line = "export const LOOK = { sat: %.2f, vibr: 0.25, drift: 1, push: 1 };" % LOOKSAT
    if _re.search(r"export const LOOK\s*=\s*\{[^}]*\};?", t): t = _re.sub(r"export const LOOK\s*=\s*\{[^}]*\};?", line, t, count=1)
    else: t = t.rstrip() + "\n" + line
    FILES["web/story.js"] = t


def build():
    """write files into the project; return error text or ''"""
    ensure_look()
    for path in ("web/story.js", "audio.py", "work/PLAN.md", "work/NOTES.md"):
        if path in FILES: (P / path).write_text(FILES[path] + "\n", encoding="utf-8")
    main = rd(KIT / "engine/main.js"); a = main.index(MARK_A); b = main.index(MARK_B)
    world = FILES.get("web/world.js")
    if world:
        if MARK_A not in world: world = MARK_A + "\n" + world
        (WEB / "main.js").write_text(main[:a] + world.rstrip() + "\n\n" + main[b:], encoding="utf-8")
    else:
        (WEB / "main.js").write_text(main, encoding="utf-8")
    (WEB / "roman.js").write_text(rd(KIT / "engine/roman.js") + "\n" + FILES.get("web/cast.js", "") + "\n", encoding="utf-8")
    (WEB / "toon.js").write_text(rd(WEB / "toonbase.js") + "\n" + rd(WEB / "roman.js"), encoding="utf-8")
    for f in ("web/story.js", "web/main.js", "web/toon.js"):
        r = subprocess.run(["node", "--check", str(P / f)], capture_output=True, text=True)
        if r.returncode: return f"SYNTAX ERROR in {f}:\n{r.stderr[-1500:]}"
    r = subprocess.run(["node", "-e", "import('./web/story.js').then(m=>console.log(JSON.stringify({T:m.TOTAL,S:m.SHOTS.map(s=>[s.id,s.a,s.b])})))"],
                       cwd=P, capture_output=True, text=True)
    if r.returncode: return "story.js does not load:\n" + r.stderr[-1500:]
    return ""


# ------------------------------------------------------------------ pictures + automatic measurements
from PIL import Image, ImageDraw


def metrics(path):
    im = Image.open(path).convert("RGB").resize((108, 192)); px = list(im.getdata()); n = len(px)
    lum = [0.299 * r + 0.587 * g + 0.114 * b for r, g, b in px]
    mean = sum(lum) / n; dark = sum(1 for l in lum if l < 25) / n
    from collections import Counter
    top = Counter((r // 32, g // 32, b // 32) for r, g, b in px).most_common(1)[0][1] / n
    return mean, dark, top


def flags_for(mean, dark, top):
    hard = dark > 0.9 or top > 0.88
    soft = mean < 45 or dark > 0.55 or top > 0.7
    return hard, soft


def tile(path, label, w=270, h=480):
    im = Image.open(path).convert("RGB").resize((w, h)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, min(w, 8 + 6 * len(label)), 13], fill=(0, 0, 0)); d.text((3, 2), label, fill=(255, 255, 0)); return im


def grid(ims, cols):
    sh = Image.new("RGB", (ims[0].width * min(cols, len(ims)), ims[0].height * ((len(ims) + cols - 1) // cols)))
    for i, im in enumerate(ims): sh.paste(im, ((i % cols) * im.width, (i // cols) * im.height))
    return sh


def jpg(im, p, q=85): im.save(p, quality=q); return Path(p)


# ------------------------------------------------------------------ asset phase
def asset_round(tag, assets):
    """render every asset alone; return (list of image paths, report text, hard_problem bool)"""
    specs = []
    for x in assets:
        views = ["front", "high", "in1", "in2"] if x["kind"] == "place" else ["front", "side", "high"]
        for v in views: specs.append(dict(name=x["name"], kind=x["kind"], view=v, light=x["light"]))
    out = P / "stills" / tag; subprocess.run(["rm", "-rf", str(out)]); out.mkdir(parents=True)
    (out / "spec.json").write_text(json.dumps(specs))
    r = subprocess.run(["node", "render.mjs", str(out), "0"], cwd=P, capture_output=True, text=True, timeout=3000, env=dict(os.environ, TESTJSON=str(out / "spec.json")))
    infos = []
    for l in (r.stdout + r.stderr).splitlines():
        if l.startswith("TESTINFO "): infos.append(json.loads(l[9:]))
    rep, hard, by = [], False, {}
    errs = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l.startswith(("ERR", "page error")))[-800:]
    if len(infos) != len(specs): rep.append("RENDER PROBLEM: " + (errs or "test render did not finish")); hard = True
    for i, (sp, inf) in enumerate(zip(specs, infos)):
        x = next(a for a in assets if a["name"] == sp["name"]); p = out / f"t{i:03d}.jpg"
        if not inf.get("ok"): by.setdefault(sp["name"], dict(err=inf.get("err", "failed"), tiles=[], size=None)); continue
        d = by.setdefault(sp["name"], dict(err=None, tiles=[], size=inf["size"], decl=x["declared"], flag=[]))
        if p.exists():
            m = metrics(p); h, s_ = m[1] > 0.9, (m[0] < 45 or m[1] > 0.55)   # the test floor is one flat colour by design: only black/dark counts here
            d["tiles"].append(tile(p, f"{sp['name'][:22]} {sp['view']}"))
            if h: d["flag"].append(f"{sp['view']}: flat/black picture")
            elif s_: d["flag"].append(f"{sp['view']}: dark or mostly one colour (brightness {m[0]:.0f}, black {m[1]:.0%}, flat {m[2]:.0%})")
    rows = []
    for name, d in by.items():
        if d["err"]: rep.append(f"{name}: BUILDER ERROR - {d['err']}"); hard = True; continue
        sx, sy, sz = d["size"]; ext = max(sx, sz); line = f"{name}: measured size {sx} x {sy} x {sz} m (x, height, z)"
        if d.get("decl"):
            line += f", declared {d['decl']} m"
            if ext > d["decl"] * 2.5 or ext < d["decl"] * 0.4: line += "  <-- SIZE MISMATCH"; hard = True
        if d["flag"]: line += "  <-- " + "; ".join(d["flag"])
        rep.append(line)
        if d["tiles"]: rows.append(d["tiles"])
    miss = [x["name"] for x in assets if x["name"] not in by]
    for m_ in miss: rep.append(f"{m_}: NO RESULT"); hard = True
    imgs = []
    for k in range(0, len(rows), 4):   # 4 assets per sheet
        chunk = rows[k:k + 4]; w = max(len(r) for r in chunk)
        sh = Image.new("RGB", (270 * w, 480 * len(chunk)))
        for y, row in enumerate(chunk):
            for xx, t in enumerate(row): sh.paste(t, (xx * 270, y * 480))
        imgs.append(jpg(sh, P / "stills" / f"assets_{tag}_{k // 4}.jpg"))
    return imgs, "\n".join(rep), hard


# ------------------------------------------------------------------ shot phase
def stills(tag):
    r = subprocess.run(["node", "-e", "import('./web/story.js').then(m=>console.log(JSON.stringify(m.SHOTS.map(s=>[s.id,s.a,s.b]))))"], cwd=P, capture_output=True, text=True)
    shots = json.loads(r.stdout.strip().splitlines()[-1]); fr = []
    for id_, a, b in shots:
        for q in (0.15, 0.5, 0.9):
            f = int(a + (b - a) * q)
            if f not in [x[1] for x in fr]: fr.append((id_, f))
    out = P / "stills" / tag; subprocess.run(["rm", "-rf", str(out)])
    r = subprocess.run(["node", "render.mjs", str(out), ",".join(str(f) for _, f in fr)], cwd=P, capture_output=True, text=True, timeout=3400)
    msgs = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l.startswith(("ERR", "page error", "PAGE")) or "Error" in l)[-2000:]
    tiles, rep, hard_shots, soft_shots = [], [], [], []
    for id_, f in fr:
        p = out / f"f{f:04d}.jpg"
        if not p.exists(): continue
        m = metrics(p); h, s_ = flags_for(*m); tiles.append((id_, f, p))
        if h: hard_shots.append(id_); rep.append(f"{id_} f{f}: BLACK or FLAT picture (brightness {m[0]:.0f}, black {m[1]:.0%}, one flat colour {m[2]:.0%})")
        elif s_: soft_shots.append(id_); rep.append(f"{id_} f{f}: dark or mostly one colour (brightness {m[0]:.0f}, black {m[1]:.0%}, flat {m[2]:.0%})")
    if not tiles: return None, [], msgs or "no stills were rendered", [], []
    global LOOKSAT
    if REFS:
        try:
            sys.path.insert(0, str(KIT / "tools")); import ref_measure as RM
            st_ = {(i, f): RM.still_stats(str(p)) for i, f, p in tiles}
            sats = sorted(v["sat"] for v in st_.values()); med = sats[len(sats) // 2]; lo, mid, hi = REFS["sat"]["lo"], REFS["sat"]["mid"], REFS["sat"]["hi"]
            if med < lo or med > hi:
                new_sat = max(0.7, min(1.7, LOOKSAT * (mid / max(med, 0.05)) ** 0.8)); rep.append(f"AUTO COLOUR: median colour strength {med:.2f}, reference range {lo:.2f}-{hi:.2f}: pipeline sets LOOK.sat {LOOKSAT:.2f} -> {new_sat:.2f} (you do not need to do this)"); LOOKSAT = new_sat
            for (i, f), v in st_.items():
                bits = []
                if v["palette"] < 0.6 * REFS["palette"]["lo"]: bits.append(f"few colours (palette {v['palette']}, references {REFS['palette']['lo']:.0f}+): give the place 4 or more distinct hues (wall, floor, trim, accent, props)")
                if v["edge"] < 0.5 * REFS["edge"]["lo"]: bits.append(f"plain, little detail (detail {v['edge']:.3f}, references {REFS['edge']['lo']:.3f}+): add dressing pieces, textures, signs, small props")
                if bits and i not in hard_shots and i not in soft_shots: soft_shots.append(i)
                if bits: rep.append(f"{i} f{f}: " + "; ".join(bits))
        except Exception as e_:
            print("WARNING reference colour check skipped:", repr(e_), flush=True); rep.append(f"(reference colour check skipped: {e_})")
    sheet = jpg(grid([tile(p, f"{i} f{f}") for i, f, p in tiles], 6), P / "stills" / f"sheet_{tag}.jpg")
    return sheet, tiles, msgs + ("\n" if msgs else "") + "\n".join(rep), hard_shots, soft_shots


def audio():
    env = dict(os.environ, FRAMES=str(TOTAL))
    r = subprocess.run(["python3", "audio.py"], cwd=P, capture_output=True, text=True, env=env, timeout=900)
    if r.returncode or not (P / "music.wav").exists(): return "audio.py failed:\n" + (r.stderr or r.stdout)[-1500:]
    r = subprocess.run(["python3", "mix.py", "voice.mp3", "music.wav", "sfx.wav"], cwd=P, capture_output=True, text=True, timeout=900)
    log(r.stdout[-400:])
    return "" if r.returncode == 0 and (P / "mix_raw.wav").exists() else "mix.py failed:\n" + (r.stderr or r.stdout)[-1000:]


# ------------------------------------------------------------------ main
TOTAL, ROWS, used, nwords = shot_table()
ASSETS = asset_list()
log(f"{len(ROWS)} shots, {TOTAL} frames, words used {used}/{nwords}; assets to test: {[a['name'] for a in ASSETS]}")
sctx, task = static_context(), task_text(TOTAL, ROWS, ASSETS)
log(f"prompt chars: static {len(sctx)}, task {len(task)}")
if A.dry: sys.exit(0)
hist = [types.Content(role="user", parts=[types.Part(text=sctx), types.Part(text=task)])]


def ask(parts, label):
    global hist
    prune_images(hist)
    hist.append(types.Content(role="user", parts=parts))
    txt = call(hist, label); hist.append(types.Content(role="model", parts=[types.Part(text=txt)]))
    return txt


txt = call(hist, "write"); hist.append(types.Content(role="model", parts=[types.Part(text=txt)]))
got = take(txt); log("first answer files:", list(got))
good = {}

# ---- phase A: every new object / place alone
if ASSETS:
    for rd_i in range(A.asset_rounds + 1):
        err = build()
        imgs, rep, hard = ([], "", False)
        if not err: imgs, rep, hard = asset_round(f"a{rd_i}", ASSETS)
        log(f"asset round {rd_i}: build_err={bool(err)} hard={hard}\n{rep[:1500]}")
        if rd_i == A.asset_rounds: break
        t = "ASSET CHECK. Each asset was built alone and rendered (columns = views; a small person card is next to anything over 1.2 m for scale; the grey ground is only the test floor).\n"
        t += "MEASURED DATA:\n" + (rep or "(none)") + "\n"
        if err: t += "\nBUILD ERROR (fix it):\n" + err + "\n"
        t += "\nAssets to judge, one checklist line each (NAME: PASS|FAIL - reason): " + "; ".join(a["name"] for a in ASSETS)
        parts = [types.Part.from_bytes(data=p.read_bytes(), mime_type="image/jpeg") for p in imgs] + [types.Part(text=t)]
        txt = ask(parts, f"asset{rd_i + 1}")
        fails = FAILLINE.findall(txt); got = take(txt); log("asset fix files:", list(got), "fails:", fails)
        if not got and not fails and not hard and not err: break
        if not got and not err and not hard: break

# ---- phase B: every shot
for rd_i in range(A.shot_rounds + 1):
    err = build()
    aerr = "" if err else audio()
    sheet, tl, msgs, hard_shots, soft_shots = (None, [], "", [], [])
    if not err:
        sheet, tl, msgs, hard_shots, soft_shots = stills(f"r{rd_i}")
        if sheet: good = dict(FILES)
    log(f"shot round {rd_i}: build_err={bool(err)} audio_err={bool(aerr)} sheet={bool(sheet)} hard={hard_shots} soft={soft_shots}")
    if rd_i == A.shot_rounds: break
    parts = []
    if sheet: parts.append(types.Part.from_bytes(data=sheet.read_bytes(), mime_type="image/jpeg"))
    flagged = list(dict.fromkeys(hard_shots + soft_shots + [x.strip() for x in FAILLINE.findall(globals().get("txt", ""))]))[:4]
    mids = {}
    for id_, f, p in tl: mids.setdefault(id_, []).append(p)
    for id_ in flagged:   # full-size middle still for flagged shots
        if id_ in mids:
            p = mids[id_][len(mids[id_]) // 2]
            parts.append(types.Part.from_bytes(data=jpg(Image.open(p).convert("RGB").resize((540, 960)), P / "stills" / f"full_{id_}.jpg").read_bytes(), mime_type="image/jpeg"))
    t = "SHOT CHECK. First image: contact sheet of the rendered stills (3 per shot: start, middle, end; label = shot id + frame). " + ("Then full-size stills of flagged shots: " + ", ".join(flagged) + ". " if flagged else "")
    if not sheet: t = "The render failed. "
    if err: t += "\nBUILD ERROR (fix it):\n" + err
    if msgs: t += "\nMEASURED DATA and BROWSER LOG:\n" + msgs
    if aerr: t += "\nAUDIO ERROR (fix audio.py):\n" + aerr
    t += ("\nShot ids to judge, one checklist line each (ID: PASS|FAIL - reason): " + "; ".join(r[0] for r in ROWS) +
          "\nCompare each shot with the author's notes (PLACE, LIGHT, CAMERA, CHARACTERS, MUST SEE, MUST NOT).")
    parts.append(types.Part(text=t))
    txt = ask(parts, f"shot{rd_i + 1}")
    fails = FAILLINE.findall(txt); got = take(txt)
    log("shot fix files:", list(got), "fails:", fails)
    if not got and not fails and not err and not aerr and not hard_shots: log("all shots PASS"); break
    if not got and not err and not aerr: break

# final: make sure what is on disk builds and renders; else fall back to the last good version
err = build()
if err and good:
    log("final version broken, using last good version"); FILES.clear(); FILES.update(good); err = build()
aerr = audio() if not err else "skipped"
(WORK / "NOTES.md").write_text((rd(WORK / "NOTES.md") if (WORK / "NOTES.md").exists() else "") + f"\n\n## pipeline\ncalls: {len(USAGE)}. final build error: {err or 'none'}. audio: {aerr or 'ok'}.\n", encoding="utf-8")
if err: log("FAILED:", err); sys.exit(1)
(WORK / "DONE.txt").write_text("\n".join(f"{id_}: {w}" for id_, a, b, w in ROWS) + "\n", encoding="utf-8")
log("DONE", json.dumps(USAGE))
