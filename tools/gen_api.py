#!/usr/bin/env python3
"""Gemini writes the scene code with DIRECT API calls (no agent CLI), looks at rendered stills and fixes the code.

usage: python3 tools/gen_api.py <project_dir> [--model gemini-3.1-pro-preview] [--rounds 3] [--dry]

The project dir comes from kit/tools/setup.sh + make_voice.py + timing.py (voice.mp3, script.txt, shot_notes.txt, work/words.json, work/phrases.json).
Steps: 1) one call writes story.js + world + cast + audio  2) build, render 2 stills per shot, contact sheet
       3) Gemini LOOKS at the sheet, lists problems, returns fixed files (repeat up to --rounds)  4) audio + mix
Token use of every call is written to work/usage.json (real numbers, for the cost report)."""
import argparse, glob, json, os, re, subprocess, sys, time
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("project"); ap.add_argument("--model", default="gemini-3.1-pro-preview")
ap.add_argument("--rounds", type=int, default=3); ap.add_argument("--dry", action="store_true")
A = ap.parse_args()
P = Path(A.project).resolve(); KIT = Path(__file__).resolve().parent.parent / "kit"; ROOT = KIT.parent
WEB = P / "web"; WORK = P / "work"; WORK.mkdir(exist_ok=True)
MARK_A, MARK_B = "// ---------- world ----------", "// ---------- cards ----------"


def rd(p): return Path(p).read_text(encoding="utf-8")


def log(*a): print(*a, flush=True)


# ------------------------------------------------------------------ shot table from the voice timing
def shot_table():
    w = json.load(open(WORK / "words.json")); ph = json.load(open(WORK / "phrases.json"))
    total = round(ph["duration"] * 30)
    notes = rd(P / "shot_notes.txt")
    shots = re.findall(r'SHOT\s+(\d+)\s*(?:\(([^)]*)\))?\s*\n\s*WORDS:\s*"(.*?)"', notes)
    i, st = 0, []
    for n, name, words in shots:
        k = len(words.split()); st.append((f"s{n}" + (("_" + re.sub(r"\W+", "", name)) if name else ""), round(w[min(i, len(w) - 1)]["s"] * 30), words)); i += k
    rows = []
    for j, (id_, a, words) in enumerate(st):
        b = (st[j + 1][1] - 1) if j + 1 < len(st) else total - 1
        rows.append((id_, a, b, words))
    return total, rows, i, len(w)


# ------------------------------------------------------------------ prompt
SYSTEM = """You write the CODE for ONE vertical animated cartoon short (1080x1920, 30 fps) with a fixed kit (three.js toon renderer + 2D 'bean-head' character cards).
The AUTHOR writes the scenes (shot_notes.txt); you only write code that shows them EXACTLY: same shots, same order, same places, light, camera moves, characters, effects, sounds.
Never drop, merge or reorder shots. If a field is empty choose something simple and list it in work/NOTES.md. No real living people, no logos, no captions.
Quality rules: every shot must have a visible, well-built environment (ground, sky, props that the notes name), characters standing in front of the camera, never inside walls/fences,
camera never inside objects, nothing cut off. Use the kit's ready-made helpers (crowd, emu, emuHerd, horseCart, hatx, FACE, OUTFITS, fx* cards) before writing custom drawing code.
The portrait frame is narrow: horizontal half-width = distance * tan(hfov/2), hfov = 2*atan(tan(vfov/2)*0.5625). Stage characters in depth, use fov 50-58 for wide shots.
Missing facial expressions or outfits: ADD them in cast.js (Object.assign(FACE,{...}), Object.assign(OUTFITS,{...})); do not substitute a different one.
Crowds: draw many people per card with the crowd helper (each card canvas is large; never create hundreds of cards).

OUTPUT FORMAT (strict): return files as blocks, nothing else inside the blocks but the file text:
<<<FILE web/story.js>>>
...full file...
<<<END>>>
Files you may write:
 - web/story.js   full file. Same exports as the example (FPS, TOTAL, DECK, SHOTS, shotAt, smooth, LIGHTS, lightFor, camAt, dofAt, worldAt, actorsAt, fxAt, ...). TOTAL is given. Shot a/b frames are given in the shot table: use them exactly.
 - web/world.js   the WORLD section of main.js (replaces everything between '// ---------- world ----------' and '// ---------- cards ----------').
                  It runs inside main.js, so THREE, T (toon.js), P (paint.js), M (materials), toon(), add, box, tbox, uvScale, mergeGeos, placed, canvasTex, rnd, cloudsInit, scene are in scope.
                  It MUST define: const DECK; const world (THREE.Group added to scene); const waterU = {t,deep,shal,glint} (keep the line of the example); const clouds = cloudsInit();
                  and function worldState(S, f) (S = worldAt(f) from story.js; it must set waterU.t.value = f / 30). Use merged geometry for repeated meshes (instanced meshes break the ink pass).
 - web/cast.js    code APPENDED to roman.js (so it can use everything defined there and in toonbase: Pen, FACE, OUTFITS, hatOn, mul, ellPts, rrect, curve, INK, ...). Export new card-drawing functions with `export const` so story.js can call them as T.name.
 - audio.py       full file. First 3 lines exactly as in the example (they load audiolib.py). Writes music.wav and sfx.wav stems. Cue times use F(frame)=frame/30.
 - work/PLAN.md   the author's shots with frame ranges (no new shots).   - work/NOTES.md  decisions and every field you had to choose yourself.
On a first answer return all of story.js, world.js, cast.js (may be tiny), audio.py, PLAN.md, NOTES.md.
On a fix answer first write 'PROBLEMS:' with one line per problem (shot id + what is wrong), then return ONLY the files you changed, each in full. If every shot looks right and matches the notes answer exactly 'STATUS: OK' and no files."""


def static_context():
    sk = rd(ROOT / "skills/cartoon-audio-short/SKILL.md")
    a = sk.index("### 4.2"); b = sk.index("### 4.8"); g = sk.index("## Engine gotchas")
    main = rd(KIT / "engine/main.js"); head = main[: main.index(MARK_A)]
    parts = [
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


def task_text(total, rows):
    tab = "\n".join(f"{id_:14s} frames {a:4d}-{b:4d}  ({(b - a + 1) / 30:.1f}s)  words: {w}" for id_, a, b, w in rows)
    return (f"===== THIS VIDEO =====\nTOTAL = {total} frames.\n\nSHOT TABLE (use these ids and frame ranges in story.js SHOTS):\n{tab}\n\n"
            f"narration (script.txt):\n{rd(P / 'script.txt')}\n\nAUTHOR'S SHOT NOTES (shot_notes.txt):\n{rd(P / 'shot_notes.txt')}\n\n"
            "Write all files now (first answer).")


# ------------------------------------------------------------------ Gemini client
from google import genai
from google.genai import types

client = genai.Client(vertexai=True, project=os.environ["GOOGLE_CLOUD_PROJECT"], location=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"))
USAGE = []


def call(contents, label):
    if os.environ.get("GEN_FAKE"):   # offline test of the pipeline: first call returns the file, later calls say OK
        return rd(os.environ["GEN_FAKE"]) if label == "write" else "STATUS: OK"
    for k in range(7):
        try:
            r = client.models.generate_content(model=A.model, contents=contents, config=types.GenerateContentConfig(
                system_instruction=SYSTEM, temperature=0.4, max_output_tokens=65000))
            break
        except Exception as e:
            s = str(e)
            log(f"[{label}] API error try {k + 1}: {s[:200]}")
            if k == 6 or not any(x in s for x in ("429", "500", "503", "504", "RESOURCE_EXHAUSTED", "UNAVAILABLE", "DEADLINE")): raise
            time.sleep(30 * (k + 1))
    u = r.usage_metadata
    rec = dict(label=label, model=A.model, prompt=u.prompt_token_count, cached=getattr(u, "cached_content_token_count", 0) or 0,
               output=u.candidates_token_count, thoughts=getattr(u, "thoughts_token_count", 0) or 0)
    USAGE.append(rec); (WORK / "usage.json").write_text(json.dumps(USAGE, indent=1)); log("usage", rec)
    return r.text or ""


# ------------------------------------------------------------------ apply files + build
FILES = {}   # path -> text (latest version of what the model wrote)
BLOCK = re.compile(r"<<<FILE\s+(\S+?)\s*>>>\n(.*?)\n?<<<END>>>", re.S)


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


def build():
    """write files into the project; return error text or ''"""
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


def stills(tag):
    r = subprocess.run(["node", "-e", "import('./web/story.js').then(m=>console.log(JSON.stringify(m.SHOTS.map(s=>[s.id,s.a,s.b]))))"], cwd=P, capture_output=True, text=True)
    shots = json.loads(r.stdout.strip().splitlines()[-1]); fr = []
    for id_, a, b in shots:
        for q in (0.3, 0.85):
            f = int(a + (b - a) * q)
            if f not in [x[1] for x in fr]: fr.append((id_, f))
    out = P / "stills" / tag; subprocess.run(["rm", "-rf", str(out)])
    r = subprocess.run(["node", "render.mjs", str(out), ",".join(str(f) for _, f in fr)], cwd=P, capture_output=True, text=True, timeout=3000)
    msgs = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l.startswith(("ERR", "page error", "PAGE")) or "Error" in l)[-2500:]
    from PIL import Image, ImageDraw
    ims = []
    for id_, f in fr:
        p = out / f"f{f:04d}.jpg"
        if not p.exists(): continue
        im = Image.open(p).convert("RGB").resize((300, 533)); d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 190, 14], fill=(0, 0, 0)); d.text((3, 2), f"{id_} f{f}", fill=(255, 255, 0)); ims.append(im)
    if not ims: return None, msgs or "no stills were rendered"
    cols = 6; sh = Image.new("RGB", (300 * min(cols, len(ims)), 533 * ((len(ims) + cols - 1) // cols)))
    for i, im in enumerate(ims): sh.paste(im, ((i % cols) * 300, (i // cols) * 533))
    sp = P / "stills" / f"sheet_{tag}.jpg"; sh.save(sp, quality=85)
    return sp, msgs


def audio():
    env = dict(os.environ, FRAMES=str(TOTAL))
    r = subprocess.run(["python3", "audio.py"], cwd=P, capture_output=True, text=True, env=env, timeout=900)
    if r.returncode or not (P / "music.wav").exists(): return "audio.py failed:\n" + (r.stderr or r.stdout)[-1500:]
    r = subprocess.run(["python3", "mix.py", "voice.mp3", "music.wav", "sfx.wav"], cwd=P, capture_output=True, text=True, timeout=900)
    log(r.stdout[-400:])
    return "" if r.returncode == 0 and (P / "mix_raw.wav").exists() else "mix.py failed:\n" + (r.stderr or r.stdout)[-1000:]


# ------------------------------------------------------------------ main
TOTAL, ROWS, used, nwords = shot_table()
log(f"{len(ROWS)} shots, {TOTAL} frames, words used {used}/{nwords}")
sctx, task = static_context(), task_text(TOTAL, ROWS)
log(f"prompt chars: static {len(sctx)}, task {len(task)}")
if A.dry: sys.exit(0)
hist = [types.Content(role="user", parts=[types.Part(text=sctx), types.Part(text=task)])]
txt = call(hist, "write"); hist.append(types.Content(role="model", parts=[types.Part(text=txt)]))
got = take(txt); log("first answer files:", list(got))
good = {}   # last version that built and rendered
for rnd_i in range(A.rounds + 1):
    err = build()
    aerr = "" if err else audio()
    sheet = None; msgs = ""
    if not err:
        sheet, msgs = stills(f"r{rnd_i}")
        if sheet: good = dict(FILES)
    log(f"round {rnd_i}: build_err={bool(err)} audio_err={bool(aerr)} sheet={bool(sheet)} msgs={msgs[:100]!r}")
    if rnd_i == A.rounds: break
    parts = []
    if sheet: parts.append(types.Part.from_bytes(data=sheet.read_bytes(), mime_type="image/jpeg"))
    t = ("Here is the contact sheet of the rendered stills (2 per shot, label = shot id + frame). " if sheet else "The render failed. ")
    if err: t += "\nBUILD ERROR (fix it):\n" + err
    if msgs: t += "\nBROWSER LOG:\n" + msgs
    if aerr: t += "\nAUDIO ERROR (fix audio.py):\n" + aerr
    t += ("\nLook at every tile and compare with the author's shot notes: environment present and well built, characters visible and not cut off, "
          "camera not inside objects, props named in the notes present, light as written, no black/white/empty frames, text not mirrored. "
          "Answer with 'PROBLEMS:' then the corrected files (only changed files, each in full), or exactly 'STATUS: OK' if all is right.")
    parts.append(types.Part(text=t))
    hist.append(types.Content(role="user", parts=parts))
    txt = call(hist, f"fix{rnd_i + 1}"); hist.append(types.Content(role="model", parts=[types.Part(text=txt)]))
    if "STATUS: OK" in txt and not BLOCK.search(txt) and not err and not aerr: log("model says OK"); break
    got = take(txt); log("fix files:", list(got), "\nPROBLEMS:", txt.split("<<<FILE")[0][:1200])
    if not got and not err and not aerr: break

# final: make sure what is on disk builds and renders; else fall back to the last good version
err = build()
if err and good:
    log("final version broken, using last good version"); FILES.clear(); FILES.update(good); err = build()
aerr = audio() if not err else "skipped"
(WORK / "NOTES.md").write_text((rd(WORK / "NOTES.md") if (WORK / "NOTES.md").exists() else "") + f"\n\n## pipeline\nrounds: {len(USAGE) - 1} fix calls. final build error: {err or 'none'}. audio: {aerr or 'ok'}.\n", encoding="utf-8")
if err: log("FAILED:", err); sys.exit(1)
(WORK / "DONE.txt").write_text("\n".join(f"{id_}: {w}" for id_, a, b, w in ROWS) + "\n", encoding="utf-8")
log("DONE", json.dumps(USAGE))
