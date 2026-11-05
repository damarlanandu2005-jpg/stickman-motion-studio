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
SPRITES = ROOT / "animation" / "assets2d"      # character sprites + places: stored in the dataset as sprites__<path>
SPRITE_PREFIX = "sprites" + "__"
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


def sprite_files(sprites: Path) -> list[Path]:
    return sorted(p for p in Path(sprites).rglob("*") if p.is_file() and p.suffix in KEEP_SUFFIX) if Path(sprites).is_dir() else []


def stage_upload(lib: Path, stage: Path, owner: str, slug: str, sprites: Path | None = None) -> dict:
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
    sp = sprite_files(sprites) if sprites else []
    idx["sprites"] = {}
    for p in sp:
        rel = p.relative_to(sprites).as_posix()
        shutil.copy(p, stage / (SPRITE_PREFIX + flat_name(rel))); idx["sprites"][rel] = sha(p)
    for k, v in idx["items"].items():                         # every indexed file must be in the upload
        if flat_name(v["file"]) not in names:
            raise FileNotFoundError(f"index entry {k} points to {v['file']} which is not in the library folder")
    (stage / "index.json").write_text(json.dumps(idx, indent=1, sort_keys=True), encoding="utf-8")
    (stage / "dataset-metadata.json").write_text(json.dumps({"title": "Stickman assets", "id": f"{owner}/{slug}", "licenses": [{"name": "other"}]}), encoding="utf-8")
    return {"files": len(names), "items": len(idx["items"]), "sprites": len(sp)}


def unstage(flat_dir: Path, lib: Path, sprites: Path | None = None) -> int:
    """Flat dataset folder -> library folder layout. Returns number of files placed."""
    n = 0
    for p in sorted(Path(flat_dir).iterdir()):
        if not p.is_file() or p.name == "dataset-metadata.json":
            continue
        if p.name.startswith(SPRITE_PREFIX):
            if sprites is None:
                continue
            dst = Path(sprites) / rel_path(p.name[len(SPRITE_PREFIX):])
        else:
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
    """Owner of the dataset: DATASET_OWNER when set (the second Kaggle account is only a collaborator), else the logged-in account."""
    return (env.get("DATASET_OWNER") or env.get("KAGGLE_USERNAME") or "").strip()


def exists(owner: str, slug: str, runner: Runner = _run) -> bool | None:
    """Does the dataset exist?  True / False / None (could not ask). Asks for the dataset itself first (works for a shared dataset too)."""
    code, out = runner(["kaggle", "datasets", "status", f"{owner}/{slug}"])
    if code == 0 and "ready" in out.lower():
        return True
    if any(w in out.lower() for w in ("404", "not found", "could not find")):
        return False
    code, out = runner(["kaggle", "datasets", "list", "--mine", "-s", slug, "--csv"])
    if code != 0:
        return None
    return f"{owner}/{slug}".lower() in out.lower()


def down(owner: str, slug: str, lib: Path = LIB, runner: Runner = _run, sprites: Path | None = None, sleep=time.sleep) -> dict:
    """Pull the dataset. 'No dataset' is only believed when Kaggle's own list of my datasets confirms it: Kaggle also answers 403
    for a dataset that is only briefly unavailable (right after a new version), and a wrong 'no dataset' would start a bootstrap upload
    that overwrites the real dataset."""
    tmp = Path(tempfile.mkdtemp()); out = ""
    for attempt in range(4):
        code, out = runner(["kaggle", "datasets", "download", "-d", f"{owner}/{slug}", "-p", str(tmp), "--unzip", "-o"])
        if code == 0:
            n = unstage(tmp, lib, sprites)
            return {"ok": True, "no_dataset": False, "files": n}
        if not any(w in out.lower() for w in ("404", "not found", "could not find", "403", "forbidden")):
            break
        if attempt < 3:
            sleep(20)
    if any(w in out.lower() for w in ("404", "not found", "could not find", "403", "forbidden")) and exists(owner, slug, runner) is False:
        return {"ok": True, "no_dataset": True, "error": None}
    return {"ok": False, "no_dataset": False, "error": out[-300:]}


def up(owner: str, slug: str, message: str, lib: Path = LIB, runner: Runner = _run, sleep=time.sleep, wait_s: int = 600, sprites: Path | None = None) -> dict:
    stage = Path(tempfile.mkdtemp()) / "stage"
    stamp_hashes(lib)
    info = stage_upload(lib, stage, owner, slug, sprites)
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


def verify(lib: Path, ids: list[str], sprites: Path | None = None) -> dict:
    """The saved drawings are really in the library the code reads: index entry, file exists, size > 0, hash equals the one in the index."""
    if not (lib / "index.json").is_file():
        return {"ok": False, "checked": 0, "sprites_checked": 0, "problems": ["no index.json in the downloaded library"]}
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
    n_sp = 0
    if sprites is not None:                                   # every sprite listed in the index is here and intact
        for rel, h in json.loads((lib / "index.json").read_text()).get("sprites", {}).items():
            f = Path(sprites) / rel; n_sp += 1
            if not f.is_file() or sha(f) != h:
                bad.append(f"sprite {rel}: missing or changed")
    return {"ok": not bad, "checked": len(ids), "sprites_checked": n_sp, "problems": bad[:20]}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(); p.add_argument("cmd", choices=["down", "up", "verify"]); p.add_argument("--slug", default=SLUG_DEFAULT)
    p.add_argument("--message", default="assets update"); p.add_argument("--lib", default=str(LIB)); p.add_argument("--sprites", default=str(SPRITES)); p.add_argument("ids", nargs="*")
    a = p.parse_intermixed_args(argv); owner = owner_of(); lib = Path(a.lib)
    if a.cmd != "verify" and not owner:
        print("KAGGLE_USERNAME is not set"); return 2
    sp = Path(a.sprites)
    r = down(owner, a.slug, lib, sprites=sp) if a.cmd == "down" else up(owner, a.slug, a.message, lib, sprites=sp) if a.cmd == "up" else verify(lib, a.ids, sp)
    print(json.dumps(r)); 
    if a.cmd == "down" and r.get("no_dataset"):
        me = (os.environ.get("KAGGLE_USERNAME") or "").strip()
        if me and owner and me != owner:                # a collaborator account must never start (and overwrite) the owner's dataset
            print("REFUSED: dataset not visible to this account, not starting a new one"); return 1
        print("NO_DATASET=true")
    return 0 if r.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
