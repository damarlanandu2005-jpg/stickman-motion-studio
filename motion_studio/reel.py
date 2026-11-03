"""Reel renderer: a list of shots, each either a full scene PICTURE (from the Kaggle scene batch) or a sprite shot
(shot2d: background + actors). Camera move, shake, captions and code-made object sounds per shot.

shot = {"image": "path.png" | "bg": ..., "actors": [...], "dur": s, "cam": {z0,z1,x0,x1,y0,y1}, "shake": 0..1,
        "caps": [[start,end,text,red]], "sfx": [{"t": s, "type": "boom", "gain": 0.5}]}
"""
from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

from . import shot2d
from .shot2d import FPS, H, W, _caption

_IMG: dict[str, Image.Image] = {}


def _picture(path: str) -> Image.Image:
    if path not in _IMG:
        im = Image.open(path).convert("RGB")
        scale = max(W / im.width, H / im.height) * 1.5  # draw 1.5x so zooms stay as sharp as the source allows
        _IMG[path] = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    return _IMG[path]


def render_still(shot: dict, t: float) -> Image.Image:
    im = _picture(shot["image"])
    cam = shot.get("cam", {})
    u = min(max(t / shot["dur"], 0.0), 1.0)
    u = u * u * (3 - 2 * u)
    z = cam.get("z0", 1.0) + (cam.get("z1", 1.06) - cam.get("z0", 1.0)) * u
    fx = cam.get("x0", 0.5) + (cam.get("x1", 0.5) - cam.get("x0", 0.5)) * u
    fy = cam.get("y0", 0.5) + (cam.get("y1", 0.5) - cam.get("y0", 0.5)) * u
    base_w = im.height * W / H if im.width / im.height > W / H else im.width  # fit-to-cover window at z = 1
    cw = base_w / z
    ch = cw * H / W
    sh = shot.get("shake", 0.0)
    dx = np.sin(t * 47.0) * sh * 0.006 * im.width
    dy = np.cos(t * 39.0) * sh * 0.006 * im.height
    x0 = min(max(fx * im.width - cw / 2 + dx, 0), im.width - cw)
    y0 = min(max(fy * im.height - ch / 2 + dy, 0), im.height - ch)
    return im.resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + cw, y0 + ch))


def render_shot_frame(lib, shot: dict, t: float) -> Image.Image:
    if "image" in shot:
        out = render_still(shot, t)
        for a, b, text, red in shot.get("caps", []):
            if a <= t < b:
                _caption(out, text, red, shot.get("cap_y", 0.68))
        return out
    return shot2d.render_frame(lib, shot, t)


def render_reel(shots: list[dict], out: Path, audio: Path | None = None, outfit: str = "explorer") -> dict:
    lib = shot2d.Library(shot2d.ROOT, outfit)
    total = sum(s["dur"] for s in shots)
    frames = int(round(total * FPS))
    cmd = ["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           *(["-i", str(audio)] if audio else []), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
           *(["-c:a", "aac", "-b:a", "160k", "-shortest"] if audio else []), "-movflags", "+faststart", str(out)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    starts, acc = [], 0.0
    for s in shots:
        starts.append(acc)
        acc += s["dur"]
    si = 0
    for f in range(frames):
        t = f / FPS
        while si + 1 < len(shots) and t >= starts[si + 1] - 1e-9:
            si += 1
        proc.stdin.write(np.asarray(render_shot_frame(lib, shots[si], t - starts[si])).tobytes())
    proc.stdin.close()
    proc.wait()
    return {"frames": frames, "seconds": round(total, 2), "shots": len(shots), "fps": FPS}
