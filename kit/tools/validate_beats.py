#!/usr/bin/env python3
"""Check a beat plan (beats.json, schema kit/schema/beat.v1.schema.json) and run the AUTOMATIC quality gates that can be decided from the plan alone.

  python3 kit/tools/validate_beats.py beats.json [--json report.json] [--strict]

Errors (exit 1) break the contract: schema, ids, word coverage, camera/transition/audio fields, kit names.
Warnings do not fail (unless --strict): style checks such as missing depth layers, repeated moves, no contact target.
Every finding carries the gate it belongs to (Q01..Q10, kit/reference/knowledge/rules.json quality_gates). Gates that need Gemini vision or a person are listed as NOT RUN.
Needs: pip install jsonschema.
"""
import json, os, re, sys, argparse

HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE); ROOT = os.path.dirname(KIT)
FPS = 30
CAP_ZONE = [0.1, 0.62, 0.9, 0.78]       # rule CAP-01 (measured: captions at about 70 % of frame height)
STILL = ("static", "creep")


def norm(s): return re.findall(r"[a-z0-9']+", s.lower())


def kit_names():
    t = open(os.path.join(ROOT, "scripts", "FORMAT.md"), encoding="utf-8").read()
    s6 = t[t.index("## 6. Kit list"): t.index("## 7. NEW items")]
    def line(tag):
        m = re.search(r"- " + re.escape(tag) + r"[^:\n]*:(.*?)(?=\n- |\n\n|\Z)", s6, re.S); return m.group(1) if m else ""
    faces = set(re.findall(r"\b([a-z]+)\b", re.sub(r"\([^)]*\)", "", line("FACES"))))
    extras = set(re.findall(r"`([a-z0-9]+)`", line("FACE EXTRAS")))
    poses = set(re.findall(r"\b([a-z]+)\b", re.sub(r"\([^)]*\)", "", line("ARM POSES").split("(`spear`")[0])))
    hats = set(re.findall(r"\b([a-z_]+)\b", re.sub(r"\([^)]*\)", "", line("HATS"))))
    outl = line("OUTFITS (base)")
    outl = re.sub(r"peasA to peasE", "peasA, peasB, peasC, peasD, peasE", outl)
    outfits = set(re.findall(r"\b([A-Za-z0-9]+)\b", outl))
    return faces, extras, poses, hats, outfits


def run(path):
    R = json.load(open(os.path.join(KIT, "reference", "knowledge", "rules.json")))
    SCH = json.load(open(os.path.join(KIT, "schema", "beat.v1.schema.json")))
    D = json.load(open(path))
    F = []   # (level, gate, where, message)
    def err(g, w, m): F.append(("error", g, w, m))
    def warn(g, w, m): F.append(("warn", g, w, m))

    # ---- schema (gate Q10)
    try:
        import jsonschema
    except ImportError:
        sys.exit("validate_beats: pip install jsonschema")
    v = jsonschema.Draft202012Validator(SCH)
    for e in sorted(v.iter_errors(D), key=lambda e: list(e.absolute_path)):
        err("Q10", "/".join(str(p) for p in e.absolute_path) or "root", "schema: " + e.message[:220])
    if any(f[0] == "error" for f in F):
        return D, R, F, True      # semantic checks need a valid shape

    ent = D["entities"]
    chars = {c["id"]: c for c in ent["characters"]}; objs = {o["id"]: o for o in ent["objects"]}; envs = {e["id"]: e for e in ent["environments"]}
    allid = list(chars) + list(objs) + list(envs)
    for i in set(allid):
        if allid.count(i) > 1: err("Q10", "entities", f"duplicate entity id {i}")
    known = set(allid)
    gates = {g["id"] for g in R["quality_gates"]}; recipes = {s["id"] for s in R["shot_recipes"]}; rules = {r["id"] for r in R["rules"]}
    mats = {m["id"] for m in R["material_recipes"]}; lights = {l["id"] for l in R["lighting_profiles"]}
    faces, extras, poses, hats, outfits = kit_names()

    # ---- entities: identity lock, kit names (Q01, Q07)
    for c in chars.values():
        o = c["outfit"]
        if not (o.startswith("NEW:") or o in outfits): err("Q01", f"character {c['id']}", f"outfit '{o}' is not a kit outfit and not NEW:<name>")
        h = c.get("hat")
        if h and not (h.startswith("NEW:") or h in hats): err("Q01", f"character {c['id']}", f"hat '{h}' is not a kit hat and not NEW:<name>")
    for o in objs.values():
        for m in o.get("material_ids", []):
            if m not in mats: err("Q07", f"object {o['id']}", f"unknown material {m}")
    for e in envs.values():
        for m in e.get("material_ids", []):
            if m not in mats: err("Q07", f"environment {e['id']}", f"unknown material {m}")
        if e.get("lighting_profile_id") and e["lighting_profile_id"] not in lights: err("Q10", f"environment {e['id']}", "unknown lighting profile")
        if not e.get("depth_layers"): warn("Q06", f"environment {e['id']}", "no depth_layers declared (WLD-03: foreground, midground, background)")

    # ---- words (Q04)
    W = D["narration"]["words"]
    if norm(D["narration"]["text"]) != [x for w in W for x in norm(w["w"])]:
        err("Q04", "narration", "narration.text and narration.words are not the same words")
    for i in range(1, len(W)):
        if W[i]["s"] + 1e-6 < W[i - 1]["s"]: err("Q04", f"narration.words[{i}]", "word times go backwards")
    B = D["beats"]
    ids = [b["id"] for b in B]
    for i in set(ids):
        if ids.count(i) > 1: err("Q10", "beats", f"duplicate beat id {i}")
    nxt = 0
    for k, b in enumerate(B):
        w = f"beat {b['id']}"
        if b["index"] != k + 1: err("Q10", w, f"index {b['index']} should be {k + 1}")
        a, z = b["narration"]["word_range"]
        if a != nxt: err("Q04", w, f"word_range starts at {a}, expected {nxt} (beats must cover all words in order, no gaps or overlaps)")
        if z < a or z >= len(W): err("Q04", w, f"word_range end {z} invalid"); nxt = z + 1; continue
        nxt = z + 1
        if norm(b["narration"]["text"]) != [x for ww in W[a:z + 1] for x in norm(ww["w"])]:
            err("Q04", w, "beat narration text differs from the words in its word_range")
        t0, t1 = b["time"]["start_s"], b["time"]["end_s"]
        if t1 <= t0: err("Q10", w, "end_s must be after start_s")
        if k == 0 and t0 > 0.05: err("Q10", w, "first beat must start at 0")
        if k > 0 and abs(t0 - B[k - 1]["time"]["end_s"]) > 1.5 / FPS: err("Q10", w, f"gap or overlap with the previous beat ({B[k - 1]['time']['end_s']} -> {t0})")
        if W[a]["s"] < t0 - 0.6 or W[z]["e"] > t1 + 0.6:
            warn("Q04", w, f"its words are spoken {W[a]['s']:.2f}-{W[z]['e']:.2f} s but the beat is {t0:.2f}-{t1:.2f} s (more than 0.6 s off)")
        L = t1 - t0
        # ---- id references (Q10)
        def ref(i, what, pool=known):
            if i not in pool: err("Q10", w, f"{what} '{i}' is not in entities")
        s = b["subject"]; ref(s["main_id"], "subject.main_id")
        for i in s.get("character_ids", []): ref(i, "character_ids", set(chars))
        if "hero_object_id" in s: ref(s["hero_object_id"], "hero_object_id", set(objs))
        for i in s.get("required_asset_ids", []): ref(i, "required_asset_ids")
        ref(b["environment_id"], "environment_id", set(envs))
        c = b["shot"]["composition"]; ref(c["primary_id"], "composition.primary_id")
        for i in c.get("secondary_ids", []): ref(i, "composition.secondary_ids")
        if b["shot"]["recipe_id"] not in recipes: err("Q10", w, f"unknown recipe {b['shot']['recipe_id']}")
        for g in b["validation"]["gates"]:
            if g not in gates: err("Q10", w, f"unknown gate {g}")
        for i in b["validation"]["must_see"]: ref(i, "must_see")
        for r_ in b.get("rule_refs", []):
            if r_ not in rules: err("Q10", w, f"unknown rule {r_}")
        if "look_at_id" in b["camera"]: ref(b["camera"]["look_at_id"], "camera.look_at_id")
        # ---- identity / continuity (Q01)
        for cc in b.get("continuity_change", []):
            cid = cc.split(":")[0]
            if cid not in chars: err("Q01", w, f"continuity_change '{cc}': unknown character")
        for ca in b.get("character_actions", []):
            ref(ca["character_id"], "character_actions.character_id", set(chars))
            if "gaze_target_id" in ca: ref(ca["gaze_target_id"], "gaze_target_id")
            if ca["character_id"] not in s.get("character_ids", []) and ca["character_id"] != s["main_id"]:
                warn("Q01", w, f"{ca['character_id']} acts but is not listed in subject.character_ids")
            face = ca.get("face")
            if face:
                base, *ex = face.split("+")
                if base not in faces: err("Q01", w, f"face '{base}' is not in the kit face list")
                for x in ex:
                    if x not in extras: err("Q01", w, f"face extra '{x}' is not in the kit extras")
            if ca.get("pose") and ca["pose"] not in poses: err("Q01", w, f"pose '{ca['pose']}' is not in the kit pose list")
            if ca["start_s"] + ca["duration_s"] > L + 0.3: warn("Q10", w, f"action of {ca['character_id']} ends after the beat")
        # ---- physics (Q05)
        for oe in b.get("object_events", []):
            ref(oe["object_id"], "object_events.object_id", set(objs))
            if "contact_target_id" in oe: ref(oe["contact_target_id"], "contact_target_id")
            if oe["event"] in ("impact", "drop", "break", "launch") and "contact_target_id" not in oe:
                warn("Q05", w, f"{oe['event']} of {oe['object_id']} has no contact_target_id (PHY-03)")
            if oe["event"] in ("impact", "break") and not oe.get("secondary_effects"):
                warn("Q05", w, f"{oe['event']} of {oe['object_id']} has no secondary_effects (PHY-03)")
            if oe["start_s"] + oe["duration_s"] > L + 0.3: warn("Q10", w, f"event of {oe['object_id']} ends after the beat")
        # ---- camera (Q03)
        cam = b["camera"]
        if cam["mode"] not in STILL:
            for k_ in ("duration_s", "ease", "from", "to"):
                if k_ not in cam: err("Q03", w, f"a camera move ('{cam['mode']}') needs {k_}")
            if cam.get("duration_s", 0) > L + 0.1: warn("Q03", w, "camera duration is longer than the beat")
        elif cam["purpose"] not in ("hold_for_performance", "establish", "inspect", "emphasize", "compare", "reveal", "follow", "land_on_prop", "power_angle", "impact", "carry_to_next_place"):
            err("Q03", w, "bad purpose")
        if cam["purpose"] == "hold_for_performance" and cam["mode"] not in STILL: warn("Q03", w, "purpose hold_for_performance but the mode moves")
        if cam["mode"] == "static" and L > 6: warn("Q03", w, f"a fully static camera for {L:.1f} s (CAM-01: almost always alive; use creep)")
        for kk in cam.get("kicks", []):
            if kk["time_s"] > t1 + 0.1 or kk["time_s"] < t0 - 0.1: err("Q03", w, "camera kick outside the beat (kicks use absolute time)")
        # ---- composition (Q02)
        zx0, zy0, zx1, zy1 = c.get("caption_clear_zone_norm", CAP_ZONE)
        fx, fy = c["focal_point_norm"]
        if b["captions"]["mode"] != "none" and zx0 <= fx <= zx1 and zy0 <= fy <= zy1:
            warn("Q02", w, f"focal point {c['focal_point_norm']} lies inside the caption clear zone (CMP-01)")
        # ---- audio (Q09)
        for ae in b.get("audio_events", []):
            if not (t0 - 0.3 <= ae["time_s"] <= t1 + 0.3): err("Q09", w, f"audio event '{ae['event']}' at {ae['time_s']} s is outside the beat {t0:.2f}-{t1:.2f}")
            if ae["trigger"] == "word":
                wi = ae.get("word_index")
                if wi is None or not (a <= wi <= z): err("Q09", w, f"audio event '{ae['event']}': trigger word needs word_index inside the beat's word_range")
        # ---- transitions (Q08)
        tr = b["transition_in"]
        if k == 0 and tr["type"] != "start": err("Q08", w, "first beat transition_in.type must be 'start'")
        if k > 0 and tr["type"] == "start": err("Q08", w, "only the first beat may use type 'start'")
        if tr["type"] == "fly_through": warn("Q08", w, "transition fly_through (camera passes through geometry into the next place) is not implemented in the renderer; use blend_fly (a cross-blend) or a camera flight inside the scene, and do not report a blend as a 3D fly-through")
        if tr["type"] in ("dissolve", "blend_fly", "fly_through", "flash") and "frames" not in tr: err("Q08", w, f"{tr['type']} needs frames")
    if nxt != len(W): err("Q04", "beats", f"beats cover {nxt} of {len(W)} words")
    if B and B[-1]["time"]["end_s"] < W[-1]["e"] - 0.1: err("Q04", "beats", "the last beat ends before the last word")

    # ---- plan-level style checks (warnings)
    tt = [b["transition_in"]["type"] for b in B[1:]]
    if tt:
        cut = tt.count("cut") / len(tt)
        if cut > 0.45: warn("Q08", "plan", f"{cut:.0%} of scene changes are hard cuts (CHK-11 range 0-45 %, TRN-06)")
        if "dissolve" not in tt: warn("Q08", "plan", "no dissolve at all (TRN-06: dissolve is the default)")
    for key, nm in (("recipe", "shot recipe"), ("mode", "camera mode")):
        seq = [(b["shot"]["recipe_id"] if key == "recipe" else b["camera"]["mode"]) for b in B]
        for i in range(2, len(seq)):
            if seq[i] == seq[i - 1] == seq[i - 2] and seq[i] not in STILL:
                warn("Q03", f"beat {B[i]['id']}", f"same {nm} '{seq[i]}' three beats in a row (CAM-10: vary the moves)")
    return D, R, F, False


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("beats"); ap.add_argument("--json"); ap.add_argument("--strict", action="store_true"); a = ap.parse_args()
    D, R, F, shape_bad = run(a.beats)
    E = [f for f in F if f[0] == "error"]; Wn = [f for f in F if f[0] == "warn"]
    for lv, g, w, m in F: print(f"{lv.upper():5s} {g}  {w}: {m}")
    print()
    if shape_bad: print("SCHEMA INVALID: semantic checks skipped.")
    print("Automatic gate results (from the plan only):")
    rep = {}
    for g in R["quality_gates"]:
        auto = [c for c in g["checks"] if c["class"] == "automatic" and "validate_beats.py (implemented" in c["implemented_in"]]
        notrun = [c for c in g["checks"] if c not in auto]
        e = sum(1 for f in E if f[1] == g["id"]); w = sum(1 for f in Wn if f[1] == g["id"])
        st = "NO AUTOMATIC CHECK HERE" if not auto else ("FAIL" if e else ("PASS (with warnings)" if w else "PASS"))
        if shape_bad and g["id"] != "Q10" and auto: st = "NOT RUN (schema invalid)"
        rep[g["id"]] = {"status": st, "errors": e, "warnings": w, "not_run": [f"[{c['class']}] {c['what']}" for c in notrun]}
        print(f"  {g['id']} {g['check']:20s} {st:22s} errors {e} warnings {w}   not run: {len(notrun)} ({', '.join(sorted({c['class'] for c in notrun})) or '-'})")
    ok = not E and not (a.strict and Wn)
    print(f"\n{os.path.basename(a.beats)}: {len(D.get('beats', []))} beats, {len(E)} errors, {len(Wn)} warnings -> {'OK' if ok else 'FAILED'}")
    if a.json: json.dump({"file": a.beats, "ok": ok, "errors": [list(f) for f in E], "warnings": [list(f) for f in Wn], "gates": rep}, open(a.json, "w"), indent=1)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
