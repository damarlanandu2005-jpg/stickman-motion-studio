#!/usr/bin/env python3
"""Narration only -> shot_notes.txt (CAST, PLACES, NEW OBJECTS, SHOT 1..n), written by Gemini.
Used when the script file has no SHOTS part, so the user only has to write the words.
Usage: python3 tools/make_notes.py <project_dir>      (needs project/script.txt and project/work/phrases.json)
Check: the WORDS of all shots joined must equal the narration word for word. Up to 4 tries, the error is sent back."""
import json, os, re, sys
from pathlib import Path
from google import genai
from google.genai import types

P = Path(sys.argv[1]); ROOT = Path(__file__).resolve().parent.parent
model = os.environ.get("MODEL", "gemini-3.1-pro-preview")
narr = (P / "script.txt").read_text(encoding="utf-8").strip()
fmt = (ROOT / "scripts" / "FORMAT.md").read_text(encoding="utf-8")
tpl = (ROOT / "scripts" / "TEMPLATE.txt").read_text(encoding="utf-8")
ex = (ROOT / "scripts" / "tests" / "bomb_colorblind.txt").read_text(encoding="utf-8")
ex = ex[ex.find("SHOTS:"):][:6000]
norm = lambda s: re.findall(r"[a-z0-9']+", s.lower())
client = genai.Client(vertexai=True, project=os.environ["GOOGLE_CLOUD_PROJECT"], location=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"), http_options=types.HttpOptions(timeout=900000))
base = f"""You are the script author for a vertical animated cartoon short. The narration below is final; do not change a word.
Write ONLY the part that comes after the line "SHOTS:" in the script format (CAST, PLACES, NEW OBJECTS, then SHOT 1, SHOT 2 ...).
Follow the format rules exactly. Plan for a fast, varied edit: one shot = 1 or 2 short sentences (about 2 to 4 seconds), vary camera distance and place, mix close-ups of objects with wide scenes, make the key action visible.
Keep characters simple (2 to 4 named people, bean-head cartoon people). Everything not in the kit list must be a NEW item with real sizes in meters.
No text before CAST and nothing after the last shot.

FORMAT RULES:
{fmt}

TEMPLATE:
{tpl}

EXAMPLE OF A FINISHED SHOTS PART (other story, copy the style only):
{ex}

NARRATION (copy the WORDS from here, every word, in order):
{narr}
"""
msg, err = base, ""
for t in range(4):
    r = client.models.generate_content(model=model, contents=msg, config=types.GenerateContentConfig(temperature=0.6))
    txt = (r.text or "").strip()
    txt = re.sub(r"^```\w*\n|\n```$", "", txt).strip()
    if txt.startswith("SHOTS:"): txt = txt[6:].strip()
    words = re.findall(r'^\s*WORDS:\s*"(.*?)"\s*$', txt, re.M)
    got, want = norm(" ".join(words)), norm(narr)
    if got == want and len(words) >= 8:
        (P / "shot_notes.txt").write_text(txt + "\n", encoding="utf-8")
        print(f"shot_notes.txt written: {len(words)} shots (try {t + 1})"); sys.exit(0)
    i = next((k for k, (a, b) in enumerate(zip(got, want)) if a != b), min(len(got), len(want)))
    err = f"The WORDS of the shots do not equal the narration. First difference at word {i}: shots say '{' '.join(got[i:i+6])}', narration says '{' '.join(want[i:i+6])}'. Shots: {len(words)}."
    print("try", t + 1, err, flush=True)
    msg = base + "\n\nYOUR LAST ANSWER FAILED THIS CHECK:\n" + err + "\nWrite the whole shots part again, copying the narration exactly."
sys.exit("make_notes: could not get shots whose WORDS equal the narration")
