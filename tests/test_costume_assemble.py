from pathlib import Path

from PIL import Image

from motion_studio import costume_assemble as ca


def png(p: Path):
    p.parent.mkdir(parents=True, exist_ok=True); Image.new("RGBA", (4, 4), (1, 2, 3, 255)).save(p)


def make_stand(root: Path, name="role_tech"):
    for i in range(12):
        png(root / name / f"body_{i:02d}.png")
    for h in ca.HEADS:
        png(root / name / f"head_{h}.png")


def test_assemble_borrows_heads_and_missing_poses(tmp_path):
    a = tmp_path / "assets2d"; make_stand(a)
    loop = tmp_path / "loop"
    for i in (0, 1, 2, 5):
        png(loop / f"body_{i:02d}.png")
    r = ca.assemble(loop, "bombsuit", a, "tech")
    assert r["ok"] and r["bodies_from_loop"] == [0, 1, 2, 5] and len(r["bodies_borrowed"]) == 8
    assert (a / "bombsuit" / "head_smug.png").exists() and (a / "bombsuit" / "assembled.json").exists()
    assert any("borrowed" in w for w in r["warnings"])


def test_assemble_falls_back_to_explorer_and_refuses_empty(tmp_path):
    a = tmp_path / "assets2d"; make_stand(a, "explorer")
    loop = tmp_path / "loop"; loop.mkdir()
    assert not ca.assemble(loop, "x", a, "nobody")["ok"]
    png(loop / "body_00.png")
    r = ca.assemble(loop, "x", a, "nobody")
    assert r["ok"] and r["stand_in"] == "explorer"


def test_no_stand_in_at_all(tmp_path):
    loop = tmp_path / "loop"; png(loop / "body_00.png")
    assert not ca.assemble(loop, "x", tmp_path / "none", None)["ok"]


def test_soft_picks_takes_colour_failures_only():
    from motion_studio import costume_auto as ca
    r = lambda ok, why, sc=1.0: {"pass": ok, "why": why, "score": sc}
    scored = {"a": [r(False, ["old outfit colour left"]), r(False, ["silhouette"]), r(True, [])],
              "b": [r(False, ["height"]), r(False, ["costume colour"]), r(False, ["costume colour", "pale patch in suit"])]}
    picks = {0: None, 1: None, 2: ("a", scored["a"][2])}
    out, filled = ca.soft_picks(scored, picks)
    assert filled == [0] and out[0][0] == "a" and out[1] is None
    assert ca.soft_picks(scored, {0: ("a", {}), 1: ("a", {}), 2: ("a", {})}) == ({0: ("a", {}), 1: ("a", {}), 2: ("a", {})}, [])
