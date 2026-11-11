# Score story ideas against capabilities.json. Rough planning numbers, not promises.
# Usage: python score_idea.py ideas/*.json            (prints a ranked table + the reasons for each)
# Idea file: {"title","logline","scenes":[{"id":"c1","tags":["place.street","chars.1_3","action.talk_stand","light.day","camera.glide_push"]}, ...]}
import json, sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); CAP = json.load(open(HERE + "/capabilities.json")); T = CAP["tags"]
def scene_cost(tags):
    costs = sorted((T[t]["cost"] for t in tags if t in T), reverse=True)
    return sum(c * (0.6 ** i) for i, c in enumerate(costs))          # biggest cost counts fully, the rest add less
def lint(idea, prof):
    w = []; sc = idea["scenes"]; P = CAP["profiles"][prof]
    if not P["validated"]: w.append(f"profile '{prof}' has never been produced by this engine: treat every number as a guess")
    if not (P["scenes"][0] <= len(sc) <= P["scenes"][1]): w.append(f"{len(sc)} scenes: profile '{prof}' expects {P['scenes'][0]}-{P['scenes'][1]}")
    words = sum(len(x.get("caption", "").split()) for x in sc)
    if words:
        sec = words / 2.6
        if not (P["seconds"][0] <= sec <= P["seconds"][1]): w.append(f"narration is about {sec:.0f} s ({words} words): profile expects {P['seconds'][0]}-{P['seconds'][1]} s")
    for x in sc:
        shots = x.get("shots") or []
        if len(shots) > 3: w.append(f"{x['id']}: {len(shots)} shots in one scene (more than 3 is hard to stage)")
        for k, sh in enumerate(shots):
            if not sh.get("must_see"): w.append(f"{x['id']} shot {k + 1}: no 'must_see'")
        if "caption" in x and not x.get("must_see") and not shots: w.append(f"{x['id']}: no 'must_see' (what the viewer must see in this shot)")
        if not any(t.startswith("light.") for t in x["tags"]): w.append(f"{x['id']}: no light tag")
        if not any(t.startswith("place.") for t in x["tags"]): w.append(f"{x['id']}: no place tag")
    gold = [x["id"] for x in sc if "light.golden" in x["tags"]]
    if len(gold) > 2: w.append(f"golden light in {len(gold)} scenes: keep it to the last 1-2")
    return w
def tags_of(s): return list(dict.fromkeys(list(s.get("tags", [])) + [t for sh in s.get("shots", []) for t in sh.get("tags", [])]))
def score(idea, prof="starter"):
    sc = idea["scenes"]; unknown = sorted({t for s in sc for t in tags_of(s) if t not in T})
    per = [scene_cost(tags_of(s)) for s in sc]; n = len(sc)
    sizecost = next(v for k, v in CAP["scene_count_cost"].items() if (k.startswith("<=") and n <= int(k[2:])) or (not k.startswith("<=") and (n >= int(k.rstrip("+").split("-")[0]) and (k.endswith("+") or n <= int(k.split("-")[1])))))
    used = sorted({t for s in sc for t in tags_of(s) if t in T}, key=lambda t: -T[t]["cost"])
    new_art = [t for t in used if T[t]["status"] == "missing"]
    risky = [t for t in used if T[t]["status"] == "risky"]
    d = sum(per) / max(1, n) * 6 + sizecost + 12 * len(new_art) + 3 * len(risky) + 8 * len(unknown)
    d = min(100, round(d))
    rounds = 2 + round(d / 12); lo = max(25, round(44 - d * 0.12)); hi = lo + 5
    return {"title": idea["title"], "scenes": n, "difficulty": d, "rounds": rounds, "expect_70": f"{lo}-{hi}", "new_work": [t for t in used if T[t]["source"] == "new_work"],
            "missing": new_art, "risky": risky, "unknown_tags": unknown, "lint": lint(idea, prof), "verdict": "easy win" if d < 35 else "doable" if d < 55 else "hard" if d < 75 else "do not start"}
if __name__ == "__main__":
    prof = "starter"; files = []
    a = sys.argv[1:]
    while a:
        x = a.pop(0)
        if x == "--profile": prof = a.pop(0)
        else: files.append(x)
    res = sorted((score(json.load(open(f)), prof) for f in files), key=lambda r: r["difficulty"])
    print("compat = engine-compatibility estimate out of 70, NOT a prediction of story or visual quality")
    print(f"{'title':44} {'scn':>3} {'diff':>4} {'rounds':>6} {'compat/70':>9}  verdict")
    for r in res: print(f"{r['title'][:44]:44} {r['scenes']:>3} {r['difficulty']:>4} {r['rounds']:>6} {r['expect_70']:>9}  {r['verdict']}")
    for r in res:
        print(f"\n{r['title']}\n  needs new art (missing): {', '.join(r['missing']) or '-'}\n  risky: {', '.join(r['risky']) or '-'}" + (f"\n  UNKNOWN tags: {r['unknown_tags']}" if r["unknown_tags"] else ""))
        for x in r["lint"]: print("  CHECK:", x)
        for t in r["missing"] + r["risky"]:
            if T[t].get("instead"): print(f"    change {t}: {T[t]['instead']}")
