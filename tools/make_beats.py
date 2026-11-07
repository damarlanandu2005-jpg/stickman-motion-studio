#!/usr/bin/env python3
"""shot_notes.txt + narration + word timing  ->  beats.json (beat plan, schema kit/schema/beat.v1.schema.json), written by Gemini and checked by kit/tools/validate_beats.py.

Usage: python3 tools/make_beats.py <project_dir> [--fake a.json,b.json]
  needs project/script.txt, project/shot_notes.txt, project/work/words.json, project/work/phrases.json (same inputs as tools/gen_api.py)
  writes project/beats.json (only if it passes the validator; up to 3 tries, the errors are sent back). Exit 1 if no valid plan: the pipeline goes on without it.

Gemini writes ONLY the creative fields (entities, intent, subject, camera, character actions, audio, transitions, validation ...). The tool itself fills everything that is mechanical,
so Gemini cannot get it wrong: beat times from the shot table, the narration text and word ranges, the project block, the word list, indexes and audio times of word triggers.
--fake: offline test, the files are used as Gemini's answers in order (no API call).
"""
import json, os, re, subprocess, sys
from pathlib import Path

args = [a for a in sys.argv[1:] if not a.startswith("--")]
fake = None
if "--fake" in sys.argv:
    k = sys.argv.index("--fake"); fake = sys.argv[k + 1].split(","); args = [a for a in args if a != sys.argv[k + 1]]
P = Path(args[0]).resolve(); ROOT = Path(__file__).resolve().parent.parent; KIT = ROOT / "kit"
FPS = 30
norm = lambda s: re.findall(r"[a-z0-9']+", s.lower())
rd = lambda p: Path(p).read_text(encoding="utf-8")

narr = rd(P / "script.txt").strip(); notes = rd(P / "shot_notes.txt")
W = json.load(open(P / "work" / "words.json")); ph = json.load(open(P / "work" / "phrases.json")); total = round(ph["duration"] * FPS)
shots = re.findall(r'SHOT\s+(\d+)\s*(?:\(([^)]*)\))?\s*\n\s*WORDS:\s*"(.*?)"', notes)
if not shots: sys.exit("make_beats: no SHOT blocks in shot_notes.txt")

# beat table (same rule as gen_api.shot_table: a shot starts at its first word)
toks = [(t, i) for i, w in enumerate(W) for t in norm(w["w"])]
pos, rows = 0, []
for n, name, text in shots:
    nt = len(norm(text)); seg = toks[pos:pos + nt]
    if [t for t, _ in seg] != norm(text): sys.exit(f"make_beats: shot {n} words do not match the narration at token {pos}")
    rows.append({"id": f"s{n}", "text": text, "w0": seg[0][1], "w1": seg[-1][1]}); pos += nt
if pos != len(toks): sys.exit("make_beats: shots do not cover all words")
for j, r in enumerate(rows):
    r["a"] = round(W[r["w0"]]["s"] * FPS); r["b"] = (round(W[rows[j + 1]["w0"]]["s"] * FPS) - 1) if j + 1 < len(rows) else total - 1
    r["a"] = 0 if j == 0 else r["a"]
    r["start_s"] = round(r["a"] / FPS, 4); r["end_s"] = round((r["b"] + 1) / FPS, 4)

sys.path.insert(0, str(KIT / "tools"))
import validate_beats as VB
_f, _x, _p, _h, _o = VB.kit_names()
KITNAMES = f"KIT NAMES (write exactly these; anything else is a NEW item):\n  outfits: {', '.join(sorted(_o))}\n  hats: {', '.join(sorted(_h))}\n  faces: {', '.join(sorted(_f))} (+ extras {', '.join(sorted(_x))})\n  arm poses: {', '.join(sorted(_p))}"
SCHEMA = json.load(open(KIT / "schema" / "beat.v1.schema.json"))
ex = json.load(open(KIT / "schema" / "examples" / "beats_bomb_v22.json"))
ex_beats = [{k: v for k, v in b.items() if k not in ("time", "narration", "index")} for b in ex["beats"][:3]]
example = json.dumps({"entities": ex["entities"], "beats": ex_beats}, indent=1)[:9000]
table = "\n".join(f"{r['id']}: {r['start_s']:.2f}-{r['end_s']:.2f} s, words {r['w0']}..{r['w1']}: " + " ".join(f"[{i}]{W[i]['w']}@{W[i]['s']:.2f}" for i in range(r['w0'], r['w1'] + 1)) for r in rows)

base = f"""You are the planner of a vertical animated cartoon short. The author's shot notes (CAST, PLACES, NEW OBJECTS, SHOT n with WORDS, PLACE, LIGHT, CAMERA, CHARACTERS, EFFECTS, MUST SEE, MUST NOT, SFX, MUSIC) are final.
Write the BEAT PLAN as ONE JSON object: {{"entities": {{"characters": [...], "objects": [...], "environments": [...]}}, "beats": [...]}}. One beat per shot, same ids (s1, s2, ...), same order.
Return only the JSON (no markdown). The tool fills time, narration text, word_range, index, project and words; do NOT write those.

Each beat has: id, intent, visual_purpose, subject, environment_id, light (only if it differs from the environment), character_actions, object_events, shot, camera, captions, audio_events, transition_in,
continuity_change, validation, rule_refs. Required: id, intent, visual_purpose, subject, environment_id, shot, camera, captions, transition_in, validation.
Beat times (seconds, absolute) and words, to place audio events and kicks (for trigger "word" give word_index, the tool computes time_s; other triggers need an absolute time_s inside the beat):
{table}

HOW TO DECIDE (this is the point of the plan; read the PLAYBOOK below, especially CAM-16, SCR-05, CON-01, CMP-01, ACT-01, PHY-03):
- Intent first: what are the WORDS doing? Then choose the shot recipe from the candidates for that intent (intent_map), the assets that exist and the previous beat. Do not repeat one recipe or one camera move three beats in a row (CAM-10). There is no fixed order of recipes.
- Every camera choice, including a hold, has a purpose and a short rationale (CAM-16). A camera move needs from, to, duration_s and ease; static and creep need only purpose and rationale. Flights and holds should mix like the measured references (CAM-01): about 2-5 flights per 10 s of video, holds for dialogue, reaction, numbers.
- Scene changes: mostly dissolve (reason new_place, time_shift, memory_or_thought), some blend_fly, few hard cuts (at most 45 %); NEVER fly_through (a real 3D pass-through is not implemented; blend_fly is only a cross-blend, say so honestly); a hard cut inside the same place needs reason emphasis, scale_change or continuity.
- Each character gets an identity_lock (things that must not change); list a deliberate change in continuity_change as "ID:what".
- Use ONLY kit names for outfits, hats, faces (base or base+extra), arm poses and light (list below). A face name is never a pose. NEVER write NEW:<name> for something that is in the kit list: write the kit name. Only a thing that is truly not in the kit is "NEW:<name>" with status new_item. A character's id, outfit, hat and identity_lock are its fixed identity: copy them exactly in every use.
- Appearance changes that the WORDS describe (a face turns purple, a hat falls off, a suit is put on) are recorded in that beat's continuity_change as "ID:attribute=value", e.g. "BOSS:face_colour=purple" (attribute: outfit, hat, skin, hair, beard, face_colour, outline, size, other). The character keeps its id. Do not change identity any other way.
- Name things the way the narration does: give every character and object an "aliases" list with the other words the narration uses for it. Every thing the words name must be in that beat's frame (must_see, subject or composition). If a named word is deliberately not pictured (a number, a job title), list its id in validation.not_shown and say why in visual_purpose.
- A camera purpose and the camera mode must agree: hold_for_performance = static or creep only; follow = track/pan/push-in/pull-back/tilt; impact = snap-zoom, whip, static, push-in, creep or pull-back; a move that reveals is purpose reveal, not hold. Allowed combinations are checked by the validator (error).
- Physical things need object_events: every physical_action beat has at least one (cause: move/swing/roll/slide/drop/launch; contact: impact/break with contact_target_id; reaction: secondary_effects and a character reaction; settling: a settle event). Hero objects that the words act on (timer, wires, cutters, a coin, a train) get events too. A significant collision gets an impact plan: camera purpose impact, or a kick, or secondary effects. A camera kick is optional; the impact is not.
- Scene changes: at most 45 % hard cuts (error above that with 6 or more changes). Use dissolve for new place/time, blend_fly for a continuous travel, and a hard cut only for emphasis or scale. Do not replace cuts at random; the reason must fit.
- Every id you use in a beat must exist in entities. Objects: real size_m, representation (3d_mesh, 2d_card, 2_5d_layer, billboard_fx), material_ids from M01-M07. Environments: depth_layers (foreground, midground, background), lighting_profile_id L01-L04.
- Keep the focal point (focal_point_norm) out of the caption band (y 0.62-0.78): captions sit at about 70 % of frame height (CMP-01).
- validation.gates: choose from Q01-Q10; validation.must_see = entity ids that must be visible (from the notes MUST SEE).
- Do not add shots, drop shots or change the shot notes. If something in the notes cannot be planned, plan the nearest thing and say so in the beat's visual_purpose.

BEAT PLAN FORMAT (generated from the schema):
{rd(KIT / 'docs' / 'BEATS.md')}

JSON SCHEMA (all definitions; every enum is a closed list; the tool adds time, narration, index to each beat):
{json.dumps({k: v for k, v in SCHEMA.items() if k in ('$defs',)}, separators=(',', ':'))}

{KITNAMES}

EXAMPLE (other story, first 3 beats, copy the style only):
{example}

PLAYBOOK (rules, intent map, shot recipes, gates):
{rd(KIT / 'docs' / 'PLAYBOOK.md')}

NARRATION:
{narr}

AUTHOR'S SHOT NOTES (shot_notes.txt):
{notes}
"""

def assemble(ans):
    e = ans.get("entities") or {}
    bb = {b.get("id"): b for b in ans.get("beats", [])}
    beats = []
    for k, r in enumerate(rows):
        g = dict(bb.get(r["id"], {"id": r["id"]})); g["id"] = r["id"]; g["index"] = k + 1
        g["time"] = {"start_s": r["start_s"], "end_s": r["end_s"]}; g["narration"] = {"text": r["text"], "word_range": [r["w0"], r["w1"]]}
        for ae in g.get("audio_events", []):
            if ae.get("trigger") == "word" and isinstance(ae.get("word_index"), int) and 0 <= ae["word_index"] < len(W): ae["time_s"] = round(W[ae["word_index"]]["s"], 3)
        g.setdefault("captions", {"mode": "one_word"})
        beats.append(g)
    order = ["id", "index", "time", "narration"]
    beats = [{**{k: g[k] for k in order}, **{k: v for k, v in g.items() if k not in order}} for g in beats]
    return {"schema_version": "1.2.0", "project": {"id": P.name, "fps": 30, "width": 1080, "height": 1920, "source": "gemini (tools/make_beats.py)"},
            "narration": {"text": " ".join(narr.split()), "words": W}, "entities": {"characters": e.get("characters", []), "objects": e.get("objects", []), "environments": e.get("environments", [])}, "beats": beats}


def validate(d):
    tmp = P / "beats.candidate.json"; tmp.write_text(json.dumps(d, indent=1, ensure_ascii=False), encoding="utf-8")
    r = subprocess.run([sys.executable, str(KIT / "tools" / "validate_beats.py"), str(tmp), "--json", str(P / "beats.report.json")], capture_output=True, text=True)
    return r.returncode == 0, r.stdout


if fake is None:
    from google import genai
    from google.genai import types
    client = genai.Client(vertexai=True, project=os.environ["GOOGLE_CLOUD_PROJECT"], location=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"), http_options=types.HttpOptions(timeout=900000))
    model = os.environ.get("MODEL", "gemini-3.1-pro-preview")
msg, last = base, ""
for t in range(3):
    if fake is not None:
        if t >= len(fake): break
        txt = rd(fake[t])
    else:
        r = client.models.generate_content(model=model, contents=msg, config=types.GenerateContentConfig(temperature=0.4, max_output_tokens=60000, response_mime_type="application/json"))
        txt = (r.text or "").strip()
        um = getattr(r, "usage_metadata", None)
        if um: print("tokens: prompt", um.prompt_token_count, "answer", um.candidates_token_count, flush=True)
    txt = re.sub(r"^```\w*\n|\n```$", "", txt.strip()).strip()
    try: ans = json.loads(txt)
    except Exception as e:
        last = f"The answer was not valid JSON ({e}). Return only the JSON object."; print("try", t + 1, last, flush=True); msg = base + "\n\nYOUR LAST ANSWER FAILED:\n" + last; continue
    d = assemble(ans); ok, out = validate(d)
    errs = [l for l in out.splitlines() if l.startswith("ERROR")]
    print(f"try {t + 1}: {len(errs)} errors, {sum(1 for l in out.splitlines() if l.startswith('WARN'))} warnings", flush=True)
    if ok:
        (P / "beats.json").write_text(json.dumps(d, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        (P / "beats.candidate.json").unlink(missing_ok=True)
        print(f"beats.json written: {len(d['beats'])} beats (try {t + 1}); report in beats.report.json"); sys.exit(0)
    last = "\n".join(errs[:25]); msg = base + "\n\nYOUR LAST ANSWER FAILED THE VALIDATOR (fix these and return the whole JSON again):\n" + last
sys.exit("make_beats: no valid beat plan after 3 tries; the pipeline continues without beats.json\n" + last)
