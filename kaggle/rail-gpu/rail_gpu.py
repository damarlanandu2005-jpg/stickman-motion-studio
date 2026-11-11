# Kaggle T4 render of the railroad Remotion project. MODE is replaced by the workflow: test (6 frames, timing) or full (all frames).
import subprocess, json, os, time, glob, shutil
W = "/kaggle/working"; os.makedirs(W, exist_ok=True)
MODE = "__MODE__"; PARTS = int("__PARTS__")
def sh(cmd, timeout=3600, show=2500):
    print("$", cmd, flush=True)
    try:
        r = subprocess.run(cmd, shell=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout); out = r.stdout
    except Exception as e:
        out = "EXC " + str(e)[:200]
    print(out[-show:], flush=True); return out
rep = {"mode": MODE}
rep["gpu"] = sh("nvidia-smi --query-gpu=name,driver_version --format=csv,noheader").strip()
v = sh("nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -1").strip()
sh("cd /tmp && wget -q -O nv.run https://us.download.nvidia.com/XFree86/Linux-x86_64/%s/NVIDIA-Linux-x86_64-%s.run && sh nv.run --no-kernel-module --no-drm --no-x-check --no-nouveau-check --no-questions --silent --no-backup 2>&1 | tail -3" % (v, v), timeout=900)
rep["node"] = sh("node -v").strip()
sh("rm -rf /tmp/repo && git clone -q --depth 1 --branch gemini-cartoon https://github.com/damarlanandu2005-jpg/stickman-motion-studio /tmp/repo 2>&1 | tail -2")
P = "/tmp/repo/mine/railroads_remotion"
sh("cd %s && npm ci --no-audit --no-fund 2>&1 | tail -2" % P, timeout=1500)
sh("cd /tmp && npm init -y >/dev/null 2>&1; npm install playwright 2>&1 | tail -1; npx playwright install chromium 2>&1 | tail -1; npx playwright install-deps chromium 2>&1 | tail -1", timeout=1500)
chrome = (glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux/chrome")) + glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome")) + [""])[0]
rep["chrome"] = chrome
env = "cd %s && GL=angle-egl CHROME=%s CONC=2 " % (P, chrome)
os.makedirs(P + "/out", exist_ok=True)
def part(a, b, name):
    t = time.time()
    o = sh("%s node rail_render.mjs part %d %d out/%s.mp4" % (env, a, b, name), timeout=40000, show=1500)
    return round(time.time() - t, 1), o
if MODE == "test":
    t, o = part(40, 45, "test")
    rep["test_s_total"] = t; rep["test_frames"] = 6; rep["test_s_per_frame"] = round(t / 6, 2)
    rep["ok"] = os.path.exists(P + "/out/test.mp4")
    sh("cd %s && %s node rail_render.mjs stills 40,1330 out/g_ 0.5" % (P, env.split("&& ", 1)[1]))
    for f in glob.glob(P + "/out/g_*.jpg") + glob.glob(P + "/out/test.mp4"): shutil.copy(f, W)
else:
    N = 1701; step = (N + PARTS - 1) // PARTS; t0 = time.time()
    for i in range(PARTS):
        a, b = i * step, min(N - 1, (i + 1) * step - 1)
        t, o = part(a, b, "part_%02d" % i)
        rep["part_%02d" % i] = t
        json.dump(rep, open(W + "/render_result.json", "w"), indent=1)
    rep["total_s"] = round(time.time() - t0, 1)
    sh("mkdir -p /tmp/ff && cd /tmp/ff && npm init -y >/dev/null 2>&1; npm install --no-audit --no-fund ffmpeg-static 2>&1 | tail -1", timeout=600)
    FF = "/tmp/ff/node_modules/ffmpeg-static/ffmpeg"; R = "/tmp/repo"
    ins = " ".join("-i %s/out/part_%02d.mp4" % (P, i) for i in range(PARTS))
    fc = "".join("[%d:v]" % i for i in range(PARTS)) + "concat=n=%d:v=1:a=0[v]" % PARTS
    sh("cd %s && %s -y %s -i tools/a1_assets/audio.m4a -filter_complex \"%s;[v]ass=tools/a1_assets/cap.ass[o]\" -map [o] -map %d:a:0 -c:v libx264 -crf 20 -preset medium -c:a aac -shortest -pix_fmt yuv420p %s/final.mp4 2>&1 | tail -2" % (R, FF, ins, fc, PARTS, W), timeout=2400)
    rep["final_frames"] = sh("ffprobe -v error -select_streams v -count_packets -show_entries stream=nb_read_packets -of csv=p=0 %s/final.mp4 || true" % W).strip()
    rep["final_exists"] = os.path.exists(W + "/final.mp4")
json.dump(rep, open(W + "/render_result.json", "w"), indent=1)
print("FINAL " + json.dumps(rep))
