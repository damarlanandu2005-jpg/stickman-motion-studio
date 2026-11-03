import ast
import hashlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_animation_proof_notebook as builder  # noqa: E402
from motion_studio import kaggle_runner as kr  # noqa: E402

IDENTITY = {"run_id": "run-9", "run_token": "tok-9"}


def write_run(out: Path, mp4: bytes = b"\x00\x00\x00\x18ftypisom" + b"\x00" * 64, **override):
    """Fake output folder: only tests the validator's logic, never evidence of a real render."""
    (out / "render").mkdir(parents=True, exist_ok=True)
    (out / "render" / "render.mp4").write_bytes(mp4)
    report = {"run_token": "tok-9", "run_id": "run-9", "status": "completed", "error_message": None, "width": 1080, "height": 1920,
              "video": {"width": 1080, "height": 1920, "frames": 360, "sha256": hashlib.sha256(mp4).hexdigest()},
              "render": {"mode": "gpu-egl", "gpu_used": True, "seconds_per_frame_mean": 0.2}}
    report.update(override)
    (out / "proof_report.json").write_text(json.dumps(report))


class NotebookTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.mkdtemp()
        patcher = mock.patch.dict(os.environ, {"STICKMAN_OUT_DIR": tmp + "/out", "STICKMAN_WORK_DIR": tmp + "/work"})
        patcher.start(); self.addCleanup(patcher.stop)

    def test_committed_notebook_is_up_to_date(self):
        self.assertEqual(builder.TARGET.read_text(encoding="utf-8"), builder.render())

    def test_code_cells_parse_and_report_starts_unobserved(self):
        cells = builder.build()["cells"]
        for i, c in enumerate(cells):
            if c["cell_type"] == "code":
                ast.parse("".join(c["source"]), filename=f"cell {i}")
        ns = {}
        exec(compile("".join(cells[1]["source"]), "setup", "exec"), {"__name__": "x"}, ns)
        self.assertEqual(ns["REPORT"]["status"], "running")
        self.assertIsNone(ns["REPORT"]["video"])
        self.assertEqual((ns["WIDTH"], ns["HEIGHT"]), (1080, 1920))

    def test_scene_and_engine_files_exist(self):
        anim = ROOT / "animation"
        for rel in ("dist/page.js", "index.html", "render_frames.py", "reference/short_qa.py", "reference/SOURCE.md", "reference/LICENSE-MIT"):
            self.assertTrue((anim / rel).exists(), rel)
        scene = json.loads((anim / "scenes" / "alien_crystal_proof.json").read_text())
        for asset in scene["assets"].values():
            self.assertTrue((anim / asset["file"]).exists(), asset["file"])
        for ch in scene["characters"]:
            for pose in {p["pose"] for p in ch["poses"]}:
                self.assertTrue((anim / ch["cards"].replace("{pose}", pose)).exists(), pose)

    def test_reference_files_are_unchanged(self):
        source = (ROOT / "animation" / "reference" / "SOURCE.md").read_text()
        for line in source.splitlines():
            if line.startswith("| ") and line.count("`") == 2 and not line.startswith("| File"):
                name, digest = line.split("|")[1].strip(), line.split("`")[1]
                actual = hashlib.sha256((ROOT / "animation" / "reference" / name).read_bytes()).hexdigest()
                self.assertEqual(actual, digest, f"{name} was edited; reference files must stay byte-for-byte upstream")


class ValidatorTests(unittest.TestCase):
    def out(self):
        return Path(tempfile.mkdtemp()) / "out"

    def test_good_run_passes(self):
        out = self.out(); write_run(out)
        self.assertTrue(kr.validate_animation_proof_output(out, IDENTITY)["ok"])

    def test_foreign_token_fails(self):
        out = self.out(); write_run(out, run_token="other")
        self.assertIn("another execution", " ".join(kr.validate_animation_proof_output(out, IDENTITY)["failures"]))

    def test_not_an_mp4_fails(self):
        out = self.out(); write_run(out, mp4=b"hello, not a video at all")
        self.assertIn("not an MP4", " ".join(kr.validate_animation_proof_output(out, IDENTITY)["failures"]))

    def test_hash_mismatch_fails(self):
        out = self.out(); write_run(out)
        (out / "render" / "render.mp4").write_bytes(b"\x00\x00\x00\x18ftypisom" + b"\x01" * 64)
        self.assertIn("hash", " ".join(kr.validate_animation_proof_output(out, IDENTITY)["failures"]))

    def test_failed_render_fails(self):
        out = self.out(); write_run(out, status="failed", error_message="no WebGL")
        self.assertFalse(kr.validate_animation_proof_output(out, IDENTITY)["ok"])

    def test_profile_and_summary(self):
        self.assertIn("animation-proof", kr.PROFILES)
        out = self.out(); write_run(out)
        self.assertIn("gpu_used", kr.summarize_report(out, "animation-proof"))


if __name__ == "__main__":
    unittest.main()
