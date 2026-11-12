#!/usr/bin/env python3
"""puppet - turn a doodle character image into a layered puppet for the stage.

  python3 puppet.py slice  <cutout.png> <rig_dir> [--name ID]
      cut the figure into head, body, arm and leg layers, find the pivots,
      write rig.json + layer PNGs + preview.png
  python3 puppet.py faces  <sheet.png> <rig_dir> --names happy,nervous,...
      cut an emotion sheet (a grid of heads) into replacement faces and add
      them to the rig; names go left to right, top row first
  python3 puppet.py preview <rig_dir> [out.png]
      redraw preview.png from an existing rig

The image may have a transparent background or a plain uniform backdrop.
How it works: stick limbs are thin and the head and torso are thick, so a
distance transform separates them; the neck is the narrowest row of the thick
silhouette between head and torso. See references/formats.md for rig.json.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

MAX_H = 1000            # work size: taller figures are scaled down
ORDER = ["legL", "legR", "armL", "armR", "body", "head"]

def fail(msg): sys.exit("puppet: " + msg)

# ---------------------------------------------------------------- loading
def key_backdrop(a, tol=30):
    """Make a plain backdrop transparent: everything close to the border colour
    and connected to the border goes, with a ~1 px feather."""
    rgb = a[..., :3].astype(np.int16)
    bg = np.median(np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]), axis=0)
    lab, _ = ndi.label(np.abs(rgb - bg).max(axis=2) <= tol)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    out = a.copy()
    out[..., 3] = np.clip(ndi.gaussian_filter(np.where(np.isin(lab, edge[edge > 0]), 0.0, 255.0), 0.8), 0, 255).astype(np.uint8)
    return out

def load(path):
    if not os.path.isfile(path): fail("no such file: " + path)
    a = np.asarray(Image.open(path).convert("RGBA")).copy()
    if (a[..., 3] < 250).mean() < 0.02: a = key_backdrop(a)      # no real transparency
    if not (a[..., 3] > 128).any(): fail("no figure found in " + path)
    return a

def crop(a, margin=6):
    ys, xs = np.where(a[..., 3] > 40)
    y0, y1 = max(0, ys.min() - margin), min(a.shape[0], ys.max() + 1 + margin)
    x0, x1 = max(0, xs.min() - margin), min(a.shape[1], xs.max() + 1 + margin)
    return a[y0:y1, x0:x1]

def fit(a, max_h=MAX_H):
    if a.shape[0] <= max_h: return a
    k = max_h / a.shape[0]
    return np.asarray(Image.fromarray(a).resize((max(1, round(a.shape[1] * k)), max_h), Image.LANCZOS)).copy()

def ball(mask):
    """Centre and diameter of the round face in a head mask: the widest row of
    its lower part (the hat sits in the upper part)."""
    rows = np.where(mask.any(axis=1))[0]; top, bot = rows[0], rows[-1]
    w = ndi.uniform_filter1d(mask.sum(axis=1).astype(float), 9)
    lo = int(top + 0.45 * (bot - top)); y = lo + int(np.argmax(w[lo:bot + 1]))
    xs = np.where(mask[y])[0]
    return [float((xs[0] + xs[-1]) / 2), float(y)], float(xs[-1] - xs[0] + 1)

# ---------------------------------------------------------------- slice
def slice_figure(a):
    alpha = a[..., 3]; m = alpha > 128
    lab, n = ndi.label(m)                                       # keep the figure, drop specks
    if n > 1:
        sizes = ndi.sum(m, lab, range(1, n + 1)); m = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 0.002 * sizes.max()])
    H, W = m.shape; fh = np.where(m.any(axis=1))[0]; fig_h = fh[-1] - fh[0] + 1
    r = max(4.0, 0.022 * fig_h)                                 # anything thinner than 2r is a stick
    core = ndi.distance_transform_edt(m) > r
    if not core.any(): fail("the figure has no thick parts (head, torso) to anchor on")
    thick = (ndi.distance_transform_edt(~core) <= r + 2) & m
    thin = m & ~thick
    # neck: narrowest row of the thick silhouette between head and torso
    rows = np.where(thick.any(axis=1))[0]; t0, t1 = rows[0], rows[-1]
    wid = ndi.uniform_filter1d(thick.sum(axis=1).astype(float), max(3, int(0.008 * fig_h)))
    a0, a1 = int(t0 + 0.30 * (t1 - t0)), int(t0 + 0.72 * (t1 - t0))
    neck = a0 + int(np.argmin(wid[a0:a1 + 1]))
    yy = np.arange(H)[:, None]
    head, body = thick & (yy < neck), thick & (yy >= neck)
    if not head.any() or not body.any(): fail("could not separate head and torso")
    bxs = np.where(body.any(axis=0))[0]; bcx = float(np.mean(np.where(body)[1])); by1 = np.where(body.any(axis=1))[0][-1]
    parts = {"head": head, "body": body}
    tl, tn = ndi.label(thin)
    for i in range(1, tn + 1):
        c = tl == i; ys, xs = np.where(c)
        if max(ys.max() - ys.min(), xs.max() - xs.min()) < 0.07 * fig_h or c.sum() < 30:   # stray bit: hat tip, tie end
            key = "head" if ys.mean() < neck else "body"; parts[key] = parts[key] | c; continue
        is_leg = ys.min() > by1 - 0.3 * (by1 - neck) and ys.max() > by1
        if is_leg and xs.min() < bcx - 3 and xs.max() > bcx + 3 and (xs.max() - xs.min()) > 0.3 * (bxs[-1] - bxs[0]):   # both legs in one piece
            xx = np.arange(W)[None, :]
            for key, half in (("legL", c & (xx < bcx)), ("legR", c & (xx >= bcx))):
                if half.any(): parts[key] = parts.get(key, np.zeros_like(m)) | half
            continue
        key = ("leg" if is_leg else "arm") + ("L" if xs.mean() < bcx else "R")
        parts[key] = parts.get(key, np.zeros_like(m)) | c
    # pivots
    near_body = ndi.binary_dilation(parts["body"], iterations=4)
    pivots = {}
    for key in ("armL", "armR", "legL", "legR"):
        if key not in parts: continue
        ys, xs = np.where(parts[key] & near_body)
        if not len(ys):                                          # not touching: nearest point to the torso centre
            ys, xs = np.where(parts[key]); j = np.argmin((xs - bcx) ** 2 + (ys - (neck + by1) / 2) ** 2); ys, xs = ys[j:j + 1], xs[j:j + 1]
        pivots[key] = [float(xs.mean()), float(ys.mean())]
    nx = np.where(thick[max(0, neck - 2):neck + 3].any(axis=0))[0]
    pivots["head"] = [float((nx[0] + nx[-1]) / 2), float(neck)]
    hips = [pivots[k] for k in ("legL", "legR") if k in pivots]
    pivots["body"] = [float(np.mean([p[0] for p in hips])), float(np.mean([p[1] for p in hips]))] if hips else [bcx, float(by1)]
    # give soft edge pixels to the nearest part
    label = np.zeros((H, W), np.int32); keys = [k for k in ORDER if k in parts]
    for i, k in enumerate(keys): label[parts[k]] = i + 1
    dist, (iy, ix) = ndi.distance_transform_edt(label == 0, return_indices=True)
    label = np.where((label == 0) & (alpha > 8) & (dist <= 4), label[iy, ix], label)
    layers = {}
    for i, k in enumerate(keys):
        img = a.copy(); img[..., 3] = np.where(label == i + 1, alpha, 0)
        if k == "body":                                         # plug under the head so a tilt never opens a hole
            plug = (yy >= neck - int(0.03 * fig_h)) & (yy < neck) & (label == keys.index("head") + 1)
            img[..., 3] = np.where(plug, alpha, img[..., 3])
        if k in ("armL", "armR", "legL", "legR"):               # joint dot so a swing never detaches the limb
            ys, xs = np.where(label == i + 1); col = np.median(a[ys, xs, :3], axis=0)
            jr = max(2.0, 0.9 * float(ndi.distance_transform_edt(label == i + 1).max()))
            py, px = np.ogrid[:H, :W]; dot = (px - pivots[k][0]) ** 2 + (py - pivots[k][1]) ** 2 <= jr * jr
            img[dot & (img[..., 3] < 255)] = [int(col[0]), int(col[1]), int(col[2]), 255]
        ys, xs = np.where(img[..., 3] > 0)
        box = [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]
        layers[k] = {"img": Image.fromarray(img[box[1]:box[1] + box[3], box[0]:box[0] + box[2]]), "box": box, "pivot": [round(v, 1) for v in pivots[k]]}
    center, diam = ball(parts["head"])
    hy, hx = np.where(parts["head"]); rgb = a[hy, hx, :3].astype(float); luma = rgb @ [0.2126, 0.7152, 0.0722]
    skin = np.median(rgb[luma > 170], axis=0) if (luma > 170).any() else np.median(rgb, axis=0)
    rig = {"version": 2, "size": [int(W), int(H)], "feetY": int(fh[-1]), "head": {"center": [round(v, 1) for v in center], "diameter": round(diam, 1)},
           "skin": "#%02x%02x%02x" % tuple(int(v) for v in skin), "order": keys}
    eyes = find_eyes(a, parts["head"], center, diam)
    if eyes: rig["eyes"] = eyes
    return rig, layers

def find_eyes(a, head, center, diam):
    """Two small, dark, round blobs of similar size at similar height inside the face."""
    H, W = head.shape; py, px = np.ogrid[:H, :W]
    face = head & ((px - center[0]) ** 2 + (py - center[1]) ** 2 <= (0.42 * diam) ** 2)
    dark = face & ((a[..., :3].astype(float) @ [0.2126, 0.7152, 0.0722]) < 75)
    lab, n = ndi.label(dark); cands = []; area0 = np.pi * (diam / 2) ** 2
    for i, sl in enumerate(ndi.find_objects(lab)):
        c = lab[sl] == i + 1; h, w = c.shape; area = c.sum()
        if 0.0003 * area0 < area < 0.012 * area0 and 0.6 < w / h < 1.7 and area / (w * h) > 0.6:
            cands.append((sl[1].start + w / 2, sl[0].start + h / 2, max(w, h) / 2, area))
    best = None
    for i in range(len(cands)):
        for j in range(i + 1, len(cands)):
            p, q = cands[i], cands[j]; dx = abs(p[0] - q[0])
            if abs(p[1] - q[1]) < 0.1 * diam and 0.18 * diam < dx < 0.7 * diam and max(p[3], q[3]) / min(p[3], q[3]) < 2.2 and abs((p[0] + q[0]) / 2 - center[0]) < 0.15 * diam:
                if best is None or p[3] + q[3] > best[0]: best = (p[3] + q[3], p, q)
    if not best: return None
    return [{"c": [round(e[0], 1), round(e[1], 1)], "r": round(e[2], 1)} for e in sorted(best[1:], key=lambda e: e[0])]

# ---------------------------------------------------------------- rig io + drawing
def save_rig(rig_dir, rig, layers):
    os.makedirs(rig_dir, exist_ok=True); rig["layers"] = {}
    for k, L in layers.items():
        L["img"].save(os.path.join(rig_dir, k + ".png")); rig["layers"][k] = {"file": k + ".png", "box": L["box"], "pivot": L["pivot"]}
    rig["order"] = [k for k in ORDER if k in layers]
    write_json(rig_dir, rig)

def write_json(rig_dir, rig):
    out = {k: rig[k] for k in ("version", "name", "size", "feetY", "head", "skin", "layers", "order", "eyes", "faces") if k in rig}
    for group in ("layers", "faces"):                            # loaded images are not part of the file
        if group in out: out[group] = {k: {f: v for f, v in d.items() if f != "img"} for k, d in out[group].items()}
    with open(os.path.join(rig_dir, "rig.json"), "w") as f: json.dump(out, f, indent=1)

def read_rig(rig_dir):
    p = os.path.join(rig_dir, "rig.json")
    if not os.path.isfile(p): fail("no rig.json in " + rig_dir + " (run slice first)")
    rig = json.load(open(p))
    for k, L in rig["layers"].items(): L["img"] = Image.open(os.path.join(rig_dir, L["file"])).convert("RGBA")
    for k, F in rig.get("faces", {}).items(): F["img"] = Image.open(os.path.join(rig_dir, F["file"])).convert("RGBA")
    return rig

def compose(rig, angles=None, face=None, pad=0.3):
    """Draw the puppet the way the stage does: layers in order, each turned
    about its pivot (degrees, clockwise on screen)."""
    angles = angles or {}; W, H = rig["size"]; px, py = int(W * pad), int(H * 0.08)
    canvas = Image.new("RGBA", (W + 2 * px, H + 2 * py), (0, 0, 0, 0))
    for k in rig["order"]:
        L = rig["layers"][k]; layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0)); pv = (L["pivot"][0] + px, L["pivot"][1] + py)
        F = rig.get("faces", {}).get(face) if k == "head" else None
        if F:
            s = rig["head"]["diameter"] / F["diameter"]; im = F["img"].resize((max(1, round(F["img"].width * s)), max(1, round(F["img"].height * s))), Image.LANCZOS)
            layer.alpha_composite(im, (round(pv[0] - F["pivot"][0] * s), round(pv[1] - F["pivot"][1] * s)))
        else: layer.alpha_composite(L["img"], (L["box"][0] + px, L["box"][1] + py))
        if angles.get(k): layer = layer.rotate(-angles[k], resample=Image.BICUBIC, center=pv)
        canvas.alpha_composite(layer)
    return canvas

def on_grey(im, h=620):
    bg = Image.new("RGBA", im.size, (150, 150, 158, 255)); bg.alpha_composite(im)
    return bg.convert("RGB").resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)

def preview(rig_dir, out=None):
    rig = read_rig(rig_dir); W, H = rig["size"]
    ex = Image.new("RGBA", (int(W * 1.9), int(H * 1.25)), (0, 0, 0, 0)); d = ImageDraw.Draw(ex)
    shift = {"head": (0.45, 0.0), "body": (0.45, 0.14), "armL": (0.12, 0.14), "armR": (0.78, 0.14), "legL": (0.32, 0.24), "legR": (0.58, 0.24)}
    for k in rig["order"]:
        L = rig["layers"][k]; ox, oy = int(shift[k][0] * W), int(shift[k][1] * H)
        ex.alpha_composite(L["img"], (L["box"][0] + ox, L["box"][1] + oy)); x, y = L["pivot"][0] + ox, L["pivot"][1] + oy
        d.line([x - 14, y, x + 14, y], fill=(255, 40, 90, 255), width=4); d.line([x, y - 14, x, y + 14], fill=(255, 40, 90, 255), width=4)
    src = os.path.join(rig_dir, "source_fit.png")
    panels = ([on_grey(Image.open(src).convert("RGBA"))] if os.path.isfile(src) else []) + [on_grey(ex), on_grey(compose(rig)),
              on_grey(compose(rig, {"armL": 35, "armR": -35, "legL": 12, "legR": -12, "head": 8}))]
    sheet = Image.new("RGB", (sum(p.width for p in panels) + 10 * (len(panels) - 1), 620), (40, 40, 46)); x = 0
    for p in panels: sheet.paste(p, (x, 0)); x += p.width + 10
    out = out or os.path.join(rig_dir, "preview.png"); sheet.save(out); return out

# ---------------------------------------------------------------- commands
def cmd_slice(image, rig_dir, name=None):
    a = fit(crop(load(image)))
    rig, layers = slice_figure(a); rig["name"] = name or os.path.basename(os.path.normpath(rig_dir))
    save_rig(rig_dir, rig, layers); Image.fromarray(a).save(os.path.join(rig_dir, "source_fit.png"))
    missing = [k for k in ORDER if k not in layers]
    print("wrote %s: %dx%d, layers %s%s" % (os.path.join(rig_dir, "rig.json"), rig["size"][0], rig["size"][1], ", ".join(rig["order"]), ("; missing " + ", ".join(missing)) if missing else ""))
    print("head centre %s, diameter %s; eyes %s; preview %s" % (rig["head"]["center"], rig["head"]["diameter"], "found" if "eyes" in rig else "not found (no blinking)", preview(rig_dir)))

def cmd_faces(sheet, rig_dir, names):
    rig = read_rig(rig_dir); a = load(sheet); m = a[..., 3] > 128
    lab, n = ndi.label(ndi.binary_dilation(m, iterations=max(2, int(0.012 * a.shape[0]))))     # tie sweat drops etc. to their head
    sizes = ndi.sum(m, lab, range(1, n + 1)); big = [i + 1 for i, s in enumerate(sizes) if s > 0.25 * sizes.max()]
    if len(big) != len(names): fail("found %d heads on the sheet but got %d names (%s)" % (len(big), len(names), ",".join(names)))
    boxes = ndi.find_objects(lab); cells = [(boxes[i - 1][0].start + boxes[i - 1][0].stop) / 2 for i in big]
    row_h = np.median([boxes[i - 1][0].stop - boxes[i - 1][0].start for i in big])
    order = sorted(zip(big, cells), key=lambda t: (round(t[1] / (0.6 * row_h)), boxes[t[0] - 1][1].start))
    os.makedirs(os.path.join(rig_dir, "faces"), exist_ok=True); rig["faces"] = rig.get("faces", {})
    rel = (rig["layers"]["head"]["pivot"][1] - rig["head"]["center"][1]) / rig["head"]["diameter"]   # neck below the face centre, in diameters
    for (i, _), name in zip(order, names):
        img = a.copy(); img[..., 3] = np.where(lab == i, a[..., 3], 0); img = crop(img, 4)
        k = min(1.0, 420 / img.shape[0]); img = fit(img, max(1, int(img.shape[0] * k)))
        c, d = ball(img[..., 3] > 128); Image.fromarray(img).save(os.path.join(rig_dir, "faces", name + ".png"))
        rig["faces"][name] = {"file": "faces/%s.png" % name, "size": [int(img.shape[1]), int(img.shape[0])], "pivot": [round(c[0], 1), round(c[1] + rel * d, 1)],
                              "center": [round(v, 1) for v in c], "diameter": round(d, 1)}
    write_json(rig_dir, rig); rig = read_rig(rig_dir)
    tiles = [on_grey(compose(rig, face=nm), 420) for nm in names]
    sheet_im = Image.new("RGB", (sum(t.width for t in tiles) + 8 * (len(tiles) - 1), 450), (40, 40, 46)); x = 0; d = ImageDraw.Draw(sheet_im)
    for t, nm in zip(tiles, names): sheet_im.paste(t, (x, 0)); d.text((x + 8, 428), nm, fill=(235, 235, 240)); x += t.width + 8
    out = os.path.join(rig_dir, "faces_preview.png"); sheet_im.save(out)
    print("added %d faces to %s: %s; preview %s" % (len(names), os.path.join(rig_dir, "rig.json"), ", ".join(names), out))

def opt(args, flag):
    if flag in args: i = args.index(flag); v = args[i + 1] if i + 1 < len(args) else None; del args[i:i + 2]; return v
    return None

if __name__ == "__main__":
    args = sys.argv[1:]
    name, names = opt(args, "--name"), opt(args, "--names")
    if len(args) == 3 and args[0] == "slice": cmd_slice(args[1], args[2], name)
    elif len(args) == 3 and args[0] == "faces":
        if not names: fail("faces needs --names a,b,c in the sheet's order")
        cmd_faces(args[1], args[2], [n.strip() for n in names.split(",") if n.strip()])
    elif len(args) in (2, 3) and args[0] == "preview": print("wrote " + preview(args[1], args[2] if len(args) == 3 else None))
    else: print(__doc__)
