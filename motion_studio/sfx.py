"""Object sounds made by code (no downloads, so no licence questions). Only used where a shot asks for one.
Types: boom, gunshot, thud, beep, tick, wind, static, step, click, siren.  All mono, 24 kHz, peak <= 1.
"""
from __future__ import annotations

import wave
from pathlib import Path

import numpy as np

SR = 24000
_RNG = np.random.default_rng(7)


def _env(n: int, attack: float, decay: float) -> np.ndarray:
    t = np.arange(n) / SR
    return np.minimum(t / max(attack, 1e-4), 1.0) * np.exp(-t / decay)


def _lowpass(x: np.ndarray, k: int) -> np.ndarray:
    return np.convolve(x, np.ones(k) / k, mode="same")


def make(kind: str, dur: float | None = None) -> np.ndarray:
    if kind == "boom":
        n = int(1.6 * SR)
        x = _lowpass(_RNG.standard_normal(n), 40) * 6 * _env(n, 0.005, 0.45)
        t = np.arange(n) / SR
        x += np.sin(2 * np.pi * (70 - 35 * np.minimum(t, 1)) * t) * _env(n, 0.003, 0.5)
    elif kind == "gunshot":
        n = int(0.7 * SR)
        x = _RNG.standard_normal(n) * _env(n, 0.001, 0.06) + _lowpass(_RNG.standard_normal(n), 25) * 3 * _env(n, 0.002, 0.2)
    elif kind == "thud":
        n = int(0.5 * SR)
        t = np.arange(n) / SR
        x = np.sin(2 * np.pi * 85 * t) * _env(n, 0.002, 0.09) + _lowpass(_RNG.standard_normal(n), 60) * 2 * _env(n, 0.002, 0.05)
    elif kind == "beep":
        n = int(0.18 * SR)
        t = np.arange(n) / SR
        x = np.sin(2 * np.pi * 1800 * t) * np.minimum(1, np.minimum(t / 0.005, (0.18 - t) / 0.01))
    elif kind == "tick":
        n = int(0.06 * SR)
        x = _RNG.standard_normal(n) * _env(n, 0.0005, 0.008)
    elif kind == "wind":
        n = int((dur or 3.0) * SR)
        x = _lowpass(_RNG.standard_normal(n), 120)
        t = np.arange(n) / SR
        x = x * (0.6 + 0.4 * np.sin(2 * np.pi * 0.35 * t)) * 5
    elif kind == "static":
        n = int((dur or 0.8) * SR)
        x = _RNG.standard_normal(n) * 0.5 * np.minimum(1, np.arange(n) / (0.03 * SR))
    elif kind == "step":
        n = int(0.12 * SR)
        x = _lowpass(_RNG.standard_normal(n), 30) * 3 * _env(n, 0.002, 0.03)
    elif kind == "click":
        n = int(0.03 * SR)
        x = _RNG.standard_normal(n) * _env(n, 0.0003, 0.004)
    elif kind == "siren":
        n = int((dur or 2.0) * SR)
        t = np.arange(n) / SR
        f = 900 + 350 * np.sin(2 * np.pi * 0.8 * t)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, np.minimum(t / 0.1, (n / SR - t) / 0.2))
    else:
        raise ValueError(f"unknown sound: {kind}")
    return (x / max(np.abs(x).max(), 1e-9)).astype(np.float32)


def mix(shots: list[dict], voice: Path | None, out: Path, total: float | None = None) -> Path:
    """Voice wav + the shots' sfx lists -> one wav. sfx: {"t": seconds into the shot, "type": ..., "gain": 0..1, "dur": s, "repeat": n, "every": s}"""
    total = total or sum(s["dur"] for s in shots)
    buf = np.zeros(int((total + 1.0) * SR), np.float32)
    if voice:
        with wave.open(str(voice)) as w:
            v = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        buf[:len(v)] += v[:len(buf)]
    start = 0.0
    for s in shots:
        for e in s.get("sfx", []):
            snd = make(e["type"], e.get("dur")) * e.get("gain", 0.4)
            for k in range(e.get("repeat", 1)):
                a = int((start + e.get("t", 0.0) + k * e.get("every", 0.0)) * SR)
                if a < len(buf):
                    buf[a:a + len(snd)] += snd[:len(buf) - a]
        start += s["dur"]
    buf = np.clip(buf, -1, 1)
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((buf * 32767).astype(np.int16).tobytes())
    return out
