# Kaggle T4 render of a Ricks-style Short (flat 2D puppets in a three.js 3D set).
# Tokens replaced by .github/workflows/ricks-kaggle.yml: __MODE__ (stills|full) __PROJECT__ (repo path with short.json)
# __BRANCH__ __SCALE__ (0 = full size) __FORCE__ (0|1)
# Steps: NVIDIA userspace driver (the recipe proven in kaggle/gpu-webgl-test) -> clone branch -> npm ci + chromium
# -> ricks/stage/gate_render.py (stop-frame gate, then render, then camera check) -> copy results to /kaggle/working.
import subprocess, json, os, shutil, glob, time
W = "/kaggle/working"; os.makedirs(W, exist_ok=True)
MODE = "__MODE__"; PROJECT = "__PROJECT__"
if "/" not in PROJECT: PROJECT = "ricks/projects/" + PROJECT
BRANCH = "__BRANCH__"; SCALE = float("__SCALE__"); FORCE = "__FORCE__" == "1"
def sh(cmd, timeout=3600, show=2500, env=None):
    print("$", cmd, flush=True)
    try:
        r = subprocess.run(cmd, shell=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout, env=env); out = r.stdout
    except Exception as e:
        out = "EXC " + str(e)[:200]
    print(out[-show:], flush=True); return out
rep = {"mode": MODE, "project": PROJECT, "branch": BRANCH}
rep["gpu"] = sh("nvidia-smi --query-gpu=name,driver_version --format=csv,noheader").strip()
v = sh("nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -1").strip()
# userspace NVIDIA GL/EGL/Vulkan libs: without them Chromium falls back to SwiftShader (about 1100 ms per full-frame pass vs 3.7 ms on the T4)
sh("cd /tmp && wget -q -O nv.run https://us.download.nvidia.com/XFree86/Linux-x86_64/%s/NVIDIA-Linux-x86_64-%s.run && sh nv.run --no-kernel-module --no-drm --no-x-check --no-nouveau-check --no-questions --silent --no-backup 2>&1 | tail -3" % (v, v), timeout=900)
rep["node"] = sh("node -v").strip()
sh("rm -rf /tmp/repo && git clone -q --depth 1 --branch %s https://github.com/damarlanandu2005-jpg/stickman-motion-studio /tmp/repo 2>&1 | tail -2" % BRANCH)
R = "/tmp/repo"; S = R + "/ricks/stage"
sh("cd %s && npm ci --no-audit --no-fund 2>&1 | tail -2" % S, timeout=1500)
sh("cd %s && npx playwright install chromium 2>&1 | tail -1; npx playwright install-deps chromium 2>&1 | tail -1" % S, timeout=1500)
sh("which ffmpeg || (apt-get update -qq && apt-get install -y -qq ffmpeg) 2>&1 | tail -2", timeout=900)
sh("pip -q install numpy pillow scipy opencv-python-headless 2>&1 | tail -1", timeout=900)
env = dict(os.environ, RICKS_GL="t4", RICKS_REQUIRE_GPU="1", RICKS_CRF="21", RICKS_PRESET="medium")
OUT = "/tmp/ricks_out"; os.makedirs(OUT, exist_ok=True)
cmd = "cd %s && python3 gate_render.py %s/%s %s --mode %s" % (S, R, PROJECT, OUT, MODE)
if SCALE: cmd += " --scale %s" % SCALE
if FORCE: cmd += " --force"
t = time.time(); sh(cmd, timeout=40000, show=4000, env=env); rep["total_s"] = round(time.time() - t, 1)
try: rep["result"] = json.load(open(OUT + "/result.json"))
except Exception as e: rep["result"] = {"error": "no result.json: " + str(e)[:120]}
big = OUT + "/out.mp4"                       # git refuses files over 100 MB: re-encode the render smaller when needed
if os.path.exists(big) and os.path.getsize(big) > 90e6:
    sh("ffmpeg -v error -y -i %s -c:v libx264 -crf 24 -preset medium -pix_fmt yuv420p -c:a copy -movflags +faststart %s/small.mp4 && mv %s/small.mp4 %s" % (big, OUT, OUT, big), timeout=1800)
    rep["compressed_mb"] = round(os.path.getsize(big) / 1e6, 1) if os.path.exists(big) else None
for f in glob.glob(OUT + "/out_stills/*") + glob.glob(OUT + "/*.mp4") + glob.glob(OUT + "/*.json") + glob.glob(OUT + "/log.txt"):
    shutil.copy(f, W)
json.dump(rep, open(W + "/render_result.json", "w"), indent=1)
print("FINAL " + json.dumps(rep))
