#!/usr/bin/env python3
"""Idea JSON (scenes with captions) -> voice wav + m4a + one-word-at-a-time ASS captions + timing.json.
One Kokoro clip per sentence, so scene and sentence start/end times are exact. Word times inside a sentence are estimated
from word length (Kokoro gives no word timestamps): good enough for a placeholder voice, NOT for a real recording.
Usage: python voice_timed.py idea.json models_dir out_dir [voice] [speed] [gap_sentence] [gap_scene] [lead] [tail]"""
import json, re, sys, subprocess, os
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
idea, models, out = sys.argv[1], sys.argv[2], sys.argv[3]
voice = sys.argv[4] if len(sys.argv) > 4 else "am_fenrir"; speed = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
GS = float(sys.argv[6]) if len(sys.argv) > 6 else 0.15; GC = float(sys.argv[7]) if len(sys.argv) > 7 else 0.45
LEAD = float(sys.argv[8]) if len(sys.argv) > 8 else 0.5; TAIL = float(sys.argv[9]) if len(sys.argv) > 9 else 1.0
os.makedirs(out, exist_ok=True); FPS = 30
def sentences(t):
    res, cur, q = [], "", False
    for i, ch in enumerate(t):
        cur += ch
        if ch == '"': q = not q
        if ch in ".!?" and not q and (i + 1 == len(t) or t[i + 1] == " "): res.append(cur.strip()); cur = ""
    if cur.strip(): res.append(cur.strip())
    return res
k = Kokoro(os.path.join(models, "kokoro-v1.0.onnx"), os.path.join(models, "voices-v1.0.bin"))
d = json.load(open(idea)); sr = 24000; chunks = [np.zeros(int(LEAD * sr), dtype=np.float32)]; t = LEAD; timing = []; words_all = []
for si, sc in enumerate(d["scenes"]):
    s0 = t; sents = []
    for sj, s in enumerate(sentences(sc["caption"])):
        a, _ = k.create(s, voice=voice, speed=speed, lang="en-us"); a = a.astype(np.float32); dur = len(a) / sr
        sents.append({"text": s, "start": round(t, 3), "end": round(t + dur, 3)})
        ws = [w for w in s.split() if re.sub(r"[^A-Za-z0-9']", "", w)]
        wt = [len(re.sub(r"[^A-Za-z0-9']", "", w)) + 2 + (3 if w[-1] in ",:;" else 0) for w in ws]; tot = sum(wt); x = t
        for w, wv in zip(ws, wt):
            words_all.append((x, x + dur * wv / tot, re.sub(r"[^A-Za-z0-9' -]", "", w).upper())); x += dur * wv / tot
        chunks.append(a); t += dur
        last = sj == len(sentences(sc["caption"])) - 1
        gap = GC if (last and si < len(d["scenes"]) - 1) else (GS if not last else 0)
        if gap: chunks.append(np.zeros(int(gap * sr), dtype=np.float32)); t += gap
    timing.append({"id": sc["id"], "start": round(s0, 3), "end": round(sents[-1]["end"], 3), "sentences": sents})
speech_end = t; chunks.append(np.zeros(int(TAIL * sr), dtype=np.float32)); t += TAIL
audio = np.concatenate(chunks); sf.write(out + "/voice_raw.wav", audio, sr)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", out + "/voice_raw.wav", "-af", "loudnorm=I=-16:TP=-2", "-ar", "44100", "-c:a", "aac", "-b:a", "160k", out + "/audio.m4a"], check=True)
def ts(x): h = int(x // 3600); m = int(x % 3600 // 60); return "%d:%02d:%05.2f" % (h, m, x % 60)
hdr = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tools", "a1_assets", "cap.ass")).read().split("[Events]")[0]
ev = "[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n"
for i, (a, b, w) in enumerate(words_all):
    e = words_all[i + 1][0] if i + 1 < len(words_all) and words_all[i + 1][0] - b < 0.3 else b
    ev += "Dialogue: 0,%s,%s,C,,0,0,0,,%s\n" % (ts(a), ts(e), w)
open(out + "/cap.ass", "w").write(hdr + ev)
nw = sum(len(sc["caption"].split()) for sc in d["scenes"]); total_frames = int(np.ceil(t * FPS))
res = {"voice": voice, "speed": speed, "speech_seconds": round(speech_end - LEAD, 2), "speech_end": round(speech_end, 2), "total_seconds": round(t, 2),
       "total_frames": total_frames, "words": nw, "words_per_second_speech": round(nw / (speech_end - LEAD), 2), "words_per_second_total": round(nw / t, 2),
       "fps": FPS, "scenes": timing}
json.dump(res, open(out + "/timing.json", "w"), indent=1); print({k2: v for k2, v in res.items() if k2 != "scenes"})
