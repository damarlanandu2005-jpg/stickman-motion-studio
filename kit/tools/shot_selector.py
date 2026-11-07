#!/usr/bin/env python3
"""Shot-recipe selector: validated beat plan  ->  chosen recipe per beat, with the reasons.   (Step 2B, production code)

  python3 kit/tools/shot_selector.py beats.json [--out beats.selected.json] [--report selection.report.json] [--profile profile.json ...]

UNIVERSAL: nothing here knows a topic. It reads only the plan (intent, who and what is in the frame, the action, the camera purpose, the place change, the previous beats)
and the data in kit/reference/knowledge (rules.json: intent_map, shot_recipes; traceability.json: capability_registry).
SPECIALISED behaviour (a horse gallop, a water material ...) does NOT belong here: it comes in through --profile files, which can only (a) bias a recipe,
(b) add candidate recipes for an intent, (c) require a renderer capability. No profile is shipped in this commit; the hook is tested with a synthetic one.

For every beat it scores all 8 recipes on seven factors (each 0..1, weights in WEIGHTS), keeps the planner's (Gemini's) choice when it is a justified alternative
(score within KEEP_MARGIN of the best and not unavailable), otherwise replaces it, and writes why. There is no fixed recipe sequence: the same beat gets a different recipe
when the previous beats, the assets or the place change differ.

WHAT IT DOES NOT DO: it does not move the camera, change the characters or touch the renderer. It sets shot.recipe_id (and shot.framing when the recipe needs another family)
and records the decision under beat.extensions.selector. The renderer does not read the plan yet (see kit/docs/TRACEABILITY.md).
"""
import argparse, copy, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE)
RULES = os.path.join(KIT, "reference", "knowledge", "rules.json")
TRACE = os.path.join(KIT, "reference", "knowledge", "traceability.json")

WEIGHTS = {"intent": 0.26, "assets": 0.22, "action": 0.14, "continuity": 0.12, "variety": 0.14, "camera": 0.08, "duration": 0.04}
REPEAT_LIMIT_MARGIN = 0.30   # a third identical recipe is allowed only if every other recipe scores this far below
KEEP_MARGIN = 0.07        # the planner's recipe is kept when it scores within this of the best (a justified alternative)
FRAMING_OF = {"S01": ("wide", "medium_wide"), "S02": ("medium", "medium_wide"), "S03": ("close", "detail", "top_down", "pov"), "S04": ("close", "medium"),
              "S05": ("wide", "medium_wide"), "S06": ("medium", "medium_wide", "wide"), "S07": ("detail", "close", "top_down"), "S08": ("medium", "medium_wide")}
# which camera purposes a recipe usually serves (interpretation of rules.json recipe text, CAM-16)
PURPOSES_OF = {"S01": {"establish", "reveal", "carry_to_next_place"}, "S02": {"hold_for_performance", "power_angle", "emphasize"},
               "S03": {"inspect", "emphasize", "land_on_prop", "compare", "impact"}, "S04": {"emphasize", "hold_for_performance", "land_on_prop"},
               "S05": {"reveal", "establish", "power_angle", "carry_to_next_place"}, "S06": {"follow", "impact", "reveal", "inspect", "emphasize"},
               "S07": {"inspect", "compare", "emphasize"}, "S08": {"hold_for_performance", "compare", "emphasize"}}
# renderer capability a recipe needs. S07 (diagram/cutaway) has no verified renderer support, so it is unavailable unless a profile supplies one
RECIPE_CAPS = {"S07": ["CAP-DIAGRAM-CARD"]}


def load():
    return json.load(open(RULES)), json.load(open(TRACE))


def capabilities(trace, profiles):
    caps = {c["id"]: bool(c.get("exists")) for c in trace.get("capability_registry", [])}
    caps["CAP-DIAGRAM-CARD"] = False                 # nothing in kit/engine draws a diagram card or cutaway (verified in TRACEABILITY.md)
    for p in profiles:
        for c in p.get("provides_capabilities", []): caps[c] = True
    return caps


class Ctx:
    """what the plan says about one beat, in numbers and flags"""
    def __init__(self, D, k):
        B = D["beats"]; b = B[k]; ents = D["entities"]
        self.chars = {c["id"] for c in ents["characters"]}; self.objs = {o["id"] for o in ents["objects"]}
        s = b["subject"]; sh = b["shot"]
        self.L = b["time"]["end_s"] - b["time"]["start_s"]
        ids = {s["main_id"], *s.get("character_ids", []), *s.get("required_asset_ids", []), *b["validation"]["must_see"], sh["composition"]["primary_id"], *sh["composition"].get("secondary_ids", [])}
        self.chars_in = ({i for i in ids if i in self.chars} | set(s.get("character_ids", [])))
        self.objs_in = {i for i in ids if i in self.objs} | ({s["hero_object_id"]} if "hero_object_id" in s else set())
        self.main_is_char = s["main_id"] in self.chars
        self.hero = "hero_object_id" in s or (not self.main_is_char and s["main_id"] in self.objs)
        ev = b.get("object_events", []); self.events = ev
        self.contact = any(e["event"] in ("impact", "break", "drop", "launch") for e in ev)
        self.moving = any(e["event"] in ("move", "swing", "roll", "slide", "drop", "launch", "spin", "bend") for e in ev)
        ca = b.get("character_actions", []); self.actions = ca
        self.faces = [a for a in ca if a.get("face")]
        self.talking = any(a.get("speaking") for a in ca) if ca else False
        env = next((e for e in ents["environments"] if e["id"] == b["environment_id"]), {})
        self.depth = len(env.get("depth_layers", [])) >= 2
        self.new_place = k > 0 and (B[k - 1]["environment_id"] != b["environment_id"])
        self.first_in_env = all(x["environment_id"] != b["environment_id"] for x in B[:k])
        self.intent = b["intent"]; self.purpose = b["camera"]["purpose"]; self.mode = b["camera"]["mode"]; self.framing = sh["framing"]
        self.primary = sh["composition"]["primary_id"]; self.planner = sh["recipe_id"]; self.trans = b["transition_in"]["type"]; self.k = k; self.id = b["id"]
        self.numeric = bool([o for o in self.objs_in if next((x for x in ents["objects"] if x["id"] == o), {}).get("text_on_object")])


def f_intent(R, c, rid):
    im = R["intent_map"].get(c.intent, {}).get("candidate_recipes", [])
    if rid in im: return [1.0, 0.8, 0.6, 0.5][min(im.index(rid), 3)], f"candidate #{im.index(rid) + 1} for intent {c.intent}"
    rec = next(s for s in R["shot_recipes"] if s["id"] == rid)
    if c.intent in rec["fits_intents"]: return 0.45, f"fits intent {c.intent} (not a first-line candidate)"
    return 0.1, f"not meant for intent {c.intent}"


def f_assets(c, rid):
    n_ch, n_ob = len(c.chars_in), len(c.objs_in)
    if rid == "S01": return (1.0 if c.depth and (n_ch or n_ob) else 0.55 if c.depth else 0.25), "environment with depth layers" + (" and a scale anchor" if (n_ch or n_ob) else ", no scale anchor")
    if rid == "S02": return (1.0 if c.main_is_char and n_ch == 1 else 0.6 if n_ch >= 1 else 0.0), f"{n_ch} character(s) in frame"
    if rid == "S03": return (1.0 if c.hero or (n_ob and not n_ch) else 0.55 if n_ob else 0.0), ("hero object" if c.hero else f"{n_ob} object(s) in frame")
    if rid == "S04": return (1.0 if n_ch and (c.faces or c.main_is_char) else 0.5 if n_ch else 0.0), ("a character with a face action" if c.faces else f"{n_ch} character(s)")
    if rid == "S05": return (1.0 if c.depth and (n_ch or n_ob) else 0.5 if c.depth else 0.2), "a place with depth and something to reveal"
    if rid == "S06": return (1.0 if n_ch and n_ob else 0.5 if (n_ch or n_ob) else 0.0), f"actor+object: {n_ch} character(s), {n_ob} object(s)"
    if rid == "S07": return (0.5 if n_ob else 0.1), "diagram needs a hero object and a cutaway renderer"
    if rid == "S08": return (1.0 if n_ch >= 2 else 0.0), f"{n_ch} characters in frame (dialogue needs two)"
    return 0.0, "-"


def f_action(c, rid):
    act = c.moving or c.contact or bool(c.events)
    if rid == "S06": return (1.0 if act and c.chars_in else 0.7 if act else 0.1), ("object events planned" if act else "no physical action planned")
    if rid == "S03": return (0.9 if act else 0.7 if c.hero else 0.3), ("hero object acts" if act else "hero object, no action")
    if rid == "S04": return (1.0 if c.faces else 0.5), ("a face/reaction is planned" if c.faces else "no face action planned")
    if rid == "S08": return (1.0 if len(c.faces) >= 2 or c.talking else 0.6), "two-way acting"
    if rid in ("S01", "S05"): return (0.8 if not act else 0.5), "the place carries the beat" if not act else "action would be lost in a wide shot"
    if rid == "S02": return (0.8 if not act else 0.4), "a person holds the frame"
    return 0.5, "-"


def f_continuity(c, rid, prev):
    """prev: list of already chosen (recipe, framing) of the beats before"""
    if c.k == 0: return (0.8 if rid in ("S04", "S03", "S05", "S01") else 0.6), "opening beat: no history; a reaction, a prop or a world all open well"
    pr = prev[-1][0]
    if c.new_place and c.first_in_env: return (1.0 if rid in ("S01", "S05") else 0.55), "new place seen for the first time: show the place"
    if c.new_place: return (0.8 if rid in ("S01", "S05", "S02") else 0.6), "back in a known place"
    if c.trans in ("cut",) and rid == pr: return 0.2, "hard cut to the same recipe looks like a jump cut"
    if rid in ("S03", "S04") and pr in ("S03", "S04") and rid != pr: return 0.75, "tight-to-tight, different subject"
    if rid in ("S03", "S04", "S06") and pr in ("S01", "S05"): return 1.0, "coming in from a wide shot"
    if rid in ("S01", "S05") and pr in ("S03", "S04", "S06"): return 0.9, "pulling out after a tight shot"
    return 0.7, "same place, no special continuity need"


def f_variety(c, rid, prev):
    run = 0
    for r, _, _ in reversed(prev):
        if r == rid: run += 1
        else: break
    fr_prev = prev[-1][1] if prev else None
    s = 1.0 - [0, 0.35, 0.8, 1.0][min(run, 3)]
    fr_me = c.framing if (rid == c.planner and c.framing in FRAMING_OF[rid]) else FRAMING_OF[rid][0]
    if prev and prev[-1][2] == c.primary and prev[-1][1] == fr_me:
        s -= 0.35; run_note = "same subject and same framing as the previous beat (a near-identical picture)"
    else: run_note = None
    why = [f"{rid} used {run}x just before" if run else "not used in the last beat"] + ([run_note] if run_note else [])
    if run == 0 and sum(1 for r, _, _ in prev[-4:] if r == rid) >= 2: s -= 0.25; why.append("2+ times in the last 4")
    if fr_prev and fr_prev in FRAMING_OF[rid] and run == 0 and len(FRAMING_OF[rid]) == 1: s -= 0.1
    return max(0.0, s), "; ".join(why)


def f_camera(c, rid):
    ok = c.purpose in PURPOSES_OF[rid]
    return (1.0 if ok else 0.35), f"camera purpose {c.purpose} " + ("fits" if ok else "is not typical for") + f" {rid}"


def f_duration(R, c, rid):
    lo, hi = next(s for s in R["shot_recipes"] if s["id"] == rid)["typical_seconds"]
    # the measured median scene is 2.4 s, much longer than the designed ranges, so only a big mismatch counts
    return (1.0 if c.L <= hi * 2.5 else 0.5 if c.L <= hi * 4 else 0.25), f"beat is {c.L:.1f} s, designed range {lo}-{hi} s"


def evaluate(R, caps, profiles, D, k, prev):
    c = Ctx(D, k); out = {}
    for rec in R["shot_recipes"]:
        rid = rec["id"]
        need = list(RECIPE_CAPS.get(rid, [])); [need.extend(p.get("recipe_needs", {}).get(rid, [])) for p in profiles]
        missing = [n for n in need if not caps.get(n)]
        fs = {"intent": f_intent(R, c, rid), "assets": f_assets(c, rid), "action": f_action(c, rid), "continuity": f_continuity(c, rid, prev),
              "variety": f_variety(c, rid, prev), "camera": f_camera(c, rid), "duration": f_duration(R, c, rid)}
        score = sum(WEIGHTS[n] * v for n, (v, _) in fs.items())
        bias = sum(p.get("recipe_bias", {}).get(rid, 0.0) for p in profiles if _profile_applies(p, c))
        extra = any(rid in p.get("extra_candidates", {}).get(c.intent, []) for p in profiles)
        if extra: score += 0.05
        score += bias
        if c.chars_in == set() and rid in ("S02", "S04", "S08"): score -= 0.3     # no person to show
        unavailable = bool(missing) or (rid == "S08" and len(c.chars_in) < 2)
        out[rid] = {"score": round(score, 3), "factors": {n: {"value": round(v, 2), "why": w} for n, (v, w) in fs.items()}, "bias": round(bias, 3),
                    "unavailable": unavailable, "missing_capabilities": missing}
    return c, out


def _profile_applies(p, c):
    w = p.get("applies_to_intents")
    return not w or c.intent in w


def reason(ctx, rid, ev, chosen_by):
    e = ev[rid]; top = sorted(e["factors"].items(), key=lambda kv: -WEIGHTS[kv[0]] * kv[1]["value"])[:3]
    weak = [n for n, f in e["factors"].items() if f["value"] <= 0.4]
    s = f"{rid} for intent {ctx.intent}: " + "; ".join(f"{n} {f['value']:.2f} ({f['why']})" for n, f in top)
    if weak: s += " | weak: " + ", ".join(f"{n} ({e['factors'][n]['why']})" for n in weak)
    return s


def select(D, R, caps, profiles=()):
    D = copy.deepcopy(D); prev = []; rep = []
    for k, b in enumerate(D["beats"]):
        ctx, ev = evaluate(R, caps, list(profiles), D, k, prev)
        ranked = sorted(((r, v) for r, v in ev.items() if not v["unavailable"]), key=lambda kv: -kv[1]["score"])
        # never a third identical recipe in a row (CAM-10), unless every other recipe is a poor fit for this beat
        run3 = len(prev) >= 2 and prev[-1][0] == prev[-2][0]
        if run3:
            others = [(r, v) for r, v in ranked if r != prev[-1][0]]
            if others and others[0][1]["score"] >= ranked[0][1]["score"] - REPEAT_LIMIT_MARGIN:
                for r, v in ranked:
                    if r == prev[-1][0]: v["unavailable"] = True; v["missing_capabilities"] = ["would be the third identical recipe in a row (CAM-10)"]
                ranked = others
        best, bv = ranked[0]
        planner = ctx.planner
        if planner in ev and not ev[planner]["unavailable"] and bv["score"] - ev[planner]["score"] <= KEEP_MARGIN:
            chosen, how = planner, ("planner's choice kept" + (" (it is the best)" if planner == best else f" as a justified alternative: {ev[planner]['score']:.2f} vs best {best} {bv['score']:.2f}"))
        else:
            chosen = best
            how = f"replaced planner's {planner}" + (" (unavailable: " + ", ".join(ev[planner]["missing_capabilities"] or ["needs two characters in frame"]) + ")" if planner in ev and ev[planner]["unavailable"] else f" ({ev.get(planner, {}).get('score', 0):.2f} vs {best} {bv['score']:.2f})")
        sh = b["shot"]; old_fr = sh["framing"]
        if chosen != planner and old_fr not in FRAMING_OF[chosen]:
            sh["framing"] = FRAMING_OF[chosen][0]; framing_note = f"framing {old_fr} -> {sh['framing']} to suit {chosen}"
        else: framing_note = None
        sh["recipe_id"] = chosen
        alts = [{"recipe": r, "score": v["score"]} for r, v in ranked if r != chosen][:2]
        notes = []
        if ctx.purpose not in PURPOSES_OF[chosen]: notes.append(f"camera purpose {ctx.purpose} is unusual for {chosen}: the planner's camera was left as written")
        if framing_note: notes.append(framing_note)
        rec = {"beat": b["id"], "intent": ctx.intent, "planner_recipe": planner, "chosen": chosen, "decision": how, "why": reason(ctx, chosen, ev, how),
               "alternatives": alts, "notes": notes, "scores": {r: v["score"] for r, v in ev.items()},
               "unavailable": {r: (v["missing_capabilities"] or ["needs two characters in frame"]) for r, v in ev.items() if v["unavailable"]}}
        rep.append(rec)
        b.setdefault("extensions", {})["selector"] = {k_: rec[k_] for k_ in ("planner_recipe", "chosen", "decision", "why", "alternatives", "notes")}
        prev.append((chosen, sh["framing"], ctx.primary))
    if D.get("schema_version") == "1.0.0": D["schema_version"] = "1.1.0"
    return D, rep


def summary(rep):
    n = len(rep); kept = sum(1 for r in rep if r["planner_recipe"] == r["chosen"])
    return {"beats": n, "planner_kept": kept, "replaced": n - kept, "recipes": {r: sum(1 for x in rep if x["chosen"] == r) for r in sorted({x["chosen"] for x in rep})}}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("beats"); ap.add_argument("--out"); ap.add_argument("--report"); ap.add_argument("--profile", action="append", default=[]); a = ap.parse_args()
    R, T = load(); profiles = [json.load(open(p)) for p in a.profile]; caps = capabilities(T, profiles)
    D = json.load(open(a.beats)); S, rep = select(D, R, caps, profiles)
    for r in rep: print(f"{r['beat']:4s} {r['intent'][:22]:22s} planner {r['planner_recipe']} -> {r['chosen']}   {r['decision']}")
    print(json.dumps(summary(rep)))
    if a.out: json.dump(S, open(a.out, "w"), indent=1, ensure_ascii=False); open(a.out, "a").write("\n")
    if a.report: json.dump({"summary": summary(rep), "weights": WEIGHTS, "keep_margin": KEEP_MARGIN, "capabilities": caps, "profiles": [p.get("id") for p in profiles], "beats": rep}, open(a.report, "w"), indent=1)


if __name__ == "__main__":
    main()
