# Kaggle P100 render of an inkbeat (Remotion + R3F) composition.
# DECISIVE TEST (2026-11-16): does Remotion's Chromium get HARDWARE WebGL on a P100 when the NVIDIA
# userspace driver is installed (the recipe that gives our Ricks engine 3.7 ms/frame vs 1100 ms on
# SwiftShader)? The old "inkbeat can't use the Kaggle GPU" conclusion was reached BEFORE that driver
# recipe existed - inkbeat only ever ran enable_gpu:false + software GL. This kernel installs the
# driver, proves hardware GL independently, then times a Remotion render with --gl=angle-egl.
# Tokens replaced by the workflow: __BRANCH__ __COMP__ __BLUR__
import subprocess, json, os, shutil, time
W = "/kaggle/working"; os.makedirs(W, exist_ok=True)
BRANCH = "__BRANCH__"; COMP = "__COMP__"; BLUR = "__BLUR__" == "1"
def sh(cmd, timeout=3600, show=2500, env=None):
    print("$", cmd, flush=True)
    try:
        r = subprocess.run(cmd, shell=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout, env=env); out = r.stdout
    except Exception as e:
        out = "EXC " + str(e)[:200]
    print(out[-show:], flush=True); return out
rep = {"engine": "inkbeat", "comp": COMP, "branch": BRANCH, "test": "p100-hardware-gl"}
rep["gpu"] = sh("nvidia-smi --query-gpu=name,driver_version --format=csv,noheader").strip()
v = sh("nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -1").strip()
# the exact Ricks recipe: userspace NVIDIA GL/EGL/Vulkan libs so Chromium can reach the GPU
sh("cd /tmp && wget -q -O nv.run https://us.download.nvidia.com/XFree86/Linux-x86_64/%s/NVIDIA-Linux-x86_64-%s.run && sh nv.run --no-kernel-module --no-drm --no-x-check --no-nouveau-check --no-questions --silent --no-backup 2>&1 | tail -3" % (v, v), timeout=900)
rep["node"] = sh("node -v").strip()
sh("rm -rf /tmp/repo && git clone -q --depth 1 --branch %s https://github.com/damarlanandu2005-jpg/stickman-motion-studio /tmp/repo 2>&1 | tail -2" % BRANCH)
P = "/tmp/repo/inkbeat"
sh("cd %s && npm ci --no-audit --no-fund 2>&1 | tail -3" % P, timeout=1800)
sh("cd %s && npx --yes playwright@1.56.0 install chromium 2>&1 | tail -2; npx --yes playwright@1.56.0 install-deps chromium 2>&1 | tail -1" % P, timeout=1500)
chrome = sh("find /root /home -path '*ms-playwright*' -name chrome -type f 2>/dev/null | head -1", show=300).strip().splitlines()
chrome = chrome[-1].strip() if chrome else ""
rep["chrome"] = chrome or "NOT_FOUND"
sh("which ffmpeg || (apt-get update -qq && apt-get install -y -qq ffmpeg) 2>&1 | tail -2", timeout=900)

# ---- STEP 1: prove hardware WebGL independently of Remotion, with the exact Ricks flags ----
probe = r'''
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined,
    args: ['--use-angle=gl-egl','--ignore-gpu-blocklist','--enable-gpu','--no-sandbox'] });
  const pg = await b.newPage();
  await pg.setContent('<canvas id=c></canvas>');
  const r = await pg.evaluate(() => {
    const gl = document.getElementById('c').getContext('webgl2') || document.getElementById('c').getContext('webgl');
    if (!gl) return 'NO_WEBGL';
    const e = gl.getExtension('WEBGL_debug_renderer_info');
    return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  console.log('GL_RENDERER ' + r);
  await b.close();
})().catch(e => { console.log('PROBE_ERR ' + String(e).slice(0,300)); process.exit(0); });
'''
open("/tmp/probe.js", "w").write(probe)
glr = sh("cd %s && CHROME='%s' node /tmp/probe.js 2>&1 | tail -4" % (P, chrome), timeout=300, show=600)
rep["gl_renderer"] = next((l.split("GL_RENDERER ", 1)[1].strip() for l in glr.splitlines() if "GL_RENDERER" in l), glr.strip()[-200:])
rep["hardware_gl"] = bool(rep["gl_renderer"]) and not any(s in rep["gl_renderer"].lower() for s in ("swiftshader", "llvmpipe", "software", "no_webgl"))

# ---- STEP 2: time a Remotion render with hardware GL (short Demo comp = 30 frames) ----
out = P + "/out"; os.makedirs(out, exist_ok=True)
be = ("--browser-executable='%s'" % chrome) if chrome else ""
def render(comp, mp4, gl, extra="", timeout=6000):
    log = "/tmp/rr_%s.log" % gl.replace("-", "")
    t = time.time()
    c = "cd %s && npx remotion render src/index.ts %s out/%s --gl=%s --chrome-mode=chrome-for-testing %s %s --timeout=300000 --concurrency=1 > %s 2>&1" % (P, comp, mp4, gl, be, extra, log)
    sh(c, timeout=timeout, show=120)
    dt = round(time.time() - t, 1)
    try: full = open(log).read(); tail = full[-1400:]
    except Exception: full = tail = ""
    errs = [l[:400] for l in full.splitlines() if ("Error" in l or "error" in l) and "node_modules" not in l][:12]
    ok = os.path.exists(out + "/" + mp4)
    return {"gl": gl, "comp": comp, "ok": ok, "total_s": dt, "tail": tail, "errors": errs,
            "size_mb": round(os.path.getsize(out + "/" + mp4) / 1e6, 1) if ok else 0}

# hardware first (angle-egl = Chrome --use-angle=gl-egl, the ricks path); record it
rep["demo_hw"] = render("Demo", "demo_hw.mp4", "angle-egl", timeout=4000)
# only bother with the full pilot on hardware if the Demo rendered fast (hardware actually engaged)
if rep["demo_hw"]["ok"] and rep["demo_hw"]["total_s"] < 300:
    rep["pilot_hw"] = render(COMP, "inkbeat_pilot.mp4", "angle-egl", timeout=20000)
    mp4 = out + "/inkbeat_pilot.mp4"
    if os.path.exists(mp4): shutil.copy(mp4, W + "/inkbeat_pilot.mp4")
else:
    # hardware didn't engage or was slow: capture the software baseline for an honest comparison
    rep["demo_sw"] = render("Demo", "demo_sw.mp4", "swangle", timeout=4000)

json.dump(rep, open(W + "/inkbeat_result.json", "w"), indent=1)
print("FINAL " + json.dumps({k: v for k, v in rep.items() if k not in ("demo_hw", "pilot_hw", "demo_sw")}))
for k in ("demo_hw", "pilot_hw", "demo_sw"):
    if k in rep: print(k, {kk: vv for kk, vv in rep[k].items() if kk != "tail"})
