import subprocess, json, os, base64, io, tarfile, time, shutil, glob
W = "/kaggle/working"; os.makedirs(W, exist_ok=True)
def sh(cmd, timeout=1800, show=3000):
    print("$", cmd, flush=True)
    try:
        r = subprocess.run(cmd, shell=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout); out = r.stdout
    except Exception as e:
        out = "EXC " + str(e)[:200]
    print(out[-show:], flush=True); return out
B64 = "__B64__"
rep = {}
os.makedirs("/tmp/proj", exist_ok=True)
tarfile.open(fileobj=io.BytesIO(base64.b64decode(B64)), mode="r:gz").extractall("/tmp/proj")
rep["gpu"] = sh("nvidia-smi --query-gpu=name,driver_version --format=csv,noheader").strip()
# 1. NVIDIA user-space 3D libs matching the kernel driver
v = sh("nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -1").strip()
sh("cd /tmp && wget -q -O nv.run https://us.download.nvidia.com/XFree86/Linux-x86_64/%s/NVIDIA-Linux-x86_64-%s.run && sh nv.run --no-kernel-module --no-drm --no-x-check --no-nouveau-check --no-questions --silent --no-backup 2>&1 | tail -3" % (v, v), timeout=900)
# 2. node + playwright + chromium
rep["node_before"] = sh("node -v 2>&1 | head -1").strip()
if "v" not in rep["node_before"][:2] or int(rep["node_before"][1:].split(".")[0] or 0) < 18:
    sh("curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>&1 | tail -2; apt-get install -y -q nodejs 2>&1 | tail -2", timeout=900)
rep["node"] = sh("node -v").strip()
sh("cd /tmp/proj && npm init -y >/dev/null 2>&1; npm install playwright 2>&1 | tail -2; npx playwright install chromium 2>&1 | tail -2; npx playwright install-deps chromium 2>&1 | tail -2", timeout=1500)
sh("mkdir -p /tmp/proj/web/lib /tmp/_three && cd /tmp/_three && npm pack three@0.160.0 >/dev/null 2>&1 && tar xzf three-0.160.0.tgz && cp package/build/three.module.js /tmp/proj/web/lib/")
N = int(sh("cd /tmp/proj && node -e \"import('./web/story.js').then(m=>console.log(m.TOTAL))\"").strip().split()[-1])
rep["total_frames"] = N
# 3. GPU render of a sample, then CPU render of a few frames on the same machine
def run(env, out, spec, step):
    t = time.time()
    o = sh("cd /tmp/proj && %s node render.mjs %s %s %d 0.9" % (env, out, spec, step), timeout=2400)
    return round(time.time() - t, 1), o
tg, og = run("GPU=1", "/tmp/proj/fgpu", "0-%d" % (N - 1), 1)
rep["gpu_total_s"] = tg; rep["gpu_frames"] = len(glob.glob("/tmp/proj/fgpu/*.jpg")); rep["gpu_s_per_frame"] = round(tg / max(1, rep["gpu_frames"]), 3)
rep["gl_renderer"] = next((l for l in og.splitlines() if "GL_RENDERER" in l), "")
tc, oc = run("", "/tmp/proj/fcpu", "0-%d" % (N - 1), 30)
rep["cpu_frames"] = len(glob.glob("/tmp/proj/fcpu/*.jpg")); rep["cpu_total_s"] = tc; rep["cpu_s_per_frame"] = round(tc / max(1, rep["cpu_frames"]), 3)
os.makedirs(W + "/sample", exist_ok=True)
for f in sorted(glob.glob("/tmp/proj/fgpu/f*.jpg"))[::150]:
    shutil.copy(f, W + "/sample/gpu_" + os.path.basename(f))
for f in sorted(glob.glob("/tmp/proj/fcpu/f*.jpg"))[:3]:
    shutil.copy(f, W + "/sample/cpu_" + os.path.basename(f))
json.dump(rep, open(W + "/render_result.json", "w"), indent=1)
print("FINAL " + json.dumps(rep))
