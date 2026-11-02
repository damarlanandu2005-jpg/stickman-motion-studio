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
            "fact_check_report.json",
            "stickman_script_benchmark/revised_script.json",
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
            revised = {"narration": "One sentence. Another sentence.", "continuity_bible": {"summary": "consistent"}, "scenes": [{"scene_number": 1, "narration_segment": "One sentence."}, {"scene_number": 2, "narration_segment": "Another sentence."}]}
            (root / "revised_script.json").write_text(json.dumps(revised), encoding="utf-8")
            fact_check = {**identity, "status": "needs_human_review", "first_pass": [], "second_pass": [], "unresolved_claims": [], "approved_script_file": None}
            (root / "fact_check_report.json").write_text(json.dumps(fact_check), encoding="utf-8")
            (root / "benchmark_report.json").write_text(json.dumps(report), encoding="utf-8")
            result = validate_script_writer_output(root, identity)
            self.assertTrue(result["ok"], result["failures"])

if __name__ == "__main__":
    unittest.main()


    def test_revised_script_validator_rejects_empty_scene_narration(self):
        import json
        import tempfile
        from pathlib import Path
        from motion_studio.kaggle_runner import validate_script_writer_output

        identity = {"run_id": "run-1", "run_token": "token-1"}
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "benchmark_report.json").write_text(json.dumps({
                **identity, "status": "success", "dependencies_installed": True,
                "at_least_one_model_completed": True, "outputs_saved": True,
                "results": [{"label": "Qwen", "completed": True, "json_file": "qwen.json"}]
            }))
            (root / "qwen.json").write_text("{}")
            (root / "revised_script.json").write_text(json.dumps({
                "narration": "First sentence. Second sentence.",
                "continuity_bible": {},
                "scenes": [
                    {"narration_segment": "First sentence. Second sentence."},
                    {"narration_segment": ""}
                ]
            }))
            (root / "fact_check_report.json").write_text(json.dumps({
                **identity, "status": "needs_human_review", "first_pass": [],
                "second_pass": [], "unresolved_claims": [], "approved_script_file": None
            }))
            result = validate_script_writer_output(root, identity)
            self.assertFalse(result["ok"])
            self.assertTrue(any("empty narration segments" in item for item in result["failures"]))

    def test_revised_script_validator_accepts_complete_nonempty_scene_segments(self):
        import json
        import tempfile
        from pathlib import Path
        from motion_studio.kaggle_runner import validate_script_writer_output

        identity = {"run_id": "run-2", "run_token": "token-2"}
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "benchmark_report.json").write_text(json.dumps({
                **identity, "status": "success", "dependencies_installed": True,
                "at_least_one_model_completed": True, "outputs_saved": True,
                "results": [{"label": "Qwen", "completed": True, "json_file": "qwen.json"}]
            }))
            (root / "qwen.json").write_text("{}")
            (root / "revised_script.json").write_text(json.dumps({
                "narration": "First sentence. Second sentence.",
                "continuity_bible": {},
                "scenes": [
                    {"narration_segment": "First sentence."},
                    {"narration_segment": "Second sentence."}
                ]
            }))
            (root / "fact_check_report.json").write_text(json.dumps({
                **identity, "status": "needs_human_review", "first_pass": [],
                "second_pass": [], "unresolved_claims": [], "approved_script_file": None
            }))
            result = validate_script_writer_output(root, identity)
            self.assertTrue(result["ok"], result["failures"])


    def test_scene_narration_distribution_supports_fewer_sentences_than_scenes(self):
        from motion_studio.factcheck import sync_narration_segments

        narration = "One short sentence. Another short sentence. Final sentence."
        scenes = [{"narration_segment": "old"} for _ in range(10)]
        synced = sync_narration_segments(narration, scenes)
        self.assertEqual(len(synced), 10)
        self.assertTrue(all(scene["narration_segment"].strip() for scene in synced))
        combined = " ".join(scene["narration_segment"] for scene in synced)
        self.assertEqual(" ".join(combined.split()), narration)
