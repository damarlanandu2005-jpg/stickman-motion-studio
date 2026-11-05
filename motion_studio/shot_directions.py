"""Author's directions for ONE shot -> settings for the sprite engine (shot2d). Plain words, no language model.

    where:  arthur centre near, chief right far          who stands where (left / centre / right / far left / far right) and how close (near / mid / far)
    face:   worried -> scared                            the speaker's face; "->" = it changes during the shot.  "chief: angry" = for one person
    pose:   stand -> point                               (pose words; "->" = changes during the shot)
    move:   timer 0:05 -> 0:00, sweat, spark, flash, gunfire, smoke, shake, arthur walk left -> right, rain, snow, bubbles, dust, fog
    camera: still (default) | slow push | slow pull | pan | shake
    view:   normal | scope (round night-vision scope) | card (flat colour + the shot's text)

Everything the engine cannot do is reported as a warning, never a crash.
"""
from __future__ import annotations

import re

X = {"far left": 0.13, "left": 0.27, "centre": 0.5, "center": 0.5, "middle": 0.5, "right": 0.73, "far right": 0.87}
DIST = {"near": (0.44, 0.95), "mid": (0.32, 0.9), "far": (0.2, 0.8)}           # (body height, feet line) as parts of the picture height
FACE_WORDS = {"angry": "angry", "happy": "happy", "laugh": "laugh", "laughing": "laugh", "neutral": "neutral", "calm": "neutral", "sad": "sad",
              "scared": "scared", "afraid": "scared", "nervous": "scared", "worried": "sad", "surprised": "surprised", "shocked": "surprised",
              "smug": "smug", "proud": "smug", "smile": "happy", "smiling": "happy", "shouting": "angry", "yelling": "angry", "crying": "sad"}
CAM = {"still": {"z0": 1.0, "z1": 1.0}, "slow push": {"z0": 1.0, "z1": 1.07}, "push": {"z0": 1.0, "z1": 1.07},
       "slow pull": {"z0": 1.07, "z1": 1.0}, "pull": {"z0": 1.07, "z1": 1.0}, "pan": {"z0": 1.05, "z1": 1.05, "x0": 0.47, "x1": 0.53},
       "shake": {"z0": 1.04, "z1": 1.04, "shake": 0.012}}
FX_WORDS = {"rain": "rain", "snow": "snow", "bubbles": "bubbles", "dust": "dust", "fog": "fog", "gunfire": "tracers", "bullets": "tracers",
            "tracers": "tracers", "smoke": "smoke", "spark": "spark", "sparks": "spark"}


def _arrows(s: str) -> list[str]:
    return [p.strip() for p in re.split(r"->|→", s) if p.strip()]


def parse_where(text: str, names: list[str]) -> dict[str, dict]:
    """'arthur centre near, chief right far' -> {name: {x, height, feet}}"""
    out = {}
    for part in [p.strip().lower() for p in (text or "").split(",") if p.strip()]:
        name = next((n for n in names if re.search(rf"\b{re.escape(n)}\b", part)), None)
        if not name:
            continue
        rest = part.replace(name, " ")
        x = next((v for k, v in sorted(X.items(), key=lambda kv: -len(kv[0])) if re.search(rf"\b{k}\b", rest)), None)
        d = next((v for k, v in DIST.items() if re.search(rf"\b{k}\b", rest)), None)
        e = {}
        if x is not None:
            e["x"] = x
        if d:
            e["height"], e["feet"] = d
        out[name] = e
    return out


def face_timeline(words: list[str], dur: float) -> list[list]:
    faces = [FACE_WORDS.get(w.lower().strip(), None) for w in words]
    faces = [f for f in faces if f]
    if not faces:
        return []
    step = dur / len(faces)
    return [[round(i * step, 2), f] for i, f in enumerate(faces)]


def parse_face(text: str, names: list[str], dur: float) -> dict[str, list]:
    """'worried -> scared' (for the first person) or 'arthur: scared -> shocked, chief: angry'"""
    out = {}
    for part in [p.strip() for p in (text or "").split(",") if p.strip()]:
        m = re.match(r"^(\w+)\s*:\s*(.+)$", part)
        who, val = (m.group(1).lower(), m.group(2)) if m and m.group(1).lower() in names else (names[0] if names else "", part)
        tl = face_timeline(_arrows(val), dur)
        if tl and who:
            out[who] = tl
    return out


def parse_move(text: str, names: list[str], dur: float) -> dict:
    """-> {"texts": [...], "fx": [...], "flash": [...], "sweat": [names], "walk": {name: (x0, x1)}, "shake": bool, "unknown": [...]}"""
    r = {"texts": [], "fx": [], "flash": [], "sweat": [], "walk": {}, "shake": False, "unknown": []}
    for item in [p.strip() for p in (text or "").split(",") if p.strip()]:
        low = item.lower()
        m = re.match(r"^(?:timer|clock|countdown)\s+(\d+):(\d\d)\s*(?:->|→)\s*(\d+):(\d\d)(?:\s+at\s+([\d.]+)\s+([\d.]+))?$", low)
        if m:
            a, b = int(m.group(1)) * 60 + int(m.group(2)), int(m.group(3)) * 60 + int(m.group(4))
            x, y = (float(m.group(5)), float(m.group(6))) if m.group(5) else (0.5, 0.3)
            r["texts"].append({"count": [a, b], "x": x, "y": y, "size": 0.05, "font": "mono", "color": (255, 80, 60), "bg": (0, 0, 0, 230), "screen": not m.group(5)})
            continue
        m = re.match(r"^(?:timer|clock)\s+(\d+:\d\d)$", low)
        if m:
            r["texts"].append({"text": m.group(1), "x": 0.5, "y": 0.3, "size": 0.05, "font": "mono", "color": (255, 80, 60), "bg": (0, 0, 0, 230), "screen": True}); continue
        if low.startswith("sweat"):
            who = next((n for n in names if n in low), names[0] if names else None)
            if who:
                r["sweat"].append(who)
            continue
        if low.startswith("flash"):
            r["flash"].append([max(dur - 0.25, 0), dur, 0.9] if "end" in low else [0.0, 0.12, 0.9]); continue
        if low == "shake":
            r["shake"] = True; continue
        m = re.match(r"^(\w+)\s+(?:walks?|runs?|slides?|moves?)\s+(far left|left|centre|center|middle|right|far right)\s*(?:->|→|to)\s*(far left|left|centre|center|middle|right|far right)$", low)
        if m and m.group(1) in names:
            r["walk"][m.group(1)] = (X[m.group(2)], X[m.group(3)]); continue
        key = next((v for k, v in FX_WORDS.items() if re.search(rf"\b{k}\b", low)), None)
        if key:
            fx = {"type": key, "strength": 1.0}
            if key == "spark":
                fx.update({"t0": max(dur - 0.45, 0)})
            r["fx"].append(fx); continue
        r["unknown"].append(item)
    return r


def camera(word: str):
    return CAM.get((word or "").lower().strip())
