import json
from pathlib import Path

from PIL import Image

from motion_studio import cast_auto as ca, script_reader as sr

ROOT = Path(__file__).resolve().parents[1]
CAST = {"characters": {"doc": {"stages": {"m": {"costume": "doctor"}}}, "x": {"stages": {"m": {"costume": "ghostsuit"}}}},
        "costumes": {"doctor": {"head": "bald, round glasses, grey mustache"}, "ghostsuit": {"look": "white sheet", "head": "no hair"}}}


def test_needs_lists_heads_and_unknown_poses_only():
    s = sr.parse_script("SCENE\nbg: r\nwho: doc, x\npose: kneel with hands on a box, stand\nsay: hi\nSCENE\nbg: r\nwho: doc\npose: point -> lie in bed\nsay: yo\n")
    r = ca.needs(s, CAST, ROOT)
    assert [h["costume"] for h in r["heads"]] == ["doctor"]
    assert [p["slug"] for p in r["poses"]] == ["kneel_with_hands_on_a_box", "lie_in_bed"]
    assert r["poses"][0]["ref"] == "ds:sprites__doctor__body_00.png"
    assert any("ghostsuit" in x for x in r["skipped"])


def test_head_sheet_check_passes_the_reference_itself():
    ref = ROOT / "animation" / "reference_art" / ca.HEAD_REF
    res = ca.check_head_sheet(ref, ref)
    assert all(res[f]["pass"] for f in ca.CORE_FACES), {f: res[f] for f in ca.CORE_FACES}


def test_head_sheet_check_fails_a_blank_sheet(tmp_path):
    ref = ROOT / "animation" / "reference_art" / ca.HEAD_REF
    blank = tmp_path / "b.png"; Image.new("RGB", (1120, 1408), "white").save(blank)
    assert not any(v["pass"] for v in ca.check_head_sheet(blank, ref).values())


def test_pose_check_on_the_stand_body(tmp_path):
    stand = ROOT / "animation" / "assets2d" / "doctor" / "body_00.png"
    b = Image.open(stand).convert("RGBA"); im = Image.new("RGB", (768, 768), "white")
    k = 600 / b.height; b = b.resize((int(b.width * k), 600)); im.paste(b, (300, 100), b); f = tmp_path / "p.png"; im.save(f)
    r = ca.check_pose(f, stand)
    assert r["pass"], r
    other = ROOT / "animation" / "assets2d" / "soldier" / "body_00.png"
    assert "outfit colour differs" in ca.check_pose(f, other)["why"]


def test_plan_judge_install_round_trip(tmp_path, monkeypatch):
    root = tmp_path / "root"; (root / "animation" / "assets2d" / "doctor").mkdir(parents=True); (root / "animation" / "reference_art" / "headhat").mkdir(parents=True)
    src = ROOT / "animation" / "assets2d" / "doctor" / "body_00.png"
    (root / "animation" / "assets2d" / "doctor" / "body_00.png").write_bytes(src.read_bytes())
    (root / "animation" / "reference_art" / ca.HEAD_REF).write_bytes((ROOT / "animation" / "reference_art" / ca.HEAD_REF).read_bytes())
    req = {"heads": [{"id": "head_doctor", "costume": "doctor", "folder": "doctor", "desc": "bald"}],
           "poses": [{"id": "pose_doctor_kneel", "costume": "doctor", "folder": "doctor", "pose": "kneel", "slug": "kneel", "ref": "ds:x"}]}
    jobs = tmp_path / "jobs.json"; st = tmp_path / "st"
    r = ca.plan(req, 1, st, jobs)
    assert r["jobs"] == 4 and r["uses_dataset"]
    out = tmp_path / "out"; out.mkdir()
    (out / "pose_head_doctor_r1_s0.png").write_bytes((ROOT / "animation" / "reference_art" / ca.HEAD_REF).read_bytes())
    b = Image.open(src).convert("RGBA"); im = Image.new("RGB", (768, 768), "white"); b2 = b.resize((int(b.width * 600 / b.height), 600)); im.paste(b2, (300, 100), b2)
    im.save(out / "pose_pose_doctor_kneel_r1_s0.png")
    j = ca.judge(req, 1, st, out, root)
    assert j["complete"]
    notes = ca.install(req, st, root)
    d = root / "animation" / "assets2d" / "doctor"
    assert (d / "head_smug.png").exists() and (d / "pose_kneel.png").exists() and json.loads((d / "head_source.json").read_text())["desc"] == "bald"
    assert len(notes) == 2 and ca.plan(req, 2, st, jobs)["jobs"] == 0
