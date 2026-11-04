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


def test_plan_new_seeds_and_only_pending(tmp_path, monkeypatch):
    monkeypatch.setenv("ASSET_REFS", "1")      # the old behaviour is still available as a switch
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


def test_pale_band_is_cut_off_and_too_tall_band_is_refused(tmp_path):
    lib = _lib(tmp_path); style = aa.library_style(json.loads((lib / "index.json").read_text()), lib)
    im = Image.open(lib / "backgrounds" / "bg_0.png").convert("RGB"); d = ImageDraw.Draw(im); d.rectangle([0, 860, W, H], fill=(205, 245, 253))
    assert aa.band_start(im) == 860
    fixed = aa.repair_bottom(im); assert fixed.size == (W, H) and not aa.pale_blue_bottom(fixed)
    d.rectangle([0, 600, W, H], fill=(205, 245, 253)); assert aa.repair_bottom(im) is None
    assert aa.repair_bottom(Image.open(lib / "backgrounds" / "bg_1.png")).size == (W, H)    # no band: unchanged picture


def test_judge_repairs_a_banded_picture_and_saves_the_repair(tmp_path, monkeypatch):
    monkeypatch.setattr(aa, "gate_background", lambda c, style, refs=None: {"pass": True, "why": [], "score": 0.0})   # the style numbers of a 4-picture toy library are too narrow for a stretched picture
    lib = _lib(tmp_path); st = tmp_path / "st"; out = tmp_path / "out"; out.mkdir()
    req = {"name": "t", "needs": [{"id": "bg_x", "type": "background", "tags": ["room"], "desc": "a room"}]}
    im = Image.open(lib / "backgrounds" / "bg_2.png").convert("RGB"); ImageDraw.Draw(im).rectangle([0, 850, W, H], fill=(205, 245, 253)); im.save(out / "pose_bg_x_r1_c0.png")
    rep = aa.judge(req, 1, st, out, lib)
    assert rep["complete"] and "repair" in rep["gate_log"]["bg_x"][0]
    assert not aa.pale_blue_bottom(Image.open(lib / "backgrounds" / "bg_x.png"))


def _scene(path, sun=False, seed=0):
    im = Image.new("RGB", (W, H), (130, 170, 230)); d = ImageDraw.Draw(im)
    rng = np.random.RandomState(seed)
    for i in range(6):
        x = int(rng.randint(0, W - 150)); d.rectangle([x, 500 + i * 60, x + 140, 560 + i * 60], outline=(20, 20, 20), width=5, fill=(120, 110, 100))
    if sun:
        d.ellipse([330, 40, 560, 270], fill=(255, 220, 60), outline=(20, 20, 20), width=5)
    im.save(path)


def test_continuation_gate_wants_same_layout_and_a_visible_change(tmp_path):
    lib = _lib(tmp_path); style = aa.library_style(json.loads((lib / "index.json").read_text()), lib)
    _scene(tmp_path / "base.png", sun=False); _scene(tmp_path / "sun.png", sun=True); _scene(tmp_path / "same.png", sun=False); _scene(tmp_path / "other.png", sun=True, seed=5)
    ok = aa.gate_continuation(tmp_path / "sun.png", tmp_path / "base.png", style)
    assert ok["struct"] > 0.6 and ok["changed"] > 0.02
    same = aa.gate_continuation(tmp_path / "same.png", tmp_path / "base.png", style); assert any("nothing visible changed" in w for w in same["why"])
    other = aa.gate_continuation(tmp_path / "other.png", tmp_path / "base.png", style); assert any("not the same place" in w for w in other["why"])


def test_plan_draws_a_continuation_from_its_base_and_waits_when_the_base_is_missing(tmp_path):
    lib = _lib(tmp_path); st = tmp_path / "st"; st.mkdir()
    need = {"id": "bg_room_sun", "type": "background", "tags": ["room", "sun"], "desc": "room with sun", "base": "bg_0", "change": "sun"}
    waits = {"id": "bg_room_night", "type": "background", "tags": ["room", "night"], "desc": "room at night", "base": "bg_room_new", "change": "night"}
    r = aa.plan({"name": "t", "needs": [need, waits]}, 1, st, lib, tmp_path / "j.json")
    jobs = json.loads((tmp_path / "j.json").read_text())["jobs"]
    assert r["waiting"] == ["bg_room_night"] and all(j["id"].startswith("bg_room_sun") for j in jobs)
    assert all(j["refs"] == ["ds:backgrounds__bg_0.png"] and j["prompt"].startswith("Edit the reference picture") and "it is now sun" in j["prompt"] for j in jobs)


def test_judge_saves_a_continuation_with_its_base_and_asks_for_a_dataset_update(tmp_path, monkeypatch):
    lib = _lib(tmp_path); st = tmp_path / "st"; out = tmp_path / "out"; out.mkdir()
    base = {"id": "bg_new", "type": "background", "tags": ["room"], "desc": "a room"}
    cont = {"id": "bg_new_sun", "type": "background", "tags": ["room", "sun"], "desc": "a room with sun", "base": "bg_new", "change": "sun"}
    req = {"name": "t", "needs": [base, cont]}
    monkeypatch.setattr(aa, "gate_background", lambda c, style, refs=None, skip=(): {"pass": True, "why": [], "score": 0.0})
    _scene(out / "pose_bg_new_r1_c0.png")
    rep = aa.judge(req, 1, st, out, lib)
    assert rep["accepted"] == ["bg_new"] and rep["needs_dataset_update"] == ["bg_new_sun"]
    out2 = tmp_path / "out2"; out2.mkdir(); _scene(out2 / "pose_bg_new_sun_r2_c0.png", sun=True); (st / "candidates" / "pose_bg_new_r1_c0.png").exists()
    rep = aa.judge(req, 2, st, out2, lib)
    it = json.loads((lib / "index.json").read_text())["items"]["bg_new_sun"]
    assert rep["complete"] and it["base"] == "bg_new" and it["change"] == "sun"


def test_a_new_place_takes_no_reference_by_default(tmp_path):
    lib = _lib(tmp_path); st = tmp_path / "st"; st.mkdir()
    r = aa.plan({"name": "t", "needs": [{"id": "bg_x", "type": "background", "tags": ["room"], "desc": "a room"}]}, 1, st, lib, tmp_path / "j.json")
    assert not r["uses_dataset"] and all(j["refs"] == [] for j in json.loads((tmp_path / "j.json").read_text())["jobs"])


def test_soft_issues_are_redrawn_then_accepted_with_warnings_and_hard_issues_never_used(tmp_path):
    lib = _lib(tmp_path); st = tmp_path / "st"; out1 = tmp_path / "o1"; out1.mkdir()
    req = {"name": "t", "needs": [{"id": "obj_y", "type": "object", "tags": ["ball"], "desc": "a ball"},
                                  {"id": "obj_z", "type": "object", "tags": ["cube"], "desc": "a cube"}]}
    _obj(out1 / "pose_obj_y_r1_c0.png", 900)                                   # too big: soft issue only
    Image.new("RGB", (W, H), "white").save(out1 / "pose_obj_z_r1_c0.png")      # blank: hard issue
    rep = aa.judge(req, 1, st, out1, lib, max_rounds=2)
    assert rep["accepted"] == [] and (st / "fallback.json").exists()           # soft: kept as fallback, will be drawn again
    out2 = tmp_path / "o2"; out2.mkdir(); Image.new("RGB", (W, H), "white").save(out2 / "pose_obj_z_r2_c0.png")
    rep = aa.judge(req, 2, st, out2, lib, max_rounds=2)                        # last round
    assert rep["accepted"] == ["obj_y"] and "obj_y" in rep["accepted_with_warnings"] and rep["still_missing"] == ["obj_z"]
    assert json.loads((lib / "index.json").read_text())["items"]["obj_y"]["warnings"]


def test_finalize_accepts_the_best_fallback_without_new_pictures(tmp_path):
    lib = _lib(tmp_path); st = tmp_path / "st"; out = tmp_path / "o"; out.mkdir()
    req = {"name": "t", "needs": [{"id": "obj_y", "type": "object", "tags": ["ball"], "desc": "a ball"}]}
    _obj(out / "pose_obj_y_r1_c0.png", 900); aa.judge(req, 1, st, out, lib, max_rounds=3)
    rep = aa.judge(req, 3, st, None, lib, max_rounds=3)
    assert rep["complete"] and "obj_y" in rep["accepted_with_warnings"]


def test_next_view_needs_the_same_colours_and_a_new_view(tmp_path):
    lib = _lib(tmp_path); style = aa.library_style(json.loads((lib / "index.json").read_text()), lib)
    _scene(tmp_path / "base.png"); _scene(tmp_path / "copy.png")
    d = Image.new("RGB", (W, H), (200, 60, 60)); d.save(tmp_path / "red.png")                 # other colours, different picture
    _scene(tmp_path / "next.png", seed=7)                                                       # same colours, other arrangement
    ok = aa.gate_continuation(tmp_path / "next.png", tmp_path / "base.png", style, "next")
    assert ok["palette"] > 0.8 and ok["changed"] > 0.1 and not any("continue" in w or "next view" in w for w in ok["why"])
    cp = aa.gate_continuation(tmp_path / "copy.png", tmp_path / "base.png", style, "next"); assert any("not a next view" in w for w in cp["why"])
    rd = aa.gate_continuation(tmp_path / "red.png", tmp_path / "base.png", style, "next"); assert any("colours do not continue" in w for w in rd["why"])


def test_drift_from_the_first_picture_of_a_chain_is_noticed(tmp_path):
    lib = _lib(tmp_path); style = aa.library_style(json.loads((lib / "index.json").read_text()), lib)
    _scene(tmp_path / "first.png"); _scene(tmp_path / "second.png", sun=True); _scene(tmp_path / "third.png", sun=True, seed=5)
    g = aa.gate_continuation(tmp_path / "third.png", tmp_path / "second.png", style, "same", tmp_path / "first.png")
    assert "struct_root" in g and g["struct_root"] < aa.ROOT_MIN + 0.3
