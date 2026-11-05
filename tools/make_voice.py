#!/usr/bin/env python3
"""Script file -> voice.mp3 (Kokoro, free, offline) + script.txt (narration only, for timing.py).
Usage: python3 tools/make_voice.py scripts/<name>.txt <project_dir> [models_dir] [voice] [speed]
Only the NARRATION part of the script is spoken (see scripts/FORMAT.md)."""
import re, subprocess, sys
from pathlib import Path

src, proj = Path(sys.argv[1]), Path(sys.argv[2])
models = Path(sys.argv[3] if len(sys.argv) > 3 else "models")
voice = sys.argv[4] if len(sys.argv) > 4 else "am_fenrir"
speed = float(sys.argv[5]) if len(sys.argv) > 5 else 1.05
text = src.read_text(encoding="utf-8")
m = re.search(r"^NARRATION:\s*\n(.*?)(?=^\s*SHOT NOTES:|\Z)", text, re.S | re.M)
narr = (m.group(1) if m else text).strip()
narr = " ".join(l.strip() for l in narr.splitlines() if l.strip() and not l.strip().startswith("#"))
proj.mkdir(parents=True, exist_ok=True)
(proj / "script.txt").write_text(narr + "\n", encoding="utf-8")
notes = re.search(r"^\s*SHOT NOTES:\s*\n(.*)\Z", text, re.S | re.M)
if notes and notes.group(1).strip():
    (proj / "shot_notes.txt").write_text(notes.group(1).strip() + "\n", encoding="utf-8")
from kokoro_onnx import Kokoro
import soundfile as sf
k = Kokoro(str(models / "kokoro-v1.0.onnx"), str(models / "voices-v1.0.bin"))
audio, sr = k.create(narr, voice=voice, speed=speed, lang="en-us")
sf.write(proj / "voice_raw.wav", audio, sr)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(proj / "voice_raw.wav"), "-af", "loudnorm=I=-16:TP=-2", "-ar", "44100", "-b:a", "192k", str(proj / "voice.mp3")], check=True)
print("voice.mp3 written:", round(len(audio) / sr, 2), "s,", len(narr.split()), "words")
