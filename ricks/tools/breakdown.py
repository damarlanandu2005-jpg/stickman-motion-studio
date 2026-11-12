#!/usr/bin/env python3
"""Director's breakdown -> checked -> compiled into the stage's short.json.

  breakdown.py check <project>     validate breakdown.json against the library, the word timings and the pipeline rules
  breakdown.py build <project>     copy the needed library assets into the project and write short.json

breakdown.json (all positions are relative to the place's "at"):
  title, period, pivot ("say:You see" - light turns to night there; or "lighting": [...] to set it by hand)
  audio {voice, music, musicDb}, words, ground {texture|color, repeat}
  places {id: {kit, at:[x,y,z], backdrop: <library backdrop id>|null, bare: true|false}}
  cast   [{id, char, hat, place, pos, flip, face, height}]
  props  [{place, ...stage prop}]                     story props (the ones the script needs)
  lines  [{say, place, subject | anchor, shot: close|medium|wide|two|insert, move: push|orbitL|orbitR|craneUp|craneDown|pull,
           acts:[{who, at, face, motion, repeat, to, walk, over, hop, shake, hold, pose, flip}], proof, extra:{...shot fields}}]
"""
import json, os, re, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__)); LIB = os.path.normpath(os.path.join(HERE, "..", "library"))
SIZE = {"close": 0.22, "medium": 0.15, "wide": 0.10, "two": 0.13, "insert": 0.30}
MOVE = {"push": dict(zoom=6, orbit=2.2, rise=0.6), "orbitL": dict(zoom=3, orbit=-5, rise=0.8), "orbitR": dict(zoom=3, orbit=5, rise=-0.8),
        "craneUp": dict(zoom=3, orbit=2, rise=3.2), "craneDown": dict(zoom=3, orbit=-2, rise=-3.2), "pull": dict(zoom=-3, orbit=-2.5, rise=1.0)}
YAWS = [-10, 8, -4, 12, -8, 5, -12, 9]
MOTIONS = ["punch", "kick", "run", "swim", "wave", "cheer", "shrug", "point", "fall", "cower", "dance", "bow", "give", "take", "nod", "play"]

def J(p): return json.load(open(p))
def norm(w): return re.sub(r"[^a-z0-9']", "", w.lower())
def words_of(proj, B):
    d = J(os.path.join(proj, B.get("words", "audio/words.json"))); w = d["words"] if isinstance(d, dict) else d
    k = [x for x in w[0] if x not in ("start", "end", "t0", "t1")][0]; s = "start" if "start" in w[0] else "t0"; e = "end" if "end" in w[0] else "t1"
    return [(norm(x[k]), x[s], x.get(e, x[s])) for x in w]
def find_phrase(W, phrase, frm=0):
    p = [norm(x) for x in phrase.split()]; p = [x for x in p if x]
    for i in range(frm, len(W) - len(p) + 1):
        if [W[i + j][0] for j in range(len(p))] == p: return i
    return -1
def absol(place, pos, B): a = B["places"][place]["at"]; return [round(a[0] + pos[0], 3), round(a[1] + pos[1], 3), round(a[2] + pos[2], 3)]

def check(proj, quiet=False):
    B = J(os.path.join(proj, "breakdown.json")); C = J(os.path.join(LIB, "catalog.json")); err, warn = [], []
    W = words_of(proj, B); cast = {c["id"]: c for c in B["cast"]}
    for pid, P in B["places"].items():
        kp = os.path.join(LIB, "kits", P["kit"] + ".json")
        if not os.path.exists(kp): err.append("place %s: kit %s not in library" % (pid, P["kit"])); continue
        K = J(kp)
        if B.get("period") and K.get("period") and B["period"] not in K["period"]: err.append("place %s: kit %s is for %s, the story is %s" % (pid, P["kit"], K["period"], B["period"]))
        if P.get("backdrop") and P["backdrop"] not in C["backdrops"]: err.append("place %s: backdrop %s not in library" % (pid, P["backdrop"]))
        if not P.get("backdrop") and not K.get("interior"): err.append("place %s: outdoor place without its own backdrop" % pid)
        n = len([p for p in K["props"] if p["type"] not in ("box",) or max(p.get("size", [0])) > 0.8]) + len([p for p in B.get("props", []) if p["place"] == pid])
        if not P.get("bare") and not (6 <= n <= 16): warn.append("place %s: %d dressing pieces (reference range 6-10 per shot)" % (pid, n))
        subj_z = [c["pos"][2] for c in B["cast"] if c["place"] == pid]
        for i, L in enumerate(K.get("life", [])):
            zs = [q[1] for q in L["path"]]
            if subj_z and max(zs) > min(subj_z) - 0.8: err.append("place %s: background life %d walks in front of or level with the subjects" % (pid, i))
            if L["char"] not in C["characters"]: err.append("place %s: background character %s not in library" % (pid, L["char"]))
    for c in B["cast"]:
        if c["char"] not in C["characters"]: err.append("cast %s: character %s not in library" % (c["id"], c["char"])); continue
        if c.get("hat") and c["hat"] not in C["hats"]: err.append("cast %s: hat %s not in library" % (c["id"], c["hat"]))
        if c.get("hat") and not C["characters"][c["char"]].get("bare_head", True): err.append("cast %s: %s already wears a hat" % (c["id"], c["char"]))
        if c["place"] not in B["places"]: err.append("cast %s: unknown place %s" % (c["id"], c["place"]))
    at = 0; prev = None; times = []
    for i, L in enumerate(B["lines"]):
        tag = "line %d (%s)" % (i, L.get("say", "start"))
        if i == 0 and not L.get("say"): t = 0.0
        else:
            j = find_phrase(W, L["say"], at)
            if j < 0: err.append(tag + ": phrase not found in the narration after the previous line"); times.append(None); continue
            at = j; t = W[j][1]
        times.append(t)
        if not (L.get("proof") or "").strip(): err.append(tag + ": no visible proof")
        if L["place"] not in B["places"]: err.append(tag + ": unknown place")
        if "subject" in L:
            if L["subject"] not in cast: err.append(tag + ": subject %s not in cast" % L["subject"])
            elif cast[L["subject"]]["place"] != L["place"]: err.append(tag + ": subject %s lives in %s, the line is in %s" % (L["subject"], cast[L["subject"]]["place"], L["place"]))
        elif "anchor" not in L: err.append(tag + ": neither subject nor anchor")
        if L.get("shot", "medium") not in SIZE: err.append(tag + ": unknown shot size")
        if L.get("move", "push") not in MOVE: err.append(tag + ": unknown camera move")
        for a in L.get("acts", []):
            if a["who"] not in cast: err.append(tag + ": act for unknown actor " + a["who"]); continue
            ch = C["characters"].get(cast[a["who"]]["char"], {})
            if a.get("face") and a["face"] not in ch.get("faces", []): err.append(tag + ": %s has no face '%s'" % (cast[a["who"]]["char"], a["face"]))
            if a.get("motion") and a["motion"] not in MOTIONS: err.append(tag + ": unknown motion " + a["motion"])
            if cast[a["who"]]["place"] != L["place"]: warn.append(tag + ": %s acts but stands in another place" % a["who"])
        key = (L.get("subject"), L.get("shot"), L.get("move"))
        if key == prev: warn.append(tag + ": same subject, size and move as the line before")
        prev = key
    ts = [t for t in times if t is not None]; end = W[-1][2]
    for i, t in enumerate(ts):
        d = (ts[i + 1] if i + 1 < len(ts) else end) - t
        if d > 5.0: warn.append("line %d holds for %.1f s (over 5 s): split it or add an insert" % (i, d))
        if d < 0.7: warn.append("line %d lasts only %.1f s" % (i, d))
    if not quiet:
        for e in err: print("ERROR  ", e)
        for w in warn: print("warning", w)
        print("%d lines, %d places, %d cast: %d errors, %d warnings" % (len(B["lines"]), len(B["places"]), len(B["cast"]), len(err), len(warn)))
    return err, warn, B, C, W

def build(proj):
    err, warn, B, C, W = check(proj)
    if err: sys.exit("breakdown has errors: not built")
    M = J(os.path.join(LIB, "moods.json")); dur = W[-1][2] + 0.6
    def cp(src, dst): os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copy(os.path.join(LIB, src), dst)
    S = {"fps": B.get("fps", 30), "audio": B["audio"], "words": B.get("words", "audio/words.json"), "captions": B.get("captions", M.get("captions") or {"wordsPer": 1}),
         "moods": B.get("moods", M["moods"]), "ink": M.get("ink"), "end": "audio"}
    S["lighting"] = B.get("lighting") or [{"t": 0, "mood": "day"}] + ([{"t": B["pivot"], "mood": "night", "fade": 0.8}] if B.get("pivot") else [])
    g = dict(B.get("ground", {"texture": "cobble", "repeat": [150, 150]}))
    if g.get("texture") and g["texture"] in C["textures"]: cp(C["textures"][g["texture"]]["path"], os.path.join(proj, "textures", g["texture"] + ".png")); g["texture"] = "textures/%s.png" % g["texture"]
    S["ground"] = g; S["backdrop"] = []; S["characters"] = []; S["props"] = []; S["actions"] = []
    used_tex = set()
    def p2d(f):                                          # code-drawn 2D props (signs, hand-held things) live in library/props
        if isinstance(f, str) and f.startswith("props/") and not os.path.exists(os.path.join(proj, f)): cp(f, os.path.join(proj, f))
        return f
    def tex(p):
        for k in ("texture", "wall", "roofTexture"):
            v = p.get(k)
            if isinstance(v, str) and v.startswith("textures/"):
                n = os.path.basename(v)[:-4]
                if n in C["textures"] and n not in used_tex: cp(C["textures"][n]["path"], os.path.join(proj, v)); used_tex.add(n)
        p2d(p.get("image"))
        return p
    def actor(cid, char, pos, flip=False, face=None, hat=None, height=1.8):
        dst = os.path.join(proj, "puppets", char)
        if not os.path.exists(dst): shutil.copytree(os.path.join(LIB, "characters", char), dst, ignore=shutil.ignore_patterns("emotions_*", "source.png", "*preview*"))
        else: shutil.copy(os.path.join(LIB, "characters", char, "rig.json"), os.path.join(dst, "rig.json"))
        d = {"id": cid, "puppet": "puppets/" + char, "pos": pos, "height": height, "face": face or ("neutral" if "neutral" in C["characters"][char].get("faces", []) else "default")}
        if flip: d["flip"] = True
        if hat: cp(C["hats"][hat]["path"], os.path.join(proj, "hats", hat + ".png")); d["hat"] = {"file": "hats/%s.png" % hat, "scale": C["hats"][hat]["scale"], "sit": C["hats"][hat]["sit"]}
        S["characters"].append(d)
    for pid, P in B["places"].items():
        K = J(os.path.join(LIB, "kits", P["kit"] + ".json")); a = P["at"]
        if P.get("backdrop"):
            cp(C["backdrops"][P["backdrop"]]["path"], os.path.join(proj, "bg", P["backdrop"] + ".png"))
            S["backdrop"].append({"image": "bg/%s.png" % P["backdrop"], "blur": 3, "repeat": 3, "near": [a[0] - 34, a[0] + 34]})
        for p in K["props"]:
            q = json.loads(json.dumps(p)); q["pos"] = [q["pos"][0] + a[0], q["pos"][1] + a[1], q["pos"][2] + a[2]]; S["props"].append(tex(q))
        for i, L in enumerate(K.get("life", [])):       # background life: loop each behaviour for the whole video
            nid = "npc_%s_%d" % (pid, i); pts = [[a[0] + x, a[1], a[2] + z] for x, z in L["path"]]
            actor(nid, L["char"], pts[0], flip=pts[1][0] < pts[0][0], hat=L.get("hat"), height=L.get("height", 1.7))
            if L.get("behaviour", "stroll") == "stroll":
                import math
                leg = math.dist(pts[0], pts[1]) / L.get("speed", 0.9); t = L.get("start", 0.0); k = 0
                while t < dur:
                    A_, B_ = pts[k % 2], pts[(k + 1) % 2]
                    S["actions"].append({"t": round(t, 2), "who": nid, "to": B_, "walk": True, "over": round(leg, 2), "flip": B_[0] < A_[0]}); t += leg + L.get("pause", 1.2); k += 1
            elif L.get("motion"):
                t = L.get("start", 0.5)
                S["_npc_motion"] = S.get("_npc_motion", []) + [{"who": nid, "motion": L["motion"], "every": L.get("every", 2.0), "repeat": L.get("repeat", 2), "face": L.get("face")}]
    for p in B.get("props", []):
        q = {k: v for k, v in p.items() if k != "place"}; q["pos"] = absol(p["place"], p["pos"], B); S["props"].append(tex(q))
    for c in B["cast"]: actor(c["id"], c["char"], absol(c["place"], c["pos"], B), c.get("flip", False), c.get("face"), c.get("hat"), c.get("height", 1.8))
    npcm = S.pop("_npc_motion", []); shots = []; yi = 0
    for i, L in enumerate(B["lines"]):
        s = {"start": ("say:" + L["say"]) if L.get("say") else 0}
        if "subject" in L: s["target"] = L["subject"]; s["headWidth"] = SIZE[L.get("shot", "medium")]
        else: s["anchor"] = absol(L["place"], L["anchor"], B)
        s.update(MOVE[L.get("move", "push")]); s["yaw"] = L.get("yaw", YAWS[yi % len(YAWS)]); yi += 1; s["pitch"] = L.get("pitch", 6)
        s.update(L.get("extra", {})); acts = []
        for a in L.get("acts", []):
            a = dict(a)
            if "to" in a: a["to"] = absol(B["cast"][[c["id"] for c in B["cast"]].index(a["who"])]["place"], a["to"], B)
            if a.get("hold"): p2d(a["hold"]["file"])
            a.setdefault("at", 0.0); acts.append(a)
        for n in npcm:                                      # background behaviours restart in every shot of their place
            if n["who"].split("_")[1] == L["place"]: acts.append({"who": n["who"], "at": 0.1, "motion": n["motion"], "repeat": n["repeat"], **({"face": n["face"]} if n["face"] else {})})
        s["actions"] = acts
        nxt = B["lines"][i + 1] if i + 1 < len(B["lines"]) else None
        if nxt and nxt["place"] != L["place"] and "out" not in s: s["out"] = "dissolve"; s["outDur"] = 0.45
        shots.append(s)
    S["shots"] = shots
    json.dump(S, open(os.path.join(proj, "short.json"), "w"), indent=1)
    print("built short.json: %d shots, %d characters (%d background), %d props" % (len(shots), len(S["characters"]), len([c for c in S["characters"] if c["id"].startswith("npc_")]), len(S["props"])))

if __name__ == "__main__":
    if len(sys.argv) < 3: sys.exit(__doc__)
    if sys.argv[1] == "check": e, w, *_ = check(sys.argv[2]); sys.exit(1 if e else 0)
    elif sys.argv[1] == "build": build(sys.argv[2])
