# Kaggle T4 render of an inkbeat (Remotion + R3F) composition, to compare against the Ricks engine.
# Tokens replaced by .github/workflows/inkbeat-kaggle.yml: __BRANCH__ __COMP__ (composition id) __BLUR__ (0|1)
# Steps: NVIDIA userspace driver -> clone branch -> npm ci in inkbeat/ -> remotion render on the GPU (--gl=angle)
# -> (optional) 4x motion blur via ffmpeg tmix -> copy mp4 + timing to /kaggle/working.
import subprocess, json, os, shutil, glob, time
W = "/kaggle/working"; os.makedirs(W, exist_ok=True)
BRANCH = "__BRANCH__"; COMP = "__COMP__"; BLUR = "__BLUR__" == "1"
def sh(cmd, timeout=3600, show=2500, env=None):
    print("$", cmd, flush=True)
    try:
        r = subprocess.run(cmd, shell=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout, env=env); out = r.stdout
    except Exception as e:
        out = "EXC " + str(e)[:200]
    print(out[-show:], flush=True); return out
rep = {"engine": "inkbeat", "comp": COMP, "branch": BRANCH, "blur": BLUR}
rep["gpu"] = sh("nvidia-smi --query-gpu=name,driver_version --format=csv,noheader").strip()
v = sh("nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -1").strip()
sh("cd /tmp && wget -q -O nv.run https://us.download.nvidia.com/XFree86/Linux-x86_64/%s/NVIDIA-Linux-x86_64-%s.run && sh nv.run --no-kernel-module --no-drm --no-x-check --no-nouveau-check --no-questions --silent --no-backup 2>&1 | tail -3" % (v, v), timeout=900)
rep["node"] = sh("node -v").strip()
sh("rm -rf /tmp/repo && git clone -q --depth 1 --branch %s https://github.com/damarlanandu2005-jpg/stickman-motion-studio /tmp/repo 2>&1 | tail -2" % BRANCH)
P = "/tmp/repo/inkbeat"
sh("cd %s && npm ci --no-audit --no-fund 2>&1 | tail -3" % P, timeout=1800)
sh("which ffmpeg || (apt-get update -qq && apt-get install -y -qq ffmpeg) 2>&1 | tail -2", timeout=900)
# a known-good Chromium (Playwright), like the ricks path; without --browser-executable Remotion fetches its own shell
sh("cd %s && npx playwright install chromium 2>&1 | tail -1; npx playwright install-deps chromium 2>&1 | tail -1" % P, timeout=1500)
CHROME = sh("cd %s && node -e \"const{chromium}=require('playwright-core');console.log(chromium.executablePath())\" 2>/dev/null || find /root/.cache/ms-playwright -name chrome -type f 2>/dev/null | head -1" % P).strip().splitlines()[-1] if True else ""
be = (" --browser-executable='%s'" % CHROME) if CHROME and "/" in CHROME else ""
out = P + "/out"; os.makedirs(out, exist_ok=True)
def render(gl, tag):
    log = "/tmp/rr_%s.log" % tag
    if BLUR:
        c = "cd %s && npx remotion render src/index.ts %sSub out/sub.mp4 --gl=%s%s --timeout=300000 --concurrency=2 > %s 2>&1; ffmpeg -v error -y -i out/sub.mp4 -vf \"tmix=frames=4:weights='1 1 1 1',select='not(mod(n+1\\,4))',setpts=N/30/TB\" -r 30 -c:v libx264 -crf 20 -pix_fmt yuv420p out/pilot.mp4" % (P, COMP, gl, be, log)
    else:
        c = "cd %s && npx remotion render src/index.ts %s out/pilot.mp4 --gl=%s%s --timeout=300000 --concurrency=2 > %s 2>&1" % (P, COMP, gl, be, log)
    sh(c, timeout=40000, show=200)
    return open(log).read() if os.path.exists(log) else ""
t = time.time()
rep["chrome"] = CHROME
log = render("angle", "angle")       # try the GPU path
rep["gl_used"] = "angle"
if not os.path.exists(P + "/out/pilot.mp4"):    # fall back to software so we still get the video, and record that GPU failed
    rep["angle_tail"] = log[-1800:]
    log = render("swiftshader", "sw"); rep["gl_used"] = "swiftshader"
rep["total_s"] = round(time.time() - t, 1)
rep["render_tail"] = log[-1800:]
rep["gl_renderer"] = sh("grep -hoiE 'angle \\(nvidia|tesla|swiftshader|llvmpipe|gl_renderer[^,]*' /tmp/rr_*.log 2>/dev/null | sort -u | tr '\\n' '|'").strip() or "n/a"
mp4 = P + "/out/pilot.mp4"
rep["ok"] = os.path.exists(mp4)
if rep["ok"]:
    rep["size_mb"] = round(os.path.getsize(mp4) / 1e6, 1)
    shutil.copy(mp4, W + "/inkbeat_pilot.mp4")
json.dump(rep, open(W + "/inkbeat_result.json", "w"), indent=1)
print("FINAL " + json.dumps(rep))
