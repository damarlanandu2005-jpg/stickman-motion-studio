import tempfile,unittest
from pathlib import Path
from motion_studio.project import init_project
from motion_studio.state import load_state,set_stage
from motion_studio.validation import validate_project
class ProjectTests(unittest.TestCase):
 def test_init_validate(self):
  with tempfile.TemporaryDirectory() as d:
   p=init_project(Path(d)/"short","Test"); self.assertTrue(all(c.passed for c in validate_project(p)))
 def test_refuse_overwrite(self):
  with tempfile.TemporaryDirectory() as d:
   p=init_project(Path(d)/"short","Test")
   with self.assertRaises(FileExistsError): init_project(p,"Overwrite")
 def test_state_persists(self):
  with tempfile.TemporaryDirectory() as d:
   p=init_project(Path(d)/"short","Test"); set_stage(p,"script","running","Writing")
   s=load_state(p); self.assertEqual(s["stages"]["script"]["attempts"],1)
if __name__=="__main__": unittest.main()
