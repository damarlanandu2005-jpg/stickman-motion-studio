# Score story ideas against capabilities.json. Rough planning numbers, not promises.
# Usage: python score_idea.py ideas/*.json            (prints a ranked table + the reasons for each)
# Idea file: {"title","logline","scenes":[{"id":"c1","tags":["place.street","chars.1_3","action.talk_stand","light.day","camera.glide_push"]}, ...]}
import json, sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); CAP = json.load(open(HERE + "/capabilities.json")); T = CAP["tags"]
def scene_cost(tags):
    costs = sorted((T[t]["cost"] for t in tags if t in T), reverse=True)
    return sum(c * (0.6 ** i) for i, c in enumerate(costs))          # biggest cost counts fully, the rest add less
def score(idea):
    sc = idea["scenes"]; unknown = sorted({t for s in sc for t in s["tags"] if t not in T})
    per = [scene_cost(s["tags"]) for s in sc]; n = len(sc)
    sizecost = next(v for k, v in CAP["scene_count_cost"].items() if (k.startswith("<=") and n <= int(k[2:])) or (not k.startswith("<=") and (n >= int(k.rstrip("+").split("-")[0]) and (k.endswith("+") or n <= int(k.split("-")[1])))))
    used = sorted({t for s in sc for t in s["tags"] if t in T}, key=lambda t: -T[t]["cost"])
    new_art = [t for t in used if T[t]["status"] == "missing"]
    risky = [t for t in used if T[t]["status"] == "risky"]
    d = sum(per) / max(1, n) * 6 + sizecost + 12 * len(new_art) + 3 * len(risky) + 8 * len(unknown)
    d = min(100, round(d))
    rounds = 2 + round(d / 12); lo = max(25, 48 - round(d * 0.2)); hi = lo + 6
    return {"title": idea["title"], "scenes": n, "difficulty": d, "rounds": rounds, "expect_70": f"{lo}-{hi}",
            "missing": new_art, "risky": risky, "unknown_tags": unknown, "verdict": "easy win" if d < 35 else "doable" if d < 55 else "hard" if d < 75 else "do not start"}
if __name__ == "__main__":
    res = sorted((score(json.load(open(f))) for f in sys.argv[1:]), key=lambda r: r["difficulty"])
    print(f"{'title':44} {'scn':>3} {'diff':>4} {'rounds':>6} {'expect/70':>9}  verdict")
    for r in res: print(f"{r['title'][:44]:44} {r['scenes']:>3} {r['difficulty']:>4} {r['rounds']:>6} {r['expect_70']:>9}  {r['verdict']}")
    for r in res:
        print(f"\n{r['title']}\n  needs new art (missing): {', '.join(r['missing']) or '-'}\n  risky: {', '.join(r['risky']) or '-'}" + (f"\n  UNKNOWN tags: {r['unknown_tags']}" if r["unknown_tags"] else ""))
