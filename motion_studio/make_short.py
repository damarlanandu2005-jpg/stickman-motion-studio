"""One command: script file -> checked scenes -> voice (natural speed) -> shots -> video.

    python -m motion_studio.make_short scripts_in/x.txt --models <kokoro folder> --out build/x.mp4

Stops before drawing anything if the script has errors. Warnings (placeholder background, stand-in costume, close-match background) are printed
and saved in the report: they are the honest list of what is not the real thing yet.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import script_reader as sr, shot2d, voice_first
from . import shot_planner as planner

ROOT = Path(__file__).resolve().parents[1]


def _with_sounds(shots: list, wav, work: Path):
    """Voice + the sounds the script asks for, in one wav. If mixing fails the voice alone is used (a short without effects beats no short)."""
    from . import sfx
    if not any(s.get("sfx") for s in shots):
        return wav
    try:
        return sfx.mix(shots, Path(wav), work / "voice_sfx.wav")
    except Exception as e:                          # noqa: BLE001
        print(f"sound mix failed, voice only: {e}"); return wav


def make(script_path: Path, models: Path, out: Path, root: Path = ROOT) -> dict:
    script = sr.parse_script(Path(script_path).read_text(encoding="utf-8"))
    cast_path = (root / script["cast"]) if script["cast"] else None
    if not cast_path or not cast_path.is_file():
        return {"ok": False, "stage": "cast", "errors": [f"cast file not found: {script['cast']!r}"]}
    cast = json.loads(cast_path.read_text(encoding="utf-8"))
    ir = sr.resolve(script, cast, root=root)
    if not ir["ok"]:
        return {"ok": False, "stage": "script", "errors": ir["errors"]}
    work = out.parent / (out.stem + "_work"); work.mkdir(parents=True, exist_ok=True)
    wav, durs, words, vreport = voice_first.synth_scenes(models, work, ir["scenes"], voice=ir["voice"])
    shots, warns = planner.plan_shots(ir, durs, words, cast, root)
    (work / "shots.json").write_text(json.dumps(shots, indent=1))
    wav = _with_sounds(shots, wav, work)
    video = shot2d.render_video(shots, out, root=root / "animation" / "assets2d", audio=wav)
    report = {"ok": True, "video": str(out), "render": video, "scenes": len(shots), "warnings": warns, "missing_assets": ir["missing_assets"],
              "missing_costumes": ir["missing_costumes"], "voice": vreport, "human_reviewed": False}
    (work / "report.json").write_text(json.dumps(report, indent=1))
    return report


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(); p.add_argument("script"); p.add_argument("--models", required=True); p.add_argument("--out", required=True)
    a = p.parse_args(argv); r = make(Path(a.script), Path(a.models), Path(a.out))
    print(json.dumps({k: v for k, v in r.items() if k != "voice"}, indent=1)); return 0 if r["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
