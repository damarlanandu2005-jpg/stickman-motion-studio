"""Shared synth library: music + sfx helpers (stems are written by each story's audio.py)."""
import numpy as np, subprocess, wave

SR = 48000
import os
import json
_p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work', 'phrases.json')
DUR = int(os.environ['FRAMES']) / 30 if os.environ.get('FRAMES') else (json.load(open(_p))['duration'] if os.path.exists(_p) else 20.0)
N = int(DUR * SR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR

def load_voice():
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", "voice.mp3", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    v = np.frombuffer(raw, np.float32).copy()
    out = np.zeros(N, np.float32); out[:min(N, len(v))] = v[:N]; return out

def env(n, a=0.005, r=0.2, sus=None):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / r)
    return e

def lp(x, k):  # one-pole low-pass, k in (0,1)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc += k * (x[i] - acc); y[i] = acc
    return y

def lp_fast(x, cutoff):
    # FFT brick-ish low-pass (fast, fine for beds)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / (1 + (f / cutoff) ** 4); return np.fft.irfft(X, len(x)).astype(np.float32)

def hp_fast(x, cutoff):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 - 1 / (1 + (f / cutoff) ** 4); return np.fft.irfft(X, len(x)).astype(np.float32)

def place(buf, sig, t0, gain=1.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if i < N and j > i: buf[i:j] += sig[: j - i] * gain

midi = lambda m: 440 * 2 ** ((m - 69) / 12)

# ---------------- music ----------------
music = np.zeros(N, np.float32)
BPM = 104; beat = 60 / BPM
prog = [(57, [57, 60, 64]), (53, [53, 57, 60]), (55, [55, 59, 62]), (52, [52, 56, 59])]  # Am F G E
def pluck(f, dur=0.35, bright=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum((bright ** k) * np.sin(2 * np.pi * f * (k + 1) * t) / (k + 1) for k in range(6))
    return (s * env(n, 0.003, dur * 0.35)).astype(np.float32)
def brass(fs, dur):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for f in fs:
        ph = 2 * np.pi * f * t + 0.003 * np.sin(2 * np.pi * 5 * t)
        s += sum(np.sin((k + 1) * ph) / (k + 1) ** 1.3 for k in range(8))
    a = np.minimum(1, t / 0.08) * np.minimum(1, (dur - t) / 0.15).clip(0)
    return lp_fast((s * a).astype(np.float32), 1800) / len(fs)
def drum(kind):
    if kind == "kick":
        n = int(0.35 * SR); t = np.arange(n) / SR; f = 50 + 90 * np.exp(-t * 30)
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)).astype(np.float32)
    n = int(0.18 * SR); t = np.arange(n) / SR
    s = rng.standard_normal(n) * np.exp(-t * 28) * 0.6 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 20) * 0.5
    return hp_fast(s.astype(np.float32), 300)

def noise(d): return rng.standard_normal(int(d * SR)).astype(np.float32)
def thunk(f0=90, d=0.3):
    n = int(d * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f0 * t * (1 + 0.6 * np.exp(-t * 40))) * np.exp(-t * 14) + lp_fast(noise(d), 1200) * np.exp(-t * 30) * 0.5).astype(np.float32)
def rumble(d):
    n = int(d * SR); t = np.arange(n) / SR
    s = lp_fast(noise(d), 160) * 3 * np.minimum(1, t / 0.15) * np.exp(-t / (d * 0.45))
    return s.astype(np.float32)
def crash(d=1.2):
    n = int(d * SR); t = np.arange(n) / SR; s = np.zeros(n, np.float32)
    for k in range(14):
        tk = rng.uniform(0, d * 0.6); i = int(tk * SR); g = thunk(rng.uniform(60, 160), 0.35) * rng.uniform(0.3, 0.9)
        s[i:i + len(g)] += g[: n - i]
    s += lp_fast(noise(d), 2500) * np.exp(-t * 3) * 0.25
    return s
def cuckoo():
    out = []
    for f, d in [(740, 0.16), (587, 0.24)]:
        n = int(d * SR); t = np.arange(n) / SR
        out.append(np.sin(2 * np.pi * f * t) * np.minimum(1, t / 0.01) * np.exp(-t * 6)); out.append(np.zeros(int(0.06 * SR)))
    return np.concatenate(out).astype(np.float32)
def scrape(d=0.8):
    n = int(d * SR); t = np.arange(n) / SR
    s = noise(d) * (0.5 + 0.5 * np.sin(2 * np.pi * 13 * t)) * np.sin(np.pi * t / d)
    s = hp_fast(lp_fast(s, 5000), 1500)
    ring = np.sin(2 * np.pi * 1870 * t) * np.exp(-t * 3) * 0.2
    return (s * 0.6 + ring).astype(np.float32)
def ting():
    n = int(1.2 * SR); t = np.arange(n) / SR
    return (sum(np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, k in [(2093, 4), (3136, 6), (4186, 8)]) * 0.3).astype(np.float32)
def sting():
    n = int(2.0 * SR); t = np.arange(n) / SR
    low = np.sin(2 * np.pi * 41 * t) * np.exp(-t * 1.5) * 1.2
    hit = lp_fast(noise(2.0), 900) * np.exp(-t * 6) * 0.8
    stab = brass([midi(45), midi(48), midi(51)], 1.4); s = low + hit; s[: len(stab)] += stab * 2.2 * np.exp(-np.arange(len(stab)) / SR * 2)
    return s.astype(np.float32)
def creak(d=0.6, f0=140):
    n = int(d * SR); t = np.arange(n) / SR
    rate = f0 * (1 + 0.35 * np.sin(2 * np.pi * 1.3 * t / d))
    ph = np.cumsum(rate) / SR; pulses = (np.mod(ph, 1) < 0.08).astype(np.float32)
    s = lp_fast(pulses * (0.6 + 0.4 * rng.random(n).astype(np.float32)), 2200) * np.sin(np.pi * t / d)
    return hp_fast(s, 200) * 2.5
def snap():
    d = 0.5; n = int(d * SR); t = np.arange(n) / SR
    return (hp_fast(noise(d), 800) * np.exp(-t * 18) * 1.4 + np.pad(thunk(120, 0.4), (0, n - int(0.4 * SR))) * 0.6).astype(np.float32)
def splash(d=1.0):
    n = int(d * SR); t = np.arange(n) / SR
    s = lp_fast(noise(d), 4000) * (np.exp(-t * 4) * np.minimum(1, t / 0.01)) + lp_fast(noise(d), 400) * np.exp(-t * 7) * 1.5
    return s.astype(np.float32)
def whoosh(d=0.5):
    n = int(d * SR); t = np.arange(n) / SR
    return (lp_fast(noise(d), 1500) * np.sin(np.pi * t / d) ** 2 * 0.6).astype(np.float32)
def snore(d=1.1):
    n = int(d * SR); t = np.arange(n) / SR
    buzz = (np.mod(np.cumsum(60 + 25 * np.sin(np.pi * t / d)) / SR, 1) < 0.3).astype(np.float32)
    return (lp_fast(buzz * 0.5 + noise(d) * 0.15, 700) * np.sin(np.pi * t / d) ** 2).astype(np.float32)
def leaves(d):
    n = int(d * SR); t = np.arange(n) / SR
    return (hp_fast(lp_fast(noise(d), 6000), 2500) * (0.3 + 0.3 * np.sin(2 * np.pi * 0.7 * t) ** 2) * np.minimum(1, t / 0.4) * np.minimum(1, (d - t) / 0.4)).astype(np.float32)
def water(d):
    n = int(d * SR); t = np.arange(n) / SR
    return (lp_fast(noise(d), 900) * 0.5 + hp_fast(lp_fast(noise(d), 3000), 1200) * 0.15 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.4 * t))).astype(np.float32)


def honk(f0=380, d=0.35):
    n=int(d*SR); t=np.arange(n)/SR; f=f0*(1+0.35*np.exp(-t*6)-0.25*t/d)
    ph=np.cumsum(f)/SR; s=sum(np.sin(2*np.pi*ph*k)/k for k in (1,2,3,4))*np.minimum(1,t/0.02)*np.exp(-t*4)
    return lp_fast(s.astype(np.float32),2600)*0.6
def gun(d=0.35):
    n=int(d*SR); t=np.arange(n)/SR
    return (hp_fast(noise(d),300)*np.exp(-t*22)*1.2+np.sin(2*np.pi*70*t*(1+np.exp(-t*30)))*np.exp(-t*12)*0.8).astype(np.float32)
def burst(k=5,gap=0.07):
    out=np.zeros(int((k*gap+0.4)*SR),np.float32)
    for i in range(k):
        g=gun(0.3); j=int(i*gap*SR); out[j:j+len(g)]+=g[:len(out)-j]
    return out
def click(d=0.08):
    n=int(d*SR); t=np.arange(n)/SR; return (hp_fast(noise(d),2000)*np.exp(-t*80)).astype(np.float32)
def engine(d, f0=48):
    n=int(d*SR); t=np.arange(n)/SR; ph=np.cumsum(f0*(1+0.04*np.sin(2*np.pi*3*t)))/SR
    s=sum(np.sin(2*np.pi*ph*k)/k for k in (1,2,3,5))+lp_fast(noise(d),400)*0.4
    return (lp_fast(s.astype(np.float32),500)*np.minimum(1,t/0.3)*np.minimum(1,(d-t)/0.3).clip(0)).astype(np.float32)
def boing():
    d=0.45; n=int(d*SR); t=np.arange(n)/SR; f=300+250*np.sin(2*np.pi*7*t)*np.exp(-t*5)
    return (np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*6)*0.6).astype(np.float32)
def trombone_sad(d=1.3):
    n=int(d*SR); t=np.arange(n)/SR; f=midi(58)*(1-0.12*t/d)
    s=sum(np.sin(2*np.pi*np.cumsum(f)/SR*k)/k**1.2 for k in range(1,7))*np.minimum(1,t/0.1)*np.minimum(1,(d-t)/0.2).clip(0)
    return lp_fast(s.astype(np.float32),1500)*0.5
def flip(d=0.18):
    n=int(d*SR); t=np.arange(n)/SR; return (hp_fast(noise(d),1500)*np.sin(np.pi*t/d)**2*0.5).astype(np.float32)
def cheer(d=1.5):
    n=int(d*SR); t=np.arange(n)/SR
    return (hp_fast(lp_fast(noise(d),4500),600)*(0.5+0.5*np.sin(2*np.pi*3*t))*np.minimum(1,t/0.1)*np.exp(-t*1.2)).astype(np.float32)
def bell(f=520,d=2.0):
    n=int(d*SR); t=np.arange(n)/SR
    return (sum(np.sin(2*np.pi*f*r*t)*np.exp(-t*k) for r,k in [(1,2),(2.4,3),(3.1,4),(4.2,6)])*0.3).astype(np.float32)
def hammer(d=0.12):
    n=int(d*SR); t=np.arange(n)/SR
    return (np.sin(2*np.pi*900*t)*np.exp(-t*60)+hp_fast(noise(d),1500)*np.exp(-t*70)).astype(np.float32)*0.7
def steps(d, rate=2.6):
    out=np.zeros(int(d*SR),np.float32); k=0
    while k/rate<d-0.1:
        g=thunk(120,0.12)*0.5; i=int(k/rate*SR); out[i:i+len(g)]+=g[:len(out)-i]; k+=1
    return out
def crowd_steps(d):
    out=np.zeros(int(d*SR),np.float32)
    for k in range(int(d*9)):
        g=thunk(rng.uniform(90,160),0.1)*rng.uniform(0.2,0.5); i=int(rng.uniform(0,d-0.12)*SR); out[i:i+len(g)]+=g[:len(out)-i]
    return out
def murmur(d):
    n=int(d*SR); t=np.arange(n)/SR
    return (lp_fast(noise(d),900)*(0.4+0.4*np.sin(2*np.pi*0.9*t)**2)*np.minimum(1,t/0.3)*np.minimum(1,(d-t)/0.3).clip(0)).astype(np.float32)
def roar(d):
    n=int(d*SR); t=np.arange(n)/SR
    return (lp_fast(noise(d),700)*2.2*np.minimum(1,t/0.4)*np.minimum(1,(d-t)/0.5).clip(0)).astype(np.float32)
def folk(bpm_beat, dur_s, root=62, tempo=1.0):
    """simple folk dance bed: drone + pluck ostinato + hand drum"""
    out=np.zeros(int(dur_s*SR),np.float32); b=60/(bpm_beat*tempo); sc=[0,2,3,5,7,8,10]
    k=0
    while k*b<dur_s-0.2:
        deg=sc[[0,2,4,2,5,4,2,1][k%8]]
        g=pluck(midi(root+deg),0.28,0.55); i=int(k*b*SR); out[i:i+len(g)]+=g[:len(out)-i]*0.25
        if k%2==0:
            g=drum("kick"); out[i:i+len(g)]+=g[:len(out)-i]*0.3
        else:
            g=drum("snare"); out[i:i+len(g)]+=g[:len(out)-i]*0.15
        k+=1
    return out
def ragtime(dur_s, root=60, bpm=112):
    out=np.zeros(int(dur_s*SR),np.float32); b=60/bpm; k=0
    pat=[0,4,7,4,9,7,4,2]
    while k*b/2<dur_s-0.2:
        i=int(k*b/2*SR); note=root+12+pat[k%8]
        g=pluck(midi(note),0.2,0.5); out[i:i+len(g)]+=g[:len(out)-i]*0.22
        if k%2==0:
            g=pluck(midi(root-12+(0 if (k//2)%2==0 else 7)),0.3,0.4); out[i:i+len(g)]+=g[:len(out)-i]*0.3
        k+=1
    return out
def write_stems(music, sfx):
    for name, x in (("music", music), ("sfx", sfx)):
        pcm=(np.clip(x,-1,1)*32767).astype(np.int16)
        with wave.open(name+".wav","wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print("stems ok", DUR)
