# Make shots.json ({"shots":[{"id":N,"a":start,"b":end},...]}) from a story file that lists scenes like  ["c1", 0, 89, ...]
# Usage: python shots_from_story.py story.ts out.json [--pattern REGEX]   (REGEX needs 3 groups: id, start, end)
import re, sys, json
src = open(sys.argv[1]).read(); out = sys.argv[2]
pat = r'\["c?(\d+)", (\d+), (\d+)'
if "--pattern" in sys.argv: pat = sys.argv[sys.argv.index("--pattern") + 1]
shots = [{"id": int(i), "a": int(a), "b": int(b)} for i, a, b in re.findall(pat, src)]
json.dump({"shots": shots}, open(out, "w")); print(len(shots), "scenes ->", out)
