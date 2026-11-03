import json
import unittest
from pathlib import Path

from motion_studio import story as st

ROOT = Path(__file__).resolve().parents[1]
STORY = st.read_json(ROOT / "animation/stories/space_adventure.json")


class StoryFileTests(unittest.TestCase):
    def test_every_shot_uses_known_environment_assets_and_species(self):
        for s in STORY["shots"]:
            self.assertIn(s["env"], st.ENVS, s["id"])
            for o in s.get("objects", []):
                self.assertIn(o["asset"], STORY["assets"], f"{s['id']}: {o['asset']}")
            for c in s.get("cast", []):
                self.assertIn(c["who"], STORY["characters"], s["id"])

    def test_every_asset_type_has_a_rules_template(self):
        for name, a in STORY["assets"].items():
            self.assertTrue((ROOT / "library/types" / f"{a['type']}.json").is_file(), name)

    def test_cameras_cover_the_shot_and_point_at_real_things(self):
        for s in STORY["shots"]:
            ids = {o["id"] for o in s.get("objects", [])} | {c.get("id", c["who"]) for c in s.get("cast", [])} | {p["id"] for p in s.get("props", [])}
            cam = s["camera"]
            self.assertEqual(cam[0]["at_s"], 0, s["id"])
            self.assertGreaterEqual(cam[-1]["at_s"], s["duration_s"], s["id"])
            for k in cam:
                for t in k.get("frame", {}).get("on", []):
                    self.assertIn(t, ids, f"{s['id']}: camera target {t}")

    def test_shot_ids_are_unique_and_ordered(self):
        ids = [s["id"] for s in STORY["shots"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(ids, sorted(ids))

    def test_plan_splits_library_and_missing(self):
        p = st.plan(STORY, st.read_json(st.CATALOG))
        names = {x["asset"] for x in p["in_library"]} | {x["asset"] for x in p["missing"]}
        self.assertEqual(names, set(STORY["assets"]))


class GlbTests(unittest.TestCase):
    def test_extent_and_behavior_from_a_real_model(self):
        glb = ROOT / "animation/assets/models/rocket.glb"
        w, h, d = st.glb_extent(glb)
        self.assertTrue(w > 0 and h > 0 and d > 0)
        b = st.make_behavior("rocket", "rocket", glb, 7.0)
        self.assertTrue(b["solid"])
        self.assertTrue(0.2 <= b["collide_radius_m"] <= 2.0)
        self.assertEqual(st.make_behavior("x", "prop", glb, 7.0)["solid"], False)


if __name__ == "__main__":
    unittest.main()
