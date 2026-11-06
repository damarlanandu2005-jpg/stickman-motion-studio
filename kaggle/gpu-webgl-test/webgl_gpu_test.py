import subprocess, json, os, sys, shutil
def sh(cmd, timeout=900):
    print("$", cmd, flush=True)
    r = subprocess.run(cmd, shell=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout)
    print(r.stdout[-3000:], flush=True)
    return r.stdout
info = {}
info["nvidia_smi"] = sh("nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader")
info["vulkan_icd"] = sh("ls /usr/share/vulkan/icd.d /etc/vulkan/icd.d 2>&1; ls /usr/share/glvnd/egl_vendor.d 2>&1")
info["nvidia_libs"] = sh("ldconfig -p | grep -i -E 'libEGL_nvidia|libnvidia-glcore|libGLX_nvidia|libnvidia-vulkan|libvulkan' | head -20")
sh("pip install -q playwright 2>&1 | tail -2")
sh("playwright install chromium 2>&1 | tail -3")
sh("playwright install-deps chromium 2>&1 | tail -3", timeout=900)
sh("apt-get install -y -q xvfb libvulkan1 mesa-vulkan-drivers 2>&1 | tail -3", timeout=900)
here = os.path.dirname(os.path.abspath(__file__))
probe = os.path.join(here, "probe.py")
names = ["default_headless","headless_egl","newheadless_egl","newheadless_vulkan","newheadless_angle_gles","xvfb_angle_gl","xvfb_vulkan"]
results = []
for n in names:
    pre = "xvfb-run -a " if n.startswith("xvfb") else ""
    try:
        out = sh(f"{pre}python {probe} {n}", timeout=240)
    except Exception as e:
        out = "RESULT " + json.dumps({"variant": n, "error": "timeout/exception " + str(e)[:100]})
    for line in out.splitlines():
        if line.startswith("RESULT "):
            results.append(json.loads(line[7:]))
info["results"] = results
os.makedirs("/kaggle/working", exist_ok=True)
json.dump(info, open("/kaggle/working/result.json","w"), indent=1)
print("FINAL " + json.dumps(results))
