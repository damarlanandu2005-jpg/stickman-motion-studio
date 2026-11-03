import ast
import hashlib
import json
import os
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_image_to_3d_notebook as builder  # noqa: E402
from motion_studio import kaggle_runner as kr  # noqa: E402


def make_png(width=4, height=4):
    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + b"\x80\x40\x20" * width for _ in range(height))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


IDENTITY = {"run_id": "run-1", "run_token": "tok-1"}


def write_run(out: Path, **override):
    """A fake Kaggle output folder. Only used to test the validator's logic, never as evidence of a real run."""
    out.mkdir(parents=True, exist_ok=True)
    klein = []
    for name in ("rocket", "crystal_cluster", "space_rover"):
        p = out / f"object_{name}.png"
        p.write_bytes(make_png())
        klein.append({"name": name, "file": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "status": "success"})
    glb = out / "triposr_rocket.glb"
    glb.write_bytes(b"glTF" + b"\x02\x00\x00\x00" + b"\x00" * 16)
    report = {
        "run_token": "tok-1", "run_id": "run-1", "status": "completed", "error_message": None,
        "objects": ["rocket", "crystal_cluster", "space_rover"],
        "engines": {
            "klein": {"status": "success", "objects": klein},
            "triposr": {"status": "partial", "objects": [
                {"name": "rocket", "status": "success", "file": glb.name, "sha256": hashlib.sha256(glb.read_bytes()).hexdigest(), "seconds": 3.1},
                {"name": "crystal_cluster", "status": "failed", "error": "CUDA out of memory"}]},
        },
        "summary": {"triposr": {"stage_status": "partial", "objects_ok": 1, "objects_total": 3}},
    }
    report.update(override)
    (out / "image_to_3d_report.json").write_text(json.dumps(report))
    return report


class NotebookTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        env = {"STICKMAN_OUT_DIR": self._tmp.name + "/out", "STICKMAN_STAGE_DIR": self._tmp.name + "/stages"}
        patcher = mock.patch.dict(os.environ, env)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_committed_notebook_is_up_to_date(self):
        self.assertEqual(builder.TARGET.read_text(encoding="utf-8"), builder.render())

    def test_every_code_cell_and_stage_script_parses(self):
        for index, cell in enumerate(builder.build()["cells"]):
            if cell["cell_type"] == "code":
                ast.parse("".join(cell["source"]), filename=f"cell {index}")
        for name in ("KLEIN_STAGE", "TRIPOSR_STAGE", "HUNYUAN_SHAPE_STAGE", "HUNYUAN_PAINT_STAGE"):
            ast.parse(getattr(builder, name), filename=name)

    def test_setup_starts_unobserved_with_three_objects(self):
        ns = {}
        exec(compile("".join(builder.build()["cells"][1]["source"]), "setup", "exec"), {"__name__": "x"}, ns)
        self.assertEqual(ns["REPORT"]["status"], "running")
        self.assertEqual(ns["REPORT"]["engines"], {})
        self.assertEqual(len(ns["OBJECTS"]), 3)
        self.assertEqual(ns["KLEIN_REVISION"], "e7b7dc27f91deacad38e78976d1f2b499d76a294")
        for pin in ("TRIPOSR_COMMIT", "HUNYUAN_COMMIT"):
            self.assertEqual(len(ns[pin]), 40)

    def test_failed_stage_without_result_is_recorded_not_hidden(self):
        ns = {"__name__": "x"}
        cells = builder.build()["cells"]
        for index in (1, 2, 3):
            exec(compile("".join(cells[index]["source"]), f"cell{index}", "exec"), ns)
        data = ns["stage_script"]("crashy", "import sys; sys.exit(3)\n", {}, sys.executable, 60)
        self.assertEqual(data["status"], "failed")
        self.assertIn("wrote no result", data["error"])
        self.assertEqual(ns["REPORT"]["stages"]["crashy"][0]["outcome"], "exit 3")


class ValidatorTests(unittest.TestCase):
    def out(self):
        return Path(tempfile.mkdtemp()) / "out"

    def test_partial_engine_success_is_accepted_when_files_are_real(self):
        out = self.out(); write_run(out)
        result = kr.validate_image_to_3d_output(out, IDENTITY)
        self.assertTrue(result["ok"], result)

    def test_foreign_token_is_rejected(self):
        out = self.out(); write_run(out, run_token="someone-else")
        self.assertIn("another execution", " ".join(kr.validate_image_to_3d_output(out, IDENTITY)["failures"]))

    def test_incomplete_run_is_rejected(self):
        out = self.out(); write_run(out, status="failed", error_message="klein could not draw")
        self.assertFalse(kr.validate_image_to_3d_output(out, IDENTITY)["ok"])

    def test_claimed_glb_that_is_not_a_glb_is_rejected(self):
        out = self.out(); write_run(out)
        (out / "triposr_rocket.glb").write_bytes(b"not a model")
        self.assertIn("not a GLB", " ".join(kr.validate_image_to_3d_output(out, IDENTITY)["failures"]))

    def test_missing_object_picture_is_rejected(self):
        out = self.out(); write_run(out)
        (out / "object_rocket.png").unlink()
        self.assertFalse(kr.validate_image_to_3d_output(out, IDENTITY)["ok"])

    def test_profile_and_summary(self):
        self.assertIn("image-to-3d", kr.PROFILES)
        out = self.out(); write_run(out)
        text = kr.summarize_report(out, "image-to-3d")
        self.assertIn("ENGINE triposr", text)
        self.assertIn("CUDA out of memory", text)

    def test_download_pattern_matches_expected_files(self):
        import re
        pattern = re.compile(kr.IMAGE_TO_3D_PATTERN)
        for name in ("image_to_3d_report.json", "result_hunyuan_shape.json", "object_rocket.png", "cutout_space_rover.png",
                     "hunyuan_rocket_textured.glb", "install_3d_common.log", "logs/triposr_torchmcubes.log"):
            self.assertTrue(pattern.search(name), name)
        self.assertFalse(pattern.search("image_to_3d_test.ipynb"))


if __name__ == "__main__":
    unittest.main()
