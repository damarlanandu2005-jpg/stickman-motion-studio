"""Sounds and live effects for one scene, chosen from the script by code.

Sources, strongest first: the scene's `sound:` line (author's words; `sound: none` = silence) -> what is seen (bg, props, text)
-> a few strong event words in the narration (explosion, splash, thunder). Nothing is downloaded: sounds come from sfx.py and
moving things (rain, snow, bubbles, ripples, dust, fog) from effects.py. Returns ([sfx], [fx]) for the shot.
"""
from __future__ import annotations

import re

from .scene_plan import auto_sfx

WEATHER = [  # (words, fx, sfx list as (type, t_fraction, gain, extra))
    (("rain", "raining", "rainy", "drizzle", "downpour", "monsoon"), [{"type": "rain", "strength": 1.0}], [("rain", 0.0, 0.18, {"full": True})]),
    (("storm", "stormy", "thunderstorm", "thunder"), [{"type": "rain", "strength": 1.3}], [("rain", 0.0, 0.2, {"full": True}), ("thunder", 0.3, 0.45, {})]),
    (("snow", "snowing", "snowy", "blizzard", "snowfall", "snowstorm"), [{"type": "snow", "strength": 1.0}], [("wind", 0.0, 0.12, {"full": True})]),
    (("fog", "foggy", "mist", "misty"), [{"type": "fog", "strength": 1.0}], []),
    (("dust", "dusty", "sandstorm", "desert", "abandoned"), [{"type": "dust", "strength": 1.0}], []),
    (("wind", "windy", "gale"), [], [("wind", 0.0, 0.2, {"full": True})]),
    (("underwater", "bubbles", "sinks", "sank", "sinking", "drowns", "drowning", "ocean floor", "seabed"), [{"type": "bubbles", "strength": 1.0}], [("bubbles", 0.0, 0.3, {"full": True})]),
    (("splash", "splashes", "splashed", "dives", "dived", "diving", "plunges", "falls into the water", "fell into the water", "jumps into the water", "falls into water", "into the sea", "into the lake", "into the river"),
     [{"type": "ripples", "strength": 1.0}, {"type": "bubbles", "strength": 0.8, "t0": 0.5}], [("splash", 0.1, 0.55, {}), ("bubbles", 0.5, 0.3, {"dur": 1.5})]),
    (("fire", "flames", "burning", "campfire", "bonfire", "torch"), [], [("crackle", 0.0, 0.22, {"full": True})]),
    (("door", "doorway", "knock", "knocks"), [], [("door", 0.15, 0.4, {})]),
    (("crowd", "market", "crowded", "festival", "stadium", "bazaar"), [], [("crowd", 0.0, 0.1, {"full": True})]),
]
NARRATION_EVENTS = ("explosion", "explodes", "splash", "thunder", "gunshot", "crash", "crashes")


def _has(text: str, words: tuple) -> bool:
    return any(re.search(rf"\b{re.escape(w)}\b", text) for w in words)


def plan(scene: dict, dur: float) -> tuple[list[dict], list[dict]]:
    sound = (scene.get("sound") or "").lower().strip()
    if sound in ("none", "silence", "no"):
        return [], []
    seen = " ".join([sound, scene["bg"].get("wanted", ""), scene.get("text", ""), " ".join(p["wanted"] for p in scene.get("props", []))]).lower()
    spoken = " ".join(NARRATION_EVENTS_in(scene.get("voice", "")))
    sfx_list, fx_list, used = [], [], set()
    for words, fx, sfx_def in WEATHER + []:
        if _has(seen, words) or _has(spoken, words):
            for f in fx:
                key = (f["type"],)
                if key not in used:
                    used.add(key); fx_list.append(dict(f))
            for kind, tf, gain, extra in sfx_def:
                if (kind, "s") in used and kind in ("rain", "wind", "crackle", "crowd"):
                    continue
                used.add((kind, "s"))
                e = {"type": kind, "t": round(tf * dur, 2), "gain": gain}
                if extra.get("full"):
                    e["dur"] = round(dur, 2)
                elif "dur" in extra:
                    e["dur"] = extra["dur"]
                sfx_list.append(e)
    for e in auto_sfx({"action": seen + " " + spoken}):
        if e["type"] == "thud" and ("splash", "s") in used:       # a fall into water is a splash, not a thud
            continue
        if (e["type"], "s") not in used and e["type"] not in ("wind", "step"):   # wind handled above; steps only if the author asks
            used.add((e["type"], "s")); sfx_list.append(e)
    if "step" in sound or "walk" in sound:
        sfx_list.append({"type": "step", "t": 0.0, "gain": 0.3, "repeat": max(int(dur / 0.35), 1), "every": 0.35})
    for f in fx_list:                                   # t0 given as seconds-fraction -> seconds
        if "t0" in f:
            f["t0"] = round(f["t0"] * dur, 2)
    return sfx_list, fx_list


def NARRATION_EVENTS_in(voice: str) -> list[str]:
    v = (voice or "").lower()
    return [w for w in NARRATION_EVENTS if re.search(rf"\b{w}\b", v)]
