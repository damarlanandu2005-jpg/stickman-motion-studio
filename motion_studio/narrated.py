"""Narrated short: story lines (text + picture choice) -> Kokoro voice -> shots timed to the voice -> mp4 with voice only.

Voice is the only sound (the reference shorts have no effects). Captions are one word at a time; word times are
estimated from letter counts inside each chunk (not measured), so they can be a little off.

    python -m motion_studio.narrated story.json models_dir out.mp4
"""
from __future__ import annotations

import json
import re
import sys
import wave
from pathlib import Path

import numpy as np

from .shot2d import FPS, render_video

SR = 24000
GAP = 0.06  # seconds between chunks


def build(story: dict, models: Path, workdir: Path) -> tuple[list[dict], Path]:
    from kokoro_onnx import Kokoro
    k = Kokoro(str(models / "kokoro-v1.0.onnx"), str(models / "voices-v1.0.bin"))
    voice, speed = story.get("voice", "af_heart"), story.get("speed", 1.12)
    audio, shots = [], []
    for c in story["chunks"]:
        plain = c["text"].replace("*", "")
        x, sr = k.create(plain, voice=voice, speed=speed, lang="en-us")
        assert sr == SR
        nz = np.nonzero(np.abs(x) > 0.01)[0]  # trim Kokoro's silence at both ends
        x = x[nz[0]:nz[-1] + 1] if len(nz) else x
        x = np.concatenate([x, np.zeros(int(GAP * SR), np.float32)])
        dur = len(x) / SR
        words = []  # short words (a, of, to, he...) join the next word so no caption is a lonely "A"
        for w in c["text"].split():
            if words and len(re.sub(r"\W", "", words[-1])) <= 2 and not words[-1].endswith((".", ",")):
                words[-1] += " " + w
            else:
                words.append(w)
        weights = np.array([len(re.sub(r"\W", "", w)) + 1 for w in words], float)
        edges = np.concatenate([[0], np.cumsum(weights) / weights.sum()]) * (dur - GAP)
        caps = [[round(float(edges[i]), 3), round(float(edges[i + 1]) if i + 1 < len(words) else dur, 3),
                 w.replace("*", "").strip(".,!?"), "*" in w]
                for i, w in enumerate(words)]
        shot = {"bg": c["bg"], "dur": dur, "cam": c.get("cam", {"z0": 1.0, "z1": 1.07}), "actors": c.get("actors", []), "caps": caps}
        audio.append(x)
        shots.append(shot)
    wav = workdir / "voice.wav"
    pcm = (np.clip(np.concatenate(audio), -1, 1) * 32767).astype(np.int16)
    with wave.open(str(wav), "wb") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
    return shots, wav


if __name__ == "__main__":
    story = json.loads(Path(sys.argv[1]).read_text())
    out = Path(sys.argv[3])
    shots, wav = build(story, Path(sys.argv[2]), out.parent)
    print(render_video(shots, out, audio=wav))
