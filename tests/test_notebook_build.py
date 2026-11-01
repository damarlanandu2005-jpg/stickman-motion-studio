import ast
import os
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_image_smoke_notebook as builder  # noqa: E402


class SmokeNotebookTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        patcher = mock.patch.dict(os.environ, {"STICKMAN_OUT_DIR": self._tmp.name})
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_committed_notebook_is_up_to_date(self):
        self.assertEqual(builder.TARGET.read_text(encoding="utf-8"), builder.render())

    def test_every_code_cell_is_valid_python(self):
        for index, cell in enumerate(builder.build()["cells"]):
            if cell["cell_type"] == "code":
                ast.parse("".join(cell["source"]), filename=f"cell {index}")

    def test_workflow_is_api_format_and_matches_spec(self):
        namespace = {}
        setup = "".join(builder.build()["cells"][1]["source"])
        exec(compile(setup.split("# Every field starts")[0], "setup", "exec"), namespace)
        workflow = namespace["WORKFLOW"]
        for node in workflow.values():
            self.assertIn("class_type", node)
            self.assertIn("inputs", node)
        self.assertIn("white stickman astronaut standing on the moon", namespace["PROMPT"])
        self.assertTrue(namespace["NEGATIVE"].startswith("photorealistic, 3D render"))
        self.assertEqual(len(namespace["COMFYUI_COMMIT"]), 40)

    def test_report_fields_start_unobserved(self):
        namespace = {}
        setup = "".join(builder.build()["cells"][1]["source"])
        exec(compile(setup, "setup", "exec"), {"__name__": "x"}, namespace)
        report = namespace["REPORT"]
        for key in ("comfyui_started", "api_system_stats_ok", "api_object_info_ok", "generation_submitted",
                    "generation_completed", "image_downloaded", "image_valid", "cuda_available"):
            self.assertIs(report[key], False, key)
        self.assertEqual(report["status"], "running")

    def test_no_success_flag_is_hardcoded_true(self):
        source = "".join("".join(c["source"]) for c in builder.build()["cells"] if c["cell_type"] == "code")
        for key in ("comfyui_started", "api_system_stats_ok", "generation_completed", "image_valid"):
            for line in source.splitlines():
                if f'"{key}"' in line and "= True" in line:
                    # allowed only inside an observed-event code path (indented assignment), never in the initial dict
                    self.assertTrue(line.startswith(" "), line)


if __name__ == "__main__":
    unittest.main()


class KleinNotebookTests(unittest.TestCase):
    def setUp(self):
        sys.path.insert(0, str(ROOT / "scripts"))
        import build_klein_benchmark_notebook as klein
        self.klein = klein
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        patcher = mock.patch.dict(os.environ, {"STICKMAN_OUT_DIR": self._tmp.name})
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_notebook_up_to_date(self):
        self.assertEqual(self.klein.TARGET.read_text(encoding="utf-8"), self.klein.render())

    def test_code_cells_parse(self):
        for index, cell in enumerate(self.klein.build()["cells"]):
            if cell["cell_type"] == "code":
                ast.parse("".join(cell["source"]), filename=f"cell {index}")

    def test_report_starts_unobserved(self):
        namespace = {}
        exec(compile("".join(self.klein.build()["cells"][1]["source"]), "setup", "exec"), {"__name__": "x"}, namespace)
        report = namespace["REPORT"]
        for key in ("install_ok", "model_downloaded", "pipeline_loaded", "cuda_available"):
            self.assertIs(report[key], False)
        self.assertEqual(report["status"], "running")
        self.assertGreaterEqual(len(namespace["CASES"]), 3)
