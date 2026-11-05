#!/usr/bin/env python3
"""Lock the levels: music bed at 50 % of the voice level (-6 dB, gated RMS), SFX at 50 % with peaks capped at 0.7 x the voice peak.
Usage: python3 mix.py voice.mp3 music.wav sfx.wav   -> mix_raw.wav (then finish.sh).  One linear gain + a peak limiter only."""
import subprocess, sys, wave
import numpy as np
SR = 48000
def load(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()
def grms(x, gate=-40):
    if not len(x): return 1e-9
    b = int(0.4 * SR); n = max(len(x) // b, 1); blocks = x[:n * b].reshape(n, b) if len(x) >= b else x[None, :]
    r = np.sqrt((blocks ** 2).mean(1) + 1e-12); keep = r[20 * np.log10(r) > gate]
    return float(np.sqrt((keep ** 2).mean())) if len(keep) else float(np.sqrt((x ** 2).mean() + 1e-12))
v = load(sys.argv[1]); m = load(sys.argv[2]) if len(sys.argv) > 2 else np.zeros(1, np.float32); s = load(sys.argv[3]) if len(sys.argv) > 3 else np.zeros(1, np.float32)
N = len(v); fit = lambda x: np.pad(x, (0, max(0, N - len(x))))[:N]
m, s = fit(m), fit(s)
vr = grms(v); m *= 0.5 * vr / max(grms(m), 1e-9); s *= 0.5 * vr / max(grms(s), 1e-9)
cap = 0.7 * float(np.abs(v).max()); pk = float(np.abs(s).max())
if pk > cap: s *= cap / pk
mix = v + m + s; peak = float(np.abs(mix).max())
if peak > 0.98: mix *= 0.98 / peak
db = lambda a, b: 20 * np.log10(max(a, 1e-9) / max(b, 1e-9))
print(f"music vs voice: {db(grms(m), vr):.1f} dB   sfx vs voice: {db(grms(s), vr):.1f} dB")
with wave.open("mix_raw.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
