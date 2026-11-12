#!/usr/bin/env python3
"""Stop-frame gate, then full render, then numeric checks, for one Ricks-style project.

usage: python3 gate_render.py PROJECT_DIR OUT_DIR [--mode stills|full] [--scale 0.5] [--force]

PROJECT_DIR holds short.json (and audio/, puppets/, textures/, models/, bg/).
OUT_DIR gets: stills sheet, out.mp4 (full mode), result.json.
Full mode refuses to render when the stop-frame check flags anything, unless --force.
Environment is passed through, so RICKS_GL=t4 and RICKS_REQUIRE_GPU=1 reach render.mjs.
"""
import argparse, json, os, re, shutil, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))


def run(cmd, log):
    print("$", " ".join(cmd), flush=True)
    t = time.time()
    p = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    log.write("$ " + " ".join(cmd) + "\n" + p.stdout + "\n")
    print(p.stdout[-3000:], flush=True)
    return p.returncode, p.stdout, round(time.time() - t, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project"); ap.add_argument("out")
    ap.add_argument("--mode", default="stills", choices=["stills", "full"])
    ap.add_argument("--scale", type=float, default=None)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    scene = os.path.join(a.project, "short.json")
    if not os.path.exists(scene):
        sys.exit("no short.json in " + a.project)
    os.makedirs(a.out, exist_ok=True)
    mp4 = os.path.join(a.out, "out.mp4")
    res = {"project": a.project, "mode": a.mode, "gl_renderer": None}
    log = open(os.path.join(a.out, "log.txt"), "w")
    render = ["node", os.path.join(HERE, "render.mjs")]

    # 1. stop-frame gate
    rc, out, secs = run(render + [scene, mp4, "--stills"], log)
    m = re.search(r"GL_RENDERER (.*)", out)
    res["gl_renderer"] = m.group(1).strip() if m else None
    res["gate_seconds"] = secs
    m = re.search(r"(\d+) still\(s\) flagged", out)
    res["flagged"] = int(m.group(1)) if m else (0 if "no problems found" in out else None)
    res["flags"] = sorted(set(re.findall(r"\b(CAMERA_INSIDE_PROP|TARGET_HIDDEN_BEHIND_SET|TARGET_OFF_SCREEN|FLAT_FRAME|TOO_DARK|TOO_BRIGHT|PURE_BLACK)\b", out)))
    res["gate_ok"] = rc == 0 and res["flagged"] == 0
    if rc != 0:
        res["error"] = "stop-frame check failed to run (exit %d)" % rc

    if a.mode == "stills" or not (res["gate_ok"] or a.force):
        if a.mode == "full" and not res["gate_ok"]:
            res["stopped"] = "gate flagged problems; full render skipped (use --force to override)"
        json.dump(res, open(os.path.join(a.out, "result.json"), "w"), indent=1)
        print(json.dumps(res, indent=1))
        return 0 if res["gate_ok"] else 4

    # 2. full render
    cmd = render + [scene, mp4]
    if a.scale:
        cmd += ["--scale", str(a.scale)]
    rc, out, secs = run(cmd, log)
    res["render_seconds"] = secs
    res["render_ok"] = rc == 0 and os.path.exists(mp4)
    if res["render_ok"]:
        res["size_mb"] = round(os.path.getsize(mp4) / 1e6, 1)
        # 3. numeric checks: camera speed and zoom against the style ranges
        rc2, out2, _ = run([sys.executable, os.path.join(HERE, "shortkit.py"), "check", mp4], log)
        try:
            res["camera_check"] = json.loads(out2[out2.index("{"):out2.rindex("}") + 1])
        except Exception:
            res["camera_check"] = {"raw": out2[-400:]}
    json.dump(res, open(os.path.join(a.out, "result.json"), "w"), indent=1)
    print(json.dumps(res, indent=1))
    return 0 if res["render_ok"] else 5


if __name__ == "__main__":
    sys.exit(main())
