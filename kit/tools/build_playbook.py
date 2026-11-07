#!/usr/bin/env python3
"""Build kit/docs/PLAYBOOK.md (plain text for models) from kit/reference/knowledge/rules.json plus the live measured numbers.

  python3 kit/tools/build_playbook.py

rules.json is the single source of truth (edit that, never PLAYBOOK.md). The measured table is read from
kit/reference/study/_summary.json (python3 kit/tools/ref_study.py rules) and kit/reference/ref_stats.json (ref_measure.py rebuild),
so the playbook follows the reference database when new reference videos are added.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE)
K = os.path.join(KIT, "reference", "knowledge", "rules.json")
R = json.load(open(K))
try: SM = json.load(open(os.path.join(KIT, "reference", "study", "_summary.json")))
except Exception: SM = None
try: ST = json.load(open(os.path.join(KIT, "reference", "ref_stats.json")))
except Exception: ST = None

ORDER = [("camera", "CAMERA (how it moves, and why)"), ("cuts", "CUTS"), ("transition", "TRANSITIONS"), ("structure", "STORY SHAPE"), ("script", "SCRIPT TO PICTURE"),
         ("light", "LIGHT"), ("colour", "COLOUR AND TEXTURE"), ("world", "WORLD, SETS, TEXTURES"), ("character", "CHARACTERS"), ("face", "FACES AND EMOTION"),
         ("profile", "TOPIC PROFILES (what stays the same, what changes with the topic)"), ("props", "PROPS, TEXT, NUMBERS"), ("fx", "EFFECTS"), ("physics", "PHYSICS"), ("captions", "CAPTIONS"), ("sound", "SOUND"),
         ("composition", "COMPOSITION"), ("continuity", "CONTINUITY (identity lock)"), ("acting", "CHARACTER ACTING"), ("materials", "MATERIALS"),
         ("architecture", "HOW THINGS ARE BUILT (2D / 2.5D / 3D)"), ("adapt", "NEW TOPICS"), ("qc", "CHECK BEFORE RENDERING")]


def f(r, k):
    v = r.get(k)
    return "-" if v is None else (f"{v:.2f}" if isinstance(v, float) else str(v))


def main():
    L = ["# PLAYBOOK: how the reference shorts handle each situation (generated from kit/reference/knowledge/rules.json; do not edit by hand)", "",
         "READ THIS FIRST. These are HABITS measured and seen in real reference shorts. Learn the habit, do not copy a shot. A new topic needs its own world, props and",
         "story; use the habit for how to show it. Each rule says [id | how sure]: measured = computed from every frame, seen = read by eye with the time given, inferred = reasoned, proposed = designed by an independent study, NOT verified by us (use as a starting value).",
         "Use the SITUATIONS list: find the beat you are planning (hook, new place, key prop, dialogue, impact, ...) and follow its recipe and rule ids.", "",
         "STATUS: the render code does not read these rules yet. This file is knowledge for Gemini and for people; a rule is an engine feature only when listed under ENGINE below.", "",
         f"Studied: {', '.join(R['studied'])}.", ""]
    L += ["## What our videos do wrong now (measured against these references)"] + [f"- {x}" for x in R["ours_now"]["faults"]] + [""]
    if SM:
        L += ["## Measured camera and cut habits (video values, p10 .. p90 over the references; ours in brackets)", "", "| measure | references | ours (claude v2.1) |", "|---|---|---|"]
        for k, m in SM["metrics"].items():
            r = m["refs"]; o = m["ours"].get("claude_bomb_v21")
            L.append(f"| {m['label']} | {r['p10']:.2f} .. {r['p90']:.2f} (median {r['median']:.2f}) | {('%.2f' % o) if o is not None else '-'} |")
        fp = SM.get("flights_pooled")
        if fp: L += ["", f"All {fp['count']} flights together: length p10/p50/p90 = {fp['seconds']['p10']}/{fp['seconds']['p50']}/{fp['seconds']['p90']} s, peak speed {fp['peak_px_per_frame']['p10']}/{fp['peak_px_per_frame']['p50']}/{fp['peak_px_per_frame']['p90']} px per frame at 270 px width (x11.1 = percent of width per second), easing {fp['ease_share']}."]
        L.append("")
    if ST:
        L += [f"## Measured picture habits ({len(ST['videos_in_refs'])} reference videos, p10 .. p90; ours in brackets)", "", "| measure | references | ours |", "|---|---|---|"]
        for k in ("mean", "std", "p2", "sat", "palette", "edge", "motion_diff_p50", "held_frac"):
            m = ST["metrics"].get(k)
            if not m or not m.get("refs"): continue
            r, o = m["refs"], m.get("ours")
            L.append(f"| {m['label']} | {r['lo']:.2f} .. {r['hi']:.2f} (mid {r['mid']:.2f}) | {('%.2f .. %.2f' % (o['lo'], o['hi'])) if o else '-'} |")
        L.append("")
    try: LK = json.load(open(os.path.join(KIT, "reference", "look", "_summary.json")))
    except Exception: LK = None
    if LK:
        L += ["## Measured look and timing habits (ratios; p10 .. p90 over the references, median; ours in brackets)", "", "| measure | references | ours (claude v2.1) |", "|---|---|---|"]
        for k, m in LK["metrics"].items():
            o = m["ours"].get("claude_bomb_v21"); L.append(f"| {m['label']} | {m['p10']} .. {m['p90']} (median {m['median']}) | {o if o is not None else '-'} |")
        L.append("")
    L += ["## Rules", ""]
    for area, title in ORDER:
        rs = [r for r in R["rules"] if r["area"] == area]
        if not rs: continue
        L += [f"### {title}"]
        for r in rs:
            line = f"- [{r['id']} | {r['conf']} | for: {', '.join(r['tags'])}] {r['rule']}"
            if r.get("observed"): line += " OBSERVED: " + r["observed"]
            if r.get("why"): line += " WHY: " + r["why"]
            if r.get("do"): line += " DO: " + " ".join(x if x.endswith((".", "!", "?")) else x + "." for x in r["do"])
            if r.get("numbers"):
                n = r["numbers"]; line += " NUMBERS: " + "; ".join(f"{k} {v}" for k, v in n.items()) + "."
            if r.get("evidence"): line += " SEEN IN: " + "; ".join(r["evidence"]) + "."
            if r.get("estimate_note"): line += " (ESTIMATE NOTE: " + r["estimate_note"] + ")"
            if r.get("applies") and r["applies"] != "universal_unless_profile": line += f" [applies: {r['applies']}]"
            if r.get("ours_now"): line += f" (ours now: {r['ours_now']})"
            L.append(line)
        L.append("")
    L += ["## Beat intents and shot recipes (choose per beat; candidates, not a fixed order)", "",
          "Give every beat an INTENT (what the words do). Candidate recipes are scored against the assets, the previous beat and CAM-10 (vary the moves). A camera move or hold always needs a purpose (CAM-16).", ""]
    for k, v in R["intent_map"].items():
        L.append(f"- {k}: show {v['required_visuals']} Recipes: {', '.join(v['candidate_recipes'])}. Rules: {', '.join(v['rules'])}.")
    L += [""]
    for sr in R["shot_recipes"]:
        L.append(f"- {sr['id']} {sr['name']} ({sr['typical_seconds'][0]}-{sr['typical_seconds'][1]} s, designed): {sr['purpose']}. Framing: {sr['framing']}. Camera: {sr['camera_options']}. Needs: {', '.join(sr['needs'])}. Fits: {', '.join(sr['fits_intents'])}.")
    L += ["", "## Materials and light profiles (checklists from the independent study, not measured)", ""]
    for m in R["material_recipes"]:
        L.append(f"- {m['id']} {m['material']}: shape {m['shape_language']}; surface {m['surface']}; light {m['lighting']}.")
    for l in R["lighting_profiles"]:
        L.append(f"- {l['id']} {l['name']}: palette {l['palette']}; key {l['key']}; fill {l['fill']}; shadow {l['shadow']}; use for {', '.join(l['use_for'])}.")
    L += [""]
    L += ["## Recipes by situation (shot plans)", ""]
    for rc in R["recipes"]:
        L.append(f"- {rc['situation'].upper()} ({rc['seconds']} s): " + " ".join(f"{i + 1}) {s}" for i, s in enumerate(rc["steps"])) + f" Rules: {', '.join(rc['rules'])}.")
    eg = R.get("engine")
    if eg: L += ["", "## ENGINE (what our renderer does with these rules)", f"- implemented from these rules: {', '.join(eg['implemented_from_these_rules']) or 'nothing yet'}. {eg['note']}"] + [f"- gap: {x}" for x in eg["known_gaps_in_our_engine_found_by_measuring_v2.1"]]
    L += ["", "## Quality gates (before the full render, QC-01)"] + [f"- {g['id']} {g['check']}: {g['pass_condition']} Checks: " + "; ".join(f"[{c['class']}] {c['what']}" for c in g["checks"]) for g in R["quality_gates"]]
    L += ["", "## Checks (run on a finished video)"] + [f"- {c['id']}: {c['what']}" + (f" should be {c['range'][0]} .. {c['range'][1]}" if c.get("range") else "") + f" ({c['tool']})" for c in R["checks"]]
    L += ["", "## Limits of this knowledge"] + [f"- {x}" for x in R["limits"]]
    L += ["", "## How this grows", "Add a reference: `python3 kit/tools/ref_study.py study video.mp4 --name NAME --group refs`, `python3 kit/tools/ref_measure.py add video.mp4 --name NAME --group refs`, "
          "`python3 kit/tools/ref_sheet.py video.mp4 kit/reference/study/NAME.json /tmp/NAME` (look at the sheets), `python3 kit/tools/ref_study.py rules`, add or correct rules in kit/reference/knowledge/rules.json "
          "(keep conf honest, give times as evidence), then `python3 kit/tools/build_playbook.py`. Log it in kit/reference/knowledge/LEARNING_LOG.md."]
    write_beats_doc()
    out = os.path.join(KIT, "docs", "PLAYBOOK.md")
    open(out, "w").write("\n".join(L) + "\n")
    print(f"wrote {out}: {len(L)} lines, {os.path.getsize(out)} bytes")


def write_beats_doc():
    """kit/docs/BEATS.md: the beat plan format for models, generated from kit/schema/beat.v1.schema.json and rules.json (no hand-written copy that can drift)."""
    SC = json.load(open(os.path.join(KIT, "schema", "beat.v1.schema.json")))
    B = SC["$defs"]["beat"]["properties"]
    en = lambda *p: ", ".join(_dig(B, p)["enum"])
    L = ["# BEATS: the beat plan (generated from kit/schema/beat.v1.schema.json and rules.json; do not edit by hand)", "",
         f"Schema version {SC['properties']['schema_version']['const']}. One JSON file per video (beats.json). It turns the narration into structured picture instructions: what the words do, what must be seen, how the camera and the cut serve that, and which checks apply.",
         "It is a plan. It does not replace shot_notes.txt yet. Code that reads it is not built in this step (see kit/docs/TRACEABILITY.md).", "",
         "## Rules for the author of a beats file",
         "- Every beat covers consecutive WORDS of the narration; all beats together cover every word once, in order. Times follow the word times.",
         "- Every id (character, object, environment) must exist in `entities`. Write real sizes in meters for objects (as in FORMAT.md).",
         "- Choose the intent first, then the recipe, then the camera purpose, then the move. A hold is a choice with a reason (rule CAM-16). Do not copy a fixed recipe order (rule SCR-05).",
         "- Use only kit names for faces, poses, outfits and light (FORMAT.md section 6). Extra names go to `extensions`.",
         "- Keep each character's identity lock the same in every beat (rule CON-01).", "",
         "## Values", f"- intent: {en('intent')}", f"- camera.purpose: {en('camera','properties','purpose')}", f"- camera.mode: {en('camera','properties','mode')}",
         f"- camera.ease: {en('camera','properties','ease')}", f"- shot.framing: {en('shot','properties','framing')}",
         f"- transition_in.type: {en('transition_in','properties','type')}", f"- transition_in.reason: {en('transition_in','properties','reason')}",
         f"- object event: {en('object_events','items','properties','event')}", f"- motion_profile: {en('object_events','items','properties','motion_profile')}",
         f"- action phase: {en('character_actions','items','properties','phase')}", f"- confidence: {', '.join(SC['$defs']['confidence']['enum'])}", "",
         "## Fields of one beat", ""]
    for k, v in B.items():
        d = v.get("description") or ""
        req = " (required)" if k in SC["$defs"]["beat"]["required"] else ""
        L.append(f"- `{k}`{req}: {d}" if d else f"- `{k}`{req}")
    L += ["", "## Intent to recipe (candidates, not a sequence)"]
    for k, v in R["intent_map"].items():
        L.append(f"- {k}: {', '.join(v['candidate_recipes'])} ({v['required_visuals']})")
    L += ["", "## Shot recipes"] + [f"- {s['id']} {s['name']}: {s['purpose']}" for s in R["shot_recipes"]]
    L += ["", "## Quality gates that a beat can request (validation.gates)"] + [f"- {g['id']} {g['check']}" for g in R["quality_gates"]]
    L += ["", "Examples: kit/schema/examples/beats_railroads_v2.json and beats_bomb_v22.json. Check a file: python3 kit/tools/validate_beats.py <beats.json>"]
    out = os.path.join(KIT, "docs", "BEATS.md")
    open(out, "w").write("\n".join(L) + "\n")
    print(f"wrote {out}")


def _dig(d, path):
    for p in path:
        d = d[p]
    return d


if __name__ == "__main__":
    main()
