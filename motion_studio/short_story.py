"""Story -> finished short (any topic). One file describes the whole video:

{"voice": "am_fenrir", "speed": 1.12,
 "shots": [{"id": "s01", "text": "He walked for *three* days.", "frame": "wide", "chars": ["explorer"], "place": "...", "action": "...", "props": "...",
            "cam": "push", "sfx": [...]  (optional; auto-picked from the words if missing)}]}

    python -m motion_studio.short_story plan  story.json            # writes kaggle/scene-batch/jobs.json (pictures are drawn on Kaggle)
    python -m motion_studio.short_story video story.json pictures_dir models_dir out.mp4
Voice lines are spoken one per shot, so each shot lasts exactly as long as its line (plus a small gap).
"""
from __future__ import annotations

import json
import re
import sys
import wave
from pathlib import Path

import numpy as np

from .assemble import assemble
from .scene_plan import auto_sfx, make_jobs

SR, GAP = 24000, 0.06
CAMS = {"push": {"z0": 1.0, "z1": 1.12}, "pull": {"z0": 1.12, "z1": 1.0}, "drift": {"z0": 1.06, "z1": 1.06, "x0": 0.45, "x1": 0.55},
        "rise": {"z0": 1.08, "z1": 1.08, "y0": 0.6, "y1": 0.4}, "shake": {"z0": 1.05, "z1": 1.1}}


def speak(texts: list[str], models: Path, voice: str, speed: float, wav_out: Path) -> list[float]:
    from kokoro_onnx import Kokoro
    k = Kokoro(str(models / "kokoro-v1.0.onnx"), str(models / "voices-v1.0.bin"))
    parts, durs = [], []
    for t in texts:
        x, sr = k.create(t.replace("*", ""), voice=voice, speed=speed, lang="en-us")
        nz = np.nonzero(np.abs(x) > 0.01)[0]
        x = x[nz[0]:nz[-1] + 1] if len(nz) else x
        x = np.concatenate([x, np.zeros(int(GAP * SR), np.float32)])
        parts.append(x)
        durs.append(len(x) / SR)
    pcm = (np.clip(np.concatenate(parts), -1, 1) * 32767).astype(np.int16)
    with wave.open(str(wav_out), "wb") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
    return durs


def phrase_groups(text: str, max_words: int = 3, max_chars: int = 16) -> list[str]:
    """Split a line into caption groups of 1 to 3 words (like the reference shorts: 'FEET TURNED INTO'); *word* marks red."""
    groups, cur = [], []
    for w in text.split():
        plain = " ".join(x.replace("*", "") for x in cur + [w])
        if cur and (len(cur) >= max_words or len(plain) > max_chars):
            groups.append(cur); cur = []
        cur.append(w)
    if cur:
        groups.append(cur)
    if len(groups) > 1 and len(groups[-1]) == 1 and len(groups[-2]) < max_words:  # no lonely last word
        groups[-2] += groups.pop()
    return [" ".join(g) for g in groups]


def captions(text: str, dur: float) -> list[list]:
    groups = phrase_groups(text)
    wt = np.array([len(re.sub(r"\W", "", g)) + 1 for g in groups], float)
    edges = np.concatenate([[0], np.cumsum(wt) / wt.sum()]) * (dur - GAP)
    return [[round(float(edges[i]), 3), round(float(edges[i + 1]) if i + 1 < len(groups) else dur, 3), g.replace("*", "").strip(".,!?"), "*" in g]
            for i, g in enumerate(groups)]


def build_shots(story: dict, durs: list[float]) -> list[dict]:
    shots = []
    for s, d in zip(story["shots"], durs):
        cam = s.get("cam", "push")
        shots.append({"id": s["id"], "dur": d, "cam": CAMS[cam] if isinstance(cam, str) else cam, "shake": 0.6 if cam == "shake" else 0.0,
                      "caps": captions(s["text"], d), "sfx": s["sfx"] if "sfx" in s else auto_sfx(s)})
    return shots


def main(argv: list[str]) -> int:
    mode, story = argv[0], json.loads(Path(argv[1]).read_text())
    if mode == "plan":
        out = Path(__file__).resolve().parents[1] / "kaggle" / "scene-batch" / "jobs.json"
        out.write_text(json.dumps(make_jobs(story["shots"]), indent=1), encoding="utf-8")
        print(f"wrote {len(story['shots'])} jobs to {out}")
        return 0
    pictures, models, out = Path(argv[2]), Path(argv[3]), Path(argv[4])
    wav = out.with_name(out.stem + "_voice.wav")
    durs = speak([s["text"] for s in story["shots"]], models, story.get("voice", "am_fenrir"), story.get("speed", 1.12), wav)
    print(assemble(build_shots(story, durs), pictures, out, wav))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
