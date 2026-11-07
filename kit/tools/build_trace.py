#!/usr/bin/env python3
"""Check kit/reference/knowledge/traceability.json against the repo and write kit/docs/TRACEABILITY.md.

  python3 kit/tools/build_trace.py            (exit 1 if a claim cannot be verified)

Verified automatically: every rule in rules.json has exactly one row; states and test statuses are from the allowed lists; every code reference (file + symbol text)
exists in the repo; every rule claimed as "reaches Gemini through the PLAYBOOK" appears in kit/docs/PLAYBOOK.md; CHK ids exist; and NO render code (kit/engine, mine/*/web)
reads rules.json or beats.json (if one starts to, render_code_reads_rule must be changed).
Not verified (by nature): whether Gemini obeys a rule in its output, and the test results (they come from the learning log).
"""
import json, os, re, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE); ROOT = os.path.dirname(KIT)
T = json.load(open(os.path.join(KIT, "reference", "knowledge", "traceability.json")))
R = json.load(open(os.path.join(KIT, "reference", "knowledge", "rules.json")))
PB = open(os.path.join(KIT, "docs", "PLAYBOOK.md"), encoding="utf-8").read()
bad = []

rules = {r["id"] for r in R["rules"]}
rows = {}
for r in T["rules"]:
    if r["id"] in rows: bad.append(f"duplicate row {r['id']}")
    rows[r["id"]] = r
for i in rules - set(rows): bad.append(f"rule {i} has no traceability row")
for i in set(rows) - rules: bad.append(f"row {i} is not a rule")
chk = {c["id"] for c in R["checks"]}
for r in T["rules"]:
    i = r["id"]
    if r["state"] not in T["states"]: bad.append(f"{i}: bad state {r['state']}")
    if r["coverage"] not in T["coverage"]: bad.append(f"{i}: bad coverage")
    if r["production_test"]["status"] not in T["test_status"]: bad.append(f"{i}: bad test status")
    if r["state"].startswith("code") and not r["code"]: bad.append(f"{i}: state {r['state']} but no code reference")
    if r["state"] == "prompt-only" and r["code"]: bad.append(f"{i}: prompt-only but has code references")
    for c in r["code"]:
        p = os.path.join(ROOT, c["file"])
        if not os.path.exists(p): bad.append(f"{i}: file {c['file']} does not exist"); continue
        if c["symbol"] not in open(p, encoding="utf-8", errors="ignore").read(): bad.append(f"{i}: '{c['symbol']}' not found in {c['file']}")
    if r["gemini"]["code_step_playbook"] and f"[{i} |" not in PB: bad.append(f"{i}: not in PLAYBOOK.md")
    for a in r["checked_after_render"]:
        m = re.match(r"(CHK-\d+)", a)
        if m and m.group(1) not in chk: bad.append(f"{i}: unknown check {m.group(1)}")
    m = r["maturity"]
    if m["capability_exists"] != r["state"].startswith("code"): bad.append(f"{i}: maturity.capability_exists disagrees with state")
    if m["tested"] != r["production_test"]["status"]: bad.append(f"{i}: maturity.tested disagrees with production_test")
    if m["automatically_selected"] or m["consumed_by_renderer"]: bad.append(f"{i}: automatically_selected / consumed_by_renderer is true: verify and extend this tool")
    if r["render_code_reads_rule"]: bad.append(f"{i}: render_code_reads_rule is true: verify and extend this tool")

for cp in T["capability_registry"]:
    if cp["exists"] != bool(cp["where"]): bad.append(f"{cp['id']}: exists flag disagrees with its code references")
    for c in cp["where"]:
        p = os.path.join(ROOT, c["file"])
        if not os.path.exists(p) or c["symbol"] not in open(p, encoding="utf-8", errors="ignore").read(): bad.append(f"{cp['id']}: '{c['symbol']}' not found in {c['file']}")
# nothing in render code may read the knowledge files
readers = []
for pat in ("kit/engine/*.js", "mine/*/web/*.js", "mine/*/render.mjs", "kit/tools/render.mjs"):
    for f in glob.glob(os.path.join(ROOT, pat)):
        t = open(f, encoding="utf-8", errors="ignore").read()
        if re.search(r"rules\.json|beats\.json|traceability\.json", t): readers.append(os.path.relpath(f, ROOT))
if readers: bad.append("render code reads the knowledge files: " + ", ".join(readers))

def short(s, n=95): return s if len(s) <= n else s[: n - 1].rstrip() + "..."
from collections import Counter
cs = Counter(r["state"] for r in T["rules"]); ct = Counter(r["production_test"]["status"] for r in T["rules"])
L = ["# TRACEABILITY: which rule is really used (generated from kit/reference/knowledge/traceability.json by kit/tools/build_trace.py; do not edit by hand)", "",
     T["how_to_read"], "",
     "## Summary", f"- rules: {len(T['rules'])} (69 measured/observed before 2026-11-08, 15 added from the independent study)",
     "- state: " + ", ".join(f"{k} {cs.get(k, 0)}" for k in T["states"] if k != "unimplemented") + "  (the gaps are listed as unimplemented capabilities below)",
     "- production test: " + ", ".join(f"{k} {ct.get(k, 0)}" for k in T["test_status"]),
     "- render code that reads rules.json or beats.json: " + (", ".join(readers) if readers else "none (checked by this tool)"), "",
     "## States", ""] + [f"- **{k}**: {v}" for k, v in T["states"].items()]
L += ["", "## Four levels of maturity (kept separate on purpose)", ""] + [f"{n}. **{k}**: {v}" for n, (k, v) in enumerate(T["maturity_levels"].items(), 1)]
L += ["", "## Capabilities that are easy to confuse", "", "| id | what | exists | where | auto-selected | consumed by renderer | tested | note |", "|---|---|---|---|---|---|---|---|"]
for cp in T["capability_registry"]:
    L.append(f"| {cp['id']} | {cp['what']} | {'yes' if cp['exists'] else 'NO'} | {cp['scope']} | {'yes' if cp['automatically_selected'] else 'no'} | {'yes' if cp['consumed_by_renderer'] else 'no'} | {cp['tested']} | {cp['note']} |")
L += ["", "## Rule table", "", "| id | area | source | state | coverage | where / code | Gemini (code step / notes step) | 1 exists | 2 auto-selected | 3 consumed by renderer | 4 tested | what is missing |", "|---|---|---|---|---|---|---|---|---|---|---|---|"]
for r in T["rules"]:
    code = "; ".join(f"{c['file'].replace('kit/engine/', 'engine/')}:{c['symbol']}" for c in r["code"]) or "-"
    src = r["source"]["origin"].replace("our_", "") + "/" + r["source"]["values"]
    L.append(f"| {r['id']} | {r['area']} | {src} | {r['state']} | {r['coverage']} | {code} | playbook / {r['gemini']['notes_step']} | {'yes' if r['maturity']['capability_exists'] else 'no'} | no | no | {r['production_test']['status']} | {short(r['not_implemented_parts'] or r['note'], 110)} |")
L += ["", "## Test evidence (only rules with a test result)", ""]
for r in T["rules"]:
    if r["production_test"]["status"] != "none": L.append(f"- {r['id']} [{r['production_test']['status']}]: {r['production_test']['where']}")
L += ["", "## Unimplemented capabilities (no code, no prompt text that does it, no check)", ""] + [f"- {u['capability']} (rules: {u['rules']})" for u in T["unimplemented_capabilities"]]
L += ["", "## Quality gates: which checks are automatic, AI-assisted or human", "", "| gate | check | class | where it is implemented |", "|---|---|---|---|"]
for g in T["quality_gates"]:
    for c in g["checks"]: L.append(f"| {g['id']} {g['check']} | {c['what']} | {c['class']} | {c['implemented_in']} |")
L += ["", "## Contradictions found", ""] + [f"- {x}" for x in T["prompt_contradictions"]] + [f"- {c['topic']}: ChatGPT/other says {c.get('chatgpt', c.get('ours'))}; decision: {c['decision']}" for c in R["merge_ledger"]["contradictions"]]
out = os.path.join(KIT, "docs", "TRACEABILITY.md"); open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
print(f"wrote {out}: {len(L)} lines")
print("states:", dict(cs)); print("tests:", dict(ct))
if bad:
    print("\nPROBLEMS:"); [print(" -", b) for b in bad]; sys.exit(1)
print("traceability verified: every row, code reference and playbook claim checked")
