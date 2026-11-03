"""Turn klein's pose drawings (character on white) into engine cards: transparent background, one common scale.

    python -m motion_studio.poses PICKS.json --src DIR --out animation/assets/cards_astronaut

PICKS.json maps pose name -> file name inside --src, e.g. {"stand": "pose_stand_s4201.png", ...}.
Steps (plain code, no AI): flood-fill the white background from the picture border into transparency, crop to the
character, scale every pose by the SAME factor (the engine fixes card scale from the first pose, so all cards must
share one canvas size and scale), stand the feet on the bottom edge and centre the body horizontally.
Checks: every pose must have a real character (area and height in range), no pose may touch the picture border
before cropping (cut-off limbs), and the scale factor comes from the upright poses only.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

CANVAS = (640, 960)      # every card has this size
MARGIN = 14              # empty space kept under the feet and around the body
UPRIGHT = ("stand", "walk_1", "walk_2", "walk_3", "walk_4", "point", "wave", "surprised")


def cutout(img: Image.Image, thresh: int = 38) -> Image.Image:
    """White background connected to the border becomes transparent; white inside the character (the suit) stays."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    marked = rgb.copy()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    for seed in seeds:
        if sum(marked.getpixel(seed)) > 3 * 225:
            ImageDraw.floodfill(marked, seed, (255, 0, 255), thresh=thresh)
    mask = Image.eval(ImageChops.difference(marked, Image.new("RGB", (w, h), (255, 0, 255))).convert("L"), lambda v: 0 if v < 8 else 255)
    # mask is 255 where the pixel is NOT background (difference from magenta is large)
    out = rgb.convert("RGBA")
    out.putalpha(mask)
    return out


def touches_border(alpha: Image.Image, pad: int = 2) -> list[str]:
    w, h = alpha.size
    sides = []
    for name, box in (("top", (0, 0, w, pad)), ("bottom", (0, h - pad, w, h)), ("left", (0, 0, pad, h)), ("right", (w - pad, 0, w, h))):
        if alpha.crop(box).getbbox():
            sides.append(name)
    return sides


def character_box(rgba: Image.Image) -> tuple[int, int, int, int]:
    box = rgba.getchannel("A").point(lambda v: 255 if v > 128 else 0).getbbox()
    if not box:
        raise ValueError("picture has no character")
    return box


def build_cards(picks: dict[str, str], src: Path, out: Path, scale_from: tuple[str, ...] = UPRIGHT) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    cut, report = {}, {"poses": {}, "problems": []}
    for name, file in picks.items():
        rgba = cutout(Image.open(src / file))
        sides = touches_border(rgba.getchannel("A"))
        if sides:
            report["problems"].append(f"{name}: character touches the picture edge ({', '.join(sides)}); a limb may be cut off")
        box = character_box(rgba)
        cut[name] = rgba.crop(box)
        report["poses"][name] = {"file": file, "crop_w": box[2] - box[0], "crop_h": box[3] - box[1]}
    heights = [cut[n].height for n in scale_from if n in cut]
    if not heights:
        raise ValueError("no upright pose to take the common scale from")
    heights.sort()
    ref_h = heights[len(heights) // 2]                              # median upright height
    scale = (CANVAS[1] - 2 * MARGIN) * 0.93 / ref_h                 # upright characters fill 93 % of the card height
    report["scale"], report["reference_height_px"] = round(scale, 4), ref_h
    for name, im in cut.items():
        w, h = max(1, round(im.width * scale)), max(1, round(im.height * scale))
        if w > CANVAS[0] - 2 * MARGIN or h > CANVAS[1] - 2 * MARGIN:
            f = min((CANVAS[0] - 2 * MARGIN) / w, (CANVAS[1] - 2 * MARGIN) / h)
            w, h = max(1, round(w * f)), max(1, round(h * f))
            report["problems"].append(f"{name}: did not fit the card at the common scale and was shrunk by {f:.2f}")
        small = im.resize((w, h), Image.LANCZOS)
        card = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        card.paste(small, ((CANVAS[0] - w) // 2, CANVAS[1] - MARGIN - h), small)
        card.save(out / f"stickman_{name}.png")
        report["poses"][name].update({"card_w": w, "card_h": h})
    # upright poses must end up within 12 % of each other in height (the same character at the same scale)
    ups = [report["poses"][n]["card_h"] for n in scale_from if n in report["poses"]]
    if ups and max(ups) > 1.12 * min(ups):
        report["problems"].append(f"upright poses differ too much in height ({min(ups)}..{max(ups)} px)")
    return report


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("picks", type=Path)
    ap.add_argument("--src", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args(argv)
    report = build_cards(json.loads(args.picks.read_text()), args.src, args.out)
    (args.out / "cards_report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    return 1 if report["problems"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
