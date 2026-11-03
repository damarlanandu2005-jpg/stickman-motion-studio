"""Script -> story file (shot list). The planner asks a language model (any callable) to cut a script into shots; this module owns
the prompt, the checking of the answer, and a rule-based fallback that always returns something valid (low quality: one place, one
character, simple frame rhythm). Nothing here is tied to a topic.

    plan = plan_script(script_text, llm=my_llm_function)   # llm(prompt: str) -> str ; returns a checked story dict
    plan = fallback_plan(script_text, setting="a quiet street", cast=["explorer"])

NOT tested with a real language model yet: tests use a fake one. Wire a real one (e.g. the Kaggle gemma3 brain in yt-auto) before relying on it.
"""
from __future__ import annotations

import json
import re

from .scene_plan import COSTUMES, FRAMES

COSTUME_HELP = {"explorer": "tan explorer with pith helmet", "soldier": "camouflage soldier", "doctor": "white-coat doctor", "sailor": "navy sailor/uniform",
                "winter": "winter coat and beanie", "diver": "scuba diver", "egypt": "ancient Egyptian headdress", "astronaut": "white space suit"}
CAMS = {"push", "pull", "drift", "rise", "shake"}

PROMPT = """You turn a short video script into a shot list for a vertical 9:16 cartoon short.
Characters are round-headed stickmen. Each character wears one of these costumes (use the name): {costumes}.
A costume can be reused for different people by adding a short "note" (clothes, hat, beard) - keep the note IDENTICAL every time the same person appears.

Rules:
- Cut the script into shots of 3 to 9 words each, in order, keeping every word of the script. A shot is about 1.2 to 2.5 seconds of speech.
- frame is one of: wide (small characters in a rich place), medium (chest-up), close (huge face), insert (one object, no character), card (flat colour + one symbol such as a calendar, number or timer, no character).
- Mix them like real shorts: about 40% wide, 35% medium, 10% close, 15% insert or card. Never use the same frame more than 3 times in a row.
- chars: list of costume names or {{"c": costume, "note": "..."}}; empty list for insert and card.
- place: where it happens, concrete and visual. Reuse the same words for the same place. action: what the characters do. props: key objects. face: expressions (optional).
- cam is one of push, pull, drift, rise, shake (shake for danger or impact).
- Put *stars* around one key word per shot to show it in red.
Answer with JSON only: {{"shots": [{{"id": "s01", "text": "...", "frame": "wide", "chars": ["explorer"], "place": "...", "action": "...", "props": "...", "face": "...", "cam": "push"}}]}}

Script:
{script}
"""


def build_prompt(script: str) -> str:
    return PROMPT.format(costumes=", ".join(f"{k} ({v})" for k, v in COSTUME_HELP.items()), script=script.strip())


def _json_from(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("no JSON object in the answer")
    return json.loads(m.group(0))


def check(story: dict, script: str | None = None) -> list[str]:
    """Return a list of problems (empty = valid)."""
    problems = []
    shots = story.get("shots")
    if not isinstance(shots, list) or not shots:
        return ["no shots"]
    seen = set()
    run, last = 0, None
    for i, s in enumerate(shots):
        tag = f"shot {i + 1}"
        sid = s.get("id", "")
        if not re.fullmatch(r"[a-z0-9_]+", sid or ""):
            problems.append(f"{tag}: bad id {sid!r}")
        if sid in seen:
            problems.append(f"{tag}: duplicate id {sid}")
        seen.add(sid)
        words = len(str(s.get("text", "")).split())
        if not 2 <= words <= 14:
            problems.append(f"{tag}: text has {words} words")
        if s.get("frame") not in FRAMES:
            problems.append(f"{tag}: unknown frame {s.get('frame')!r}")
        for c in s.get("chars", []):
            name = c["c"] if isinstance(c, dict) else c
            if name not in COSTUMES:
                problems.append(f"{tag}: unknown costume {name!r}")
        if s.get("frame") in ("insert", "card") and s.get("chars"):
            problems.append(f"{tag}: {s['frame']} must have no characters")
        if s.get("frame") in ("wide", "medium", "close") and not s.get("chars"):
            problems.append(f"{tag}: {s['frame']} needs at least one character")
        if s.get("cam") and s["cam"] not in CAMS:
            problems.append(f"{tag}: unknown cam {s['cam']!r}")
        run = run + 1 if s.get("frame") == last else 1
        last = s.get("frame")
        if run > 3:
            problems.append(f"{tag}: more than 3 {last} shots in a row")
    if script:
        want = re.sub(r"[^a-z0-9 ]", "", script.lower().replace("*", "")).split()
        got = re.sub(r"[^a-z0-9 ]", "", " ".join(str(s.get("text", "")) for s in shots).lower().replace("*", "")).split()
        if want != got:
            problems.append(f"the shots do not contain the script words exactly ({len(got)} words vs {len(want)})")
    return problems


def plan_script(script: str, llm, tries: int = 3) -> dict:
    """Ask the model, check the answer, send the problems back, up to `tries` times. Raises if it never gets valid."""
    prompt, problems = build_prompt(script), ["not asked yet"]
    for _ in range(tries):
        try:
            story = _json_from(llm(prompt))
            problems = check(story, script)
            if not problems:
                return story
        except (ValueError, json.JSONDecodeError) as exc:
            problems = [f"answer was not valid JSON: {exc}"]
        prompt = build_prompt(script) + "\n\nYour previous answer had these problems, fix them and answer with the full JSON again:\n- " + "\n- ".join(problems[:12])
    raise ValueError("planner could not produce a valid shot list: " + "; ".join(problems[:6]))


def fallback_plan(script: str, setting: str = "a simple outdoor place", cast: list[str] | None = None, prefix: str = "s") -> dict:
    """Rule-based plan: sentences cut into pieces of about 6 words; frames cycle wide, medium, wide, close, medium. Always valid."""
    cast = cast or ["explorer"]
    pieces = []
    for sent in re.split(r"(?<=[.!?])\s+", script.strip()):
        words = sent.split()
        n = max(1, round(len(words) / 6))
        size = -(-len(words) // n)
        pieces += [" ".join(words[i:i + size]) for i in range(0, len(words), size)]
    rhythm = ["wide", "medium", "wide", "close", "medium"]
    shots = []
    for i, text in enumerate(pieces):
        shots.append({"id": f"{prefix}{i + 1:02d}", "text": text, "frame": rhythm[i % len(rhythm)], "chars": cast[:2] if rhythm[i % len(rhythm)] != "close" else cast[:1],
                      "place": setting, "action": "reacts to what is being said", "cam": ["push", "drift", "pull"][i % 3]})
    return {"voice": "am_fenrir", "speed": 1.12, "shots": shots}
