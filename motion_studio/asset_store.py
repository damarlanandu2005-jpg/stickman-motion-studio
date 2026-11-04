"""Kaggle dataset as the asset store.  Pictures live in ONE private dataset (flat, ordered by file name); the code reads them from the
normal library folder (animation/asset_library/) after `down`.  Everything new is saved with `up`.

Layout in the dataset (flat, no folders; "__" stands for "/"):
    index.json                              id -> {type, tags, desc, file, ...}   (the map; sorted)
    backgrounds__<id>.png                   -> animation/asset_library/backgrounds/<id>.png
    objects__<id>.png                       -> animation/asset_library/objects/<id>.png
    costumes__<name>__body_00.png ...       -> animation/asset_library/costumes/<name>/body_00.png   (+ manifest.json, accepted_sheet.png)
    heads__<costume>__<expression>.png      -> animation/asset_library/heads/<costume>/<expression>.png

    python -m motion_studio.asset_store down    pull the dataset into the library folder   (prints NO_DATASET=true when it does not exist yet)
    python -m motion_studio.asset_store up      push the library folder as a new dataset version (creates it the first time), wait until ready
    python -m motion_studio.asset_store verify  ids ...   check that these ids are in the pulled library, files intact (hash from index)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "animation" / "asset_library"
SLUG_DEFAULT = "stickman-assets"
SEP = "__"
KEEP_SUFFIX = (".png", ".json", ".jpg")


def flat_name(rel: str) -> str:
    """'backgrounds/bg_x.png' -> 'backgrounds__bg_x.png'"""
    assert SEP not in rel.replace("/", ""), f"'__' is reserved in names: {rel}"
    return rel.replace("/", SEP)


def rel_path(flat: str) -> str:
    return flat.replace(SEP, "/")


def sha(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def library_files(lib: Path = LIB) -> list[Path]:
    return sorted(p for p in lib.rglob("*") if p.is_file() and p.suffix in KEEP_SUFFIX and p.name != "dataset-metadata.json")


def stage_upload(lib: Path, stage: Path, owner: str, slug: str) -> dict:
    """Flat copy of the whole library + dataset-metadata.json, ready for `kaggle datasets create/version`."""
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)
    names = []
    for p in library_files(lib):
        rel = p.relative_to(lib).as_posix()
        if rel == "index.json":
            continue
        shutil.copy(p, stage / flat_name(rel)); names.append(flat_name(rel))
    idx = json.loads((lib / "index.json").read_text()) if (lib / "index.json").exists() else {"items": {}}
    for k, v in idx["items"].items():                         # every indexed file must be in the upload
        if flat_name(v["file"]) not in names:
            raise FileNotFoundError(f"index entry {k} points to {v['file']} which is not in the library folder")
    (stage / "index.json").write_text(json.dumps(idx, indent=1, sort_keys=True), encoding="utf-8")
    (stage / "dataset-metadata.json").write_text(json.dumps({"title": "Stickman assets", "id": f"{owner}/{slug}", "licenses": [{"name": "other"}]}), encoding="utf-8")
    return {"files": len(names), "items": len(idx["items"])}


def unstage(flat_dir: Path, lib: Path) -> int:
    """Flat dataset folder -> library folder layout. Returns number of files placed."""
    n = 0
    for p in sorted(Path(flat_dir).iterdir()):
        if not p.is_file() or p.name == "dataset-metadata.json":
            continue
        dst = lib / rel_path(p.name)
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(p, dst); n += 1
    return n


def stamp_hashes(lib: Path) -> int:
    """Write the sha256 of every indexed file into the index (so a later check can prove the file is intact)."""
    f = lib / "index.json"; idx = json.loads(f.read_text()); n = 0
    for v in idx["items"].values():
        p = lib / v["file"]
        if p.is_file():
            v["sha256"] = sha(p); n += 1
    f.write_text(json.dumps(idx, indent=1, sort_keys=True), encoding="utf-8")
    return n


def merge_index(lib: Path, new_items: dict) -> None:
    """Add/replace entries in the library index (sorted, stable)."""
    f = lib / "index.json"
    idx = json.loads(f.read_text()) if f.exists() else {"items": {}}
    idx["items"].update(new_items)
    f.write_text(json.dumps(idx, indent=1, sort_keys=True), encoding="utf-8")


Runner = Callable[[list[str]], tuple[int, str]]


def _run(args: list[str]) -> tuple[int, str]:
    p = subprocess.run(args, capture_output=True, text=True)
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def owner_of(env=os.environ) -> str:
    return (env.get("KAGGLE_USERNAME") or "").strip()


def down(owner: str, slug: str, lib: Path = LIB, runner: Runner = _run) -> dict:
    tmp = Path(tempfile.mkdtemp())
    code, out = runner(["kaggle", "datasets", "download", "-d", f"{owner}/{slug}", "-p", str(tmp), "--unzip", "-o"])
    if code != 0:
        gone = any(w in out.lower() for w in ("404", "not found", "could not find", "403", "forbidden")   # Kaggle answers 403 for a dataset that does not exist yet)
        return {"ok": gone, "no_dataset": gone, "error": None if gone else out[-300:]}
    n = unstage(tmp, lib)
    return {"ok": True, "no_dataset": False, "files": n}


def up(owner: str, slug: str, message: str, lib: Path = LIB, runner: Runner = _run, sleep=time.sleep, wait_s: int = 600) -> dict:
    stage = Path(tempfile.mkdtemp()) / "stage"
    stamp_hashes(lib)
    info = stage_upload(lib, stage, owner, slug)
    code, out = runner(["kaggle", "datasets", "version", "-p", str(stage), "-m", message, "--dir-mode", "skip"])
    if code != 0:
        code, out = runner(["kaggle", "datasets", "create", "-p", str(stage), "--dir-mode", "skip"])
        info["created"] = True
    if code != 0:
        return {"ok": False, "error": out[-400:], **info}
    waited = 0
    while waited <= wait_s:                                   # a new version is usable only when Kaggle says ready
        c, s = runner(["kaggle", "datasets", "status", f"{owner}/{slug}"])
        if c == 0 and "ready" in s.lower():
            return {"ok": True, **info}
        sleep(15); waited += 15
    return {"ok": False, "error": "dataset not ready after waiting", **info}


def verify(lib: Path, ids: list[str]) -> dict:
    """The saved drawings are really in the library the code reads: index entry, file exists, size > 0, hash equals the one in the index."""
    idx = json.loads((lib / "index.json").read_text())["items"]
    bad = []
    for i in ids:
        v = idx.get(i)
        if not v:
            bad.append(f"{i}: not in index"); continue
        f = lib / v["file"]
        if not f.is_file() or f.stat().st_size == 0:
            bad.append(f"{i}: file missing {v['file']}"); continue
        if v.get("sha256") and sha(f) != v["sha256"]:
            bad.append(f"{i}: hash differs from the index")
    return {"ok": not bad, "checked": len(ids), "problems": bad}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(); p.add_argument("cmd", choices=["down", "up", "verify"]); p.add_argument("--slug", default=SLUG_DEFAULT)
    p.add_argument("--message", default="assets update"); p.add_argument("--lib", default=str(LIB)); p.add_argument("ids", nargs="*")
    a = p.parse_args(argv); owner = owner_of(); lib = Path(a.lib)
    if a.cmd != "verify" and not owner:
        print("KAGGLE_USERNAME is not set"); return 2
    r = down(owner, a.slug, lib) if a.cmd == "down" else up(owner, a.slug, a.message, lib) if a.cmd == "up" else verify(lib, a.ids)
    print(json.dumps(r)); 
    if a.cmd == "down" and r.get("no_dataset"):
        print("NO_DATASET=true")
    return 0 if r.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
