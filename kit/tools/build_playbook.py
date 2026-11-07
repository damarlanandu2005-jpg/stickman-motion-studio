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
         ("profile", "TOPIC PROFILES (what stays the same, what changes with the topic)"), ("props", "PROPS, TEXT, NUMBERS"), ("fx", "EFFECTS"), ("physics", "PHYSICS"), ("captions", "CAPTIONS"), ("sound", "SOUND")]


def f(r, k):
    v = r.get(k)
    return "-" if v is None else (f"{v:.2f}" if isinstance(v, float) else str(v))


def main():
    L = ["# PLAYBOOK: how the reference shorts handle each situation (generated from kit/reference/knowledge/rules.json; do not edit by hand)", "",
         "READ THIS FIRST. These are HABITS measured and seen in real reference shorts. Learn the habit, do not copy a shot. A new topic needs its own world, props and",
         "story; use the habit for how to show it. Each rule says [id | how sure]: measured = computed from every frame, seen = read by eye with the time given, inferred = reasoned.",
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
    L += ["## Recipes by situation (shot plans)", ""]
    for rc in R["recipes"]:
        L.append(f"- {rc['situation'].upper()} ({rc['seconds']} s): " + " ".join(f"{i + 1}) {s}" for i, s in enumerate(rc["steps"])) + f" Rules: {', '.join(rc['rules'])}.")
    eg = R.get("engine")
    if eg: L += ["", "## ENGINE (what our renderer does with these rules)", f"- implemented from these rules: {', '.join(eg['implemented_from_these_rules']) or 'nothing yet'}. {eg['note']}"] + [f"- gap: {x}" for x in eg["known_gaps_in_our_engine_found_by_measuring_v2.1"]]
    L += ["", "## Checks (run on a finished video)"] + [f"- {c['id']}: {c['what']}" + (f" should be {c['range'][0]} .. {c['range'][1]}" if c.get("range") else "") + f" ({c['tool']})" for c in R["checks"]]
    L += ["", "## Limits of this knowledge"] + [f"- {x}" for x in R["limits"]]
    L += ["", "## How this grows", "Add a reference: `python3 kit/tools/ref_study.py study video.mp4 --name NAME --group refs`, `python3 kit/tools/ref_measure.py add video.mp4 --name NAME --group refs`, "
          "`python3 kit/tools/ref_sheet.py video.mp4 kit/reference/study/NAME.json /tmp/NAME` (look at the sheets), `python3 kit/tools/ref_study.py rules`, add or correct rules in kit/reference/knowledge/rules.json "
          "(keep conf honest, give times as evidence), then `python3 kit/tools/build_playbook.py`. Log it in kit/reference/knowledge/LEARNING_LOG.md."]
    out = os.path.join(KIT, "docs", "PLAYBOOK.md")
    open(out, "w").write("\n".join(L) + "\n")
    print(f"wrote {out}: {len(L)} lines, {os.path.getsize(out)} bytes")


if __name__ == "__main__":
    main()
