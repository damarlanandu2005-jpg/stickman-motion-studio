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

# (start, end, text); *word* = red keyword. Chunk starts come from the OCR of v3's caption track (about +-0.1 s). The text is rebuilt from the
# same OCR, so a few words (the last 10 s especially) are my reading, not a transcript. Each chunk is stretched to its span so voice and
# caption changes line up with v3 at chunk level.
SENTENCES = [
    (0.15, 2.97, "This bomb squad technician could never ask which"),
    (2.97, 3.67, "*wire* to cut,"),
    (3.67, 5.07, "because his team would find out"),
    (5.07, 7.57, "he was completely *colorblind*."),
    (7.57, 9.07, "When his daughter needed heart surgery,"),
    (9.07, 10.97, "Arthur applied for the highest-paying job in the"),
    (10.97, 14.05, "police department: explosive ordnance disposal."),
    (14.05, 15.47, "The medical exam?"),
    (15.47, 17.47, "He memorized the colorblindness test"),
    (17.47, 19.37, "backwards and forwards before"),
    (19.37, 20.80, "walking into the room."),
    (20.80, 21.87, "Once he was on the squad,"),
    (21.87, 24.05, "every call was a nightmare."),
    (24.05, 25.57, "When headquarters radioed instructions"),
    (25.57, 27.87, "like cut the red wire, not the *green*,"),
    (27.87, 29.55, "Arthur couldn't tell the difference."),
    (29.55, 31.37, "To survive, he stayed up every night"),
    (31.37, 33.17, "memorizing the factory blueprints of"),
    (33.17, 36.57, "every timer, battery and circuit board on the market,"),
    (36.57, 39.27, "tracing wires by which terminal they connected,"),
    (39.27, 40.65, "never by their color."),
    (40.65, 42.47, "He disarmed *forty-one* bombs"),
    (42.47, 43.65, "in three years."),
    (43.65, 45.57, "Then came a device built from scratch,"),
    (45.57, 47.17, "with six identical-looking"),
    (47.17, 49.37, "wires twisted together in a knot."),
    (49.37, 51.15, "His commander screamed over"),
    (51.15, 52.77, "the radio to cut the *blue* wire with ten"),
    (52.77, 53.90, "seconds left."),
    (53.90, 55.67, "Arthur took off his headset,"),
    (55.67, 57.77, "felt the thickness of the copper insulation with"),
    (57.77, 59.67, "his bare fingers, and snipped the"),
    (59.67, 61.27, "higher-gauge ground wire with"),
    (61.27, 63.00, "one second on the clock."),
    (63.00, 66.50, "The commander wanted to fire him,"),
    (66.50, 69.37, "but made him head *instructor* instead,"),
    (69.37, 70.90, "because he was the only man in the city"),
    (70.90, 73.05, "who didn't rely on *paint* to read a bomb."),
]


def _atempo_chain(r: float) -> str:
    parts = []
    while r > 2.0:
        parts.append("atempo=2.0"); r /= 2.0
    while r < 0.5:
        parts.append("atempo=0.5"); r /= 0.5
    parts.append(f"atempo={r:.5f}")
    return ",".join(parts)


def synth(models: Path, workdir: Path, total: float, voice: str = "am_fenrir", speed: float = 1.0, sentences=SENTENCES):
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
        r = min(max(d0 / span, 0.80), 1.40)  # >1 means the chunk is sped up to fit its v3 span (clamped; overflow is cut with a short fade)
        raw, out = workdir / f"s{i}.wav", workdir / f"s{i}_fit.wav"
        pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
        with wave.open(str(raw), "wb") as f:
            f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr); f.writeframes(pcm.tobytes())
        subprocess.run(["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-i", str(raw), "-filter:a", _atempo_chain(r), str(out)], check=True)
        with wave.open(str(out)) as f:
            y = np.frombuffer(f.readframes(f.getnframes()), np.int16).astype(np.float32) / 32768
        s0 = int(a * SR)
        keep = int((span + 0.12) * SR)           # never run far into the next chunk
        over = max(len(y) / SR - (span + 0.12), 0.0)
        if len(y) > keep:
            y = y[:keep].copy(); y[-int(0.04 * SR):] *= np.linspace(1, 0, int(0.04 * SR))
        timeline[s0:s0 + len(y)] += y[: len(timeline) - s0]
        report.append({"sentence": i + 1, "span": [a, b], "natural_s": round(d0, 2), "fit_ratio": round(r, 2), "fitted_s": round(len(y) / SR, 2), "cut_off_s": round(over, 2)})
        toks = text.split()
        wt = np.array([len(re.sub(r"\W", "", t)) + 0.6 for t in toks])
        edges = np.concatenate([[0], np.cumsum(wt) / wt.sum()]) * (len(y) / SR) + a
        for j, t in enumerate(toks):
            words.append((float(edges[j]), float(edges[j + 1]), t.replace("*", "").strip(), "*" in t))
    raw = workdir / "voice_raw.wav"
    pcm = (np.clip(timeline / max(float(np.abs(timeline).max()), 1.0), -1, 1) * 32767).astype(np.int16)
    with wave.open(str(raw), "wb") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
    wav = workdir / "voice.wav"   # loudness about -16 LUFS, true peak <= -2 dB (the v3 voice measures -15.9 LUFS, peak -4.2 dB)
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-i", str(raw), "-af", "loudnorm=I=-16:TP=-2:LRA=7", "-ar", str(SR), "-ac", "1", str(wav)], check=True)
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
    out = [[g[0][0], g[-1][1], " ".join(x[2] for x in g).strip(".,:?!"), any(x[3] for x in g)] for g in groups]
    for cur, nxt in zip(out, out[1:]):      # like v3: a caption stays on screen until the next one starts (short pauses only)
        if 0 < nxt[0] - cur[1] < 1.6:
            cur[1] = nxt[0]
    return [tuple(g) for g in out]
