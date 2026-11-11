# Build the verifier's review material from a rendered video: 3 frames per scene (start, middle, end) and side-by-side
# sheets against reference frames (5 scenes per sheet).  Reference frames are private: pass local paths, never commit them.
# Usage: python make_sheets.py video.mp4 shots.json outdir --ref r1.jpg r2.jpg ... [--ffmpeg PATH] [--per 5] [--h 300]
import sys, os, json, subprocess
args = sys.argv[1:]; video, shots, out = args[0], json.load(open(args[1])), args[2]
ref, ff, per, h, cur = [], "ffmpeg", 5, 300, None; i = 3
while i < len(args):
    if args[i] == "--ref": cur = "ref"
    elif args[i] == "--ffmpeg": ff = args[i + 1]; i += 1; cur = None
    elif args[i] == "--per": per = int(args[i + 1]); i += 1; cur = None
    elif args[i] == "--h": h = int(args[i + 1]); i += 1; cur = None
    elif cur == "ref": ref.append(args[i])
    i += 1
os.makedirs(out + "/frames", exist_ok=True); here = os.path.dirname(os.path.abspath(__file__)); made = []
for s in shots["shots"]:
    row = []
    for f in (s["a"] + 4, (s["a"] + s["b"]) // 2, s["b"] - 4):
        p = f"{out}/frames/c{s['id']}_{f}.jpg"
        subprocess.run([ff, "-y", "-v", "error", "-i", video, "-vf", f"select=eq(n\\,{f}),scale=360:-1", "-frames:v", "1", p], check=False)
        row.append(p)
    made.append(row)
for k in range(0, len(made), per):
    ours = [p for r in made[k:k + per] for p in r]
    cmd = [sys.executable, here + "/sbs_sheet.py", f"{out}/sbs_{k // per + 1}.jpg", "--ours"] + ours + (["--ref"] + ref if ref else []) + ["--h", str(h)]
    subprocess.run(cmd, check=False)
print("sheets in", out)
