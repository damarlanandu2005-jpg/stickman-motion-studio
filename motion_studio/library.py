"""Asset library: files live in a private Kaggle dataset, the catalog lives in GitHub (library/catalog.json).

    python -m motion_studio.library check   [--catalog library/catalog.json]   # local files match the catalog
    python -m motion_studio.library publish [--catalog ...] [--owner USER]     # create or version the Kaggle dataset
    python -m motion_studio.library verify  [--catalog ...] [--owner USER]     # download every file back, check hashes
    python -m motion_studio.library fetch ID [ID ...] --dest DIR [--owner USER] # get only what a scene needs

The catalog is the source of truth for what an asset is (kind, real height, tags, how it was made, licence and the
sha256 of the exact file). Kaggle stores the bytes. Every download is checked against the catalog hash, so a render
can never silently use a different file. Dataset file names are flat ("model__rocket.glb") because the Kaggle CLI
skips sub-folders by default.
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
import zipfile
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CATALOG = ROOT / "library" / "catalog.json"
KINDS = {"model", "card", "texture"}

Runner = Callable[[list[str]], tuple[int, str]]


def run(args: list[str]) -> tuple[int, str]:
    p = subprocess.run(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return p.returncode, p.stdout


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def load(path: Path = DEFAULT_CATALOG) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def check_catalog(cat: dict[str, Any], root: Path = ROOT) -> list[str]:
    """Plain-code checks: unique ids and file names, known kinds, models have a real height, local files match."""
    problems: list[str] = []
    ids, names = set(), set()
    for it in cat.get("items", []):
        i = it.get("id", "?")
        if i in ids: problems.append(f"duplicate id {i}")
        if it.get("file") in names: problems.append(f"duplicate file {it.get('file')}")
        ids.add(i); names.add(it.get("file"))
        if it.get("kind") not in KINDS: problems.append(f"{i}: unknown kind {it.get('kind')!r}")
        if "/" in str(it.get("file", "/")): problems.append(f"{i}: dataset file names must be flat (no '/')")
        if it.get("kind") == "model" and not (isinstance(it.get("height_m"), (int, float)) and it["height_m"] > 0):
            problems.append(f"{i}: models need a real height_m")
        for key in ("sha256", "bytes", "licence", "source", "tags", "local"):
            if key not in it: problems.append(f"{i}: missing {key}")
        local = root / str(it.get("local", ""))
        if not local.is_file():
            problems.append(f"{i}: local file {it.get('local')} is missing")
        elif sha256(local) != it.get("sha256"):
            problems.append(f"{i}: local file {it.get('local')} does not match the catalog hash")
    problems += check_sections(cat, root)
    return problems


def check_sections(cat: dict[str, Any], root: Path = ROOT) -> list[str]:
    """Character, motions and scenes are defined in code/scene files: every listed path must exist and every motion
    must really be handled by animation/src/motion.ts."""
    problems: list[str] = []
    ch = cat.get("character")
    if ch:
        if not (root / ch["code"]).is_file(): problems.append(f"character: {ch['code']} is missing")
        elif not (ch.get("height_m", 0) > 0): problems.append("character: needs height_m")
    code = (root / "animation/src/motion.ts")
    text = code.read_text(encoding="utf-8") if code.is_file() else ""
    seen = set()
    for m in cat.get("motions", []):
        if m["id"] in seen: problems.append(f"duplicate motion {m['id']}")
        seen.add(m["id"])
        if f'"{m["id"]}"' not in text and m["id"] not in ("walk", "run"):
            problems.append(f"motion {m['id']} is not in motion.ts")
    for it in cat.get("items", []):
        if it.get("behavior"):
            problems += check_behavior(root / it["behavior"], it["id"])
    sids = set()
    for sc in cat.get("scenes", []):
        if sc["id"] in sids: problems.append(f"duplicate scene {sc['id']}")
        sids.add(sc["id"])
        if sc.get("status") not in ("test", "episode-draft", "episode-legacy", "episode"):
            problems.append(f"scene {sc['id']}: unknown status {sc.get('status')!r}")
        if not (root / sc["file"]).is_file(): problems.append(f"scene {sc['id']}: {sc['file']} is missing")
    return problems


def check_behavior(path: Path, owner: str) -> list[str]:
    """A behavior file says what an object can do. Plain checks so a broken file never reaches a render."""
    if not path.is_file():
        return [f"{owner}: behavior file {path.name} is missing"]
    try:
        b = json.loads(path.read_text(encoding="utf-8"))
    except ValueError as e:
        return [f"{owner}: behavior file is not valid JSON ({e})"]
    p: list[str] = []
    if b.get("type") not in ("vehicle", "prop", "building"): p.append(f"{owner}: behavior type {b.get('type')!r} is unknown")
    parts = {x.get("id"): x for x in b.get("parts", [])}
    for pid, x in parts.items():
        lo, hi = x["region"]["min"], x["region"]["max"]
        if not all(0 <= a <= 1 for a in lo + hi) or any(a >= c for a, c in zip(lo, hi)): p.append(f"{owner}: part {pid} region must be a box inside 0..1")
        if not any(abs(v) > 0 for v in x.get("axis", [0, 0, 0])): p.append(f"{owner}: part {pid} needs a hinge axis")
        if not x.get("open_deg"): p.append(f"{owner}: part {pid} needs open_deg")
    for t in b.get("triggers", []):
        if t.get("part") not in parts: p.append(f"{owner}: trigger points to unknown part {t.get('part')}")
        if not t.get("within_m", 0) > 0: p.append(f"{owner}: trigger needs within_m")
    cr = b.get("crash")
    if cr:
        if not cr.get("min_speed_mps", 0) > 0: p.append(f"{owner}: crash needs min_speed_mps")
        for pid in cr.get("open_parts", []):
            if pid not in parts: p.append(f"{owner}: crash opens unknown part {pid}")
    return p


def dataset_ref(cat: dict[str, Any], owner: str) -> str:
    owner = owner.strip()
    if not owner or "/" in owner:
        raise ValueError("owner must be the Kaggle user name")
    return f"{owner}/{cat['dataset_slug']}"


def stage(cat: dict[str, Any], owner: str, dest: Path, root: Path = ROOT) -> Path:
    """Folder with the flat dataset files + dataset-metadata.json, ready for `kaggle datasets create/version`."""
    dest.mkdir(parents=True, exist_ok=True)
    for it in cat["items"]:
        shutil.copy2(root / it["local"], dest / it["file"])
    (dest / "dataset-metadata.json").write_text(json.dumps({
        "title": cat["title"], "id": dataset_ref(cat, owner), "licenses": [{"name": "other"}],
        "description": "Stickman Thoughts asset library. The catalog (what each file is, how it was made, licence, sha256) "
                       "is library/catalog.json in the GitHub repository; this dataset only stores the bytes.",
    }, indent=2), encoding="utf-8")
    return dest


def remote_status(ref: str, runner: Runner = run) -> str | None:
    code, out = runner(["kaggle", "datasets", "status", ref])
    if code != 0:
        return None
    return out.strip().splitlines()[-1].strip().lower() if out.strip() else None


def publish(cat: dict[str, Any], owner: str, message: str, runner: Runner = run, sleep=time.sleep,
            wait_s: int = 900, root: Path = ROOT) -> dict[str, Any]:
    ref = dataset_ref(cat, owner)
    with tempfile.TemporaryDirectory() as tmp:
        folder = stage(cat, owner, Path(tmp) / "stage", root)
        existing = remote_status(ref, runner)
        cmd = (["kaggle", "datasets", "version", "-p", str(folder), "-m", message, "-q"] if existing
               else ["kaggle", "datasets", "create", "-p", str(folder), "-q"])
        code, out = runner(cmd)
        if code != 0:
            raise RuntimeError(f"kaggle {'version' if existing else 'create'} failed: {out[-1500:]}")
    deadline = time.monotonic() + wait_s
    status = None
    while time.monotonic() < deadline:
        status = remote_status(ref, runner)
        if status == "ready":
            break
        if status and "error" in status:
            raise RuntimeError(f"dataset {ref} processing failed: {status}")
        sleep(15)
    if status != "ready":
        raise RuntimeError(f"dataset {ref} not ready after {wait_s} s (last status {status!r})")
    return {"dataset": ref, "action": "version" if existing else "create", "status": status, "files": len(cat["items"])}


def _download(ref: str, file: str, dest: Path, runner: Runner) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    code, out = runner(["kaggle", "datasets", "download", ref, "-f", file, "-p", str(dest), "-o", "-q"])
    if code != 0:
        raise RuntimeError(f"download of {file} failed: {out[-800:]}")
    target, zipped = dest / file, dest / (file + ".zip")
    if not target.exists() and zipped.exists():  # some file types arrive zipped
        with zipfile.ZipFile(zipped) as z:
            z.extract(file, dest)
        zipped.unlink()
    if not target.exists():
        raise RuntimeError(f"download of {file} produced no file")
    return target


def fetch(cat: dict[str, Any], owner: str, ids: list[str], dest: Path, runner: Runner = run) -> list[dict[str, Any]]:
    """Download only the named assets and refuse any whose bytes differ from the catalog."""
    by_id = {it["id"]: it for it in cat["items"]}
    missing = [i for i in ids if i not in by_id]
    if missing:
        raise KeyError(f"not in the catalog: {missing}")
    ref, got = dataset_ref(cat, owner), []
    for i in ids:
        it = by_id[i]
        path = _download(ref, it["file"], Path(dest), runner)
        digest = sha256(path)
        if digest != it["sha256"]:
            path.unlink()
            raise RuntimeError(f"{i}: downloaded file hash {digest[:12]} != catalog {it['sha256'][:12]}")
        got.append({"id": i, "file": str(path), "sha256": digest})
    return got


def _cli(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="library")
    ap.add_argument("action", choices=["check", "publish", "verify", "fetch"])
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    ap.add_argument("--owner", default=os.environ.get("KAGGLE_USERNAME", ""))
    ap.add_argument("--dest", type=Path, default=Path("library-download"))
    ap.add_argument("--message", default="Update asset library")
    args = ap.parse_args(argv)
    cat = load(args.catalog)
    problems = check_catalog(cat)
    if problems:
        print("CATALOG PROBLEMS:\n  " + "\n  ".join(problems), file=sys.stderr)
        return 1
    if args.action == "check":
        print(f"OK: {len(cat['items'])} catalog items match their local files")
        return 0
    if args.action == "publish":
        print(json.dumps(publish(cat, args.owner, args.message), indent=2))
        return 0
    ids = args.ids or [it["id"] for it in cat["items"]]
    got = fetch(cat, args.owner, ids, args.dest)
    print(json.dumps({"action": args.action, "verified": len(got), "items": got}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli())
