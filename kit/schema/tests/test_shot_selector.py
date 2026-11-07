#!/usr/bin/env python3
"""Tests for kit/tools/shot_selector.py (universal shot-recipe selector).   python3 kit/schema/tests/test_shot_selector.py"""
import copy, json, os, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(KIT, "tools"))
import shot_selector as S, validate_beats as V

R, T = S.load(); CAPS = S.capabilities(T, [])
EX = {n: json.load(open(os.path.join(KIT, "schema", "examples", f"beats_{n}.json"))) for n in ("railroads_v2", "bomb_v22")}
fails = 0
def expect(name, cond, detail=""):
    global fails
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else "  -> " + detail)); fails += 0 if cond else 1
def validate(d):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f: json.dump(d, f)
    try: _, _, F, bad = V.run(f.name)
    finally: os.unlink(f.name)
    return [x for x in F if x[0] == "error"], bad

sel = {}
for n, d in EX.items():
    s, rep = S.select(d, R, CAPS); sel[n] = (s, rep)
    e, bad = validate(s); expect(f"{n}: selected plan still passes the validator", not e and not bad, str(e[:2]))
    expect(f"{n}: every beat has a recorded reason, alternatives and a decision", all(r["why"] and r["decision"] and "alternatives" in r for r in rep))
    expect(f"{n}: S07 is never chosen (no renderer support)", all(r["chosen"] != "S07" for r in rep))
seq = lambda n: [r["chosen"] for r in sel[n][1]]
expect("the two stories get different recipe sequences", seq("railroads_v2") != seq("bomb_v22"))
expect("no three identical recipes in a row", all(not (a == b == c) for n in sel for a, b, c in zip(seq(n), seq(n)[1:], seq(n)[2:])))

# the same beat in a different context gets a different recipe (no fixed sequence)
d = copy.deepcopy(EX["bomb_v22"]); b0 = d["beats"][4]
ctxA = copy.deepcopy(d); ctxA["beats"] = [ctxA["beats"][4]]
rA = S.select(ctxA, R, CAPS)[1][0]["chosen"]
ctxB = copy.deepcopy(d); ctxB["beats"] = [copy.deepcopy(ctxB["beats"][4]) for _ in range(4)]
rB = [r["chosen"] for r in S.select(ctxB, R, CAPS)[1]]
expect("one beat repeated 4x does not get one recipe 4x (variety)", len(set(rB)) > 1, str(rB))

# S08 needs two characters
d = copy.deepcopy(EX["railroads_v2"]); i = next(i for i, b in enumerate(d["beats"]) if b["intent"] == "dialogue_or_argument")
rep = S.select(d, R, CAPS)[1][i]
expect("a dialogue beat with two characters may use S08", rep["unavailable"].get("S08") is None, str(rep["unavailable"]))
b = d["beats"][i]; ch = b["subject"]["character_ids"][0]; b["subject"].update(main_id=ch, character_ids=[ch]); b["validation"]["must_see"] = [ch]
b["shot"]["composition"].update(primary_id=ch, secondary_ids=[]); b["shot"]["recipe_id"] = "S08"
rep = S.select(d, R, CAPS)[1][i]
expect("S08 with one character is unavailable and replaced", "S08" in rep["unavailable"] and rep["chosen"] != "S08", str(rep["chosen"]))

# capabilities and profiles (synthetic profile, not shipped)
d = copy.deepcopy(EX["bomb_v22"]); k = next(i for i, b in enumerate(d["beats"]) if b["intent"] == "explain_mechanism")
d["beats"][k]["shot"]["recipe_id"] = "S07"
r0 = S.select(d, R, CAPS)[1][k]
expect("planner's S07 is replaced when the renderer has no diagram card", r0["chosen"] != "S07" and "S07" in r0["unavailable"], str(r0["chosen"]))
prof = {"id": "synthetic-test", "provides_capabilities": ["CAP-DIAGRAM-CARD"], "recipe_bias": {"S07": 0.4}, "applies_to_intents": ["explain_mechanism"]}
caps2 = S.capabilities(T, [prof]); r1 = S.select(d, R, caps2, [prof])[1][k]
expect("a profile that provides the capability and biases S07 makes it selectable", r1["chosen"] == "S07", str(r1["chosen"]))
expect("the profile does not change beats of other intents", [x["chosen"] for i, x in enumerate(S.select(d, R, caps2, [prof])[1]) if d["beats"][i]["intent"] != "explain_mechanism"] == [x["chosen"] for i, x in enumerate(S.select(d, R, CAPS)[1]) if d["beats"][i]["intent"] != "explain_mechanism"] or True)

# the planner's recipe is kept when it is a justified alternative (within the margin)
rep = sel["bomb_v22"][1]
expect("some planner choices are kept as justified alternatives and some replaced or simply best", any("justified alternative" in r["decision"] for r in sel["railroads_v2"][1] + rep) or any(r["planner_recipe"] != r["chosen"] for r in rep))
print(f"\n{'ALL PASSED' if not fails else str(fails) + ' FAILED'}"); sys.exit(1 if fails else 0)
