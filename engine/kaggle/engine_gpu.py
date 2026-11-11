# Kaggle T4 render of ANY Remotion + three.js short in this repo.
# Tokens are replaced by the workflow: __MODE__ (test|full) __PROJECT__ (e.g. mine/railroads_remotion) __COMP__ (composition id)
# __TOTAL__ (frames) __PARTS__ __BRANCH__ __AUDIO__ (repo path or none) __ASS__ (repo path or none)
# Full mode: render parts (ONE browser tab, GL=angle-egl) -> join -> find bad frames -> re-render only those frames -> splice
# -> burn captions + mux audio (padded so no frame is cut) -> keep the file under ~92 MB. Result in /kaggle/working.
import subprocess, json, os, time, glob, shutil, sys
W = "/kaggle/working"; os.makedirs(W, exist_ok=True)
MODE = "__MODE__"; PROJECT = "__PROJECT__"; COMP = "__COMP__"; TOTAL = int("__TOTAL__"); PARTS = int("__PARTS__")
BRANCH = "__BRANCH__"; AUDIO = "__AUDIO__"; ASS = "__ASS__"
def sh(cmd, timeout=3600, show=2500):
    print("$", cmd, flush=True)
    try:
        r = subprocess.run(cmd, shell=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout); out = r.stdout
    except Exception as e:
        out = "EXC " + str(e)[:200]
    print(out[-show:], flush=True); return out
rep = {"mode": MODE, "project": PROJECT, "comp": COMP}
rep["gpu"] = sh("nvidia-smi --query-gpu=name,driver_version --format=csv,noheader").strip()
v = sh("nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -1").strip()
sh("cd /tmp && wget -q -O nv.run https://us.download.nvidia.com/XFree86/Linux-x86_64/%s/NVIDIA-Linux-x86_64-%s.run && sh nv.run --no-kernel-module --no-drm --no-x-check --no-nouveau-check --no-questions --silent --no-backup 2>&1 | tail -3" % (v, v), timeout=900)
rep["node"] = sh("node -v").strip()
sh("rm -rf /tmp/repo && git clone -q --depth 1 --branch %s https://github.com/damarlanandu2005-jpg/stickman-motion-studio /tmp/repo 2>&1 | tail -2" % BRANCH)
R = "/tmp/repo"; P = "%s/%s" % (R, PROJECT)
shutil.copy(R + "/engine/render.mjs", P + "/engine_render.mjs")
sh("cd %s && npm ci --no-audit --no-fund 2>&1 | tail -2" % P, timeout=1500)
sh("cd /tmp && npm init -y >/dev/null 2>&1; npm install playwright 2>&1 | tail -1; npx playwright install chromium 2>&1 | tail -1; npx playwright install-deps chromium 2>&1 | tail -1", timeout=1500)
chrome = (glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux/chrome")) + glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome")) + [""])[0]
rep["chrome"] = chrome
env = "cd %s && COMP=%s GL=angle-egl CHROME=%s CONC=1 " % (P, COMP, chrome)
os.makedirs(P + "/out", exist_ok=True)
def part(a, b, name):
    t = time.time(); sh("%s node engine_render.mjs part %d %d out/%s.mp4" % (env, a, b, name), timeout=40000, show=1500)
    return round(time.time() - t, 1)
if MODE == "test":
    t = part(40, 45, "test"); rep["test_s_total"] = t; rep["test_s_per_frame"] = round(t / 6, 2); rep["ok"] = os.path.exists(P + "/out/test.mp4")
    sh("%s node engine_render.mjs stills 40 out/g_ 0.5" % env)
    for f in glob.glob(P + "/out/g_*.jpg"): shutil.copy(f, W)
else:
    step = (TOTAL + PARTS - 1) // PARTS; t0 = time.time()
    for i in range(PARTS):
        a, b = i * step, min(TOTAL - 1, (i + 1) * step - 1)
        rep["part_%02d" % i] = part(a, b, "part_%02d" % i)
        json.dump(rep, open(W + "/render_result.json", "w"), indent=1)
    rep["total_s"] = round(time.time() - t0, 1)
    sh("mkdir -p /tmp/ff && cd /tmp/ff && npm init -y >/dev/null 2>&1; npm install --no-audit --no-fund ffmpeg-static 2>&1 | tail -1", timeout=600)
    FF = "/tmp/ff/node_modules/ffmpeg-static/ffmpeg"
    ins = " ".join("-i %s/out/part_%02d.mp4" % (P, i) for i in range(PARTS))
    fc = "".join("[%d:v]" % i for i in range(PARTS)) + "concat=n=%d:v=1:a=0[v]" % PARTS
    sh("cd %s && %s -y %s -filter_complex \"%s\" -map [v] -c:v libx264 -crf 12 -preset veryfast -pix_fmt yuv420p %s/out/silent.mp4 2>&1 | tail -2" % (R, FF, ins, fc, P), timeout=2400)
    sh("pip -q install numpy pillow 2>&1 | tail -1")
    os.environ["FFMPEG"] = FF; sys.path.insert(0, R + "/engine/tools"); import framecheck as fcx
    g = fcx.load(P + "/out/silent.mp4"); bad = sorted(fcx.find(g)); rep["bad_found"] = len(bad); rep["bad_list"] = bad[:200]; del g
    json.dump({"bad": bad}, open(P + "/out/bad.json", "w"))
    fixdir = P + "/out/fix"; os.makedirs(fixdir, exist_ok=True); todo = bad[:150]
    for attempt in range(3):
        if not todo: break
        for k in range(0, len(todo), 15):
            sh("%s node engine_render.mjs stills %s out/fix/fix_ 1" % (env, ",".join(map(str, todo[k:k + 15]))), timeout=3000, show=600)
        todo = [f for f in todo if not (os.path.exists("%s/fix_%d.jpg" % (fixdir, f)) and fcx.image_ok("%s/fix_%d.jpg" % (fixdir, f)))]
        for f in todo:
            try: os.remove("%s/fix_%d.jpg" % (fixdir, f))
            except Exception: pass
    rep["bad_unfixed"] = todo
    audio = AUDIO if AUDIO != "none" else ""; ass = ASS if ASS != "none" else ""
    for crf in (19, 23, 27):
        sh("cd %s && CRF=%d python3 engine/tools/repair_video.py %s/out/silent.mp4 %s/out/bad.json %s %s/final.mp4 %s %s %s %s 2>&1 | tail -3" % (R, crf, P, P, fixdir, W, audio or '""', ass or '""', R, FF), timeout=3600)
        rep["final_mb"] = round(os.path.getsize(W + "/final.mp4") / 1e6, 1); rep["crf"] = crf
        if rep["final_mb"] < 92: break
    g = fcx.load(W + "/final.mp4"); rem = sorted(fcx.find(g)); rep["bad_after_repair"] = len(rem); rep["bad_after_list"] = rem[:100]; rep["final_frames"] = len(g)
    rep["final_exists"] = os.path.exists(W + "/final.mp4")
json.dump(rep, open(W + "/render_result.json", "w"), indent=1)
print("FINAL " + json.dumps(rep))
