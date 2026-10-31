import json,tempfile,unittest
from pathlib import Path
from motion_studio.render import render_project
class RenderGateTests(unittest.TestCase):
 def test_empty_storyboard_blocked(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d); (p/"storyboard").mkdir(); (p/"storyboard/shots.json").write_text(json.dumps({"shots":[]}))
   with self.assertRaisesRegex(RuntimeError,"No storyboard shots"): render_project(p)
 def test_still_image_fallback_blocked(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d); (p/"storyboard").mkdir(); (p/"storyboard/shots.json").write_text(json.dumps({"shots":[{"id":"s1","approval":"approved","animation_clip":"still.png"}]}))
   with self.assertRaisesRegex(RuntimeError,"no animation_clip"): render_project(p)
if __name__=="__main__": unittest.main()
