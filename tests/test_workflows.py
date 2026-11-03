import unittest
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipIf(yaml is None, "PyYAML not installed")
class WorkflowFileTests(unittest.TestCase):
    def test_every_workflow_parses_and_has_jobs(self):
        files = sorted((ROOT / ".github" / "workflows").glob("*.yml"))
        self.assertTrue(files)
        for f in files:
            data = yaml.safe_load(f.read_text(encoding="utf-8"))
            self.assertIn("jobs", data, f"{f.name} has no jobs (a bad edit can silently cut a workflow short)")
            self.assertTrue(data.get(True) or data.get("on"), f"{f.name} has no trigger")


if __name__ == "__main__":
    unittest.main()
