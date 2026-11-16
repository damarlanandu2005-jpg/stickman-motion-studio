#!/usr/bin/env python3
"""Scene IR tools (Blueprint v2.1, stage 4).

  ir_tool.py build    <story_plan.json> <staging.json> <out scene_ir.json>
  ir_tool.py validate <scene_ir.json> <story_plan.json> [adapter.json]
  ir_tool.py gaps     <adapter.json> <out.md> <plan1> [plan2 ...] -- <ir1> [ir2 ...]

The story plan says what happens. Staging adds where people stand, what they do in vocabulary terms, their face,
the camera move and the mood. build merges the two into scene_ir.json; nothing in it names a renderer.
validate checks the IR against the plan and the vocabulary (errors block), then against an adapter (reports
what that renderer cannot do yet; exit code 2 = valid but not renderable).
"""
import json, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
VOCAB = json.load(open(os.path.join(HERE, "vocab.json")))
NEED = {"give": ({"hand_over"}, {"receive"}), "show": ({"hold_up", "open_case"}, None), "take": ({"lift", "receive", "dig"}, None), "put_away": ({"pocket"}, None)}


def replay_holds(plan):
    """What each character holds during each shot (after that shot's events), per the plan."""
    state, out = {}, {}
    for sc in plan["scenes"]:
        st = state.setdefault(sc.get("timeline", "main"), {})
        here = {c["id"]: set(c.get("holds", [])) for c in sc.get("cast", [])}
        for b in sc["beats"]:
            for sh in b["shots"]:
                for ev in sh.get("events", []):
                    who, p = ev.get("from") or ev.get("who"), ev["prop"]
                    if ev["do"] == "give": here[who].discard(p); here[ev["to"]].add(p)
                    elif ev["do"] in ("drop", "put_away"): here[who].discard(p)
                    elif ev["do"] in ("take", "put_on"): here[who].add(p)
                out[(sc["id"], sh["id"])] = {k: sorted(v) for k, v in here.items()}
        st.update(here)
    return out


def build(plan, staging):
    holds = replay_holds(plan)
    ir = {"title": plan["title"], "plan": plan.get("script"), "vocab": "scene/vocab.json", "scenes": []}
    for sc in plan["scenes"]:
        sg = staging["scenes"].get(sc["id"], {})
        shots = []
        for b in sc["beats"]:
            for sh in b["shots"]:
                ss = sg.get("shots", {}).get(sh["id"], {})
                stage = []
                for item in ss.get("stage", []):
                    who, rest = item.split("@"); slot, action, face = rest.split(":")
                    stage.append({"who": who, "slot": slot, "action": action, "face": face, "holds": holds[(sc["id"], sh["id"])].get(who, [])})
                shots.append({"id": sh["id"], "w0": sh["w0"], "type": sh["type"], "move": ss.get("move"), "subject": sh["subject"], "stage": stage,
                              "shows": [x for x in sh.get("shows", []) if not x.startswith("label:")], "labels": [x[6:] for x in sh.get("shows", []) if x.startswith("label:")],
                              "events": sh.get("events", []), "proof": b["proof"]["item"] if sh is b["shots"][0] or b["proof"]["item"] in sh.get("shows", []) or b["proof"]["item"] == sh["subject"] else None,
                              "intent": sh["action"]})
        ir["scenes"].append({"id": sc["id"], "set": sc["place"]["id"], "enclosed": sc["place"]["kind"] == "interior", "period": sc["place"]["period"], "mood": sg.get("mood"),
                             "relation": sc["relation"], "tag": sc.get("tag", ""), "timeline": sc.get("timeline", "main"),
                             "cast": [{"id": c["id"], "costume": c["costume"]} for c in sc.get("cast", [])],
                             "crowd": {"count": sc.get("crowd", {}).get("count", 0), "action": sg.get("crowd_action", "none")},
                             "dressing": sc["dressing"], "props_here": sc.get("props_here", []), "shots": shots})
    return ir


def validate(ir, plan, adapter=None):
    E, G = [], []          # errors (block) and gaps (renderer cannot do it yet)
    err = lambda w, m: E.append(f"{w}: {m}")
    pshots = {(sc["id"], sh["id"]): (sc, sh) for sc in plan["scenes"] for b in sc["beats"] for sh in b["shots"]}
    seen = set()
    for sc in ir["scenes"]:
        sid = sc["id"]
        vs = VOCAB["sets"].get(sc["set"])
        if not vs: err(sid, f"set '{sc['set']}' is not in the vocabulary"); vs = {"slots": [], "enclosed": sc["enclosed"]}
        if vs["enclosed"] != sc["enclosed"]: err(sid, f"plan says {'interior' if sc['enclosed'] else 'exterior'} but set '{sc['set']}' is {'enclosed' if vs['enclosed'] else 'open'}")
        kind = VOCAB["moods"].get(sc["mood"])
        if not kind: err(sid, f"mood '{sc['mood']}' is not in the vocabulary")
        elif (kind == "interior") != sc["enclosed"]: err(sid, f"mood '{sc['mood']}' is {kind} but the scene is {'interior' if sc['enclosed'] else 'exterior'}")
        if sc["crowd"]["action"] not in VOCAB["crowd_actions"]: err(sid, f"crowd action '{sc['crowd']['action']}' unknown")
        if sc["crowd"]["count"] > 0 and sc["crowd"]["action"] == "none": err(sid, "crowd present but no crowd action")
        cast = {c["id"] for c in sc["cast"]}
        staged_ever = set()
        for sh in sc["shots"]:
            hid = f"{sid}/{sh['id']}"; seen.add((sid, sh["id"]))
            if (sid, sh["id"]) not in pshots: err(hid, "shot is not in the story plan"); continue
            ps = pshots[(sid, sh["id"])][1]
            if (sh["w0"], sh["type"], sh["subject"]) != (ps["w0"], ps["type"], ps["subject"]): err(hid, "word index, type or subject differs from the plan")
            if sh["move"] not in VOCAB["moves"]: err(hid, f"camera move '{sh['move']}' unknown")
            slots = set(); acts = {}
            for st in sh["stage"]:
                staged_ever.add(st["who"]); acts[st["who"]] = st["action"]
                if st["who"] not in cast: err(hid, f"'{st['who']}' is staged but not in this scene's cast")
                if st["slot"] not in vs["slots"]: err(hid, f"slot '{st['slot']}' does not exist in set '{sc['set']}'")
                if st["slot"] in slots: err(hid, f"two people in slot '{st['slot']}'")
                slots.add(st["slot"])
                if st["action"] not in VOCAB["actions"]: err(hid, f"action '{st['action']}' unknown")
                if st["face"] not in VOCAB["faces"]: err(hid, f"face '{st['face']}' unknown")
            if sh["subject"] in cast and sh["subject"] not in acts: err(hid, f"subject '{sh['subject']}' is not staged in the shot")
            for x in sh["shows"]:
                if x in cast and x not in acts: err(hid, f"shot must show '{x}' but they are not staged")
            for ev in sh["events"]:
                a, b = NEED.get(ev["do"], (None, None)); who = ev.get("from") or ev.get("who")
                if a and acts.get(who) not in a: err(hid, f"event {ev['do']} {ev['prop']}: {who} must be doing one of {sorted(a)}, is '{acts.get(who)}'")
                if b and acts.get(ev.get("to")) not in b: err(hid, f"event {ev['do']} {ev['prop']}: {ev.get('to')} must be doing one of {sorted(b)}, is '{acts.get(ev.get('to'))}'")
        for c in cast - staged_ever: err(sid, f"cast member '{c}' is never staged")
    for k in set(pshots) - seen: err(f"{k[0]}/{k[1]}", "plan shot missing from the IR")

    if adapter:
        def st(section, key):
            v = adapter.get(section, {}).get(key)
            return (v.get("status") if isinstance(v, dict) else v) or "missing"
        def gap(kind, key, where):
            s = st(kind, key.lower() if kind == "items" else key)
            if s != "have": G.append((s, kind, key, where))
        for sc in ir["scenes"]:
            gap("sets", sc["set"], sc["id"]); gap("moods", sc["mood"], sc["id"])
            if sc["crowd"]["count"]: gap("crowd_actions", sc["crowd"]["action"], sc["id"])
            for d in sc["dressing"]: gap("items", d, sc["id"])
            for sh in sc["shots"]:
                w = f"{sc['id']}/{sh['id']}"
                gap("shot_types", sh["type"], w); gap("moves", sh["move"], w)
                for s_ in sh["stage"]:
                    gap("actions", s_["action"], w); gap("faces", s_["face"], w)
                    for p in s_["holds"]: gap("props", p, w)
    return E, G


def gaps_report(adapter, out, plans, irs):
    rows = {}
    def add(status, kind, key, where): rows.setdefault((status, kind, key), set()).add(where)
    def st(section, key):
        v = adapter.get(section, {}).get(key); return (v.get("status") if isinstance(v, dict) else v) or "missing"
    for pp in plans:
        plan = json.load(open(pp)); name = os.path.basename(pp).split(".")[0]
        for sc in plan["scenes"]:
            if st("sets", sc["place"]["id"]) != "have": add(st("sets", sc["place"]["id"]), "set", sc["place"]["id"], name)
            for d in sc["dressing"]:
                if st("items", d.lower()) != "have": add(st("items", d.lower()), "set piece", d, name)
        for p in plan["props"]:
            if st("props", p["id"]) != "have": add(st("props", p["id"]), "prop", p["id"], name)
    for ip, pp in irs:
        E, G = validate(json.load(open(ip)), json.load(open(pp)), adapter); name = os.path.basename(ip).split(".")[0]
        for s, kind, key, where in G:
            if kind in ("actions", "faces", "moods", "crowd_actions", "shot_types", "moves"): add(s, kind[:-1].replace("_", " "), key, name)
    L = ["# What the three plans need that inkbeat does not have yet", "",
         "Generated by `scene/ir_tool.py gaps`. Sets, set pieces and props are read from all three story plans. Actions, faces,",
         "moods and crowd behaviour are read from scene IR, which exists only for the plans listed under 'IR checked'.", "",
         f"IR checked: {', '.join(os.path.basename(i).split('.')[0] for i, _ in irs)}", ""]
    for status, title in (("missing", "Must be built"), ("approx", "Can be faked for now, should be built properly")):
        L += [f"## {title}", "", "| Kind | Item | Needed by |", "|---|---|---|"]
        for (s, kind, key), who in sorted(rows.items(), key=lambda r: (r[0][1], r[0][2])):
            if s == status: L.append(f"| {kind} | {key} | {', '.join(sorted(who))} |")
        L.append("")
    n_m = sum(1 for k in rows if k[0] == "missing"); n_a = sum(1 for k in rows if k[0] == "approx")
    L.insert(2, f"**{n_m} items must be built, {n_a} can be faked for now.**\n")
    open(out, "w").write("\n".join(L) + "\n"); return n_m, n_a


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "build":
        ir = build(json.load(open(sys.argv[2])), json.load(open(sys.argv[3]))); json.dump(ir, open(sys.argv[4], "w"), indent=1); print("wrote", sys.argv[4])
    elif cmd == "validate":
        ad = json.load(open(sys.argv[4])) if len(sys.argv) > 4 else None
        E, G = validate(json.load(open(sys.argv[2])), json.load(open(sys.argv[3])), ad)
        for e in E: print("ERROR", e)
        agg = {}
        for s, kind, key, where in G: agg.setdefault((s, kind, key), []).append(where)
        for (s, kind, key), w in sorted(agg.items()): print(f"GAP   {s:7s} {kind}: {key}  ({len(w)} uses, first {w[0]})")
        miss = sum(1 for k in agg if k[0] == "missing")
        print(f"{os.path.basename(sys.argv[2])}: {len(E)} errors; {miss} missing and {len(agg) - miss} approximate renderer terms")
        sys.exit(1 if E else (2 if miss else 0))
    elif cmd == "gaps":
        i = sys.argv.index("--"); plans = sys.argv[4:i]; irs = sys.argv[i + 1:]
        pairs = [(ip, next(p for p in plans if os.path.basename(p).split(".")[0] == os.path.basename(ip).split(".")[0])) for ip in irs]
        print("missing %d, approximate %d" % gaps_report(json.load(open(sys.argv[2])), sys.argv[3], plans, pairs))
