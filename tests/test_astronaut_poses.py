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
import build_astronaut_poses_notebook as builder  # noqa: E402
from motion_studio import kaggle_runner as kr  # noqa: E402

IDENTITY = {"run_id": "run-1", "run_token": "tok-1"}


def make_png(path: Path, gray: int, w: int = 16, h: int = 24) -> None:
    """Tiny valid PNG without Pillow (CI does not install it)."""
    import struct, zlib
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    raw = b"".join(b"\x00" + bytes([gray]) * w for _ in range(h))
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def write_run(out: Path, **override):
    """Fake output folder: only tests the validator's logic, never evidence of a real drawing."""
    out.mkdir(parents=True, exist_ok=True)
    make_png(out / "pose_stand_s1.png", 255)
    digest = hashlib.sha256((out / "pose_stand_s1.png").read_bytes()).hexdigest()
    report = {"run_token": "tok-1", "run_id": "run-1", "status": "completed", "error_message": None, "poses": ["stand"], "seeds": [1],
              "klein": {"status": "success", "pictures": [{"pose": "stand", "seed": 1, "status": "success", "file": "pose_stand_s1.png", "sha256": digest, "seconds": 3.0}]}}
    report.update(override)
    (out / "poses_report.json").write_text(json.dumps(report))


class NotebookTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.mkdtemp()
        p = mock.patch.dict(os.environ, {"STICKMAN_OUT_DIR": tmp + "/out", "STICKMAN_WORK_DIR": tmp + "/work"})
        p.start(); self.addCleanup(p.stop)

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
        self.assertEqual(ns["REPORT"]["files"], [])

    def test_reference_picture_matches_pinned_hash(self):
        ns = {}
        exec(compile(builder.SETUP, "setup", "exec"), {"__name__": "x"}, ns)
        data = (ROOT / ns["REFERENCE"]).read_bytes()
        self.assertEqual(hashlib.sha256(data).hexdigest(), ns["REFERENCE_SHA256"])


class ValidatorTests(unittest.TestCase):
    def out(self):
        return Path(tempfile.mkdtemp()) / "out"

    def test_good_run_passes(self):
        out = self.out(); write_run(out)
        self.assertTrue(kr.validate_poses_output(out, IDENTITY)["ok"])

    def test_foreign_token_fails(self):
        out = self.out(); write_run(out, run_token="other")
        self.assertIn("another execution", " ".join(kr.validate_poses_output(out, IDENTITY)["failures"]))

    def test_changed_picture_fails(self):
        out = self.out(); write_run(out)
        make_png(out / "pose_stand_s1.png", 0)
        self.assertIn("hash", " ".join(kr.validate_poses_output(out, IDENTITY)["failures"]))

    def test_no_pictures_fails(self):
        out = self.out(); write_run(out, klein={"status": "success", "pictures": []})
        self.assertFalse(kr.validate_poses_output(out, IDENTITY)["ok"])

    def test_profile_and_summary(self):
        self.assertIn("poses", kr.PROFILES)
        out = self.out(); write_run(out)
        self.assertIn("pictures drawn: 1 of 1", kr.summarize_report(out, "poses"))


if __name__ == "__main__":
    unittest.main()
