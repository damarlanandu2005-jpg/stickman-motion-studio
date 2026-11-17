#!/usr/bin/env python3
"""Compiler, data half (Blueprint v2.1, stage 6).

  compile.py <name>     reads director/plans/<name>.story_plan.json, scene/ir/<name>.scene_ir.json,
                        scene/resolve/<name>.resolve.json and the voice word timings, and writes
                        inkbeat/src/film/data/<name>.ts : a fully explicit film (sets, piece positions, who stands
                        where doing what, camera intent per shot). The generic composition in inkbeat/src/film
                        mounts it. No film-specific code is written by hand.
"""
import json, sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
CAT = json.load(open(os.path.join(HERE, "catalogue.json")))
GROUP = {p: g for g, ps in CAT["pieces"].items() for p in ps}
TABLETOP = {"lamp", "radio", "papers", "book", "jars", "globe", "sketch", "cash", "hat", "boot", "paper_bag", "parcel", "box_file"}
SURFACE_H = {"table": 0.78, "desk": 0.79, "counter": 1.09, "picnic_table": 0.77, "cart": 0.44}
AIR = {"cloud", "lightning", "helicopter"}
BIG = {"house", "tower", "hut", "truck", "tanker", "car", "booth", "oak", "jungle_tree", "pine", "palm", "stairs", "pole", "flagpole", "washing_line"}
MOODS = {"day_clear": "day", "day_grey": "day", "dusk": "dusk", "golden": "golden", "night_clear": "night", "night_rain": "night", "storm_day": "dusk", "interior_day": "cold", "interior_lamp": "lamp", "interior_night": "cold"}
PALETTE = [("#6a5a3a", "#3b3a44", "#3a2a22", "#ecccae"), ("#4a5240", "#2f3540", "#5a4535", "#d49a6a"), ("#45384f", "#2c2f38", "#141216", "#f1d6bd"), ("#394a63", "#2a3550", "#2a211c", "#e7b48e"), ("#6a3b3b", "#3b3a44", "#8a5a2a", "#f1d6bd")]


def kit_slots(kit, o):
    if kit == "room":
        w, d = o.get("w", 7), o.get("d", 6)
        return {"front_left": ([-w * .16, 0, -d * .32], .6), "front_right": ([w * .16, 0, -d * .32], -.6), "centre": ([0, 0, -d * .45], 0), "back_left": ([-w * .28, 0, -d * .7], .4), "back_right": ([w * .28, 0, -d * .7], -.4), "at_wall": ([0, 0, -d * .82], 0)}
    if kit == "ground": return {"front_left": ([-.9, 0, -2.8], .5), "front_right": ([.9, 0, -2.8], -.5), "centre": ([0, 0, -3.6], 0), "mid_left": ([-1.8, 0, -5], .4), "mid_right": ([1.8, 0, -5], -.4), "far": ([0, 0, -8], 0)}
    if kit == "water_edge": return {"bank_left": ([-.9, 0, -2.6], .5), "bank_right": ([.9, 0, -2.6], -.5), "bank_centre": ([0, 0, -3.2], 0), "waterline": ([.4, 0, -5.2], .2), "in_water": ([0, -.25, -7.5], 0)}
    if kit == "sky": return {"air_near": ([0, 3, -4], .3), "air_mid": ([0, 5, -10], 0), "air_far": ([0, 11, -30], 0)}
    if kit == "airliner_cabin": return {"aisle_front_left": ([-.6, 0, -3.1], .7), "aisle_front_right": ([.62, 0, -2.95], -.8), "aisle_mid": ([0, 0, -5.5], 0)}
    raise SystemExit(f"unknown kit {kit}")


def zones(kit, o):
    """auto-placement zones: (normal floor zones, big-item zones, wall x-range and z, air zones)"""
    air = [[-5, 9, -20], [5, 11, -24], [0, 13, -28], [-9, 12, -30], [8, 8, -22], [-2, 15, -34]]
    if kit == "room":
        w, d = o.get("w", 7), o.get("d", 6)
        fl = [[-w * .34, 0, -d * .72, .3], [w * .34, 0, -d * .72, -.3], [-w * .36, 0, -d * .42, .6], [w * .36, 0, -d * .42, -.6], [0, 0, -d * .8, 0], [-w * .2, 0, -d * .86, 0]]
        return fl, fl, (-w / 2 + 1.1, w / 2 - 1.1, -d + .13), air
    if kit == "airliner_cabin": fl = [[0, 0, -7.5, 0], [0, 0, -10, 0], [0, 0, -12.5, 0]]; return fl, fl, (-.6, .6, -16.85), air
    if kit == "water_edge":
        return [[-2.2, 0, -2.4, .4], [2.3, 0, -2.8, -.4], [-3.6, 0, -4.2, .3], [3.4, 0, -4.4, -.3], [0, 0, -1.6, 0]], [[-6, 0, -3.8, .6], [6, 0, -4, -.6], [-9, 0, -2, .5]], None, air
    if kit == "sky": fl = [[1.6, 2.4, -6, .3], [-2.2, 4, -8, -.3], [3, 6, -12, 0], [-4, 1, -9, 0]]; return fl, fl, None, air
    return ([[-2.6, 0, -4.6, .4], [2.7, 0, -5, -.4], [-4.2, 0, -7.5, .3], [4.2, 0, -8, -.3], [0, 0, -10, 0], [-1.7, 0, -2.2, .3], [2.2, 0, -2.4, -.3]],
            [[-6, 0, -12, .3], [6, 0, -13, -.3], [0, 0, -16, 0], [-11, 0, -16, .4], [11, 0, -17, -.4], [-3, 0, -19, 0]], None, air)


def compile_film(name):
    plan = json.load(open(f"{ROOT}/director/plans/{name}.story_plan.json")); ir = json.load(open(f"{HERE}/ir/{name}.scene_ir.json"))
    res = json.load(open(f"{HERE}/resolve/{name}.resolve.json")); words = json.load(open(f"{ROOT}/ricks/projects/{name}/audio/words.json"))["words"]
    T = lambda w: words[w]["t0"] if w < len(words) else words[-1]["t1"] + 0.15
    flat = [(sc, sh) for sc in ir["scenes"] for sh in sc["shots"]]
    ends = {(sc["id"], sh["id"]): T(flat[i + 1][1]["w0"]) if i + 1 < len(flat) else words[-1]["t1"] + 0.15 for i, (sc, sh) in enumerate(flat)}
    notes = []
    film = {"name": name, "title": plan["title"], "fps": 30, "frames": int(math.ceil((words[-1]["t1"] + 0.15) * 30)), "voice": f"films/{name}/voice.mp3", "music": f"films/{name}/music.mp3",
            "words": [[w["w"], w["t0"], w["t1"]] for w in words], "cast": res.get("looks", {}), "scenes": []}
    for si, sc in enumerate(ir["scenes"]):
        st = res["sets"][sc["set"]]; kit, opt = st["kit"], st.get("options", {})
        slots = kit_slots(kit, opt)
        for k, v in st.get("slots", {}).items(): slots[k] = (v["p"], v.get("yaw", 0), v.get("legs"))
        lay = st.get("layout", {})
        fl, big, wall, air = zones(kit, opt); fi = bi = ai = 0
        wall_items, pieces, planes, anchors, rain, surface = [], [], [], {}, False, None
        def place(dname, tok, k):
            nonlocal fi, bi, ai, rain, surface
            kind, _, label = tok.lstrip("~").partition(":")
            if kind in ("kit", "mood"): anchors.setdefault(dname, st.get("anchors", {}).get(dname)); return
            if kind == "rain": rain = True; return
            if kind == "parachute": return
            ov = lay.get(dname); ov = (ov[k] if isinstance(ov, list) else ov) if ov else None
            if kind == "airliner":
                p = ov or ({"p": [-6, 9, -26], "yaw": 0} if kit == "sky" else {"p": [0.5, 2.45, -16], "yaw": 0, "gear": True})
                if not any(q["p"] == p["p"] for q in planes): planes.append(p)
                anchors[dname] = p.get("focus", p["p"]); return
            o = {"label": label} if label else {}
            if ov: P, yaw, s = ov["p"], ov.get("yaw", 0), ov.get("s", 1); o.update(ov.get("opts", {}))
            elif kind in AIR: P, yaw, s = air[ai % len(air)], 0, 1.6 if kind == "cloud" else 1; ai += 1
            elif kind in TABLETOP and surface: P, yaw, s = [surface[0] + (.32 if len(pieces) % 2 else -.3), surface[1], surface[2] + .05], 0, 1
            elif GROUP.get(kind) == "walls and fittings" and wall and kind not in ("lamp", "floor_lamp", "radio", "papers", "book", "jars", "rope_post", "scale", "panel", "yoke", "sketch"):
                wall_items.append(len(pieces)); P, yaw, s = [0, 0, wall[2]], 0, 1
            elif kind in BIG: z = big[bi % len(big)]; bi += 1; P, yaw, s = z[:3], z[3], 1
            else: z = fl[fi % len(fl)]; fi += 1; P, yaw, s = z[:3], z[3], 1
            if kind in SURFACE_H: surface = [P[0], P[1] + SURFACE_H[kind], P[2]]
            pieces.append({"kind": kind, "p": [round(x, 3) for x in P], "yaw": yaw, "s": s, "opts": o, "name": dname}); anchors[dname] = pieces[-1]["p"]
        for d in sc["dressing"]:
            v = res["items"][d]
            for k, tok in enumerate(v if isinstance(v, list) else [v]):
                if tok.startswith("BUILD"): notes.append(f"{sc['id']}: '{d}' left out (not in the library)"); continue
                place(d, tok, k)
        for j, idx in enumerate(wall_items):   # spread wall fittings along the back wall
            pieces[idx]["p"][0] = round(wall[0] + (wall[1] - wall[0]) * ((j + .5) / len(wall_items)), 3); anchors[pieces[idx]["name"]] = pieces[idx]["p"]
        for pid in sc.get("props_here", []):
            tok = res["props"][pid]; kind, _, label = tok.partition(":"); ov = lay.get(pid)
            P = ov["p"] if ov else ([surface[0] - .1, surface[1], surface[2] + .12] if surface and kind in TABLETOP else [0.3, 0, -2.4])
            pieces.append({"kind": kind, "p": P, "yaw": (ov or {}).get("yaw", 0), "s": (ov or {}).get("s", 1), "opts": {"label": label} if label else {}, "name": pid, "loose": True}); anchors[pid] = P
        # crowd
        crowd, n, act = [], sc["crowd"]["count"], sc["crowd"]["action"]
        cz = {"room": -opt.get("d", 6) * .8}.get(kit, -8)
        for i in range(min(n, 10) if act not in ("none", "seated_idle") else 0):
            if act in ("walk_cross", "queue"): d = 1 if i % 2 else -1; crowd.append({"look": i % 5, "p": [-d * 4.5 + d * i * 1.1, 0, cz - (i % 3) * .5], "vel": [d * .8, 0], "yaw": d * 1.57, "walk": True})
            elif act == "walk_away": o_ = st.get("crowd_from", [0, 0, -9]); az = st.get("azimuth", 0); vx, vz = -.8 * math.cos(az) + .15 * math.sin(az), .8 * math.sin(az) + .15 * math.cos(az)   # across the frame, never at the lens
                crowd.append({"look": i % 5, "p": [o_[0] + 1 + (i % 3) * .8, 0, o_[2] + 1.5 + (i // 3) * 1.3], "vel": [round(vx, 3), round(vz, 3)], "yaw": round(math.atan2(vx, vz), 3), "walk": True})
            elif act == "search_line": crowd.append({"look": i % 5, "p": [-7.5 + i * 1.6, 0, -9.5 - (i % 2) * .8], "vel": [0, .12], "yaw": 0, "walk": True})
            else: crowd.append({"look": i % 5, "p": [-4 + i * 1.0, 0, cz], "vel": [0, 0], "yaw": 0, "walk": False})
        shots = []
        for sh in sc["shots"]:
            chars = []
            for s_ in sh["stage"]:
                P, yaw, *legs = slots[s_["slot"]]
                chars.append({"id": s_["who"], "p": P, "yaw": yaw, "legs": (legs[0] if legs and legs[0] else None), "action": s_["action"], "face": s_["face"], "holds": [res["props"][h] for h in s_["holds"]]})
            subj = sh["subject"]; ids = [c["id"] for c in chars]
            if subj in ids: subject = {"char": subj}
            elif subj in res["props"] and any(res["props"][subj] in c["holds"] for c in chars): subject = {"held": next(c["id"] for c in chars if res["props"][subj] in c["holds"]), "token": res["props"][subj]}
            elif anchors.get(subj):
                subject = {"point": anchors[subj]}
                tok0 = res["items"].get(subj, res["props"].get(subj, "")); tok0 = (tok0[0] if isinstance(tok0, list) else tok0).lstrip("~").split(":")[0]
                size = {"airliner": 7, "tower": 4, "house": 3, "hut": 2.2, "helicopter": 3, "truck": 2.2, "tanker": 2.5, "car": 1.8, "kit": 5}.get(tok0)
                if size and sh["type"] in ("wide", "medium"): subject["size"] = size
            elif subj == "place": subject = {"point": st.get("centre", slots[next(iter(slots))][0])}
            else: subject = {"point": slots[next(iter(slots))][0]}; notes.append(f"{sc['id']}/{sh['id']}: subject '{subj}' has no position; camera uses the first slot")
            second = None
            if sh["type"] == "two_shot": second = next((c for c in ids if c != subj and (c in sh["shows"] or True)), None)
            shots.append({"id": sh["id"], "t0": round(T(sh["w0"]), 3), "t1": round(ends[(sc["id"], sh["id"])], 3), "type": sh["type"], "move": sh["move"], "subject": subject, "second": second, "chars": chars, "labels": sh["labels"]})
        w, d = opt.get("w", 7), opt.get("d", 6)
        lim = {"room": {"x": w / 2 - .5, "zmax": 2.6, "ymax": opt.get("h", 3.2) - .5}, "airliner_cabin": {"x": .55, "zmax": 1.2, "ymax": 1.95}}.get(kit)
        film["scenes"].append({"id": sc["id"], "t0": shots[0]["t0"], "t1": shots[-1]["t1"], "tag": sc["tag"] if si else "", "kit": kit, "options": opt, "mood": MOODS[sc["mood"]], "sky": not sc["enclosed"],
                               "night": "night" in sc["mood"], "pieces": pieces, "planes": planes, "rain": rain, "crowd": crowd, "limit": lim, "azimuth": st.get("azimuth", 0), "shots": shots})
    os.makedirs(f"{ROOT}/inkbeat/src/film/data", exist_ok=True)
    open(f"{ROOT}/inkbeat/src/film/data/{name}.ts", "w").write("// GENERATED by scene/compile.py. Do not edit by hand.\nimport type { FilmData } from \"../types\";\nexport const film: FilmData = " + json.dumps(film, indent=1, ensure_ascii=False) + ";\n")
    for n_ in notes: print("NOTE", n_)
    print(f"{name}: {len(film['scenes'])} scenes, {sum(len(s['shots']) for s in film['scenes'])} shots, {sum(len(s['pieces']) for s in film['scenes'])} pieces, {film['frames']} frames")


if __name__ == "__main__": compile_film(sys.argv[1])
