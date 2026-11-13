#!/usr/bin/env python3
"""Test 0 / dual-verify Part A: send a video to Gemini (Vertex) and have it watch the motion.
usage: gemini_watch.py video.mp4 [--out answer.txt] [--prompt "..."]
Compresses the clip small enough to send inline, then asks gemini-2.5-flash to describe the motion
and flag anything that flickers, disappears or looks broken, with timestamps."""
import os, sys, subprocess, tempfile, argparse
from google import genai
from google.genai import types

MODEL = os.environ.get("WATCH_MODEL", "gemini-2.5-flash")
DEFAULT = ("You are watching a short animated cartoon. Describe, in order with timestamps (M:SS), what happens: "
 "who is on screen, what they do, and the setting. Then, under a heading DEFECTS, list every moment where something "
 "flickers, disappears for a frame, floats, is cut off by the edge, or looks broken — each with a timestamp. "
 "If you see no defects, write 'DEFECTS: none'. Be specific and honest; do not invent a story.")

def small(src, dst, mb=15):
    # downscale to 480 wide, 12 fps, and pick a bitrate that lands near the size budget
    dur = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",src],
                               text=True, stdout=subprocess.PIPE).stdout.strip() or "55")
    kbps = max(200, int(mb * 8192 / dur) - 64)
    subprocess.run(["ffmpeg","-v","error","-y","-i",src,"-vf","scale=480:-2,fps=12","-c:v","libx264",
                    "-b:v","%dk"%kbps,"-an","-movflags","+faststart",dst], check=True)
    return os.path.getsize(dst)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("video"); ap.add_argument("--out"); ap.add_argument("--prompt", default=DEFAULT)
    a = ap.parse_args()
    proj = os.environ["GOOGLE_CLOUD_PROJECT"]
    combos = [(os.environ.get("VIDEO_LOCATION", "us-central1"), MODEL), ("us-central1", "gemini-2.5-flash"),
              ("us-central1", "gemini-2.0-flash-001"), ("us-east4", "gemini-2.5-flash"), ("us-central1", "gemini-flash-latest")]
    seen = []; combos = [c for c in combos if not (c in seen or seen.append(c))]
    with tempfile.TemporaryDirectory() as d:
        clip = os.path.join(d, "clip.mp4"); n = small(a.video, clip)
        print("compressed to %.1f MB" % (n / 1e6), flush=True)
        data = open(clip, "rb").read()
        txt = None; last = None
        for loc, model in combos:
            try:
                client = genai.Client(vertexai=True, project=proj, location=loc, http_options=types.HttpOptions(timeout=300000))
                part = types.Part.from_bytes(data=data, mime_type="video/mp4")
                r = client.models.generate_content(model=model, contents=[part, a.prompt])
                txt = r.text or "(no text)"; print("OK with location=%s model=%s" % (loc, model), flush=True); break
            except Exception as e:
                last = "%s / %s -> %s" % (loc, model, repr(e)[:160]); print("FAIL", last, flush=True)
    if txt is None:
        print("=== GEMINI COULD NOT WATCH (all combos failed) ===\nlast error: " + str(last))
        if a.out: open(a.out, "w").write("FAILED\n" + str(last))
        sys.exit(1)
    print("=== GEMINI WATCHED THE VIDEO ===\n" + txt)
    if a.out: open(a.out, "w").write(txt)

if __name__ == "__main__":
    main()
