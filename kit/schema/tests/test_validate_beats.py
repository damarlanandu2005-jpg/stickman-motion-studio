#!/usr/bin/env python3
"""Tests for kit/tools/validate_beats.py: the two real examples must pass; each deliberate break must be caught by the right gate.
  python3 kit/schema/tests/test_validate_beats.py"""
import copy, json, os, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(KIT, "tools"))
import validate_beats as V

EX = {n: json.load(open(os.path.join(KIT, "schema", "examples", f"beats_{n}.json"))) for n in ("railroads_v2", "bomb_v22")}


def check(d):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f: json.dump(d, f)
    try: _, _, F, bad = V.run(f.name)
    finally: os.unlink(f.name)
    return F, bad


def errs(F, gate=None): return [f for f in F if f[0] == "error" and (gate is None or f[1] == gate)]


fails = 0
def expect(name, cond, detail=""):
    global fails
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else "  -> " + detail)); fails += 0 if cond else 1


for n, d in EX.items():
    F, bad = check(d); expect(f"example {n} has no errors", not errs(F) and not bad, str(errs(F)[:3]))

def mut(fn):
    d = copy.deepcopy(EX["railroads_v2"]); fn(d); return check(d)

cases = [
 ("unknown top-level key is rejected by the schema", lambda d: d.update(bogus=1), "Q10"),
 ("a word dropped from a beat text breaks narration match", lambda d: d["beats"][2]["narration"].update(text="whoever finishes first gets business"), "Q04"),
 ("overlapping word_range", lambda d: d["beats"][3]["narration"].update(word_range=[d["beats"][2]["narration"]["word_range"][1], d["beats"][3]["narration"]["word_range"][1]]), "Q04"),
 ("a gap between beat times", lambda d: d["beats"][4]["time"].update(start_s=d["beats"][4]["time"]["start_s"] + 0.5), "Q10"),
 ("camera move without duration/ease", lambda d: [d["beats"][1]["camera"].pop(k) for k in ("duration_s", "ease")], "Q03"),
 ("unknown entity id in the subject", lambda d: d["beats"][0]["subject"].update(main_id="NOBODY"), "Q10"),
 ("face that is not in the kit", lambda d: d["beats"][4]["character_actions"][0].update(face="furious"), "Q01"),
 ("pose that is a face name (smile)", lambda d: d["beats"][4]["character_actions"][0].update(pose="smile"), "Q01"),
 ("outfit that is neither kit nor NEW:", lambda d: d["entities"]["characters"][0].update(outfit="spaceman"), "Q01"),
 ("sound effect outside its beat", lambda d: d["beats"][0]["audio_events"][0].update(time_s=30.0), "Q09"),
 ("word trigger pointing at a word outside the beat", lambda d: d["beats"][0]["audio_events"][0].update(word_index=150), "Q09"),
 ("first transition is not 'start'", lambda d: d["beats"][0]["transition_in"].update(type="cut", reason="new_place"), "Q08"),
 ("dissolve without frames", lambda d: d["beats"][1]["transition_in"].pop("frames"), "Q08"),
 ("unknown quality gate", lambda d: d["beats"][0]["validation"].update(gates=["Q99"]), "Q10"),
 ("unknown rule reference", lambda d: d["beats"][0].update(rule_refs=["ZZZ-99"]), "Q10"),
 ("unknown material id", lambda d: d["entities"]["objects"][0].update(material_ids=["M08"]), "Q07"),
 ("camera purpose missing", lambda d: d["beats"][0]["camera"].pop("purpose"), "Q10"),
 ("beats do not cover all words (last beat removed)", lambda d: d["beats"].pop(), "Q04"),
]
for name, fn, gate in cases:
    F, bad = mut(fn)
    expect(f"break caught by {gate}: {name}", bool(errs(F, gate)), f"gates with errors: {sorted({f[1] for f in errs(F)})}")

# warnings (not errors)
d = copy.deepcopy(EX["railroads_v2"]); d["beats"][0]["shot"]["composition"]["focal_point_norm"] = [0.5, 0.7]
F, _ = check(d); expect("focal point inside the caption zone gives a warning, not an error", any(f[0] == "warn" and f[1] == "Q02" for f in F) and not errs(F))
d = copy.deepcopy(EX["railroads_v2"]); del d["entities"]["environments"][0]["depth_layers"]
F, _ = check(d); expect("missing depth_layers gives a Q06 warning", any(f[0] == "warn" and f[1] == "Q06" for f in F) and not errs(F))
d = copy.deepcopy(EX["railroads_v2"]); d["beats"][3]["transition_in"].update(type="fly_through")
F, _ = check(d); expect("transition fly_through is flagged as not implemented (a blend is not a 3D fly-through)", any(f[0] == "warn" and f[1] == "Q08" and "not implemented" in f[3] for f in F) and not errs(F))
d = copy.deepcopy(EX["railroads_v2"]); d["entities"]["characters"][0]["outfit"] = "NEW:worker1"
F, _ = check(d); expect("a kit outfit written as NEW: gives a warning", any(f[0] == "warn" and f[1] == "Q01" and "kit outfit" in f[3] for f in F) and not errs(F))
print(f"\n{'ALL PASSED' if not fails else str(fails) + ' FAILED'}")
sys.exit(1 if fails else 0)
