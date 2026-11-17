#!/usr/bin/env python3
"""Pre-render gate, geometry layer (Blueprint v2.1, stage 5).

  gate.py <name>   reads scene/film/<name>.film.json (from compile.py), chooses a camera for every shot that
                   passes the checks, writes inkbeat/src/film/data/<name>.ts and scene/gate/<name>.gate.md.
                   Exit 1 if any shot is blocked (no camera passes).

For each shot, at five moments across it, a camera must satisfy:
  clear     the lens is not inside or touching a piece, a person, an aircraft or a wall, and is inside the set
  sight     nothing stands between the lens and the subject (or either person of a two-shot, or anyone the
            shot must show); a held item counts, so a paper in front of a face fails
  framed    the subject (and the others the shot must show) are inside the frame with margin, above the captions
  size      the subject's head is neither a speck nor cropped, by shot type
The default camera (shot type + scene view angle) is tried first; if it fails, nearby cameras are searched
(side, angle, height, distance, lens) and the closest passing one is used. That is the auto-fix. Every change
is recorded. If nothing passes, the shot is blocked and the least-bad camera is kept only so stills can be made.
"""
import json, sys, os, math, itertools
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
BND = json.load(open(f"{HERE}/bounds.json")); CH = BND["character"]
DIST = {"wide": 8.5, "medium": 4.6, "two_shot": 4.3, "close": 3.1, "detail": 2.3}
FOV = {"wide": 52, "medium": 46, "two_shot": 44, "close": 36, "detail": 30}
HEAD_MIN = {"wide": 0.012, "medium": 0.035, "two_shot": 0.03, "close": 0.07, "detail": 0.0}; HEAD_MAX = 0.3
UP = {"hand_over", "receive", "hold_up", "open_case", "lift", "count_fingers", "push_lever", "point"}
ASPECT = 9 / 16; KEYS = [0, .25, .5, .75, 1]
# things a person can stand on or sit in: being "inside" their box is normal. Anything else is solid.
WALKABLE = ("stairs", "seat", "airstair", "bench", "chair", "boat", "picnic", "blanket", "crowd", "cart")
ease = lambda u: (lambda x: x * x * (3 - 2 * x))(min(1, max(0, u)))
add = lambda a, b: [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; sub = lambda a, b: [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
dot = lambda a, b: a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; norm = lambda a: math.sqrt(dot(a, a))
cross = lambda a, b: [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def legs_of(c):
    a = c["action"]; return c.get("legs") or ("sit" if a == "sit" else "kneel" if a in ("kneel", "dig") else "crouch" if a == "crouch" else "stand")
def char_pos(c, sh, t):
    p = list(c["p"]); a = c["action"]
    if a in ("step_off", "fall"):
        dt = max(0, t - (sh["t0"] + (sh["t1"] - sh["t0"]) * (0 if a == "fall" else .5)))
        return [p[0] + math.sin(c["yaw"]) * dt * 2.4, p[1] + dt * 1.4 - dt * dt * 7.5, p[2] + math.cos(c["yaw"]) * dt * 2.4]
    if a == "hang_parachute": return [p[0], p[1] - (t - sh["t0"]) * .35, p[2]]
    return p
def head(c, sh, t, H):
    p = char_pos(c, sh, t); return [p[0], p[1] + H * (CH["head_y_per_height"] - CH["drop_per_height"][legs_of(c)]), p[2] + H * CH["head_z_per_height"]]
def hand(c, sh, t, H, left=False):
    p = char_pos(c, sh, t); up = c["action"] in UP and not left
    y = (1.22 if up else .92) * (H / 1.72) - CH["drop_per_height"][legs_of(c)] * H
    fx, fz = (-.3 if left else .3), (.42 if up else .2); yw = c["yaw"]
    return [p[0] + math.cos(yw) * fx + math.sin(yw) * fz, p[1] + y, p[2] - math.sin(yw) * fx + math.cos(yw) * fz]


def yaw_box(b, p, yaw, s=1):
    """piece-local AABB -> world AABB after scale, yaw and translation"""
    xs, zs = [], []
    for x in (b[0], b[3]):
        for z in (b[2], b[5]): xs.append(math.cos(yaw) * x * s + math.sin(yaw) * z * s); zs.append(-math.sin(yaw) * x * s + math.cos(yaw) * z * s)
    return [p[0] + min(xs), p[1] + b[1] * s, p[2] + min(zs), p[0] + max(xs), p[1] + b[4] * s, p[2] + max(zs)]
def held_box(tok, at, c):
    kind, _, label = tok.partition(":")
    if kind == "briefcase": return [at[0] - .25, at[1] - .35, at[2] - .2, at[0] + .25, at[1] + .22, at[2] + .2]
    if kind == "money_bag": return [at[0] - .22, at[1] - .25, at[2] - .2, at[0] + .22, at[1] + .22, at[2] + .2]
    if label: w = min(.52, .1 + len(label) * .03); return [at[0] - w / 2, at[1] - .08, at[2] - .02, at[0] + w / 2, at[1] + .08, at[2] + .02]
    b = BND["pieces"].get(kind, [-.15, 0, -.15, .15, .3, .15]); r = max(b[3] - b[0], b[5] - b[2], b[4] - b[1]) / 2
    return [at[0] - r, at[1] - r, at[2] - r, at[0] + r, at[1] + r, at[2] + r]


def occluders(film, sc, sh, t):
    """[(owner, name, box)] at time t. owner = a character id for their body and what they hold, else None."""
    O = []
    for p in sc["pieces"]:
        b = BND["pieces"].get(p["kind"])
        if b and p["kind"] not in ("road", "stream", "blanket", "cloud", "lightning"): O.append((None, p["name"], yaw_box(b, p["p"], p["yaw"], p["s"])))
    for pl in sc["planes"]:
        P, yw = pl["p"], pl.get("yaw", 0)
        parts = [("fuselage", [-9.6, -1.1, -1.1, 8.9, 1.1, 1.1]), ("wing", [-1.2, -.62, -7.5, 2.0, -.38, 7.5]), ("tail fin", [-10, .4, -.15, -7.2, 3.6, .15]), ("tailplane", [-10.2, 3.1, -2.3, -8.6, 3.3, 2.3])]
        if pl.get("stairs") and t >= pl.get("stairs_from", 0): parts.append(("airstair", [-8.45, -3.4, -.5, -4.95, -1.05, .5]))
        for n, b in parts: O.append((None, "airliner " + n, yaw_box(b, P, yw)))
    if sc["kit"] == "airliner_cabin":
        for i in range(7):
            z = -1.6 - i * 1.55
            for sx in (-1, 1): O.append((None, "seat row", [min(sx * .56, sx * 1.48), 0, z - .46, max(sx * .56, sx * 1.48), 1.23, z + .45]))
        for sx in (-1, 1): O.append((None, "overhead bin", [min(sx * 1.1, sx * 1.56), 1.5, -17, max(sx * 1.1, sx * 1.56), 1.95, 1]))
    for c in sh["chars"]:
        H = film["cast"][c["id"]].get("height", 1.72); p = char_pos(c, sh, t); top = head(c, sh, t, H)[1] + .16 * H
        O.append((c["id"], c["id"], [p[0] - .27, p[1], p[2] - .2, p[0] + .27, top, p[2] + .2]))
        for k, tok in enumerate(c["holds"]):
            last = k == len(c["holds"]) - 1
            if tok.split(":")[0] == "pack" and c["action"] in ("hang_parachute", "step_off", "fall"): continue
            O.append((c["id"], f"{c['id']}'s {tok.split(':')[0]}", held_box(tok, hand(c, sh, t, H, left=not last) if last else hand({**c, "action": "stand"}, sh, t, H, left=True), c)))
    for i, c in enumerate(sc["crowd"]):
        dt = t - sc["t0"]; x, z = c["p"][0] + c["vel"][0] * dt, c["p"][2] + c["vel"][1] * dt
        O.append((None, "crowd", [x - .27, c["p"][1], z - .2, x + .27, c["p"][1] + 1.6, z + .2]))
    return O


def seg_hits(a, b, box, pad=-.03):
    """does segment a->b pass through the box (slab test)?"""
    t0, t1 = 0.0, 1.0
    for i in range(3):
        d = b[i] - a[i]; lo, hi = box[i] - pad, box[i + 3] + pad
        if abs(d) < 1e-9:
            if a[i] < lo or a[i] > hi: return False
        else:
            x0, x1 = (lo - a[i]) / d, (hi - a[i]) / d
            if x0 > x1: x0, x1 = x1, x0
            t0, t1 = max(t0, x0), min(t1, x1)
            if t0 > t1: return False
    return t1 > .02 and t0 < .98
def inside(p, box, pad): return all(box[i] - pad <= p[i] <= box[i + 3] + pad for i in range(3))
def ndc(frm, look, fov, pt):
    f = sub(look, frm); L = norm(f); f = [x / L for x in f]; r = cross(f, [0, 1, 0]); rl = norm(r) or 1; r = [x / rl for x in r]; u = cross(r, f)
    v = sub(pt, frm); z = dot(v, f)
    if z < .25: return None
    th = math.tan(math.radians(fov) / 2); return dot(v, r) / z / (th * ASPECT), dot(v, u) / z / th, z
def aim_look(frm, S, fov, face):
    d = norm(sub(S, frm)); return [S[0], S[1] - math.tan(math.radians((.5 - face) * fov)) * d, S[2]]


def subject_points(film, sc, sh, t):
    """(S, owner of S, [(point, owner, label)] that must be seen)"""
    by = {c["id"]: c for c in sh["chars"]}; H = lambda i: film["cast"][i].get("height", 1.72); s = sh["subject"]; must = []
    if s.get("char") in by: c = by[s["char"]]; S = head(c, sh, t, H(c["id"])); own = c["id"]; must.append((S, own, c["id"]))
    elif s.get("held") in by: c = by[s["held"]]; S = hand(c, sh, t, H(c["id"])); own = c["id"]; must.append((S, own, "the " + s["token"].split(":")[0]))
    else:
        p = s.get("point", [0, 1, -4]); S = [p[0], p[1] + ((.45 if sh["type"] != "wide" else 1.2) if p[1] < .3 else 0), p[2]]; own = "__point__"; must.append((S, own, "the subject"))
    if sh["type"] == "two_shot" and sh.get("second") in by and s.get("char") in by:
        c2 = by[sh["second"]]; b = head(c2, sh, t, H(c2["id"])); must.append((b, c2["id"], c2["id"])); S = [(S[0] + b[0]) / 2, (S[1] + b[1]) / 2, (S[2] + b[2]) / 2]
    return S, own, must


def evaluate(film, sc, sh, cand):
    """returns (list of problems, baked camera keys) for one candidate camera"""
    probs, keys = [], []
    daz, side, sx, hf, ds, fs = cand
    fov = min(66, FOV[sh["type"]] * fs); face = .5 if sh["type"] == "detail" else .42
    for u in KEYS:
        t = sh["t0"] + (sh["t1"] - sh["t0"]) * u; e = ease(u)
        S, own, must = subject_points(film, sc, sh, t)
        dist = DIST[sh["type"]] * ds
        if sh["subject"].get("size"): dist = max(dist, sh["subject"]["size"] * 2.4 * ds)
        if len(must) > 1: sep = math.hypot(must[0][0][0] - must[1][0][0], must[0][0][2] - must[1][0][2]); dist = max(dist, (sep / 2 + .55) / (math.tan(math.radians(FOV["two_shot"] / 2)) * ASPECT) * ds)
        mv = sh["move"]
        if mv == "push": dist *= 1 - .12 * e
        elif mv == "pull": dist *= .88 + .12 * e
        az = sc.get("azimuth", 0) + daz + (side * .25 * e if mv == "orbit" else 0); off = side * (sx + (.05 * e if mv == "hold_drift" else 0))
        frm = [S[0] + dist * (math.sin(az) + off * math.cos(az)), S[1] + dist * (hf + (.22 * e if mv == "crane_up" else 0)), S[2] + dist * .97 * (math.cos(az) - off * math.sin(az))]
        tgt = [S[0], S[1] + ((1 - e) * .25 * dist if mv == "tilt_down" else 0), S[2]]
        look = aim_look(frm, tgt, fov, face); keys.append({"from": [round(x, 3) for x in frm], "look": [round(x, 3) for x in look]})
        O = occluders(film, sc, sh, t)
        # clear
        L = sc.get("limit")
        if L and (abs(frm[0]) > L["x"] or frm[2] > L["zmax"] or frm[1] > L["ymax"]): probs.append(("clear", "camera outside the set"))
        if sc["kit"] != "sky" and frm[1] < .3: probs.append(("clear", "camera below the floor"))
        for owner, name, box in O:
            if inside(frm, box, .3): probs.append(("clear", f"camera inside or touching {name}")); break
        # sight + framed + size
        for pt, powner, label in must:
            for owner, name, box in O:
                if owner == powner and (name == powner or label.startswith("the ")): continue   # a person does not hide their own head; a held subject is not hidden by its holder
                if inside(pt, box, .12):
                    # the point is within this thing's box: it is the subject itself, or something stood on / sat in. A person inside a solid thing cannot be seen at all.
                    if powner != "__point__" and not label.startswith("the ") and owner is None and not any(w in name for w in WALKABLE): probs.append(("sight", f"{label} is inside {name}"))
                    continue
                if seg_hits(frm, pt, box): probs.append(("sight", f"{name} hides {label}")); break
            q = ndc(frm, look, fov, pt)
            if mv == "tilt_down" and u < .5: continue   # a tilt arrives on its subject; it need not hold it from the first frame
            if not q or abs(q[0]) > .78 or q[1] > .86 or q[1] < -.42: probs.append(("framed", f"{label} is out of frame")); continue
            if powner not in ("__point__",) and not label.startswith("the "):
                Hh = film["cast"][powner].get("height", 1.72); sz = .13 * Hh / (q[2] * math.tan(math.radians(fov) / 2))
                if sz < HEAD_MIN[sh["type"]]: probs.append(("size", f"{label} is too small in frame"))
                if sz > HEAD_MAX: probs.append(("size", f"{label} is cropped (too close)"))
    return probs, {"keys": keys, "fov": round(fov, 1)}


def candidates(sh):
    base_h = .12 if sh["type"] == "wide" else .04
    order = []
    for daz, sx, hf, ds, fs in itertools.product([0, .35, -.35, .7, -.7, 1.1, -1.1, 1.5, -1.5], [.2, .06, .45], [base_h, .15, .3, .5, .8], [1, .8, 1.25, .62, 1.6, 2.2, .45, .34], [1, 1.2, 1.45]):
        cost = abs(daz) * 2 + abs(sx - .2) * 2 + abs(hf - base_h) * 4 + abs(math.log(ds)) * 3 + (fs - 1) * 3
        order.append((cost, (daz, sx, hf, ds, fs)))
    order.sort(key=lambda x: x[0]); return [c for _, c in order]


def gate(name):
    film = json.load(open(f"{HERE}/film/{name}.film.json")); rows, blocked, fixed = [], 0, 0
    n = 0
    for si, sc in enumerate(film["scenes"]):
        for hi, sh in enumerate(sh_ for sh_ in sc["shots"]):
            side0 = 1 if (si + hi) % 2 else -1; n += 1
            cands = candidates(sh); d = cands[0]
            p0, cam0 = evaluate(film, sc, sh, (d[0], side0, d[1], d[2], d[3], d[4]))
            if not p0: sh["cam"] = cam0; rows.append((sc["id"], sh["id"], sh["type"], "pass", "", "")); continue
            best = (len(p0), p0, cam0); found = None
            for c in cands[:1500]:
                for side in (side0, -side0):
                    p, cam = evaluate(film, sc, sh, (c[0], side, c[1], c[2], c[3], c[4]))
                    if not p: found = (c, side, cam); break
                    if len(p) < best[0]: best = (len(p), p, cam)
                if found: break
            why = "; ".join(sorted({m for _, m in p0}))
            if found:
                c, side, cam = found; sh["cam"] = cam; fixed += 1
                ch = [x for x in [f"turned {abs(c[0]):.1f} rad" if c[0] else "", "raised" if c[2] > .2 else "", "pulled back" if c[3] > 1.1 else "moved in" if c[3] < .9 else "", "wider lens" if c[4] > 1 else "", "other side" if side != side0 else ""] if x]
                rows.append((sc["id"], sh["id"], sh["type"], "fixed", why, ", ".join(ch) or "shifted sideways"))
            else:
                sh["cam"] = best[2]; blocked += 1
                rows.append((sc["id"], sh["id"], sh["type"], "BLOCKED", why, "still failing: " + "; ".join(sorted({m for _, m in best[1]}))))
    os.makedirs(f"{ROOT}/inkbeat/src/film/data", exist_ok=True); os.makedirs(f"{HERE}/gate", exist_ok=True)
    open(f"{ROOT}/inkbeat/src/film/data/{name}.ts", "w").write("// GENERATED by scene/compile.py + scene/gate.py. Do not edit by hand.\nimport type { FilmData } from \"../types\";\nexport const film: FilmData = " + json.dumps(film, indent=1, ensure_ascii=False) + ";\n")
    L = [f"# Pre-render gate: {film['title']}", "", f"{n} shots: {n - fixed - blocked} passed as planned, {fixed} fixed by moving the camera, **{blocked} blocked**.", "",
         "| Scene | Shot | Type | Result | What was wrong | What the gate did |", "|---|---|---|---|---|---|"] + [f"| {a} | {b} | {c} | {d} | {e} | {f} |" for a, b, c, d, e, f in rows]
    open(f"{HERE}/gate/{name}.gate.md", "w").write("\n".join(L) + "\n")
    print(L[2]); [print("  BLOCKED", r[0], r[1], r[2], "|", r[4], "|", r[5]) for r in rows if r[3] == "BLOCKED"]
    return blocked


if __name__ == "__main__": sys.exit(1 if gate(sys.argv[1]) else 0)
