#!/usr/bin/env python3
"""Generate what the library is missing, with Gemini (Vertex), from ricks/library/requests.json.

usage: python3 gen_library.py ricks/library [--only id1,id2]
requests.json: {"style_ref": "path/to/reference.png", "items": [
   {"kind": "character", "id": "police_a", "who": "..."},                 -> raw/<id>_character.png
   {"kind": "faces", "id": "police_a", "sheet": "b", "ref": "raw/police_a_character.png", "headgear": false}  -> raw/<id>_sheet_<sheet>.png
   {"kind": "hat", "id": "kepi", "what": "..."},                            -> raw/hat_<id>.png
   {"kind": "texture", "id": "brick", "surface": "..."}, {"kind": "backdrop", "id": "nyc", "sky": "...", "far": "..."} ]}
Items whose output file already exists are skipped, so the same request file can be re-run after a rate limit.
Prompt wording for character, sheet, texture and backdrop is the skill's (ricks/references/prompts.md).
"""
import json, os, sys, time, argparse
from google import genai
from google.genai import types
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

MODELS = os.environ.get("IMG_MODELS", "gemini-2.5-flash-image").split(",")
client = genai.Client(vertexai=True, project=os.environ["GOOGLE_CLOUD_PROJECT"], location=os.environ.get("VIDEO_LOCATION", "us-central1"),
                      http_options=types.HttpOptions(timeout=300000))

CHARACTER = ("2D cartoon doodle character: a big round off-white head about as wide as the body, with a soft grey cel-shadow on one side, "
 "tiny solid black dot eyes, thick expressive black eyebrows, tiny simple line mouth, no nose, no ears; thick uniform black outline. "
 "Body is a soft rounded bean-shaped torso covered by simple flat-colored clothing with one soft shadow tone; arms are thin solid black "
 "stick lines ending in small round black dot hands, hanging relaxed at the sides slightly away from the torso; legs are two thin solid "
 "black stick lines with no trousers, no feet and no shoes drawn, coming straight out of the bottom of the torso, slightly apart. "
 "Clean vector lines, flat colors, no texture. Character asset: ONE character, full body, standing, front view, centered, whole figure "
 "visible from the top of the head to the tips of the stick legs, on a solid uniform light warm-grey backdrop; sharp focus everywhere, "
 "no environment, no fog, no blur, no gradient, no shadow on the floor. Character: {who}. "
 "No text, no labels, no captions, no extra characters, no color swatches.")
ARMS_NOTE = (" Important: the torso is a plain rounded bean shape with NO sleeves. The two arms are bare thin black stick lines (no clothing on them) that leave "
 "the shoulders and angle outward and downward, well away from the torso, with a clear gap of plain backdrop between each arm and the torso along the whole arm.")
BARE = " The head is completely bare on top: NO hat, NO cap, NO helmet of any kind."
SHEET = ("Emotion sheet for the exact same character as the reference image: SIX separate heads of this character ({head}, "
 "cut off at the neck, no body, no shoulders), arranged in a clean grid of 3 columns and 2 rows with wide empty gaps between the heads so "
 "no two heads touch. Exact same art style, same line weight, same colors, same head size{same} in every cell, front view. Expressions, "
 "left to right, top row then bottom row: {expr}. Solid uniform light warm-grey backdrop, no shadows on the backdrop, no text, no labels, no numbers, no frames, no grid lines.")
SHEETS = {
 "a": "1) happy, wide open smile; 2) nervous, sweat drop, wobbly mouth, worried eyebrows; 3) shocked, huge round eyes, open mouth; 4) shouting, wide open mouth, angry eyebrows; 5) confused, one eyebrow raised, small squiggle mouth; 6) neutral, calm closed mouth",
 "b": "1) sad, drooping eyebrows, small frown; 2) angry, deep V eyebrows, gritted teeth; 3) scared, wide eyes, trembling open mouth, raised eyebrows; 4) laughing hard, eyes shut as curved lines, huge open mouth; 5) smug, half-closed eyes, one-sided smirk; 6) crying, big tears streaming, wailing open mouth",
 "c": "1) scheming, narrowed eyes, sly thin grin, one eyebrow low; 2) embarrassed, pink blush on the cheeks, tiny awkward smile, eyes looking aside; 3) determined, firm straight mouth, strong lowered eyebrows; 4) tired, heavy half-closed eyelids, small yawn; 5) skeptical, one eyebrow raised high, flat sideways mouth; 6) disgusted, tongue out, squinting eyes, wrinkled brow",
}
SHEET_NAMES = {"a": "happy,nervous,shocked,shouting,confused,neutral", "b": "sad,angry,scared,laughing,smug,crying", "c": "scheming,embarrassed,determined,tired,skeptical,disgusted"}
HAT = ("2D cartoon doodle prop in the exact same art style as the reference image (thick uniform black outline, flat colors with one soft shadow tone, clean vector lines): "
 "ONE single hat only, with nothing else: {what}. Front view, seen straight on at eye level, as it would sit on a big round cartoon head, centered, large in the frame, "
 "on a solid uniform light warm-grey backdrop; no head, no face, no character, no shadow, no text.")
TEXTURE = ("Seamless tileable texture, flat straight-on view, hand-painted comic style: {surface}, flat even lighting, no perspective, "
 "no cast shadows, no vignette, no objects, the pattern fills the whole frame edge to edge.")
BACKDROP = ("Flat 2D painted backdrop for a cartoon, wide panorama: {sky}, and along a low horizon in the bottom quarter {far}, simple flat shapes, "
 "soft muted colours, gentle atmospheric haze, no people, no animals, no text, nothing in the foreground.")

log = []
def gen(path, parts, aspect, tries=4):
    name = os.path.basename(path)
    for attempt in range(tries):
        for m in MODELS:
            try:
                cfg = types.GenerateContentConfig(response_modalities=["IMAGE"], image_config=types.ImageConfig(aspect_ratio=aspect))
                r = client.models.generate_content(model=m, contents=parts, config=cfg)
                for c in r.candidates[0].content.parts:
                    if getattr(c, "inline_data", None) and c.inline_data.data:
                        open(path, "wb").write(c.inline_data.data)
                        log.append(dict(name=name, ok=True, model=m, attempt=attempt + 1)); print("OK", name, flush=True); return True
                raise RuntimeError("no image part")
            except Exception as e:
                log.append(dict(name=name, ok=False, attempt=attempt + 1, error=repr(e)[:300])); print("FAIL", name, repr(e)[:200], flush=True)
                time.sleep(60 * (attempt + 1) if "429" in repr(e) else 5)
    return False

def img(path): return types.Part.from_bytes(data=open(path, "rb").read(), mime_type="image/png")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("lib"); ap.add_argument("--only", default="")
    a = ap.parse_args(); only = set(x for x in a.only.split(",") if x and x != "all")
    req = json.load(open(os.path.join(a.lib, "requests.json"))); raw = os.path.join(a.lib, "raw"); os.makedirs(raw, exist_ok=True)
    repo = os.path.abspath(os.path.join(a.lib, "..", ".."))
    ref = os.path.join(repo, req["style_ref"]) if req.get("style_ref") else None
    style = [img(ref), "Exact same art style as the reference image (same character design language, same line weight, same shading). "] if ref and os.path.exists(ref) else [""]
    for it in req["items"]:
        if only and it["id"] not in only: continue
        k = it["kind"]
        if k == "character":
            out = os.path.join(raw, it["id"] + "_character.png")
            if os.path.exists(out): continue
            text = CHARACTER.format(who=it["who"]) + ARMS_NOTE + ("" if it.get("headgear") else BARE)
            gen(out, style[:-1] + [style[-1] + text], "2:3")
        elif k == "faces":
            out = os.path.join(raw, "%s_sheet_%s.png" % (it["id"], it["sheet"])); src = os.path.join(repo, it["ref"]) if it.get("ref") else os.path.join(raw, it["id"] + "_character.png")
            if os.path.exists(out) or not os.path.exists(src): continue
            hg = it.get("headgear")
            keep = (" Every one of the six heads MUST keep exactly the same " + it["keep"] + " as the reference; only the eyes, eyebrows and mouth change.") if it.get("keep") else ""
            gen(out, [img(src), SHEET.format(head="head with its hat only" if hg else "bare head only, no hat", same=" and hat" if hg else "", expr=SHEETS[it["sheet"]]) + keep], "3:2")
        elif k == "redraw":      # same character, arms redrawn as free stick lines so the puppet can be sliced
            out = os.path.join(raw, it["id"] + "_character.png"); src = os.path.join(raw, it["id"] + "_character_v1.png")
            if not os.path.exists(src) and os.path.exists(out): os.replace(out, src)
            if os.path.exists(out) or not os.path.exists(src): continue
            gen(out, [img(src), "Redraw this exact same character: same head, same hair, same face, same outfit colours, same art style, same proportions, same legs. Change ONLY the arms. "
                "The torso must be a plain rounded bean shape with no sleeves. The arms are two thin solid black stick lines (no clothing, no sleeves, no cuffs, no gloves) that leave the shoulder points and angle outward and downward, "
                "well away from the torso, with a clear gap of plain backdrop between each arm and the torso along their whole length, each ending in a small round black dot hand. Whole figure visible from the top of the head to the "
                "tips of the stick legs, front view, centered, solid uniform light warm-grey backdrop, no shadow, no text, no extra characters."], "2:3")
        elif k == "hat":
            out = os.path.join(raw, "hat_" + it["id"] + ".png")
            if os.path.exists(out): continue
            gen(out, style[:-1] + [HAT.format(what=it["what"])], "1:1")
        elif k == "texture":
            out = os.path.join(raw, "tex_" + it["id"] + ".png")
            if not os.path.exists(out): gen(out, [TEXTURE.format(surface=it["surface"])], "1:1")
        elif k == "backdrop":
            out = os.path.join(raw, "backdrop_" + it["id"] + ".png")
            if not os.path.exists(out): gen(out, [BACKDROP.format(sky=it["sky"], far=it["far"])], "21:9")
        time.sleep(12)
    json.dump(log, open(os.path.join(raw, "gen_log_%d.json" % time.time()), "w"), indent=1)
    print("done:", sum(1 for l in log if l["ok"]), "ok,", sum(1 for l in log if not l["ok"]), "failed attempts")

if __name__ == "__main__":
    main()
