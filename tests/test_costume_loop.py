import json
from pathlib import Path
from PIL import Image
from motion_studio import costume_loop as cl
import motion_studio.costume_check as cc

SPEC = json.loads((Path(__file__).resolve().parents[1] / "animation/costume_specs/bombsuit.json").read_text())


def test_spec_files_exist_and_prompts_present():
    root = Path(__file__).resolve().parents[1] / "animation/reference_art"
    assert (root / SPEC["old_sheet"]).exists() and (root / SPEC["old_info"]).exists()
    assert "shins" in SPEC["prompt_first"] and SPEC["max_rounds"] >= 2


def test_plan_round1_uses_old_sheet_only_and_round2_adds_accepted(tmp_path):
    art = tmp_path / "art"; (art / "cast").mkdir(parents=True); jobs = tmp_path / "jobs.json"
    r1 = cl.plan(SPEC, 1, tmp_path / "st", art, jobs)
    j = json.loads(jobs.read_text())["jobs"]
    assert r1["refs"] == [SPEC["old_sheet"]] and len(j) == SPEC["first_round_seeds"] and not r1["needs_ref_commit"]
    acc = tmp_path / "st" / "out" / SPEC["name"]; acc.mkdir(parents=True)
    Image.new("RGB", (cc.SHEET_W, cc.SHEET_H), "white").save(acc / "accepted_sheet.png")
    r2 = cl.plan(SPEC, 2, tmp_path / "st", art, jobs)
    j2 = json.loads(jobs.read_text())["jobs"]
    assert len(r2["refs"]) == 2 and r2["needs_ref_commit"] and (art / r2["refs"][1]).exists()
    assert not {x["seed"] for x in j} & {x["seed"] for x in j2} and "Two reference images" in j2[0]["prompt"]


def test_judge_with_no_sheets_reports_everything_missing(tmp_path):
    out = tmp_path / "o"; out.mkdir()
    rep = cl.judge(SPEC, 1, tmp_path / "st", out)
    assert not rep["complete"] and len(rep["missing_poses"]) == 12 and rep["human_reviewed"] is False


def _fake_state(tmp_path, accepted=(0, 1, 2), missing=(10,)):
    st = tmp_path / "st" / "out" / SPEC["name"]; st.mkdir(parents=True)
    Image.new("RGB", (cc.SHEET_W, cc.SHEET_H), "white").save(st / "accepted_sheet.png")
    for i in accepted:
        Image.new("RGBA", (50, 80), (60, 85, 40, 255)).save(st / f"body_{i:02d}.png")
    (st / "manifest.json").write_text(json.dumps({"poses": {str(i): {} for i in accepted}, "missing": list(missing)}))
    return tmp_path / "st"


def test_pose_round_makes_one_job_per_seed_per_missing_pose_with_two_refs(tmp_path):
    art = tmp_path / "art"; (art / "cast").mkdir(parents=True)
    root = Path(__file__).resolve().parents[1] / "animation/reference_art/cast"
    for f in (SPEC["old_sheet"], SPEC["old_info"]):
        (art / f).write_bytes((root.parent / f).read_bytes())
    state = _fake_state(tmp_path)
    r = cl.plan(SPEC, SPEC["pose_rounds_from"], state, art, tmp_path / "jobs.json")
    jobs = json.loads((tmp_path / "jobs.json").read_text())["jobs"]
    assert r["mode"] == "pose" and len(jobs) == SPEC["pose_seeds"] and all(len(j["refs"]) == 2 and j["width"] == 768 for j in jobs)
    assert all((art / ref).exists() for j in jobs for ref in j["refs"])


def test_fallback_is_labelled_and_never_counts_as_accepted(tmp_path):
    art = tmp_path / "art"; (art / "cast").mkdir(parents=True)
    root = Path(__file__).resolve().parents[1] / "animation/reference_art/cast"
    for f in (SPEC["old_sheet"], SPEC["old_info"]):
        (art / f).write_bytes((root.parent / f).read_bytes())
    state = _fake_state(tmp_path)
    fb = cl.fallbacks(SPEC, state, art)
    man = json.loads((state / "out" / SPEC["name"] / "manifest.json").read_text())
    assert "10" in fb and "NOT a redrawn pose" in fb["10"]["note"] and 10 in man["missing"]
