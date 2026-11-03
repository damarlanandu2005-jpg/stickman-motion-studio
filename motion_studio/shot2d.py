"""Flat 2D shot engine (reference-style Shorts): background picture + sprite character + slow camera + quick cuts.

Frames are pure functions of time: render_frame(t) never depends on an earlier frame. Characters are built from the
owner's picture library: a headless body sprite (one per pose) and a head sprite (one per expression, hat included).
No sound and no captions here (both are paused by the owner).

    python -m motion_studio.shot2d shots.json out.mp4
"""
from __future__ import annotations

import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

W, H, FPS = 720, 1280, 30
SS = 1.5  # scene is drawn 1.5x larger, then the camera crops and shrinks it, so zooms stay sharp
ROOT = Path(__file__).resolve().parents[1] / "animation" / "assets2d"


def _neck(body: Image.Image) -> tuple[int, int, int]:
    """(top row, shoulder row, neck centre x) of a headless body sprite."""
    a = np.array(body)[:, :, 3] > 0
    rows = a.sum(1)
    top = int(np.argmax(rows > 0))
    w0 = max(int(rows[top + 3]), 1)
    shoulder = top + 40
    for y in range(top + 3, len(rows)):
        if rows[y] > w0 * 2.2:
            shoulder = y
            break
    xs = np.nonzero(a[top + 2])[0]
    return top, shoulder, int(xs.mean())


class Library:
    def __init__(self, root: Path = ROOT, outfit: str = "explorer"):
        self.root, self.outfit = Path(root), outfit
        self.places = json.loads((self.root / "places" / "places.json").read_text())
        self._bg: dict[str, Image.Image] = {}
        self._body: dict[int, tuple] = {}
        self._head: dict[str, Image.Image] = {}
        self._cache: dict[tuple, Image.Image] = {}

    def bg(self, name: str) -> Image.Image:
        if name not in self._bg:
            im = Image.open(self.root / "places" / f"{name}.jpg").convert("RGB")
            self._bg[name] = im.resize((int(W * SS), int(H * SS)), Image.LANCZOS)
        return self._bg[name]

    def body(self, pose: int):
        if pose not in self._body:
            b = Image.open(self.root / self.outfit / (f"body_{pose:02d}.png" if isinstance(pose, int) else f"{pose}.png")).convert("RGBA")
            top, sh, nx = _neck(b)
            a = np.array(b)[:, :, 3] > 0
            ys, xs = np.nonzero(a[sh + 10:int(sh + 0.55 * (a.shape[0] - sh))])  # torso/hip area
            lean = math.degrees(math.atan2(nx - xs.mean(), ys.mean() + sh + 10 - top)) if len(xs) else 0.0
            self._body[pose] = (b, top, sh, nx, lean)
        return self._body[pose]

    def head(self, expr: str) -> Image.Image:
        if expr not in self._head:
            im = Image.open(self.root / self.outfit / f"head_{expr}.png").convert("RGBA")
            self._head[expr] = im.crop(im.getchannel("A").getbbox())
        return self._head[expr]

    def head_ref_width(self) -> int:
        return self.head("neutral").width


def draw_actor(lib: Library, scene: Image.Image, actor: dict, t: float, dur: float = 1.0) -> None:
    """Paint one character. actor: pose, x (0..1 of width), feet (0..1 of height), height (0..1 of height, headless body)."""
    pose = actor.get("pose", 0)
    for at, ps in actor.get("pose_seq", []):  # pose changes inside one shot
        if t >= at:
            pose = ps
    if actor.get("cycle"):  # walk/run cycle: a list of body pictures played in a loop while the character moves
        cyc = actor["cycle"]
        pose = cyc[int(t * actor.get("cycle_fps", 8)) % len(cyc)]
    expr = "neutral"
    for at, e in actor.get("faces", [[0, "neutral"]]):
        if t >= at:
            expr = e
    body, ntop, nshoulder, nx, lean = lib.body(pose)
    sw, sh = scene.size
    body_h = actor.get("height", 0.36) * sh
    k = body_h / body.height
    bob = math.sin(t * 2 * math.pi / 2.6) * 0.004 * sh
    flip = actor.get("flip", False)
    x_pos = actor.get("x", 0.5)
    sway = 0.0
    if "x1" in actor:  # walk or run across the shot, with step bounce and a little head sway
        u = min(max(t / actor.get("move_dur", dur), 0.0), 1.0)
        x_pos = actor["x"] + (actor["x1"] - actor["x"]) * u
        flip = actor["x1"] < actor["x"]
        stride = actor.get("stride", 2.2)  # steps per second
        bob = 0.0 if actor.get("cycle") else -abs(math.sin(t * math.pi * stride)) * 0.014 * sh
        sway = math.sin(t * math.pi * stride) * 3.0
    key = ("b", pose, round(k, 3), flip)
    if key not in lib._cache:
        b = body.resize((int(body.width * k), int(body.height * k)), Image.LANCZOS)
        lib._cache[key] = b.transpose(Image.FLIP_LEFT_RIGHT) if flip else b
    b = lib._cache[key]
    fx = x_pos * sw
    fy = actor.get("feet", 0.86) * sh + bob
    bx = int(fx - (b.width - nx * k if flip else nx * k))
    by = int(fy - b.height)
    shadow = Image.new("RGBA", scene.size, (0, 0, 0, 0))
    from PIL import ImageDraw
    ImageDraw.Draw(shadow).ellipse([fx - b.width * 0.35, fy - 14, fx + b.width * 0.35, fy + 16], fill=(0, 0, 0, 70))
    scene.alpha_composite(shadow) if scene.mode == "RGBA" else scene.paste(shadow, (0, 0), shadow)
    scene.paste(b, (bx, by), b)
    # head: width tied to the body height, chin just over the shoulders (bottom-centre of the sprite is the chin)
    fw = int(body_h * actor.get("head", 0.62))
    hk = fw / lib.head_ref_width()
    ang = round((-lean if flip else lean) * actor.get("tilt", 0.85) + sway)  # head follows the lean of the body
    hkey = ("h", expr, round(hk, 3), flip, ang)
    if hkey not in lib._cache:
        h = lib.head(expr)
        h = h.resize((max(int(h.width * hk), 1), max(int(h.height * hk), 1)), Image.LANCZOS)
        h = h.transpose(Image.FLIP_LEFT_RIGHT) if flip else h
        if ang:  # turn about the chin: pivot sits at the middle of a big canvas, then the canvas is turned
            L = max(h.size) * 2
            cv = Image.new("RGBA", (L * 2, L * 2), (0, 0, 0, 0))
            cv.paste(h, (L - h.width // 2, L - h.height))
            h = cv.rotate(-ang, Image.BICUBIC)  # screen-clockwise for a right lean
            h = h.crop(h.getchannel("A").getbbox() or (0, 0, 1, 1)) if False else h
        lib._cache[hkey] = h
    h = lib._cache[hkey]
    neck_x = bx + (b.width - nx * k if flip else nx * k)
    chin_y = by + (ntop + 0.9 * (nshoulder - ntop)) * k + 0.03 * fw
    chin_y += fw * 0.12 * min(abs(lean), 25) / 25  # leaning bodies: sink the head so the neck stays joined
    if ang:
        scene.paste(h, (int(neck_x - h.width / 2), int(chin_y - h.height / 2)), h)  # pivot is the canvas centre
    else:
        scene.paste(h, (int(neck_x - h.width / 2), int(chin_y - h.height)), h)


def render_frame(lib: Library, shot: dict, local_t: float) -> Image.Image:
    bg = lib.bg(shot["bg"])
    scene = bg.copy().convert("RGBA")
    for actor in shot.get("actors", []):
        draw_actor(lib, scene, actor, local_t, shot["dur"])
    cam = shot.get("cam", {})
    u = min(max(local_t / shot["dur"], 0.0), 1.0)
    u = u * u * (3 - 2 * u)  # ease in and out
    z = cam.get("z0", 1.0) + (cam.get("z1", 1.05) - cam.get("z0", 1.0)) * u
    fx = cam.get("x0", 0.5) + (cam.get("x1", 0.5) - cam.get("x0", 0.5)) * u
    fy = cam.get("y0", 0.5) + (cam.get("y1", 0.5) - cam.get("y0", 0.5)) * u
    cw, ch = scene.width / z, scene.height / z
    x0 = min(max(fx * scene.width - cw / 2, 0), scene.width - cw)
    y0 = min(max(fy * scene.height - ch / 2, 0), scene.height - ch)
    out = scene.convert("RGB").resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + cw, y0 + ch))
    for a, b, text, red in shot.get("caps", []):
        if a <= local_t < b:
            _caption(out, text, red)
    return out


_FONT = None


def _caption(im: Image.Image, text: str, red: bool, y: float = 0.68) -> None:
    """One word or short phrase, white with a black outline (red for the key word), at 68 % height like the reference shorts."""
    global _FONT
    from PIL import ImageDraw, ImageFont
    if _FONT is None:
        _FONT = ImageFont.truetype("/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf", 46)
    d = ImageDraw.Draw(im)
    text = text.upper()
    w = d.textlength(text, font=_FONT)
    d.text(((W - w) / 2, int(H * y)), text, font=_FONT, fill=(220, 30, 30) if red else (255, 255, 255),
           stroke_width=4, stroke_fill=(0, 0, 0))


def render_video(shots: list[dict], out: Path, root: Path = ROOT, outfit: str = "explorer", audio: Path | None = None) -> dict:
    lib = Library(root, outfit)
    total = sum(s["dur"] for s in shots)
    frames = int(round(total * FPS))
    cmd = ["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", *(["-i", str(audio)] if audio else []), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", *(["-c:a", "aac", "-b:a", "160k", "-shortest"] if audio else []), "-movflags", "+faststart", str(out)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    starts = []
    acc = 0.0
    for s in shots:
        starts.append(acc)
        acc += s["dur"]
    si = 0
    for f in range(frames):
        t = f / FPS
        while si + 1 < len(shots) and t >= starts[si + 1] - 1e-9:
            si += 1
        proc.stdin.write(np.asarray(render_frame(lib, shots[si], t - starts[si])).tobytes())
    proc.stdin.close()
    proc.wait()
    return {"frames": frames, "seconds": round(total, 2), "shots": len(shots), "fps": FPS}


if __name__ == "__main__":
    shots = json.loads(Path(sys.argv[1]).read_text())
    print(render_video(shots, Path(sys.argv[2])))
