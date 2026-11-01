import json
import re
import tempfile
import unittest
from pathlib import Path

from motion_studio.kaggle_runner import PROFILES, validate_script_writer_output


class ScriptWriterRunnerTests(unittest.TestCase):
    def test_output_pattern_matches_nested_report_and_result_files(self):
        pattern = re.compile(PROFILES["script-writer"]["pattern"])
        for name in (
            "benchmark_report.json",
            "stickman_script_benchmark/benchmark_results.json",
            "stickman_script_benchmark/model_comparison.csv",
            "stickman_script_benchmark/Qwen3-4B-Instruct-2507.json",
            "stickman_script_benchmark/Gemma-3-4B-IT.txt",
        ):
            with self.subTest(name=name):
                self.assertRegex(name, pattern)

    def test_report_and_model_json_validate(self):
        identity = {"run_id": "run-1", "run_token": "token-1"}
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "Qwen3-4B-Instruct-2507.json").write_text('{"scenes": []}', encoding="utf-8")
            report = {
                **identity,
                "status": "success",
                "dependencies_installed": True,
                "at_least_one_model_completed": True,
                "outputs_saved": True,
                "results": [{
                    "label": "Qwen3-4B-Instruct-2507",
                    "completed": True,
                    "error": None,
                    "json_file": "Qwen3-4B-Instruct-2507.json",
                }],
            }
            (root / "benchmark_report.json").write_text(json.dumps(report), encoding="utf-8")
            result = validate_script_writer_output(root, identity)
            self.assertTrue(result["ok"], result["failures"])

if __name__ == "__main__":
    unittest.main()
