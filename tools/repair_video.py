# Stream a silent video through python, replace bad frames with re-rendered stills, then encode with audio + captions.
# Usage: python repair_video.py silent.mp4 bad.json fixdir out.mp4 audio.m4a cap.ass repo_dir [ffmpeg]
import sys, json, subprocess, os
import numpy as np
from PIL import Image
silent, badjson, fixdir, out, audio, ass, repo = sys.argv[1:8]
FF = sys.argv[8] if len(sys.argv) > 8 else "ffmpeg"
W, H, FPS = 1080, 1920, 30
bad = set(json.load(open(badjson))["bad"])
n_total = int(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-count_packets", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", silent], capture_output=True, text=True).stdout.strip().split(",")[0])
dec = subprocess.Popen([FF, "-v", "error", "-i", silent, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
cmd = [FF, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-"]
if audio and os.path.exists(os.path.join(repo, audio)): cmd += ["-i", os.path.join(repo, audio)]
vf = f"ass={ass}" if ass else "null"
cmd += ["-vf", vf, "-map", "0:v:0"]
if audio: cmd += ["-map", "1:a:0", "-af", "apad", "-c:a", "aac"]
cmd += ["-frames:v", str(n_total), "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-pix_fmt", "yuv420p", os.path.abspath(out)]
enc = subprocess.Popen(cmd, stdin=subprocess.PIPE, cwd=repo)
size = W * H * 3; i = 0; fixed = 0; missing = []
while True:
    buf = dec.stdout.read(size)
    if len(buf) < size: break
    if i in bad:
        p = os.path.join(fixdir, f"fix_{i}.jpg")
        if os.path.exists(p):
            im = Image.open(p).convert("RGB")
            if im.size != (W, H): im = im.resize((W, H), Image.LANCZOS)
            buf = np.asarray(im, dtype=np.uint8).tobytes(); fixed += 1
        else: missing.append(i)
    enc.stdin.write(buf); i += 1
enc.stdin.close(); enc.wait(); dec.wait()
print(json.dumps({"frames_in": i, "frames_expected": n_total, "bad": len(bad), "fixed": fixed, "missing": missing}))
