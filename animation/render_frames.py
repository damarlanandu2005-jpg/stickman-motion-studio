"""Render a scene file to frames (and an MP4) in headless Chromium.

    python render_frames.py --scene scenes/alien_crystal_proof.json --out out/ [--width 1080 --height 1920]
                            [--frames 0,90,180] [--gl auto|gpu|software] [--no-video]

Runs from the animation/ folder (serves it over a local HTTP server). With --gl auto it tries GPU WebGL first and
records which renderer Chromium really used (WEBGL_debug_renderer_info), falling back to SwiftShader (CPU).
Writes render_report.json with per-frame timings; the report never claims GPU use unless the renderer string shows it.
"""
from __future__ import annotations

import argparse
import functools
import http.server
import json
import shutil
import socketserver
import subprocess
import sys
import threading
import time
from pathlib import Path

GL_MODES = {
    "gpu-egl": ["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu"],
    "gpu-vulkan": ["--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist", "--enable-gpu"],
    "software": ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
}
GPU_WORDS = ("nvidia", "tesla", "geforce", "quadro", "amd", "radeon", "intel")


def serve(root: Path) -> tuple[socketserver.TCPServer, int]:
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass
    handler = functools.partial(Quiet, directory=str(root))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def open_scene(pw, mode: str, url: str, scene: str, width: int, height: int):
    browser = pw.chromium.launch(channel="chromium", args=GL_MODES[mode])
    page = browser.new_page(viewport={"width": width, "height": height})
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)[:400]))
    page.on("console", lambda m: errors.append(m.text[:300]) if m.type == "error" else None)
    page.goto(url)
    page.wait_for_function("() => typeof window.__setup === 'function'", timeout=60000)
    info = page.evaluate("([s, w, h]) => window.__setup(s, w, h)", [scene, width, height])
    return browser, page, info, errors


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scene", required=True)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--width", type=int, default=1080)
    ap.add_argument("--height", type=int, default=1920)
    ap.add_argument("--frames", default="", help="comma list for stills only; default = every frame")
    ap.add_argument("--gl", default="auto", choices=["auto", "gpu", "software"])
    ap.add_argument("--no-video", action="store_true")
    ap.add_argument("--crf", type=int, default=18)
    ap.add_argument("--start", type=int, default=0, help="first frame (for split rendering)")
    ap.add_argument("--end", type=int, default=-1, help="one past the last frame; -1 = scene end")
    ap.add_argument("--video-name", default="render.mp4")
    args = ap.parse_args(argv)

    from playwright.sync_api import sync_playwright

    root = Path(__file__).resolve().parent
    args.out.mkdir(parents=True, exist_ok=True)
    report: dict = {"scene": args.scene, "width": args.width, "height": args.height, "attempts": [], "status": "running", "error": None}
    httpd, port = serve(root)
    url = f"http://127.0.0.1:{port}/index.html"
    order = {"auto": ["gpu-egl", "gpu-vulkan", "software"], "gpu": ["gpu-egl", "gpu-vulkan"], "software": ["software"]}[args.gl]
    started = time.monotonic()
    try:
        with sync_playwright() as pw:
            chosen = None
            for mode in order:
                try:
                    browser, page, info, errors = open_scene(pw, mode, url, args.scene, args.width, args.height)
                except Exception as exc:  # a GPU mode can fail to start; record it and try the next one
                    report["attempts"].append({"mode": mode, "ok": False, "error": f"{type(exc).__name__}: {exc}"[:400]})
                    continue
                gl = (info or {}).get("gl", {})
                is_gpu = any(w in str(gl.get("renderer", "")).lower() for w in GPU_WORDS) and "swiftshader" not in str(gl).lower()
                report["attempts"].append({"mode": mode, "ok": bool(info and info.get("ok")), "gl": gl, "gpu": is_gpu, "errors": errors[:5]})
                if not info or not info.get("ok"):
                    browser.close()
                    raise RuntimeError(f"scene setup failed: {info}")
                if mode.startswith("gpu") and not is_gpu:
                    browser.close()
                    continue
                chosen = (mode, browser, page, info, errors)
                break
            if not chosen:
                raise RuntimeError("no WebGL mode could render the scene")
            mode, browser, page, info, errors = chosen
            report.update(mode=mode, gl=info["gl"], gpu_used=report["attempts"][-1]["gpu"], warnings=info.get("warnings", []), events=info.get("events", []),
                          fps=info["fps"], total_frames=info["frames"])
            end = info["frames"] if args.end < 0 else min(args.end, info["frames"])
            frames = [int(x) for x in args.frames.split(",") if x.strip()] or list(range(args.start, end))
            if not frames:
                raise RuntimeError(f"no frames to render in range {args.start}..{end}")
            report.update(start=frames[0], end=frames[-1] + 1)
            canvas = page.locator("canvas")
            ffmpeg = None
            video = args.out / args.video_name
            if not args.frames and not args.no_video:
                exe = shutil.which("ffmpeg")
                if not exe:
                    raise RuntimeError("ffmpeg not found on PATH")
                ffmpeg = subprocess.Popen([exe, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(info["fps"]), "-c:v", "png", "-i", "-",
                                           "-c:v", "libx264", "-preset", "veryfast", "-crf", str(args.crf), "-pix_fmt", "yuv420p",
                                           "-movflags", "+faststart", str(video)], stdin=subprocess.PIPE)
            times = []
            for i, f in enumerate(frames):
                t0 = time.monotonic()
                page.evaluate("(f) => window.__render(f)", f)
                png = canvas.screenshot(type="png")
                times.append(round(time.monotonic() - t0, 3))
                if ffmpeg:
                    ffmpeg.stdin.write(png)
                else:
                    (args.out / f"still_{f:04d}.png").write_bytes(png)
                if i in (0, len(frames) // 2) or i == len(frames) - 1:
                    (args.out / f"still_{f:04d}.png").write_bytes(png)
                if i % 30 == 0:
                    print(f"frame {f} ({i + 1}/{len(frames)}) {times[-1]} s", flush=True)
            if ffmpeg:
                ffmpeg.stdin.close()
                if ffmpeg.wait() != 0:
                    raise RuntimeError("ffmpeg failed to encode the video")
                report["video"] = video.name
            report["page_errors"] = errors[:10]
            report["frames_rendered"] = len(frames)
            report["seconds_per_frame_mean"] = round(sum(times) / len(times), 3)
            report["seconds_per_frame_max"] = max(times)
            browser.close()
        report["status"] = "completed"
    except Exception as exc:
        report["status"] = "failed"
        report["error"] = f"{type(exc).__name__}: {exc}"
        print(report["error"], file=sys.stderr)
    finally:
        httpd.shutdown()
        report["render_seconds_total"] = round(time.monotonic() - started, 1)
        (args.out / "render_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps({k: v for k, v in report.items() if k != "attempts"}, indent=2))
    return 0 if report["status"] == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
