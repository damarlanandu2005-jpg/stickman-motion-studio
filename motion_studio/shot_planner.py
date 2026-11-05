"""Planner: checked scenes (script_reader.resolve) + scene lengths + word times  ->  shot specs for the sprite engine (shot2d).

Rule based, no language model, any topic. What it decides by rules:
  * actors: costume stage -> sprite folder; x spread and body size by number of characters; feet on the floor line
  * pose words -> body pictures (stand, point, arms_up, hands_on_hips, arms_crossed, walk, run, crouch, fall ...)
  * face from words in the voice line (scared, happy, sad ...), neutral otherwise
  * props on the right side, background from the library (plain placeholder + a warning when it is not drawn yet)
  * camera: the one in the script, else push / pan / pull in turn
  * big text from `text:`; captions of 1 to 3 words (red keyword) from the word times
Not done here: object sounds, walk paths across the picture, sitting/kneeling poses that the sprite set does not have.
"""
from __future__ import annotations

import re
from pathlib import Path

from .voice_first import SR  # noqa: F401  (keeps the timing module the single source of the sample rate)
from .v3_voice import caption_groups
from . import script_sounds

ROOT = Path(__file__).resolve().parents[1]
PUSH = {"z0": 1.0, "z1": 1.16}
PULL = {"z0": 1.16, "z1": 1.0}
PAN = {"z0": 1.06, "z1": 1.06, "x0": 0.45, "x1": 0.55}
STILL = {"z0": 1.0, "z1": 1.0}
CAMS = {"push": PUSH, "pull": PULL, "pan": PAN, "still": STILL}
AUTO_CAMS = [PUSH, PAN, PULL]
POSES = {"stand": 0, "point": 1, "point_right": 1, "point_left": 2, "arms_up": 3, "cheer": 3, "hands_on_hips": 4, "hips": 4,
         "arms_crossed": 5, "think": 6, "hold": 7, "map": 7, "walk": 8, "run": 9, "crouch": 10, "kneel": 10, "fall": 11}
FACES = [("scared", r"\b(scared|afraid|fear|bomb|explod|danger|ten seconds|seconds left|nightmare)\w*"),
         ("surprised", r"\?|\b(suddenly|shock|surpris|then came|wow)\w*"),
         ("sad", r"\b(sad|cry|cried|lost|died|death|surgery|sick|alone)\w*"),
         ("happy", r"\b(happy|won|win|saved|safe|proud|love|celebrat)\w*"),
         ("smug", r"\b(only man|never|best|clever|trick)\w*")]
LAYOUT = {1: ([0.5], 0.36), 2: ([0.3, 0.7], 0.31), 3: ([0.2, 0.5, 0.8], 0.26), 4: ([0.13, 0.38, 0.62, 0.87], 0.22)}
FEET_DEFAULT = 0.9
EXPRESSIONS = {"scared": "scared", "surprised": "surprised", "shocked": "surprised", "sad": "sad", "happy": "happy", "smug": "smug", "angry": "angry", "laugh": "laugh", "laughing": "laugh", "neutral": "neutral"}


def key_words(caption: str, allred: set[str]) -> list[str]:
    """Only the keyword(s) of a caption are red, not the whole phrase. Empty list = all white."""
    return [w for w in caption.split() if re.sub(r"\W", "", w).lower() in allred]


def face_for(voice: str) -> str:
    low = voice.lower()
    for name, pat in FACES:
        if re.search(pat, low):
            return name
    return "neutral"


def outfit_for(costume: str, status: str, cast: dict, root: Path) -> tuple[str, str | None]:
    """(sprite folder, warning). A costume without a full sprite set (heads) uses its stand-in from the cast file, else the explorer."""
    a = root / "animation" / "assets2d"
    if status == "ready":
        return (f"role_{costume}" if (a / f"role_{costume}").is_dir() else costume), None
    stand = cast.get("costumes", {}).get(costume, {}).get("stand_in")
    for cand in ([f"role_{stand}", stand] if stand else []):
        if cand and (a / cand).is_dir():
            return cand, f"costume '{costume}' is {status}: stand-in '{cand}' used"
    return "explorer", f"costume '{costume}' is {status} and has no stand-in: explorer used"


def plan_shots(ir: dict, durs: list[float], words: list, cast: dict, root: Path = ROOT, feet_by_bg: dict | None = None) -> tuple[list[dict], list[str]]:
    groups, shots, warns, t = caption_groups(words), [], [], 0.0
    allred = {re.sub(r"\W", "", r).lower() for sc in ir["scenes"] for r in sc["red"]}
    feet_by_bg = feet_by_bg or {}
    for sc, d in zip(ir["scenes"], durs):
        n = len(sc["who"]); props = [p for p in sc["props"] if p["library_id"]]
        bg_id = sc["bg"]["library_id"]
        if bg_id:
            bg = "lib:" + bg_id
            if sc["bg"]["match"] < 1.0:
                warns.append(f"scene {sc['n']}: background '{sc['bg']['wanted']}' is only a close match ({sc['bg']['match']}): {bg_id}")
        else:
            bg = "solid:placeholder"; warns.append(f"scene {sc['n']}: background '{sc['bg']['wanted']}' not in the library yet: plain placeholder")
        feet = feet_by_bg.get(bg_id, FEET_DEFAULT)
        xs, h = LAYOUT[min(max(n, 1), 4)]
        if props and n:
            xs = [0.22 + (0.38 * i / max(n - 1, 1) if n > 1 else 0.18) for i in range(n)]; h = min(h, 0.32)
        frame = sc.get("frame") or "wide"
        if frame == "insert" and not props:
            warns.append(f"scene {sc['n']}: frame 'insert' needs props: wide shot used instead"); frame = "wide"
        who_list = sc["who"][:4]
        if frame in ("medium", "close") and who_list:
            who_list = who_list[:1] if frame == "close" else who_list[:2]            # closer shots show the speaker(s) only
            xs, h = ([0.5], 0.52) if len(who_list) == 1 else ([0.32, 0.68], 0.46)
            if frame == "close":
                xs, h, feet = [0.5], 0.80, 1.18                                       # big, feet below the picture: head and chest fill it
        elif frame == "insert":
            who_list = []
        actors, face = [], face_for(sc["voice"])
        for i, w in enumerate(who_list):
            of, warn = outfit_for(w["costume"], w["costume_status"], cast, root)
            if warn and warn not in warns:
                warns.append(warn)
            pw = (sc["pose"][i] if i < len(sc["pose"]) else (sc["pose"][-1] if sc["pose"] else "stand")).lower().replace(" ", "_")
            who_face = face
            if pw in EXPRESSIONS:                                   # "pose: scared" = a standing pose with that face
                who_face, pw = EXPRESSIONS[pw], "stand"
            pose = POSES.get(pw, None)
            if pose is None:
                warns.append(f"scene {sc['n']}: pose word not known, stand used"); pose = 0
            actors.append({"outfit": of, "pose": pose, "x": xs[i], "feet": feet, "height": h, "faces": [[0, who_face]]})
        objects = [{"lib": p["library_id"], "x": 0.82 - 0.2 * j, "feet": feet, "height": 0.16, "pop": 0.2 + 0.25 * j} for j, p in enumerate(props[:2])]
        if frame == "insert":                                                         # detail shot: the object alone, big, in the middle
            objects = [{"lib": p["library_id"], "x": 0.5 if len(props) == 1 else 0.3 + 0.4 * j, "feet": 0.62, "height": 0.34, "pop": 0.0} for j, p in enumerate(props[:2])]
        texts = [{"text": sc["text"], "x": 0.5, "y": 0.2, "size": 0.07, "font": "bold", "color": (255, 255, 255), "stroke": 3, "screen": True}] if sc["text"] else []
        caps = [[round(max(a - t, 0), 3), round(min(b - t, d), 3), txt, key_words(txt, allred)] for a, b, txt, red in groups if b > t + 0.05 and a < t + d - 0.05]
        cam = CAMS.get(sc["camera"], AUTO_CAMS[(sc["n"] - 1) % 3])
        sfx_l, fx_l = script_sounds.plan(sc, d)
        shots.append({"bg": bg, "dur": d, "cam": cam, "actors": actors, "objects": objects, "texts": texts, "caps": caps, "cap_y": 0.68,
                      "sfx": sfx_l, "fx": fx_l, "fx_seed": sc["n"]})
        t += d
    return shots, warns
