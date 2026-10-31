import json
import tempfile
import unittest
from pathlib import Path

from motion_studio.render import render_project


class RenderGateTests(unittest.TestCase):
    def test_empty_storyboard_blocked(self):
        with tempfile.TemporaryDirectory() as folder:
            project = Path(folder)
            (project / "storyboard").mkdir()
            (project / "storyboard" / "shots.json").write_text(
                json.dumps({"shots": []}), encoding="utf-8"
            )
            with self.assertRaisesRegex(RuntimeError, "No storyboard shots"):
                render_project(project)

    def test_still_image_fallback_blocked(self):
        with tempfile.TemporaryDirectory() as folder:
            project = Path(folder)
            (project / "storyboard").mkdir()
            (project / "storyboard" / "shots.json").write_text(
                json.dumps({
                    "shots": [{
                        "id": "s1",
                        "approval": "approved",
                        "animation_clip": "still.png",
                    }]
                }),
                encoding="utf-8",
            )
            # Missing file and non-MP4 checks both correctly reject still images.
            with self.assertRaisesRegex(RuntimeError, "Missing animated MP4|no animation_clip"):
                render_project(project)


if __name__ == "__main__":
    unittest.main()
