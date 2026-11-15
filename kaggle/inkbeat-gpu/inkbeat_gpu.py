# Kaggle CPU render of an inkbeat (Remotion + R3F) composition, to compare against the Ricks engine.
# Why no GPU: on the T4, Remotion's bundled headless Chrome could not create a WebGL context at all
# (crash in ~11s on both --gl=angle and --gl=swiftshader). So we drop the GPU (no T4x2 queue wait) and
# render with Playwright's Chromium, whose SwiftShader software GL is the exact binary that rendered the
# inkbeat stills in-container. Tokens replaced by the workflow: __BRANCH__ __COMP__ (composition id) __BLUR__ (0|1)
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
rep = {"engine": "inkbeat", "comp": COMP, "branch": BRANCH, "blur": BLUR, "gl_used": "swiftshader", "mode": "cpu+playwright-chromium"}
rep["cpu"] = sh("nproc").strip()
rep["node"] = sh("node -v").strip()
sh("rm -rf /tmp/repo && git clone -q --depth 1 --branch %s https://github.com/damarlanandu2005-jpg/stickman-motion-studio /tmp/repo 2>&1 | tail -2" % BRANCH)
P = "/tmp/repo/inkbeat"
sh("cd %s && npm ci --no-audit --no-fund 2>&1 | tail -3" % P, timeout=1800)
# Node Playwright's Chromium (its SwiftShader software GL is what rendered the inkbeat stills in-container;
# Remotion's own bundled Chrome crashes on Kaggle). Install node playwright, locate the binary with find.
sh("cd %s && npx --yes playwright@1.56.0 install chromium 2>&1 | tail -2; npx --yes playwright@1.56.0 install-deps chromium 2>&1 | tail -1" % P, timeout=1500)
chrome = sh("find /root /home -path '*ms-playwright*' -name chrome -type f 2>/dev/null | head -1", show=300).strip().splitlines()
chrome = chrome[-1].strip() if chrome else ""
rep["chrome"] = chrome or "NOT_FOUND"
sh("which ffmpeg || (apt-get update -qq && apt-get install -y -qq ffmpeg) 2>&1 | tail -2", timeout=900)
out = P + "/out"; os.makedirs(out, exist_ok=True)
be = ("--browser-executable='%s'" % chrome) if chrome else ""
log = "/tmp/rr.log"
t = time.time()
if BLUR:
    c = ("cd %s && npx remotion render src/index.ts %sSub out/sub.mp4 --gl=swiftshader --chrome-mode=chrome-for-testing %s --timeout=300000 --concurrency=4 > %s 2>&1; "
         "ffmpeg -v error -y -i out/sub.mp4 -vf \"tmix=frames=4:weights='1 1 1 1',select='not(mod(n+1\\,4))',setpts=N/30/TB\" -r 30 -c:v libx264 -crf 20 -pix_fmt yuv420p out/pilot.mp4") % (P, COMP, be, log)
else:
    c = "cd %s && npx remotion render src/index.ts %s out/pilot.mp4 --gl=swiftshader --chrome-mode=chrome-for-testing %s --timeout=300000 --concurrency=4 > %s 2>&1" % (P, COMP, be, log)
sh(c, timeout=40000, show=200)
rep["total_s"] = round(time.time() - t, 1)
try: rep["render_tail"] = open(log).read()[-1600:]
except Exception: rep["render_tail"] = ""
mp4 = P + "/out/pilot.mp4"
rep["ok"] = os.path.exists(mp4)
if rep["ok"]:
    rep["size_mb"] = round(os.path.getsize(mp4) / 1e6, 1)
    shutil.copy(mp4, W + "/inkbeat_pilot.mp4")
json.dump(rep, open(W + "/inkbeat_result.json", "w"), indent=1)
print("FINAL " + json.dumps(rep))
