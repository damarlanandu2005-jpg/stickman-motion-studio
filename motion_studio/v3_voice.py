"""v3 recreation voice: Kokoro am_fenrir, one sentence at a time, each sentence stretched (pitch kept) to the time span it has in v3.

Words get times in proportion to their letters inside the sentence span (no forced aligner is installed), so caption times are approximate.
"""
from __future__ import annotations

import re
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 24000

# (start, end, text); *word* = red keyword. Spans come from the OCR of v3's caption track (approximate). The text is reconstructed from the
# same OCR, so a few words (marked in the report) are my reading, not a transcript.
SENTENCES = [
    (0.40, 7.40, "This bomb squad technician could never ask which *wire* to cut, because his team would find out he was completely *colorblind*."),
    (7.60, 14.00, "When his daughter needed heart surgery, Arthur applied for the highest-paying job in the police department: explosive ordnance disposal."),
    (14.10, 20.80, "The medical exam? He memorized the colorblindness test backwards and forwards before walking into the room."),
    (20.80, 24.00, "Once he was on the squad, every call was a nightmare."),
    (24.10, 29.50, "When headquarters radioed instructions like cut the red wire, not the *green*, Arthur couldn't tell the difference."),
    (29.60, 40.60, "To survive, he stayed up every night memorizing the factory blueprints of every timer, battery and circuit board on the market, tracing wires by which terminal they connected, never by their color."),
    (40.70, 43.60, "He disarmed *forty-one* bombs in three years."),
    (43.70, 49.40, "Then came a device built from scratch, with six identical-looking wires twisted together in a knot."),
    (49.40, 53.90, "His commander screamed over the radio to cut the *blue* wire, with ten seconds left."),
    (53.90, 63.00, "Arthur took off his headset, felt the thickness of the copper insulation with his bare fingers, and snipped the higher-gauge ground wire with one second on the clock."),
    (63.00, 73.00, "The commander wanted to fire him, but made him head *instructor* instead, because he was the only man in the city who didn't rely on *paint* to read a bomb."),
]


def _atempo_chain(r: float) -> str:
    parts = []
    while r > 2.0:
        parts.append("atempo=2.0"); r /= 2.0
    while r < 0.5:
        parts.append("atempo=0.5"); r /= 0.5
    parts.append(f"atempo={r:.5f}")
    return ",".join(parts)


def synth(models: Path, workdir: Path, total: float, voice: str = "am_fenrir", speed: float = 1.12, sentences=SENTENCES):
    """Return (wav_path, report, words) ; words = [(t0, t1, word, is_red)] on the whole-video timeline."""
    from kokoro_onnx import Kokoro
    k = Kokoro(str(models / "kokoro-v1.0.onnx"), str(models / "voices-v1.0.bin"))
    workdir.mkdir(parents=True, exist_ok=True)
    timeline = np.zeros(int(total * SR) + SR, np.float32)
    report, words = [], []
    for i, (a, b, text) in enumerate(sentences):
        x, sr = k.create(text.replace("*", ""), voice=voice, speed=speed, lang="en-us")
        nz = np.nonzero(np.abs(x) > 0.01)[0]
        x = x[nz[0]:nz[-1] + 1] if len(nz) else x
        d0 = len(x) / sr
        span = b - a
        r = d0 / span                       # >1 means the sentence must be sped up to fit its v3 span
        raw, out = workdir / f"s{i}.wav", workdir / f"s{i}_fit.wav"
        pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
        with wave.open(str(raw), "wb") as f:
            f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr); f.writeframes(pcm.tobytes())
        subprocess.run(["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-i", str(raw), "-filter:a", _atempo_chain(r), str(out)], check=True)
        with wave.open(str(out)) as f:
            y = np.frombuffer(f.readframes(f.getnframes()), np.int16).astype(np.float32) / 32768
        s0 = int(a * SR)
        timeline[s0:s0 + len(y)] += y[: len(timeline) - s0]
        report.append({"sentence": i + 1, "span": [a, b], "natural_s": round(d0, 2), "fit_ratio": round(r, 2), "fitted_s": round(len(y) / SR, 2)})
        toks = text.split()
        wt = np.array([len(re.sub(r"\W", "", t)) + 0.6 for t in toks])
        edges = np.concatenate([[0], np.cumsum(wt) / wt.sum()]) * (len(y) / SR) + a
        for j, t in enumerate(toks):
            words.append((float(edges[j]), float(edges[j + 1]), t.replace("*", "").strip(), "*" in t))
    wav = workdir / "voice.wav"
    pcm = (np.clip(timeline, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(wav), "wb") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
    return wav, report, words


def caption_groups(words, max_words: int = 3, max_chars: int = 16):
    """Group words into 1 to 3 word captions with a start and end time; a red word makes the group show that word red (group red flag)."""
    groups, cur = [], []
    for w in words:
        plain = " ".join(x[2] for x in cur + [w])
        if cur and (len(cur) >= max_words or len(plain) > max_chars):
            groups.append(cur); cur = []
        cur.append(w)
        if re.search(r"[.,:?!]$", w[2]):
            groups.append(cur); cur = []
    if cur:
        groups.append(cur)
    return [(g[0][0], g[-1][1], " ".join(x[2] for x in g).strip(".,:?!"), any(x[3] for x in g)) for g in groups]
