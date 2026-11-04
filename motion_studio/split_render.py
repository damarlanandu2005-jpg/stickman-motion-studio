"""Parallel render: one video is split into frame ranges, each range is rendered by its own job, ffmpeg joins them.

    prepare  script --models M --work DIR      script -> checked scenes -> voice -> shots  (DIR/shots.json, voice.wav, meta.json)
    plan     --work DIR [--parts N]            how many parts (auto by a time model) and which frames  (DIR/parts.json, prints the matrix)
    part     --work DIR --index I              render part I  (DIR/part_I.mp4, video only)
    merge    --work DIR --out FILE             join the parts, add the voice, check frame count and length

Why this is safe: every frame is a pure function of its own time, so frames [a, b) render the same alone or inside the whole video.
Parts are cut on exact frame numbers, encoded with the same settings, each starts on a keyframe, so `ffmpeg -c copy` joins them without re-encoding.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import time
from pathlib import Path

from . import script_reader as sr, shot2d, voice_first
from . import shot_planner as planner

ROOT = Path(__file__).resolve().parents[1]
SEC_PER_FRAME = 0.03        # measured on GitHub runners: 1211 frames in 35 s as one part (plain-ish backgrounds); the merge job prints real numbers
JOB_OVERHEAD_S = 60         # a render job also needs: start, checkout, unpack the inputs
MIN_GAIN_S = 15             # one more part must save at least this much, otherwise it is not worth a runner
MAX_PARTS = 10


def choose_parts(frames: int, sec_per_frame: float = SEC_PER_FRAME, min_gain: float = MIN_GAIN_S, max_parts: int = MAX_PARTS) -> int:
    """Smallest n where one more part saves less than `min_gain` seconds. Render time of n parts = frames*spf/n (parts run together)."""
    n = 1
    while n < max_parts and n < frames and frames * sec_per_frame / (n * (n + 1)) >= min_gain:
        n += 1
    return n


def split_frames(frames: int, n: int) -> list[dict]:
    """n ranges that cover [0, frames) exactly once; sizes differ by at most one frame."""
    n = max(1, min(n, frames)); base, extra = divmod(frames, n); out, s = [], 0
    for i in range(n):
        e = s + base + (1 if i < extra else 0)
        out.append({"index": i, "start": s, "end": e}); s = e
    return out


def prepare(script_path: Path, models: Path, work: Path, root: Path = ROOT) -> dict:
    script = sr.parse_script(Path(script_path).read_text(encoding="utf-8"))
    cast_path = (root / script["cast"]) if script["cast"] else None
    if not cast_path or not cast_path.is_file():
        return {"ok": False, "errors": [f"cast file not found: {script['cast']!r}"]}
    cast = json.loads(cast_path.read_text(encoding="utf-8")); ir = sr.resolve(script, cast, root=root)
    if not ir["ok"]:
        return {"ok": False, "errors": ir["errors"]}
    work.mkdir(parents=True, exist_ok=True)
    wav, durs, words, vreport = voice_first.synth_scenes(models, work, ir["scenes"], voice=ir["voice"])
    shots, warns = planner.plan_shots(ir, durs, words, cast, root)
    (work / "shots.json").write_text(json.dumps(shots, indent=1))
    total = sum(s["dur"] for s in shots); frames = int(round(total * shot2d.FPS))
    meta = {"ok": True, "title": ir["title"], "wav": str(Path(wav).name), "frames": frames, "fps": shot2d.FPS, "seconds": round(total, 2), "shots": len(shots),
            "warnings": warns, "missing_assets": ir["missing_assets"], "missing_costumes": ir["missing_costumes"], "human_reviewed": False}
    if Path(wav).resolve() != (work / "voice.wav").resolve():
        (work / "voice.wav").write_bytes(Path(wav).read_bytes())
    meta["wav"] = "voice.wav"
    (work / "meta.json").write_text(json.dumps(meta, indent=1))
    return meta


def plan(work: Path, parts: int | None = None) -> dict:
    meta = json.loads((work / "meta.json").read_text()); n = parts or choose_parts(meta["frames"])
    ranges = split_frames(meta["frames"], n)
    info = {"frames": meta["frames"], "parts": len(ranges), "ranges": ranges, "estimated_render_s_per_part": round(meta["frames"] / len(ranges) * SEC_PER_FRAME, 1),
            "estimated_single_job_s": round(meta["frames"] * SEC_PER_FRAME, 1), "chosen_by": "user" if parts else "time model"}
    (work / "parts.json").write_text(json.dumps(info, indent=1)); return info


def render_part(work: Path, index: int, root: Path = ROOT) -> dict:
    parts = json.loads((work / "parts.json").read_text())["ranges"]; r = parts[index]
    shots = json.loads((work / "shots.json").read_text()); t0 = time.time()
    res = shot2d.render_video(shots, work / f"part_{index}.mp4", root=root / "animation" / "assets2d", frame_start=r["start"], frame_end=r["end"])
    res.update({"index": index, "seconds_taken": round(time.time() - t0, 1), "start": r["start"], "end": r["end"]})
    (work / f"part_{index}.json").write_text(json.dumps(res)); return res


def _probe(path: Path, what: str) -> str:
    return subprocess.run(["ffprobe", "-v", "error", "-select_streams", what, "-count_frames", "-show_entries", "stream=nb_read_frames,duration",
                           "-of", "default=nw=1", str(path)], capture_output=True, text=True).stdout


def merge(work: Path, out: Path) -> dict:
    meta = json.loads((work / "meta.json").read_text()); parts = json.loads((work / "parts.json").read_text())["ranges"]
    files = [work / f"part_{r['index']}.mp4" for r in parts]
    missing = [f.name for f in files if not f.is_file()]
    if missing:
        return {"ok": False, "error": f"parts missing: {missing}"}
    lst = work / "parts.txt"; lst.write_text("".join(f"file '{f.resolve()}'\n" for f in files))
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-nostdin", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-i", str(work / meta["wav"]),
           "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", str(out)]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        return {"ok": False, "error": p.stderr[-400:]}
    vi = _probe(out, "v:0"); frames = int(next((l.split("=")[1] for l in vi.splitlines() if l.startswith("nb_read_frames")), "0"))
    ok = frames == meta["frames"]
    times = [json.loads((work / f"part_{r['index']}.json").read_text()).get("seconds_taken") for r in parts if (work / f"part_{r['index']}.json").exists()]
    return {"ok": ok, "frames_in_video": frames, "frames_expected": meta["frames"], "parts": len(parts), "part_seconds": times,
            "slowest_part_s": max(times) if times else None, "sum_of_parts_s": round(sum(times), 1) if times else None, "out": str(out),
            "error": None if ok else "frame count differs from the plan"}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(); p.add_argument("cmd", choices=["prepare", "plan", "part", "merge"]); p.add_argument("script", nargs="?")
    p.add_argument("--models"); p.add_argument("--work", required=True); p.add_argument("--parts", type=int); p.add_argument("--index", type=int); p.add_argument("--out")
    a = p.parse_args(argv); work = Path(a.work)
    if a.cmd == "prepare":
        r = prepare(Path(a.script), Path(a.models), work)
    elif a.cmd == "plan":
        r = plan(work, a.parts); print("MATRIX=" + json.dumps({"index": [x["index"] for x in r["ranges"]]}))
    elif a.cmd == "part":
        r = render_part(work, a.index)
    else:
        r = merge(work, Path(a.out))
    print(json.dumps(r)); return 0 if r.get("ok", True) else 1


if __name__ == "__main__":
    sys.exit(main())
