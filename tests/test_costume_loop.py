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
