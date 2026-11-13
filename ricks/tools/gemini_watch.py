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
    key = None if os.environ.get("WATCH_VERTEX") == "1" else os.environ.get("GEMINI_API_KEY")
    if key:                                   # Developer API + Files API: upload the whole video (no tight size limit)
        import time
        os.environ.pop("GOOGLE_GENAI_USE_VERTEXAI", None)      # the Files API works only in Developer mode, not Vertex
        client = genai.Client(api_key=key, vertexai=False, http_options=types.HttpOptions(timeout=300000))
        with tempfile.TemporaryDirectory() as d:
            clip = os.path.join(d, "clip.mp4"); small(a.video, clip, mb=40)   # light downscale just to speed the upload
            up = client.files.upload(file=clip)
            for _ in range(60):
                if up.state and up.state.name == "ACTIVE": break
                if up.state and up.state.name == "FAILED": sys.exit("upload failed")
                time.sleep(2); up = client.files.get(name=up.name)
            for model in (MODEL, "gemini-2.5-flash", "gemini-2.0-flash"):
                try:
                    r = client.models.generate_content(model=model, contents=[up, a.prompt])
                    txt = r.text or "(no text)"; print("OK (API key) model=%s" % model, flush=True)
                    print("=== GEMINI WATCHED THE VIDEO ===\n" + txt)
                    if a.out: open(a.out, "w").write(txt)
                    return
                except Exception as e:
                    print("FAIL", model, repr(e)[:160], flush=True)
            sys.exit("API-key path failed on all models")
    proj = os.environ["GOOGLE_CLOUD_PROJECT"]
    loc = os.environ.get("VIDEO_LOCATION", "global")
    models = os.environ.get("WATCH_MODELS", "gemini-3.5-flash,gemini-3.1-pro-preview").split(",")
    hdr = {"x-goog-user-project": os.environ.get("USER_PROJECT", proj)}
    client = genai.Client(vertexai=True, project=proj, location=loc,
                          http_options=types.HttpOptions(timeout=300000, headers=hdr))
    with tempfile.TemporaryDirectory() as d:
        clip = os.path.join(d, "clip.mp4"); n = small(a.video, clip)
        print("compressed to %.1f MB, vertex location=%s" % (n / 1e6, loc), flush=True)
        data = open(clip, "rb").read()
        txt = None; last = None
        for model in models:
            try:
                part = types.Part.from_bytes(data=data, mime_type="video/mp4")
                r = client.models.generate_content(model=model, contents=[part, a.prompt])
                txt = r.text or "(no text)"; print("OK with location=%s model=%s" % (loc, model), flush=True); break
            except Exception as e:
                last = "%s / %s -> %s" % (loc, model, repr(e)[:200]); print("FAIL", last, flush=True)
    if txt is None:
        print("=== GEMINI COULD NOT WATCH (all combos failed) ===\nlast error: " + str(last))
        if a.out: open(a.out, "w").write("FAILED\n" + str(last))
        sys.exit(1)
    print("=== GEMINI WATCHED THE VIDEO ===\n" + txt)
    if a.out: open(a.out, "w").write(txt)

if __name__ == "__main__":
    main()
