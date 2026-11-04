"""Gentle code checks of a finished short. Only clear breakage is a FAIL (no file, no video stream, wrong size, far too short,
black or frozen picture, silent audio when voice was expected). Everything else is a warning with numbers. A person decides taste.

    python -m motion_studio.video_check out/x.mp4 [--expect-seconds S]   prints JSON, last line VIDEO_OK=true|false
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np


def _probe(path: Path) -> dict:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)], capture_output=True, text=True, timeout=60)
    return json.loads(r.stdout or "{}")


def _frame(path: Path, t: float, w: int = 90, h: int = 160) -> np.ndarray | None:
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-ss", f"{t:.2f}", "-i", str(path), "-frames:v", "1", "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                       capture_output=True, timeout=60)
    return np.frombuffer(r.stdout, np.uint8).reshape(h, w).astype(np.float32) if len(r.stdout) == w * h else None


def _audio_level(path: Path) -> float | None:
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], capture_output=True, timeout=120)
    if not r.stdout:
        return None
    x = np.frombuffer(r.stdout, np.int16).astype(np.float32) / 32768
    return float(np.sqrt((x ** 2).mean()))


def check(path: Path, expect_seconds: float | None = None, voice_expected: bool = True) -> dict:
    path = Path(path); out = {"file": str(path), "fails": [], "warnings": []}
    if not path.is_file() or path.stat().st_size < 10_000:
        out["fails"].append("no video file (or tiny)"); out["ok"] = False; return out
    info = _probe(path); vs = [s for s in info.get("streams", []) if s.get("codec_type") == "video"]
    if not vs:
        out["fails"].append("no video stream"); out["ok"] = False; return out
    v = vs[0]; dur = float(info.get("format", {}).get("duration", 0) or 0)
    out.update({"seconds": round(dur, 2), "size": [v.get("width"), v.get("height")]})
    if (v.get("width"), v.get("height")) != (720, 1280):
        out["fails"].append(f"size {v.get('width')}x{v.get('height')} is not 720x1280")
    if dur < 8:
        out["fails"].append(f"only {dur:.1f} s long")
    if expect_seconds and abs(dur - expect_seconds) > max(1.5, expect_seconds * 0.05):
        out["warnings"].append(f"length {dur:.1f} s differs from the planned {expect_seconds:.1f} s")
    if dur > 62:
        out["warnings"].append(f"{dur:.0f} s is longer than a Short (60 s)")
    frames = [f for f in (_frame(path, dur * u) for u in (0.05, 0.25, 0.5, 0.75, 0.95)) if f is not None]
    if len(frames) < 3:
        out["fails"].append("could not read frames")
    else:
        means = [float(f.mean()) for f in frames]; out["frame_means"] = [round(m, 1) for m in means]
        if max(means) < 8:
            out["fails"].append("picture is black")
        diffs = [float(np.abs(a - b).mean()) for a, b in zip(frames, frames[1:])]
        out["frame_changes"] = [round(d, 1) for d in diffs]
        if max(diffs) < 0.5:
            out["fails"].append("picture never changes (frozen)")
    has_audio = any(s.get("codec_type") == "audio" for s in info.get("streams", []))
    if voice_expected:
        lvl = _audio_level(path) if has_audio else None
        out["audio_rms"] = None if lvl is None else round(lvl, 4)
        if not has_audio or lvl is None:
            out["fails"].append("no audio")
        elif lvl < 0.003:
            out["fails"].append("audio is silent")
        elif lvl > 0.5:
            out["warnings"].append("audio is very loud")
    out["ok"] = not out["fails"]; return out


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(); p.add_argument("video"); p.add_argument("--expect-seconds", type=float)
    a = p.parse_args(argv); r = check(Path(a.video), a.expect_seconds)
    print(json.dumps(r, indent=1)); print("VIDEO_OK=" + ("true" if r["ok"] else "false")); return 0


if __name__ == "__main__":
    sys.exit(main())
