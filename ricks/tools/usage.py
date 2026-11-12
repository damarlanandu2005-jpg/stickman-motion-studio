#!/usr/bin/env python3
"""Per-stage usage log.  usage.py mark "<stage name>"   |   usage.py report [transcript.jsonl ...]
A mark records the wall-clock time a stage STARTS. The report reads the session transcript(s) and sums token use between marks.
Effective units: input + 0.1 x cache reads + 2 x cache writes + 5 x output (roughly proportional to cost)."""
import json, sys, time, os, glob, datetime
HERE = os.path.dirname(os.path.abspath(__file__)); MARKS = os.path.join(HERE, "..", "usage", "marks.jsonl")
def ts(s): return datetime.datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
if sys.argv[1] == "mark":
    open(MARKS, "a").write(json.dumps({"t": time.time(), "stage": sys.argv[2]}) + "\n"); print("marked", sys.argv[2])
else:
    marks = [json.loads(l) for l in open(MARKS)]
    files = sys.argv[2:] or glob.glob(os.path.expanduser("~/.claude/projects/*/*.jsonl")) + glob.glob(os.path.expanduser("~/.claude/projects/*/*/*/*.jsonl"))
    rows = {}; seen = set()
    for f in files:
        sub = "/subagents/" in f or f.count(os.sep) > os.path.expanduser("~/.claude/projects/x/y.jsonl").count(os.sep)
        for line in open(f):
            try: o = json.loads(line)
            except Exception: continue
            if o.get("type") != "assistant" or "timestamp" not in o: continue
            m = o.get("message", {}); u = m.get("usage") or {}; mid = m.get("id")
            if mid in seen: continue
            seen.add(mid); t = ts(o["timestamp"])
            st = None
            for k in marks:
                if k["t"] <= t: st = k["stage"]
            if st is None: continue
            r = rows.setdefault(st, dict(turns=0, out=0, eff=0.0, agent_eff=0.0))
            e = u.get("input_tokens", 0) + 0.1 * u.get("cache_read_input_tokens", 0) + 2 * u.get("cache_creation_input_tokens", 0) + 5 * u.get("output_tokens", 0)
            r["turns"] += 1; r["out"] += u.get("output_tokens", 0); r["eff"] += e
            if sub: r["agent_eff"] += e
    print("%-44s %7s %6s %10s %10s" % ("stage", "minutes", "turns", "eff.units", "of which agents"))
    for i, k in enumerate(marks):
        end = marks[i + 1]["t"] if i + 1 < len(marks) else time.time(); r = rows.get(k["stage"], dict(turns=0, eff=0, agent_eff=0))
        print("%-44s %7.1f %6d %10.0f %10.0f" % (k["stage"][:44], (end - k["t"]) / 60, r["turns"], r["eff"], r["agent_eff"]))
    print("%-44s %7.1f %6d %10.0f" % ("TOTAL", (time.time() - marks[0]["t"]) / 60, sum(r["turns"] for r in rows.values()), sum(r["eff"] for r in rows.values())))
