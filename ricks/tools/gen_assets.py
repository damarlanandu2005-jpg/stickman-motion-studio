#!/usr/bin/env python3
"""Generate the still assets for one Ricks-style project with Gemini (Vertex), using the skill's own prompt templates.

usage: python3 gen_assets.py ricks/projects/<name> [--only lustig,poisson,textures,backdrop]

Needs: GOOGLE_CLOUD_PROJECT (+ GOOGLE_APPLICATION_CREDENTIALS), google-genai installed.
Writes PNG/JPG files to <project>/raw/ and a gen_log.json. Nothing is cut or sliced here: that happens afterwards.
The fixed wording of every template comes from ricks/references/prompts.md and must stay as it is.
"""
import json, os, sys, time, argparse
from google import genai
from google.genai import types

MODELS = os.environ.get("IMG_MODELS", "gemini-2.5-flash-image").split(",")
LOC = os.environ.get("VIDEO_LOCATION", "us-central1")
client = genai.Client(vertexai=True, project=os.environ["GOOGLE_CLOUD_PROJECT"], location=LOC,
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

SHEET = ("Emotion sheet for the exact same character as the reference image: SIX separate heads of this character (head with its hat only, "
 "cut off at the neck, no body, no shoulders), arranged in a clean grid of 3 columns and 2 rows with wide empty gaps between the heads so "
 "no two heads touch. Exact same art style, same line weight, same colors, same head size and hat in every cell, front view. Expressions, "
 "left to right, top row then bottom row: 1) happy, wide open smile; 2) nervous, sweat drop, wobbly mouth, worried eyebrows; 3) shocked, "
 "huge round eyes, open mouth; 4) shouting, wide open mouth, angry eyebrows; 5) confused, one eyebrow raised, small squiggle mouth; "
 "6) neutral {neutral}. Solid uniform light warm-grey backdrop, no shadows on the backdrop, no text, no labels, no numbers, no frames, no grid lines.")

TEXTURE = ("Seamless tileable texture, flat straight-on view, hand-painted comic style: {surface}, flat even lighting, no perspective, "
 "no cast shadows, no vignette, no objects, the pattern fills the whole frame edge to edge.")

BACKDROP = ("Flat 2D painted backdrop for a cartoon, wide panorama: {sky}, and along a low horizon in the bottom quarter {far}, simple flat shapes, "
 "soft muted colours, gentle atmospheric haze, no people, no animals, no text, nothing in the foreground.")

CAST = {
 "lustig": dict(who="Victor Lustig, a charming 1920s con man: navy double-breasted suit, small bow tie, grey fedora hat, thin neat moustache, "
                    "smug confident look. His hat is part of the head", neutral="smug half-smile under the fedora"),
 "poisson": dict(who="Andre Poisson, a stocky 1920s Parisian scrap-metal dealer: brown waistcoat over a white shirt, flat tweed cap, thick "
                     "dark moustache, eager look. His cap is part of the head", neutral="eager, slightly open eyes under the flat cap"),
}
TEXTURES = {
 "floor": "polished warm oak parquet floor planks with soft painted highlights and thin dark plum lines between the planks",
 "wallpaper": "elegant cream hotel wallpaper with a subtle gold fleur-de-lis pattern and a soft painted look, thin dark plum outlines",
 "cobble": "rounded warm grey-beige Paris cobblestones of slightly different sizes with soft painted highlights, thin dark plum lines between the stones",
 "roof": "blue-grey zinc roof panels of a Paris rooftop with thin raised seams, soft painted highlights, thin dark plum lines",
}
SKY = "a soft Paris morning sky with a few small clouds"
FAR = "a hazy Paris skyline of cream stone buildings and the iron lattice Eiffel Tower standing tall in the middle distance"

log = []
def gen(name, parts, aspect, out_dir, ext="png", tries=3):
    for attempt in range(tries):
        for m in MODELS:
            try:
                cfg = types.GenerateContentConfig(response_modalities=["IMAGE"], image_config=types.ImageConfig(aspect_ratio=aspect))
                try:
                    r = client.models.generate_content(model=m, contents=parts, config=cfg)
                except Exception as e:
                    if "image_config" in repr(e) or "aspect" in repr(e).lower():
                        r = client.models.generate_content(model=m, contents=parts, config=types.GenerateContentConfig(response_modalities=["IMAGE"]))
                    else: raise
                for c in r.candidates[0].content.parts:
                    if getattr(c, "inline_data", None) and c.inline_data.data:
                        path = os.path.join(out_dir, name + "." + ext)
                        open(path, "wb").write(c.inline_data.data)
                        log.append(dict(name=name, ok=True, model=m, attempt=attempt + 1, bytes=len(c.inline_data.data)))
                        print("OK", name, m, flush=True); return c.inline_data.data
                raise RuntimeError("no image part")
            except Exception as e:
                log.append(dict(name=name, ok=False, model=m, attempt=attempt + 1, error=repr(e)[:300]))
                print("FAIL", name, m, repr(e)[:200], flush=True)
                time.sleep(60 * (attempt + 1) if "429" in repr(e) else 5)   # rate limit: back off for a minute or more
    return None

def img(data): return types.Part.from_bytes(data=data, mime_type="image/png")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("project"); ap.add_argument("--only", default="lustig,poisson,textures,backdrop")
    a = ap.parse_args(); only = set(a.only.split(","))
    raw = os.path.join(a.project, "raw"); os.makedirs(raw, exist_ok=True)
    first = None
    for who in ("lustig", "poisson"):
        if who not in only: continue
        parts = [CHARACTER.format(who=CAST[who]["who"])]
        if first is not None:   # keep the second character in the same art style as the first
            parts = [img(first), "Exact same art style as the reference image (same character design language, same line weight, same shading). "
                     + CHARACTER.format(who=CAST[who]["who"])]
        data = gen(who + "_character", parts, "2:3", raw)
        if data and first is None: first = data
        if data:
            gen(who + "_sheet", [img(data), SHEET.format(neutral=CAST[who]["neutral"])], "3:2", raw)
    if "textures" in only or any(o.startswith("tex_") for o in only):
        for k, v in TEXTURES.items():
            if "textures" in only or ("tex_" + k) in only:
                gen("tex_" + k, [TEXTURE.format(surface=v)], "1:1", raw, ext="png"); time.sleep(15)
    if "backdrop" in only:
        gen("backdrop", [BACKDROP.format(sky=SKY, far=FAR)], "21:9", raw)
    json.dump(log, open(os.path.join(raw, "gen_log_%d.json" % time.time()), "w"), indent=1)
    bad = [l for l in log if not l["ok"]]
    print("done:", sum(1 for l in log if l["ok"]), "ok,", len(bad), "failed attempts")

if __name__ == "__main__":
    main()
