"""Turn a costume loop result (body_XX.png + manifest.json) into a full sprite folder the renderer can use.

The loop draws headless bodies only. Heads (8 faces) are borrowed from the stand-in character (cast file 'stand_in', else explorer).
A body pose the loop could not make is borrowed from the stand-in too. Everything borrowed is written to assembled.json, so the
morning report can say "costume X: heads borrowed from Y, poses 3,7 borrowed". Nothing here judges looks; a person does that later.

    assemble(loop_dir, name, assets2d, stand_in=None) -> dict   (writes assets2d/<name>/)
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

HEADS = ["angry", "happy", "laugh", "neutral", "sad", "scared", "smug", "surprised"]
POSES = 12


def stand_dir(assets2d: Path, stand_in: str | None) -> Path | None:
    for cand in ([f"role_{stand_in}", stand_in] if stand_in else []) + ["explorer"]:
        if cand and (assets2d / cand).is_dir():
            return assets2d / cand
    return None


def assemble(loop_dir: Path, name: str, assets2d: Path, stand_in: str | None = None) -> dict:
    loop_dir, assets2d = Path(loop_dir), Path(assets2d)
    src = stand_dir(assets2d, stand_in)
    report = {"costume": name, "stand_in": src.name if src else None, "bodies_from_loop": [], "bodies_borrowed": [], "heads_borrowed": [], "ok": False, "warnings": []}
    if src is None:
        report["warnings"].append("no stand-in folder found: cannot add heads"); return report
    own = sorted(int(p.stem.split("_")[1]) for p in loop_dir.glob("body_[0-9][0-9].png"))
    if not own:
        report["warnings"].append("loop made no body at all"); return report
    dest = assets2d / name
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    for i in range(POSES):
        f = loop_dir / f"body_{i:02d}.png"
        if f.exists():
            shutil.copy(f, dest / f.name); report["bodies_from_loop"].append(i)
        elif (src / f"body_{i:02d}.png").exists():
            shutil.copy(src / f"body_{i:02d}.png", dest / f"body_{i:02d}.png"); report["bodies_borrowed"].append(i)
        else:
            report["warnings"].append(f"pose {i} missing everywhere")
    for h in HEADS:
        f = src / f"head_{h}.png"
        if f.exists():
            shutil.copy(f, dest / f.name); report["heads_borrowed"].append(h)
        else:
            report["warnings"].append(f"head {h} missing in stand-in")
    if report["bodies_borrowed"]:
        report["warnings"].append(f"{len(report['bodies_borrowed'])} body poses borrowed from {src.name} (old outfit shows in those poses)")
    report["warnings"].append(f"heads borrowed from {src.name}")
    report["ok"] = len(list(dest.glob("body_*.png"))) == POSES and len(list(dest.glob("head_*.png"))) == len(HEADS)
    (dest / "assembled.json").write_text(json.dumps(report, indent=1))
    return report


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(); p.add_argument("--loop-dir", required=True); p.add_argument("--name", required=True)
    p.add_argument("--assets2d", default="animation/assets2d"); p.add_argument("--stand-in")
    a = p.parse_args(argv)
    r = assemble(Path(a.loop_dir), a.name, Path(a.assets2d), a.stand_in)
    print(json.dumps(r)); print("ASSEMBLED=" + ("true" if r["ok"] else "false")); return 0


if __name__ == "__main__":
    raise SystemExit(main())
