#!/usr/bin/env python3
"""Minimal cartoon pizzicato bed, synthesized (Karplus-Strong plucks): sneaky A-minor walk, steady medium tempo, no drums.
usage: pizzicato.py out.wav seconds [pivot_seconds]   - a second plucked line enters at the pivot and the pace lifts near the end."""
import sys, numpy as np, wave
out, dur = sys.argv[1], float(sys.argv[2]); pivot = float(sys.argv[3]) if len(sys.argv) > 3 else dur / 2
SR = 44100; bpm = 112; beat = 60 / bpm
rng = np.random.default_rng(7)
def pluck(freq, length, amp=0.5, decay=0.996):
    n = int(SR * length); N = max(2, int(SR / freq)); buf = rng.uniform(-1, 1, N) * amp; y = np.zeros(n)
    for i in range(n):
        y[i] = buf[i % N]; buf[i % N] = decay * 0.5 * (buf[i % N] + buf[(i + 1) % N])
    return y
def hz(m): return 440 * 2 ** ((m - 69) / 12)
mix = np.zeros(int(SR * (dur + 1)))
def add(t, y):
    i = int(t * SR); mix[i:i + len(y)] += y[:len(mix) - i]
bass = [45, 45, 52, 45, 48, 48, 52, 47]           # A A E A C C E B  (MIDI)
top = [69, 72, 76, 72, 69, 71, 72, 71]            # arpeggio line
t = 0.0; step = 0
while t < dur:
    add(t, pluck(hz(bass[step % 8]), 0.5, 0.55, 0.994))
    if t >= pivot:                                 # tension: second line enters after "You see"
        add(t + beat / 2, pluck(hz(top[step % 8]), 0.35, 0.28, 0.99))
        if t >= dur - 6: add(t + beat / 4, pluck(hz(top[(step + 3) % 8] + 12), 0.25, 0.18, 0.988))
    elif step % 2 == 1:
        add(t + beat / 2, pluck(hz(top[step % 8] - 12), 0.3, 0.2, 0.99))
    t += beat; step += 1
mix = mix[:int(SR * dur)]; fade = int(SR * 1.5); mix[-fade:] *= np.linspace(1, 0, fade); mix[:int(SR * .05)] *= np.linspace(0, 1, int(SR * .05))
mix = mix / (np.abs(mix).max() + 1e-9) * 0.8
with wave.open(out, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("wrote", out, round(dur, 1), "s")
