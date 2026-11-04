"""Asset library: every background, object and character picture is made ONCE, saved with tags, and reused in any video.

A video asks for what it needs (`ensure`). Assets already in the library are returned as they are (same pixels every time). Missing
ones become Kaggle jobs (`asset_jobs`); when the pictures come back, `ingest` saves them (objects are cut out onto transparent).
The library lives in the repo (animation/asset_library), not on Kaggle, because Kaggle keeps no files between runs.

Types:
  background  full 9:16 picture, NO characters
  object      one object on a plain white background -> cut out to transparent
  character   (later) one cast member in one pose + expression
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "animation" / "asset_library"
INDEX = ROOT / "index.json"
STYLE_FILE = ROOT.parent / "style" / "house_style.txt"
DEFAULT_STYLE = ("Flat 2D vector cartoon, thick clean dark outlines, clean flat colours with soft simple shading, in the same style as a stickman "
                 "explainer short. There is no character, no person, no face and no eyes in the picture. No text, no letters, no watermark, no frame.")


def style_text() -> str:
    """The channel's style text, added to EVERY picture prompt. The owner replaces animation/style/house_style.txt (for example once a week)."""
    try:
        t = STYLE_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        t = ""
    return " ".join(t.split()) or DEFAULT_STYLE


STYLE = DEFAULT_STYLE      # kept for old callers; new code uses style_text()
PROMPTS = {
    "background": "A vertical 9:16 background scene: {desc}. {style}",
    "object": "One single object only: {desc}. Shown from the front with a slight three-quarter view, centred, complete, on a pure plain white background, no floor, no shadow, no other objects. {style}",
}


def prompt_text(kind: str, desc: str) -> str:
    """The words sent to the model for a new picture. `desc` is the author's detailed text (script `draw:`) or, if there is none, the short `bg:` words."""
    return PROMPTS[kind].format(desc=desc.strip().rstrip("."), style=style_text())


def load() -> dict:
    return json.loads(INDEX.read_text()) if INDEX.exists() else {"items": {}}


def save(db: dict) -> None:
    INDEX.parent.mkdir(parents=True, exist_ok=True)
    INDEX.write_text(json.dumps(db, indent=1, sort_keys=True), encoding="utf-8")


def find(db: dict, tags: list[str], kind: str | None = None) -> list[str]:
    """Ids of assets that carry ALL the tags (best first: fewest extra tags)."""
    want = {t.lower() for t in tags}
    hits = [(len(set(v["tags"]) - want), k) for k, v in db["items"].items() if want <= set(v["tags"]) and (kind is None or v["type"] == kind)]
    return [k for _, k in sorted(hits)]


def ensure(db: dict, needs: list[dict]) -> tuple[dict[str, str], list[dict]]:
    """needs: [{"id": wanted name, "type": "background"|"object", "tags": [...], "desc": "..."}]
    Returns (name -> library id for what exists, list of missing needs)."""
    have, missing = {}, []
    for n in needs:
        if n["id"] in db["items"]:
            have[n["id"]] = n["id"]
            continue
        hit = find(db, n["tags"], n["type"])
        if hit:
            have[n["id"]] = hit[0]
        else:
            missing.append(n)
    return have, missing


def asset_jobs(missing: list[dict], seed0: int = 7100) -> dict:
    jobs = []
    for i, n in enumerate(missing):
        jobs.append({"id": n["id"], "prompt": prompt_text(n["type"], n["desc"]), "refs": [], "seed": seed0 + i, "width": 576, "height": 1024})
    return {"jobs": jobs}


def cutout(path: Path, out: Path) -> Path:
    """White background -> transparent (flood from the border, so white inside the object stays), then crop to the object."""
    import numpy as np
    from scipy import ndimage as ndi
    a = np.array(Image.open(path).convert("RGB")).astype(int)
    lab, _ = ndi.label(a.min(2) > 235)
    edge = (set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1])) - {0}
    fg = ndi.binary_opening(~np.isin(lab, list(edge)), iterations=1)
    im = Image.fromarray(np.dstack([a.astype(np.uint8), (fg * 255).astype(np.uint8)]))
    bbox = im.getchannel("A").getbbox()
    im = im.crop(bbox) if bbox else im
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out)
    return out


def ingest(db: dict, missing: list[dict], pictures: Path, run: str = "") -> list[str]:
    """Save the drawn pictures into the library. Returns ids that were saved."""
    saved = []
    for n in missing:
        src = pictures / f"pose_{n['id']}.png"
        if not src.exists():
            continue
        sub = "backgrounds" if n["type"] == "background" else "objects"
        dst = ROOT / sub / f"{n['id']}.png"
        if n["type"] == "object":
            cutout(src, dst)
        else:
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(src.read_bytes())
        db["items"][n["id"]] = {"type": n["type"], "tags": sorted({t.lower() for t in n["tags"]}), "file": f"{sub}/{n['id']}.png",
                                "desc": n["desc"], "run": run}
        saved.append(n["id"])
    save(db)
    return saved


def path_of(db: dict, lib_id: str) -> Path:
    return ROOT / db["items"][lib_id]["file"]
