import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from motion_studio import asset_auto as aa
from motion_studio import asset_store as store

W, H = aa.W, aa.H


def _bg(path, seed=0):
    rng = np.random.RandomState(seed)
    a = np.full((H, W, 3), (210, 200, 170), np.uint8)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    for i in range(6):
        x = int(rng.randint(0, W - 100)); d.rectangle([x, 100 + i * 80, x + 90, 160 + i * 80], outline=(30, 30, 30), width=4, fill=(150, 170, 200))
    im.save(path)


def _obj(path, size=250):
    im = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(im)
    d.ellipse([W // 2 - size // 2, H // 2 - size // 2, W // 2 + size // 2, H // 2 + size // 2], fill=(200, 30, 30), outline=(0, 0, 0), width=5)
    im.save(path)


def _lib(tmp):
    lib = tmp / "lib"; (lib / "backgrounds").mkdir(parents=True); items = {}
    for k in range(4):
        _bg(lib / "backgrounds" / f"bg_{k}.png", k)
        items[f"bg_{k}"] = {"type": "background", "tags": ["room"], "desc": "room", "file": f"backgrounds/bg_{k}.png"}
    (lib / "index.json").write_text(json.dumps({"items": items}))
    return lib


def test_object_gate(tmp_path):
    _obj(tmp_path / "ok.png"); assert aa.gate_object(tmp_path / "ok.png")["pass"]
    Image.new("RGB", (W, H), "white").save(tmp_path / "white.png"); assert not aa.gate_object(tmp_path / "white.png")["pass"]
    _obj(tmp_path / "big.png", 900); assert not aa.gate_object(tmp_path / "big.png")["pass"]


def test_background_gate(tmp_path):
    lib = _lib(tmp_path); style = aa.library_style(json.loads((lib / "index.json").read_text()), lib)
    _bg(tmp_path / "ok.png", 9); assert aa.gate_background(tmp_path / "ok.png", style)["pass"]
    Image.new("RGB", (W, H), "white").save(tmp_path / "white.png"); assert not aa.gate_background(tmp_path / "white.png", style)["pass"]
    Image.fromarray(np.random.RandomState(1).randint(0, 255, (H, W, 3), np.uint8)).save(tmp_path / "noise.png")
    assert not aa.gate_background(tmp_path / "noise.png", style)["pass"]


def test_plan_new_seeds_and_only_pending(tmp_path):
    lib = _lib(tmp_path); req = {"name": "t", "needs": [{"id": "bg_x", "type": "background", "tags": ["room"], "desc": "a room"},
                                                         {"id": "obj_y", "type": "object", "tags": ["ball"], "desc": "a ball"}]}
    st = tmp_path / "st"; st.mkdir()
    r1 = aa.plan(req, 1, st, lib, tmp_path / "j1.json"); r2 = aa.plan(req, 2, st, lib, tmp_path / "j2.json")
    j1 = json.loads((tmp_path / "j1.json").read_text())["jobs"]; j2 = json.loads((tmp_path / "j2.json").read_text())["jobs"]
    assert r1["jobs"] == 4 and r1["uses_dataset"]
    assert {j["seed"] for j in j1}.isdisjoint({j["seed"] for j in j2})
    assert all(j["refs"] == [] for j in j1 if j["id"].startswith("obj_y"))     # objects are text-only
    assert all(r.startswith("ds:backgrounds__") for j in j1 if j["id"].startswith("bg_x") for r in j["refs"])
    (st / "accepted.json").write_text(json.dumps({"bg_x": "f.png"}))
    assert aa.plan(req, 3, st, lib, tmp_path / "j3.json")["pending"] == ["obj_y"]


def test_judge_saves_best_and_redraws_failed(tmp_path):
    lib = _lib(tmp_path); st = tmp_path / "st"; out = tmp_path / "out"; out.mkdir()
    req = {"name": "t", "needs": [{"id": "bg_x", "type": "background", "tags": ["room"], "desc": "a room"},
                                  {"id": "obj_y", "type": "object", "tags": ["ball"], "desc": "a ball"}]}
    _bg(out / "pose_bg_x_r1_c0.png", 7); Image.new("RGB", (W, H), "white").save(out / "pose_bg_x_r1_c1.png")
    Image.new("RGB", (W, H), "white").save(out / "pose_obj_y_r1_c0.png")             # object picture failed
    rep = aa.judge(req, 1, st, out, lib)
    assert rep["accepted"] == ["bg_x"] and rep["still_missing"] == ["obj_y"] and not rep["complete"] and rep["human_reviewed"] is False
    idx = json.loads((lib / "index.json").read_text())["items"]
    assert "bg_x" in idx and idx["bg_x"]["sha256"] and (lib / "backgrounds" / "bg_x.png").is_file()
    assert store.verify(lib, ["bg_x"])["ok"]
    out2 = tmp_path / "out2"; out2.mkdir(); _obj(out2 / "pose_obj_y_r2_c0.png")      # round 2 redraw passes
    rep = aa.judge(req, 2, st, out2, lib)
    assert rep["complete"] and "obj_y" in json.loads((lib / "index.json").read_text())["items"]
    assert (lib / "objects" / "obj_y.png").is_file() and store.verify(lib, ["bg_x", "obj_y"])["ok"]


def test_pale_blue_bottom_is_rejected_and_library_style_floor_is_not(tmp_path):
    lib = _lib(tmp_path); style = aa.library_style(json.loads((lib / "index.json").read_text()), lib)
    bad = Image.open(lib / "backgrounds" / "bg_0.png").convert("RGB"); d = ImageDraw.Draw(bad); d.rectangle([0, 760, W, H], fill=(205, 245, 253))
    assert aa.pale_blue_bottom(bad); bad.save(tmp_path / "bad.png")
    r = aa.gate_background(tmp_path / "bad.png", style); assert any("pale sky-blue" in w for w in r["why"])
    assert not aa.pale_blue_bottom(Image.open(lib / "backgrounds" / "bg_1.png"))
