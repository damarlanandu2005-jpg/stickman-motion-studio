#!/usr/bin/env python3
"""The asset library: one catalogue, look up before generating, save everything new.

  python3 library.py list [kind]                     what the library holds
  python3 library.py find <words...>                 search ids, tags and descriptions (all kinds)
  python3 library.py ingest                          turn new raw/ generations into finished assets and register them
  python3 library.py use <project_dir> <id> [...]    copy characters / hats / textures / backdrops into a project
  python3 library.py cast <project_dir>              read <project>/cast.json, report which roles the library covers and
                                                     write the missing ones to library/requests_missing.json for gen_library.py

Layout (ricks/library): catalog.json, characters/<id>/ (rig.json, layers, faces/), hats/<id>.png, textures/, backdrops/, raw/ (untouched generations).
cast.json: {"roles": [{"role": "policeman 1", "want": "police", "hat": "kepi"}, ...]}
"""
import json, os, shutil, subprocess, sys, glob
HERE = os.path.dirname(os.path.abspath(__file__)); LIB = os.path.join(HERE, "..", "library"); STAGE = os.path.join(HERE, "..", "stage")
CAT = os.path.join(LIB, "catalog.json")
SHEET_NAMES = {"a": "happy,nervous,shocked,shouting,confused,neutral", "b": "sad,angry,scared,laughing,smug,crying", "c": "scheming,embarrassed,determined,tired,skeptical,disgusted"}

def cat():
    return json.load(open(CAT)) if os.path.exists(CAT) else {"characters": {}, "hats": {}, "textures": {}, "backdrops": {}, "motions": {}, "props3d": {}}
def save(c): json.dump(c, open(CAT, "w"), indent=1, sort_keys=True)
def run(cmd):
    p = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT); return p.returncode, p.stdout.strip()[-400:]
def requests():
    p = os.path.join(LIB, "requests.json"); return {(i["kind"], i["id"]): i for i in json.load(open(p))["items"]} if os.path.exists(p) else {}

def trim(path):
    from PIL import Image
    im = Image.open(path).convert("RGBA"); bb = im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    if bb: im.crop(bb).save(path)
    return im.size if not bb else (bb[2] - bb[0], bb[3] - bb[1])

def ingest():
    c = cat(); raw = os.path.join(LIB, "raw"); req = requests(); rep = []
    for src in sorted(glob.glob(os.path.join(raw, "*_character.png"))):
        cid = os.path.basename(src)[:-len("_character.png")]; d = os.path.join(LIB, "characters", cid)
        ent = c["characters"].get(cid, {})
        if not os.path.exists(os.path.join(d, "rig.json")):
            os.makedirs(d, exist_ok=True)
            run([sys.executable, os.path.join(HERE, "cutout.py"), src, os.path.join(d, "source.png")])
            rc, out = run([sys.executable, os.path.join(STAGE, "puppet.py"), "slice", os.path.join(d, "source.png"), d])
            if rc or not os.path.exists(os.path.join(d, "rig.json")): rep.append("FAIL slice %s: %s" % (cid, out)); continue
            run([sys.executable, os.path.join(HERE, "fix_hands.py"), d])
            ent = {"desc": req.get(("character", cid), {}).get("who", ""), "faces": [], "sheets": []}
        rig = json.load(open(os.path.join(d, "rig.json")))
        ent["limbs"] = sorted(k for k in rig["layers"] if k not in ("body", "head")); ent["bare_head"] = not req.get(("character", cid), {}).get("headgear", False)
        for s, names in SHEET_NAMES.items():
            sh = os.path.join(raw, "%s_sheet_%s.png" % (cid, s))
            if s in ent.get("sheets", []) or not os.path.exists(sh): continue
            cut = os.path.join(d, "emotions_%s.png" % s); run([sys.executable, os.path.join(HERE, "cutout.py"), sh, cut])
            rc, out = run([sys.executable, os.path.join(STAGE, "puppet.py"), "faces", cut, d, "--names", names])
            if rc: rep.append("FAIL faces %s sheet %s: %s" % (cid, s, out)); continue
            ent.setdefault("sheets", []).append(s); shutil.copy(os.path.join(d, "faces_preview.png"), os.path.join(d, "faces_preview_%s.png" % s))
        ent["faces"] = sorted(json.load(open(os.path.join(d, "rig.json"))).get("faces", {}))
        ent["path"] = "characters/" + cid; ent.setdefault("period", req.get(("character", cid), {}).get("period", "1920s")); ent.setdefault("tags", [w.strip(",.:").lower() for w in ent.get("desc", "").split() if len(w) > 3][:14])
        c["characters"][cid] = ent; rep.append("character %s: limbs %s, %d faces" % (cid, ",".join(ent["limbs"]), len(ent["faces"])))
    for src in sorted(glob.glob(os.path.join(raw, "hat_*.png"))):
        hid = os.path.basename(src)[4:-4]; out = os.path.join(LIB, "hats", hid + ".png")
        if hid in c["hats"] and os.path.exists(out): continue
        run([sys.executable, os.path.join(HERE, "cutout.py"), src, out]); w, h = trim(out)
        c["hats"][hid] = {"path": "hats/%s.png" % hid, "desc": req.get(("hat", hid), {}).get("what", ""), "size": [w, h], "scale": 1.05, "sit": 0.2, "period": req.get(("hat", hid), {}).get("period", "1920s")}
        rep.append("hat %s: %dx%d" % (hid, w, h))
    for kind, pre, folder in (("textures", "tex_", "textures"), ("backdrops", "backdrop_", "backdrops")):
        for src in sorted(glob.glob(os.path.join(raw, pre + "*.png"))):
            i = os.path.basename(src)[len(pre):-4]
            if i in c[kind]: continue
            shutil.copy(src, os.path.join(LIB, folder, i + ".png")); c[kind][i] = {"path": "%s/%s.png" % (folder, i), "desc": req.get((kind[:-1], i), {}).get("surface", "")}
            rep.append("%s %s" % (kind[:-1], i))
    save(c); print("\n".join(rep) or "nothing new")

def find(words):
    c = cat(); hits = []
    for kind, items in c.items():
        for i, e in items.items():
            text = (i + " " + " ".join(e.get("tags", [])) + " " + e.get("desc", "")).lower()
            score = sum(1 for w in words if w.lower() in text)
            if score: hits.append((score, kind, i, e.get("desc", "")[:70]))
    for s, kind, i, d in sorted(hits, reverse=True): print("%d  %-11s %-14s %s" % (s, kind, i, d))
    return [(k, i) for s, k, i, d in sorted(hits, reverse=True)]

def use(project, ids):
    c = cat()
    for i in ids:
        if i in c["characters"]: dst = os.path.join(project, "puppets", i); shutil.rmtree(dst, ignore_errors=True); shutil.copytree(os.path.join(LIB, "characters", i), dst, ignore=shutil.ignore_patterns("emotions_*", "source.png", "*preview*")); print("character", i, "->", dst)
        elif i in c["hats"]: os.makedirs(os.path.join(project, "hats"), exist_ok=True); shutil.copy(os.path.join(LIB, c["hats"][i]["path"]), os.path.join(project, "hats", i + ".png")); print("hat", i)
        elif i in c["textures"]: os.makedirs(os.path.join(project, "textures"), exist_ok=True); shutil.copy(os.path.join(LIB, c["textures"][i]["path"]), os.path.join(project, "textures", i + ".png")); print("texture", i)
        elif i in c["backdrops"]: os.makedirs(os.path.join(project, "bg"), exist_ok=True); shutil.copy(os.path.join(LIB, c["backdrops"][i]["path"]), os.path.join(project, "bg", i + ".png")); print("backdrop", i)
        else: print("NOT IN LIBRARY:", i)

def cast(project):
    c = cat(); roles = json.load(open(os.path.join(project, "cast.json")))["roles"]; missing = []
    for r in roles:
        words = r["want"].split(); best = None
        for i, e in c["characters"].items():
            text = (i + " " + " ".join(e.get("tags", [])) + " " + e.get("desc", "")).lower(); s = sum(1 for w in words if w.lower() in text)
            if s and (best is None or s > best[0]) and i not in [x.get("use") for x in roles]: best = (s, i)
        if best: r["use"] = best[1]; print("%-22s -> %s%s" % (r["role"], best[1], (" + hat " + r["hat"]) if r.get("hat") else ""))
        else: print("%-22s -> MISSING (%s)" % (r["role"], r["want"])); missing.append({"kind": "character", "id": r["role"].replace(" ", "_"), "who": r.get("who", r["want"])})
        if r.get("hat") and r["hat"] not in c["hats"]: print("   hat %s MISSING" % r["hat"]); missing.append({"kind": "hat", "id": r["hat"], "what": r["hat"]})
    json.dump({"roles": roles}, open(os.path.join(project, "cast.json"), "w"), indent=1)
    if missing: json.dump({"items": missing}, open(os.path.join(LIB, "requests_missing.json"), "w"), indent=1); print(len(missing), "missing -> library/requests_missing.json")

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    if a[0] == "list":
        for kind, items in cat().items():
            if len(a) > 1 and a[1] != kind: continue
            print(kind + ":", ", ".join("%s%s" % (i, ("(%d faces)" % len(e["faces"])) if "faces" in e else "") for i, e in sorted(items.items())) or "-")
    elif a[0] == "find": find(a[1:])
    elif a[0] == "ingest": ingest()
    elif a[0] == "use": use(a[1], a[2:])
    elif a[0] == "cast": cast(a[1])
    else: sys.exit(__doc__)
