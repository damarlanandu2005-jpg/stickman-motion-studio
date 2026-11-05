"""Voice-first timing: every scene's voice line is made at NATURAL speed (Kokoro, no stretching) and the scene lasts as long as its voice.

    synth_scenes(models, workdir, scenes) -> (wav, durs, words, report)

scene length = voice length + a short breath after it (and a small lead before the first scene). Nothing is sped up or slowed down, so the voice
never sounds slow or rushed. Word times inside a scene are an estimate (letters share the voice time); no forced aligner is installed.
"""
from __future__ import annotations

import re
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 24000
LEAD, BREATH, MIN_SCENE = 0.15, 0.30, 1.4
MIN_SHOT = 0.9


def _trim(x: np.ndarray) -> np.ndarray:
    nz = np.nonzero(np.abs(x) > 0.01)[0]
    return x[nz[0]:nz[-1] + 1] if len(nz) else x


def scene_durations(voice_secs: list[float], lead: float = LEAD, breath: float = BREATH, min_scene: float = MIN_SCENE) -> list[float]:
    return [round(max(v + breath + (lead if i == 0 else 0.0), min_scene), 3) for i, v in enumerate(voice_secs)]


def word_times(text: str, start: float, voice_secs: float, red: list[str]) -> list[tuple[float, float, str, bool]]:
    """Estimated word times inside one scene: the letters of each word share the voice time."""
    toks = text.split()
    if not toks:
        return []
    wt = np.array([len(re.sub(r"\W", "", t)) + 0.6 for t in toks])
    edges = np.concatenate([[0], np.cumsum(wt) / wt.sum()]) * voice_secs + start
    redset = {re.sub(r"\W", "", r).lower() for r in red}
    return [(float(edges[j]), float(edges[j + 1]), t, re.sub(r"\W", "", t).lower() in redset) for j, t in enumerate(toks)]


def synth_scenes(models: Path, workdir: Path, scenes: list[dict], voice: str = "am_fenrir", speed: float = 1.0):
    """scenes: [{'voice': text, 'red': [words]}]. Returns (wav path, scene durations, words on the whole timeline, report)."""
    from kokoro_onnx import Kokoro
    k = Kokoro(str(Path(models) / "kokoro-v1.0.onnx"), str(Path(models) / "voices-v1.0.bin"))
    Path(workdir).mkdir(parents=True, exist_ok=True)
    # shots of one scene (same "group") are spoken in ONE go, so the sentence sounds natural; the time is then split between the shots
    groups, order = {}, []
    for i, sc in enumerate(scenes):
        g = sc.get("group", ("solo", i)) if sc.get("group") is not None else ("solo", i)
        if g not in groups:
            groups[g] = []; order.append(g)
        groups[g].append(i)
    units = [{"idx": groups[g], "voice": " ".join(scenes[i]["voice"] for i in groups[g]).strip(),
              "red": [r for i in groups[g] for r in scenes[i].get("red", [])]} for g in order]
    clips = []
    for u in units:
        x, sr = k.create(u["voice"], voice=voice, speed=speed, lang="en-us")
        assert sr == SR, sr
        clips.append(_trim(x))
    udurs = scene_durations([len(c) / SR for c in clips])
    durs = [0.0] * len(scenes)
    for u, d in zip(units, udurs):
        n = len(u["idx"])
        if n == 1:
            durs[u["idx"][0]] = d; continue
        wc = np.array([max(len(scenes[i]["voice"].split()), 1) for i in u["idx"]], float)
        share = np.maximum(d * wc / wc.sum(), MIN_SHOT)
        share = share * d / share.sum()
        for i, v in zip(u["idx"], share):
            durs[i] = round(float(v), 3)
    total = sum(durs)
    timeline = np.zeros(int(total * SR) + SR, np.float32)
    words, report, t = [], [], 0.0
    for j, (u, c, d) in enumerate(zip(units, clips, udurs)):
        s0 = t + (LEAD if j == 0 else 0.0)
        timeline[int(s0 * SR):int(s0 * SR) + len(c)] += c
        words += word_times(u["voice"], s0, len(c) / SR, u["red"])
        report.append({"scene": j + 1, "shots": len(u["idx"]), "voice_s": round(len(c) / SR, 2), "scene_s": round(d, 2), "stretched": False})
        t += d
    raw, wav = Path(workdir) / "voice_raw.wav", Path(workdir) / "voice.wav"
    pcm = (np.clip(timeline / max(float(np.abs(timeline).max()), 1.0), -1, 1) * 32767).astype(np.int16)
    with wave.open(str(raw), "wb") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-i", str(raw), "-af", "loudnorm=I=-16:TP=-2:LRA=7", "-ar", str(SR), "-ac", "1", str(wav)], check=True)
    return wav, durs, words, report
