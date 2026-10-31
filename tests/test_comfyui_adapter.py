import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from motion_studio.adapters.comfyui import ComfyUIAdapter, ComfyUIError


class ComfyUIAdapterTests(unittest.TestCase):
    def test_healthcheck_reports_server(self):
        adapter = ComfyUIAdapter()
        with patch.object(adapter, "_request_json", return_value={"system": {"os": "test"}, "devices": [{}]}):
            result = adapter.healthcheck()
        self.assertTrue(result["available"])
        self.assertEqual(result["device_count"], 1)

    def test_submit_requires_api_workflow(self):
        adapter = ComfyUIAdapter()
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, "API-format"):
                adapter.submit({}, Path(folder))

    def test_submit_returns_prompt_id(self):
        adapter = ComfyUIAdapter()
        with tempfile.TemporaryDirectory() as folder:
            with patch.object(adapter, "_request_json", return_value={"prompt_id": "abc-123", "number": 1}):
                result = adapter.submit({"workflow": {"1": {"class_type": "SaveImage", "inputs": {}}}}, Path(folder))
        self.assertEqual(result["prompt_id"], "abc-123")
        self.assertEqual(result["status"], "queued")

    def test_submit_surfaces_node_validation_errors(self):
        adapter = ComfyUIAdapter()
        with tempfile.TemporaryDirectory() as folder:
            with patch.object(adapter, "_request_json", return_value={"node_errors": {"1": "bad node"}}):
                with self.assertRaisesRegex(ComfyUIError, "rejected the workflow"):
                    adapter.submit({"workflow": {"1": {}}}, Path(folder))

    def test_wait_rejects_failed_execution(self):
        adapter = ComfyUIAdapter()
        with tempfile.TemporaryDirectory() as folder:
            with patch.object(adapter, "_request_json", return_value={
                "job-1": {"status": {"status_str": "error", "completed": True}, "outputs": {}}
            }):
                with self.assertRaisesRegex(ComfyUIError, "status 'error'"):
                    adapter.wait("job-1", Path(folder), timeout=1, poll_interval=0.01)


if __name__ == "__main__":
    unittest.main()
