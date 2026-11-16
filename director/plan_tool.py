#!/usr/bin/env python3
"""Story Director tools (Blueprint v2.1, stage 2). Engine-independent.

  plan_tool.py validate <story_plan.json> <words.json>   -> errors (block) and warnings; exit 1 on any error
  plan_tool.py render   <story_plan.json> <words.json>   -> a readable .md next to the plan, for the owner

A story plan is: facts, cast, props, and scenes. Each scene declares its place, time, who is there, what they
hold, how it relates to the scene before, and its beats. A beat is one narration claim with its visible proof
and one or more shots. Word indices refer to words.json, so every word of narration is covered exactly once.
"""
import json, sys, os

RELATIONS = {"opening", "continuation", "time_jump", "location_change", "parallel", "contrast", "flashback", "montage"}
NEEDS_TAG = {"time_jump", "location_change", "flashback", "parallel"}
SHOT_TYPES = {"wide", "medium", "two_shot", "close", "detail"}
EVENTS = {"give", "take", "drop", "show", "put_away", "put_on"}
MIN_SHOT, MAX_SHOT = 0.7, 4.6      # seconds a shot may hold
MIN_DRESSING = 5                   # set pieces per place besides the proof
MIN_PUBLIC_CROWD = 6               # background people in a place marked public


def load(plan_path, words_path):
    return json.load(open(plan_path)), json.load(open(words_path))["words"]


def shot_spans(plan, words):
    """Flatten shots in order and give each its word range and time span."""
    flat = []
    for sc in plan["scenes"]:
        for b in sc["beats"]:
            for sh in b["shots"]:
                flat.append((sc, b, sh))
    for i, (sc, b, sh) in enumerate(flat):
        end = flat[i + 1][2]["w0"] if i + 1 < len(flat) else len(words)
        sh["_w1"] = end
        ok = 0 <= sh["w0"] < end <= len(words)
        sh["_t0"] = words[sh["w0"]]["t0"] if ok else 0
        sh["_t1"] = (words[end]["t0"] if end < len(words) else words[-1]["t1"]) if ok else 0
        sh["_text"] = " ".join(w["w"] for w in words[sh["w0"]:end]) if ok else "?"
    return flat


def validate(plan, words):
    E, W = [], []
    err = lambda where, msg: E.append(f"{where}: {msg}")
    warn = lambda where, msg: W.append(f"{where}: {msg}")
    facts = {f["id"]: f for f in plan.get("facts", [])}
    cast = {c["id"]: c for c in plan.get("cast", [])}
    props = {p["id"]: p for p in plan.get("props", [])}
    for k in ("title", "originality", "facts", "cast", "props", "scenes"):
        if k not in plan: err("plan", f"missing '{k}'")
    for f in facts.values():
        if not f.get("url"): err(f"fact {f['id']}", "no source url")
        if f.get("status") == "contradicted": err(f"fact {f['id']}", f"source contradicts the script: {f.get('note','')}")
        elif f.get("status") != "verified": warn(f"fact {f['id']}", f"{f.get('status','unverified')}: {f.get('note','')}")

    flat = shot_spans(plan, words)
    # every narration word covered once, in order
    if flat and flat[0][2]["w0"] != 0: err("coverage", "first shot does not start at word 0")
    prev = -1
    for sc, b, sh in flat:
        if sh["w0"] <= prev: err(f"{sc['id']}/{sh['id']}", "shots out of order or overlapping")
        prev = sh["w0"]

    state = {}      # timeline -> {char: {"costume": str, "holds": set}}
    seen_ids, tags = set(), []
    for i, sc in enumerate(plan["scenes"]):
        sid = sc.get("id", f"scene[{i}]")
        if sid in seen_ids: err(sid, "duplicate scene id")
        seen_ids.add(sid)
        rel = sc.get("relation")
        if rel not in RELATIONS: err(sid, f"relation '{rel}' is not one of {sorted(RELATIONS)}")
        if (i == 0) != (rel == "opening"): err(sid, "only the first scene may (and must) be 'opening'")
        if not sc.get("relation_reason", "").strip(): err(sid, "no reason given for the cut into this scene")
        if rel in NEEDS_TAG and not sc.get("tag", "").strip(): err(sid, f"a {rel} needs an on-screen place/time tag")
        if sc.get("tag"): tags.append(sc["tag"])
        place = sc.get("place", {})
        for k in ("id", "kind", "desc", "period"):
            if not place.get(k): err(sid, f"place.{k} missing")
        if place.get("kind") not in ("interior", "exterior"): err(sid, "place.kind must be interior or exterior")
        if not sc.get("time"): err(sid, "time of day missing")
        dressing = sc.get("dressing", [])
        if len(dressing) < MIN_DRESSING: err(sid, f"only {len(dressing)} dressing pieces; a place needs {MIN_DRESSING}+ besides the proof")
        crowd = sc.get("crowd", {"count": 0})
        if place.get("public") and crowd.get("count", 0) < MIN_PUBLIC_CROWD and not sc.get("empty_reason"):
            err(sid, f"public place with {crowd.get('count',0)} background people (needs {MIN_PUBLIC_CROWD}+ or an empty_reason)")
        if not sc.get("cast") and not crowd.get("count") and not sc.get("empty_reason"):
            err(sid, "nobody in the scene and no empty_reason")

        # ---- continuity, per timeline (a flashback or hook keeps its own snapshot) ----
        tl = sc.get("timeline", "main")
        st = state.setdefault(tl, {})
        here = {}
        for c in sc.get("cast", []):
            cid = c["id"]
            if cid not in cast: err(sid, f"cast '{cid}' is not in the cast list"); continue
            holds = set(c.get("holds", []))
            for p in holds:
                if p not in props: err(sid, f"{cid} holds unknown prop '{p}'")
            if cid in st:
                if st[cid]["costume"] != c.get("costume") and not c.get("costume_reason"):
                    err(sid, f"{cid} changes costume ('{st[cid]['costume']}' -> '{c.get('costume')}') with no costume_reason")
                if st[cid]["holds"] != holds and not c.get("holds_reason"):
                    err(sid, f"{cid} held {sorted(st[cid]['holds'])} at the end of the last scene on this timeline but enters holding {sorted(holds)} with no holds_reason")
            here[cid] = {"costume": c.get("costume"), "holds": holds}
        loose = set(sc.get("props_here", []))
        for p in loose:
            if p not in props: err(sid, f"props_here has unknown prop '{p}'")
        visible = set(here) | loose | set(dressing) | {"place"}

        if not sc.get("beats"): err(sid, "no beats")
        for b in sc.get("beats", []):
            bid = f"{sid}/{b.get('id','?')}"
            if not b.get("claim"): err(bid, "no claim (what the narration says here)")
            if b.get("fact") and b["fact"] not in facts: err(bid, f"fact '{b['fact']}' not in facts list")
            proof = b.get("proof", {})
            if not proof.get("item") or not proof.get("how"): err(bid, "no proof (what on screen shows the claim)")
            shown = False
            if not b.get("shots"): err(bid, "beat has no shots")
            for sh in b.get("shots", []):
                hid = f"{sid}/{sh.get('id','?')}"
                if sh.get("type") not in SHOT_TYPES: err(hid, f"shot type '{sh.get('type')}' unknown")
                if not sh.get("action"): err(hid, "no action")
                dur = sh["_t1"] - sh["_t0"]
                if dur < MIN_SHOT: err(hid, f"shot lasts {dur:.2f}s (< {MIN_SHOT}s), too short to read")
                if dur > MAX_SHOT: err(hid, f"shot lasts {dur:.2f}s (> {MAX_SHOT}s), split it")
                for ev in sh.get("events", []):
                    do, p = ev.get("do"), ev.get("prop")
                    if do not in EVENTS: err(hid, f"event '{do}' unknown"); continue
                    if p not in props: err(hid, f"event uses unknown prop '{p}'"); continue
                    who = ev.get("from") or ev.get("who")
                    if do in ("give", "show", "drop", "put_away"):
                        if who not in here: err(hid, f"{do}: '{who}' is not in this scene"); continue
                        if p not in here[who]["holds"]: err(hid, f"{do}: {who} does not hold '{p}' at this point"); continue
                    if do == "give":
                        to = ev.get("to")
                        if to not in here: err(hid, f"give: receiver '{to}' is not in this scene"); continue
                        here[who]["holds"].discard(p); here[to]["holds"].add(p)
                    elif do == "drop": here[who]["holds"].discard(p); loose.add(p)
                    elif do == "put_away": here[who]["holds"].discard(p)
                    elif do in ("take", "put_on"):
                        if who not in here: err(hid, f"{do}: '{who}' is not in this scene"); continue
                        if p not in loose: err(hid, f"{do}: '{p}' is not lying in this scene (props_here)"); continue
                        loose.discard(p); here[who]["holds"].add(p)
                visible_now = set(here) | loose | set(dressing) | {"place"} | {p for c in here.values() for p in c["holds"]}
                subj = sh.get("subject")
                if subj not in visible_now and not str(subj).startswith("label:"): err(hid, f"subject '{subj}' is not in this scene")
                for x in sh.get("shows", []):
                    if x not in visible_now and not str(x).startswith("label:"): err(hid, f"shows '{x}', which is not in this scene at this point")
                if proof.get("item") in sh.get("shows", []) or proof.get("item") == subj: shown = True
            if proof.get("item") and not shown: err(bid, f"no shot shows the proof '{proof.get('item')}'")
        # scene length sanity: a long scene on one shot is a static hold
        shots = [sh for b in sc.get("beats", []) for sh in b.get("shots", [])]
        if shots:
            length = shots[-1]["_t1"] - shots[0]["_t0"]
            if length > 6 and len(shots) < 2: err(sid, f"{length:.1f}s on a single shot")
        for cid, c in here.items(): st[cid] = {"costume": c["costume"], "holds": set(c["holds"])}
    dur = words[-1]["t1"]
    tgt = plan.get("duration_target", [40, 60])
    if not (tgt[0] <= dur <= tgt[1]): warn("plan", f"voice is {dur:.1f}s, outside the target {tgt[0]}-{tgt[1]}s")
    return E, W


def render(plan, words, out):
    flat = shot_spans(plan, words)
    L = [f"# Story plan: {plan['title']}", "", f"Script: `{plan.get('script','')}` · voice {words[-1]['t1']:.1f}s · {len(plan['scenes'])} scenes · {len(flat)} shots", ""]
    L += ["## Cast", ""] + [f"- **{c['id']}**: {c['desc']}" for c in plan["cast"]] + [""]
    L += ["## Props that matter", ""] + [f"- **{p['id']}**: {p['desc']}" for p in plan["props"]] + [""]
    L += ["## Scenes", ""]
    for n, sc in enumerate(plan["scenes"], 1):
        shots = [sh for b in sc["beats"] for sh in b["shots"]]
        L.append(f"### {n}. {sc['place']['desc']} ({shots[0]['_t0']:.1f}s to {shots[-1]['_t1']:.1f}s)")
        L.append("")
        L.append(f"- **Cut:** {sc['relation'].replace('_',' ')}. {sc['relation_reason']}")
        if sc.get("tag"): L.append(f"- **On-screen tag:** {sc['tag']}")
        L.append(f"- **Place and time:** {sc['place']['kind']}, {sc['place']['period']}, {sc['time']}" + (f" · timeline: {sc['timeline']}" if sc.get("timeline", "main") != "main" else ""))
        who = "; ".join(f"{c['id']} ({c['costume']}" + (f", holding {', '.join(c['holds'])}" if c.get("holds") else "") + ")" for c in sc.get("cast", []))
        L.append(f"- **Who:** {who or 'nobody named'}")
        cr = sc.get("crowd", {})
        L.append(f"- **Background people:** {cr.get('count',0)}" + (f", {cr['what']}" if cr.get("what") else "") + (f". Empty on purpose: {sc['empty_reason']}" if sc.get("empty_reason") else ""))
        L.append(f"- **Set:** {', '.join(sc['dressing'])}")
        L.append("")
        L.append("| Time | Narration | Shot | What we see | Proof |")
        L.append("|---|---|---|---|---|")
        for b in sc["beats"]:
            for j, sh in enumerate(b["shots"]):
                pr = f"{b['proof']['item']}: {b['proof']['how']}" if j == 0 else ""
                L.append(f"| {sh['_t0']:.1f}-{sh['_t1']:.1f} | {sh['_text']} | {sh['type'].replace('_',' ')} on {sh['subject']} | {sh['action']} | {pr} |")
        L.append("")
    L += ["## Fact check", "", "| Claim | Status | Source | Note |", "|---|---|---|---|"]
    L += [f"| {f['claim']} | {f['status']} | {f['url']} | {f.get('note','')} |" for f in plan["facts"]]
    open(out, "w").write("\n".join(L) + "\n")


if __name__ == "__main__":
    cmd, pp, wp = sys.argv[1], sys.argv[2], sys.argv[3]
    plan, words = load(pp, wp)
    if cmd == "validate":
        E, W = validate(plan, words)
        for w in W: print("WARN ", w)
        for e in E: print("ERROR", e)
        print(f"{os.path.basename(pp)}: {len(E)} errors, {len(W)} warnings")
        sys.exit(1 if E else 0)
    elif cmd == "render":
        out = pp.replace(".json", ".md"); render(plan, words, out); print("wrote", out)
