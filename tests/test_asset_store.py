import json
from pathlib import Path
from PIL import Image
from motion_studio import asset_store as st


def make_lib(tmp):
    lib = tmp / "lib"; (lib / "backgrounds").mkdir(parents=True); (lib / "objects").mkdir(); (lib / "costumes" / "suit").mkdir(parents=True)
    Image.new("RGB", (8, 8), "red").save(lib / "backgrounds" / "bg_a.png"); Image.new("RGBA", (8, 8)).save(lib / "objects" / "obj_k.png")
    Image.new("RGBA", (8, 8)).save(lib / "costumes" / "suit" / "body_00.png"); (lib / "costumes" / "suit" / "manifest.json").write_text("{}")
    idx = {"items": {"bg_a": {"type": "background", "tags": ["a"], "file": "backgrounds/bg_a.png"}, "obj_k": {"type": "object", "tags": ["key"], "file": "objects/obj_k.png"}}}
    (lib / "index.json").write_text(json.dumps(idx)); return lib


def test_flat_names_round_trip():
    assert st.flat_name("costumes/suit/body_00.png") == "costumes__suit__body_00.png" and st.rel_path("costumes__suit__body_00.png") == "costumes/suit/body_00.png"


def test_stage_then_unstage_gives_the_same_library(tmp_path):
    lib = make_lib(tmp_path); st.stamp_hashes(lib); stage = tmp_path / "stage"
    info = st.stage_upload(lib, stage, "me", "assets")
    assert info["items"] == 2 and (stage / "dataset-metadata.json").exists() and (stage / "backgrounds__bg_a.png").exists() and (stage / "index.json").exists()
    lib2 = tmp_path / "lib2"; st.unstage(stage, lib2)
    assert (lib2 / "costumes/suit/body_00.png").exists() and (lib2 / "index.json").exists()
    assert st.verify(lib2, ["bg_a", "obj_k"])["ok"]


def test_verify_catches_missing_and_changed_files(tmp_path):
    lib = make_lib(tmp_path); st.stamp_hashes(lib)
    Image.new("RGB", (8, 8), "blue").save(lib / "backgrounds" / "bg_a.png")
    (lib / "objects" / "obj_k.png").unlink()
    r = st.verify(lib, ["bg_a", "obj_k", "ghost"])
    assert not r["ok"] and len(r["problems"]) == 3


def test_stage_refuses_an_index_entry_without_a_file(tmp_path):
    lib = make_lib(tmp_path); (lib / "objects" / "obj_k.png").unlink()
    try:
        st.stage_upload(lib, tmp_path / "s", "me", "a"); assert False
    except FileNotFoundError:
        pass


def test_down_reports_no_dataset_and_up_creates_when_version_fails(tmp_path):
    lib = make_lib(tmp_path)
    nodata = lambda a: (1, "404 Not Found") if a[2] == "download" else (0, "ref,title\n")
    assert st.down("me", "x", tmp_path / "l", runner=nodata, sleep=lambda s: None)["no_dataset"]
    assert not st.down("me", "x", tmp_path / "l", runner=lambda a: (1, "network error"), sleep=lambda s: None)["ok"]
    calls = []
    def run(a):
        calls.append(a[2]); return (1, "no such dataset") if a[2] == "version" else (0, "ready" if a[2] == "status" else "ok")
    r = st.up("me", "x", "m", lib, runner=run, sleep=lambda s: None)
    assert r["ok"] and r["created"] and calls[:2] == ["version", "create"] and calls[-1] == "status"


def test_up_fails_if_dataset_never_becomes_ready(tmp_path):
    lib = make_lib(tmp_path)
    r = st.up("me", "x", "m", lib, runner=lambda a: (0, "running"), sleep=lambda s: None, wait_s=30)
    assert not r["ok"]


def test_sprites_travel_with_the_library(tmp_path):
    lib = make_lib(tmp_path); sp = tmp_path / "sp"; (sp / "role_chief").mkdir(parents=True); Image.new("RGBA", (8, 8)).save(sp / "role_chief" / "body_00.png")
    st.stamp_hashes(lib); stage = tmp_path / "stage"; info = st.stage_upload(lib, stage, "me", "a", sp)
    assert info["sprites"] == 1 and (stage / "sprites__role_chief__body_00.png").exists()
    lib2, sp2 = tmp_path / "lib2", tmp_path / "sp2"; st.unstage(stage, lib2, sp2)
    assert (sp2 / "role_chief" / "body_00.png").exists() and not (lib2 / "sprites__role_chief__body_00.png").exists()
    assert st.verify(lib2, ["bg_a"], sp2)["ok"]
    (sp2 / "role_chief" / "body_00.png").unlink()
    assert not st.verify(lib2, ["bg_a"], sp2)["ok"]


def test_403_is_not_believed_without_the_list_confirming_it(tmp_path):
    calls = []
    def listed(args):
        calls.append(args[2])
        if args[2] == "download": return 1, "403 Client Error: Forbidden"
        if args[2] == "status": return 0, "ready"                      # Kaggle says the dataset exists
        return 0, "ref,title\nme/assets,Stickman assets\n"
    r = st.down("me", "assets", tmp_path / "lib", runner=listed, sleep=lambda s: None)
    assert not r["ok"] and not r["no_dataset"] and calls.count("download") == 4
    def gone(args):
        if args[2] == "status": return 1, "404 Not Found"
        return (1, "403 Forbidden") if args[2] == "download" else (0, "ref,title\n")
    r = st.down("me", "assets", tmp_path / "lib", runner=gone, sleep=lambda s: None)
    assert r["ok"] and r["no_dataset"]
