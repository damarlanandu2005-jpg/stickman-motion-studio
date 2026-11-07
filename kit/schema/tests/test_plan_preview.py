#!/usr/bin/env python3
"""Tests for kit/tools/plan_preview.py.   python3 kit/schema/tests/test_plan_preview.py"""
import copy, json, os, subprocess, sys, tempfile
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(os.path.dirname(HERE)); TOOL = os.path.join(KIT, "tools", "plan_preview.py")
EX = os.path.join(KIT, "schema", "examples")
fails = 0
def expect(n, c, d=""):
    global fails
    print(("PASS " if c else "FAIL ") + n + ("" if c else "  -> " + d)); fails += 0 if c else 1
def run(beats, extra=()):
    out = tempfile.mkdtemp(); r = subprocess.run([sys.executable, TOOL, beats, out, *extra], capture_output=True, text=True)
    return r.returncode, json.load(open(os.path.join(out, "preview.report.json"))), out, r.stdout + r.stderr
def st(rep, cid): return next(c["status"] for c in rep["checks"] if c["id"] == cid)

for n in ("railroads_v2", "bomb_v22"):
    rc, rep, out, _ = run(os.path.join(EX, f"beats_{n}.json"))
    expect(f"{n}: runs and writes sheets", os.path.exists(os.path.join(out, "preview_01.jpg")) and rep["sheet_px"] == [1080, 1280])
    expect(f"{n}: sheet is phone width (1080 px, 3 tiles across)", Image.open(os.path.join(out, "preview_01.jpg")).size[0] == 1080)
    expect(f"{n}: tiles are declared as drawn from the plan, not a render", "not a render" in rep["tile_source"])
    expect(f"{n}: AI-assisted and human checks are never reported as pass", all(c["status"] == "not_run" for c in rep["checks"] if c["class"] in ("ai_assisted", "human")))
    expect(f"{n}: pixel check is not_run without stills", st(rep, "PV-A10") == "not_run")
    expect(f"{n}: label readability check passes", st(rep, "PV-A9") == "pass")
# a main subject placed in the caption band is caught
d = json.load(open(os.path.join(EX, "beats_railroads_v2.json"))); d["beats"][3]["shot"]["composition"]["focal_point_norm"] = [0.5, 0.72]; d["beats"][3]["shot"]["framing"] = "close"
p = tempfile.mktemp(suffix=".json"); json.dump(d, open(p, "w")); rc, rep, _, _ = run(p)
expect("PV-A1 catches a main subject sitting in the caption band", st(rep, "PV-A1") == "fail" and rc == 1)
# identical consecutive compositions are flagged
d = json.load(open(os.path.join(EX, "beats_railroads_v2.json"))); d["beats"][4]["shot"]["composition"] = copy.deepcopy(d["beats"][3]["shot"]["composition"]); d["beats"][4]["shot"]["framing"] = d["beats"][3]["shot"]["framing"]
json.dump(d, open(p, "w")); rc, rep, _, _ = run(p)
expect("PV-A6 flags near-identical consecutive compositions", st(rep, "PV-A6") == "warn", st(rep, "PV-A6"))
# real stills: a black still is caught, good stills pass
sd = tempfile.mkdtemp(); B = json.load(open(os.path.join(EX, "beats_railroads_v2.json")))["beats"]
for i, b in enumerate(B):
    f = round((b["time"]["start_s"] + b["time"]["end_s"]) / 2 * 30); im = Image.new("RGB", (540, 960), (0, 0, 0) if i == 2 else (40 + i * 9 % 150, 90, 160))
    for x in range(0, 540, 30):
        for y in range(0, 960, 40): im.putpixel((x, y), (255, 200, 0))
    im.save(os.path.join(sd, f"f{f:04d}.jpg"))
json.dump(json.load(open(os.path.join(EX, "beats_railroads_v2.json"))), open(p, "w"))
rc, rep, out, _ = run(p, ["--stills", sd])
expect("with stills the tile source is real stills and a black still fails PV-A10", rep["tile_source"] == "real stills" and st(rep, "PV-A10") == "fail", st(rep, "PV-A10"))
print(f"\n{'ALL PASSED' if not fails else str(fails) + ' FAILED'}"); sys.exit(1 if fails else 0)
