"""Shot specs -> klein prompts + jobs.json for the Kaggle scene batch. Topic independent: a shot is only
frame type + characters (costume names) + place + action + props. Nothing here knows about any one story.

Frame types follow the owner's reference shorts: wide (small characters, rich place), medium (chest-up),
close (huge face), insert (object only), card (flat colour + one symbol).

    python -m motion_studio.scene_plan shots.json   # writes kaggle/scene-batch/jobs.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COSTUMES = {  # costume name -> reference picture (owner's, in animation/reference_art/costumes)
    "explorer": "costumes/costume_explorer.png", "soldier": "costumes/costume_soldier.png", "doctor": "costumes/costume_doctor.png",
    "sailor": "costumes/costume_sailor.png", "winter": "costumes/costume_winter.png", "diver": "costumes/costume_diver.png",
    "egypt": "costumes/costume_ancient_egypt.png", "astronaut": "costumes/costume_astronaut.png",
}
STYLE = ("Flat 2D vector cartoon in the exact style of the reference stickman character: big round white head with a thick dark outline, "
         "small oval dot eyes, simple eyebrows and mouth, thin clean outlines, muted limited colour palette, soft flat shading. "
         "One complete vertical 9:16 illustration with a coherent detailed background. "
         "No text, no letters, no captions, no watermark, no panel borders, no collage.")
FRAMES = {
    "wide": "Wide shot: the characters are small in the frame, about one fifth of the picture height, standing on the ground in the lower third; a rich detailed environment fills the rest of the picture.",
    "medium": "Medium shot: the characters are shown from the chest up and fill the lower half of the frame; the background is visible above and behind them.",
    "close": "Extreme close-up: one character's big round head and face fill most of the picture, strong clear expression, only a hint of the costume at the bottom edge.",
    "insert": "Close-up of the object only. No characters in the picture.",
    "card": "A flat plain colour background with one big simple object in the centre. No characters and no scenery.",
}


def prompt_for(shot: dict) -> tuple[str, list[str]]:
    chars = [c if isinstance(c, dict) else {"c": c} for c in shot.get("chars", [])]
    refs: list[str] = []
    who = []
    for ch in chars:
        ref = COSTUMES[ch["c"]]
        if ref not in refs:
            refs.append(ref)
        who.append(f"a stickman in the costume of reference image {refs.index(ref) + 1}" + (f", {ch['note']}" if ch.get("note") else ""))
    parts = [FRAMES[shot["frame"]]]
    if who:
        parts.append("Characters: " + "; ".join(who) + ". Keep each costume exactly as in its reference image and the same big round white head.")
    if shot.get("place"):
        parts.append("Place: " + shot["place"] + ".")
    if shot.get("action"):
        parts.append("Action: " + shot["action"] + ".")
    if shot.get("props"):
        parts.append("Objects: " + shot["props"] + ".")
    if shot.get("mood"):
        parts.append("Mood and light: " + shot["mood"] + ".")
    parts.append(STYLE)
    return " ".join(parts), refs


def make_jobs(shots: list[dict], seed0: int = 6100) -> dict:
    jobs = []
    for i, shot in enumerate(shots):
        text, refs = prompt_for(shot)
        if not refs:  # the model needs one reference for the style even in object-only pictures
            refs = [COSTUMES["explorer"]]
        jobs.append({"id": shot["id"], "prompt": text, "refs": refs, "seed": seed0 + i, "width": 576, "height": 1024})
    return {"jobs": jobs}


if __name__ == "__main__":
    shots = json.loads(Path(sys.argv[1]).read_text())
    out = ROOT / "kaggle" / "scene-batch" / "jobs.json"
    out.write_text(json.dumps(make_jobs(shots), indent=1), encoding="utf-8")
    print(f"wrote {len(shots)} jobs to {out}")
