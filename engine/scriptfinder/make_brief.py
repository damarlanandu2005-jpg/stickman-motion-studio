# Writes SCRIPT_BRIEF.md (paste it into any AI that writes scripts for this engine) from capabilities.json.
import json, os
H = os.path.dirname(os.path.abspath(__file__)); T = json.load(open(H + "/capabilities.json"))["tags"]
def rows(status):
    return "\n".join(f"- `{k}`: {v['note'] or v.get('instead','')}" + (f"  -> if the script needs it: {v['instead']}" if v.get("instead") and v["note"] else "") for k, v in T.items() if v["status"] == status)
open(H + "/SCRIPT_BRIEF.md", "w").write(f"""# Brief for the AI that writes the script (paste this whole file)

You are writing a **vertical cartoon short, 50-65 seconds, 1080x1920**, for a fixed animation engine: flat 2D bean-head characters
(cards with ink outlines) standing in a painted 3D world with black ink lines, gliding camera, voice narration with burned-in captions.
The engine can only draw what is listed below. A script that needs something else cannot be built, so plan the story around the list.

## Hard rules (profile "starter": the only profile this engine has produced so far)
1. **8-10 scenes**, about 130-165 narration words in total (about 2.6 words per second). One main place. **1-3 characters**. A scene may have up to 3 shots (wide, close, detail) in the same place; list them under `shots`. Other profiles (explainer, comedy) are not validated yet: ask the engine owner before using them.
2. **Every narration line has one thing the viewer must see** in that shot (`must_see`). If the line says "a tiny crack", the crack is the subject, big, in the picture.
3. Show results, not hard actions: no sawing, fighting, chasing, throwing, explosions, weather, night, water, animals or crowds of named people.
4. Day light first. Golden hour only for the last 1-2 scenes.
5. At most one text prop (a sign, newspaper or chart), big, upright, 3-5 words. At most 2 close insert shots of a small object.
6. Keep two sides of a story (for example "his" and "hers") on fixed left/right sides in every scene.
7. Nothing in a scene may change shape over time (no cracks growing, bridges bending). Show before and after as two scenes instead.

## What the engine draws well (proven)
{rows("proven")}

## Works, but costs extra rounds (risky: use sparingly)
{rows("risky")}

## Cannot be drawn (do not use)
{rows("missing")}

## Output format (reply with exactly this JSON, then the full narration as plain text)
```json
{{
  "title": "Short title",
  "logline": "one sentence",
  "sources": ["link 1", "link 2"],
  "scenes": [
    {{"id": "c1", "caption": "the narration line for this scene",
      "tags": ["place.street", "chars.1_3", "light.day"],
      "shots": [
        {{"must_see": "what the viewer must see in this shot", "tags": ["camera.glide_push", "action.talk_stand"]}},
        {{"must_see": "a close detail", "tags": ["camera.insert_detail", "prop.kit_static"]}}
      ]}}
  ]
}}
```
Use only the tags above. If you need something that is not listed, change the story, do not invent a tag.
""")
print("wrote SCRIPT_BRIEF.md")
