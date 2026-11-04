"""Automatic costume acceptance: no person approves each sheet. Code scores every pose, keeps the best passing pose from all
candidate sheets, saves accepted poses for reuse, and writes redraw jobs for the poses that still fail.

    score_pose(...)            one pose of one drawn sheet -> numbers + pass flag + reasons
    pick_best(...)             per pose: best passing candidate over several sheets (and earlier accepted poses)
    save_accepted(...)         accepted cut-outs + assembled sheet + manifest under animation/costumes/<name>/
    redraw_jobs(...)           jobs.json entries (new seeds, accepted sheet as 2nd reference) for the failed poses only

Honest limit: the checks measure size, silhouette, outline, colour and stray white limbs. They cannot judge taste. The manifest says
'auto_accepted', never 'human reviewed'.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

from . import costume_check as cc

SIL_OVERLAP, SIL_COVER = 0.80, 0.85


def stray_white(rgba: Image.Image) -> list[str]:
    """White parts that are not hands or neck: a long white blob (bare shin) or white leg sticks under the shorts."""
    a = np.asarray(rgba)
    m = ndi.binary_fill_holes(a[:, :, 3] > 0)
    if not m.any():
        return []
    ys, xs = np.nonzero(m); h = ys.max() - ys.min() + 1; y0 = ys.min()
    white = ndi.binary_opening((a[:, :, :3].min(2) > 205) & m, iterations=2)
    lab, n = ndi.label(white)
    why = []
    for k in range(1, n + 1):
        yy, xx = np.nonzero(lab == k); area = len(yy) / h / h
        if area < 0.004:
            continue
        ev = np.sort(np.linalg.eigvalsh(np.cov(np.vstack([xx, yy]))))[::-1]
        el = float(np.sqrt(ev[0] / max(ev[1], 1e-6))); cy = (yy.mean() - y0) / h
        if (area > 0.02 and el > 2.5) or (cy > 0.6 and el > 1.4 and area > 0.004):
            why.append("white limb left (bare leg)")
    return sorted(set(why))


def silhouette(drawn_cut: Image.Image, ref_cut: Image.Image) -> tuple[float, float]:
    f1 = ndi.binary_fill_holes(np.asarray(drawn_cut)[:, :, 3] > 0)
    f0 = ndi.binary_fill_holes(np.asarray(ref_cut)[:, :, 3] > 0)
    d1, d0 = ndi.binary_dilation(f1, iterations=6), ndi.binary_dilation(f0, iterations=6)
    return float((f1 & d0).sum() / max(f1.sum(), 1)), float((f0 & d1).sum() / max(f0.sum(), 1))


def score_sheet(drawn: Path, ref: Path, info: list[dict], target_hue: tuple[float, float]) -> list[dict]:
    """check_sheet numbers + silhouette match + stray white limbs, per pose. Adds 'score' (higher = closer to the old pose)."""
    res = cc.check_sheet(drawn, ref, info, target_hue)
    im, rf = Image.open(drawn).convert("RGB").resize((cc.SHEET_W, cc.SHEET_H), Image.LANCZOS), Image.open(ref).convert("RGB")
    for r, c in zip(res, info):
        box = tuple(c["cell"]); cut, old = cc.cutout(im.crop(box)), cc.cutout(rf.crop(box))
        iou, cov = silhouette(cut, old)
        r["sil_overlap"], r["sil_cover"] = round(iou, 3), round(cov, 3)
        why = list(r.get("why", []))
        if iou < SIL_OVERLAP or cov < SIL_COVER:
            why.append("silhouette")
        why += stray_white(cut)
        r["why"], r["pass"] = sorted(set(why)), not why
        r["score"] = round(iou + cov - abs(1 - r.get("h_ratio", 0)) - abs(1 - r.get("w_ratio", 0)), 3)
    return res


def pick_best(scored: dict[str, list[dict]]) -> dict[int, tuple[str, dict] | None]:
    """scored: candidate name -> per-pose results. Per pose: the passing candidate with the highest score, else None (redraw)."""
    best: dict[int, tuple[str, dict] | None] = {}
    n = max(len(v) for v in scored.values())
    for i in range(n):
        ok = [(name, res[i]) for name, res in scored.items() if i < len(res) and res[i].get("pass")]
        best[i] = max(ok, key=lambda t: t[1]["score"]) if ok else None
    return best


def save_accepted(name: str, picks: dict[int, tuple[str, dict] | None], sheets: dict[str, Path], info: list[dict], root: Path) -> dict:
    """Cut the winning cells out and save them. Only accepted poses are written; the manifest lists the missing ones."""
    out = Path(root) / name; out.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGB", (cc.SHEET_W, cc.SHEET_H), "white"); manifest = {"costume": name, "status": "auto_accepted", "human_reviewed": False, "poses": {}, "missing": []}
    for i, c in enumerate(info):
        p = picks.get(i)
        if not p:
            manifest["missing"].append(i); continue
        cand, res = p
        im = Image.open(sheets[cand]).convert("RGB").resize((cc.SHEET_W, cc.SHEET_H), Image.LANCZOS); box = tuple(c["cell"])
        sheet.paste(im.crop(box), box[:2])
        cut = cc.cutout(im.crop(box)); bb = cut.getchannel("A").getbbox()
        (cut.crop(bb) if bb else cut).save(out / f"body_{i:02d}.png")
        manifest["poses"][str(i)] = {"from": cand, "sha256": hashlib.sha256(Path(sheets[cand]).read_bytes()).hexdigest()[:16], "score": res["score"]}
    sheet.save(out / "accepted_sheet.png")
    manifest["complete"] = not manifest["missing"]
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1))
    return manifest


def redraw_jobs(name: str, prompt: str, missing: list[int], round_no: int, old_sheet_ref: str, accepted_ref: str,
                seeds: int = 4, width: int = cc.SHEET_W, height: int = cc.SHEET_H) -> list[dict]:
    """New seeds for the whole sheet (the model draws a sheet, not single cells); only the cells in `missing` are used from them."""
    return [{"id": f"{name}_r{round_no}_s{k}", "prompt": prompt, "refs": [old_sheet_ref, accepted_ref], "seed": 9700 + 100 * round_no + k,
             "width": width, "height": height, "wanted_poses": missing} for k in range(seeds)]
