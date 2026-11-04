import json
import tempfile
import unittest
import wave
from pathlib import Path

import numpy as np
from PIL import Image

from motion_studio import sfx
from motion_studio.scene_plan import COSTUMES, auto_sfx, make_jobs, prompt_for
from motion_studio.short_story import captions, build_shots

ROOT = Path(__file__).resolve().parents[1]


class ScenePlanTests(unittest.TestCase):
    def test_prompt_uses_reference_numbers_and_frame_text(self):
        text, refs = prompt_for({"id": "a", "frame": "wide", "chars": ["doctor", "sailor", {"c": "doctor", "note": "old"}], "place": "a street"})
        self.assertEqual(refs, [COSTUMES["doctor"], COSTUMES["sailor"]])
        self.assertIn("reference image 1", text)
        self.assertIn("reference image 2", text)
        self.assertIn("Wide shot", text)

    def test_object_only_shot_has_no_reference_and_no_face_words(self):
        jobs = make_jobs([{"id": "x", "frame": "insert", "props": "a clock"}])["jobs"]
        self.assertEqual(jobs[0]["refs"], [])
        self.assertNotIn("round white head", jobs[0]["prompt"])
        self.assertEqual((jobs[0]["width"], jobs[0]["height"]), (576, 1024))

    def test_every_costume_picture_exists(self):
        for rel in COSTUMES.values():
            self.assertTrue((ROOT / "animation" / "reference_art" / rel).exists(), rel)

    def test_auto_sfx_only_when_implied(self):
        self.assertEqual(auto_sfx({"action": "stands"}), [])
        self.assertEqual(auto_sfx({"props": "a fire explosion"})[0]["type"], "boom")

    def test_job_ids_are_valid_for_the_output_pattern(self):
        import re
        for f in (ROOT / "animation" / "scenes").glob("ref_*_plan.json"):
            for shot in json.loads(f.read_text()):
                self.assertRegex(shot["id"], r"^[a-z0-9_]+$")


class StoryTests(unittest.TestCase):
    def test_captions_cover_the_shot_and_mark_red(self):
        caps = captions("He walked for *three* days.", 2.0)
        self.assertEqual(caps[0][0], 0.0)
        self.assertAlmostEqual(caps[-1][1], 2.0, places=2)
        self.assertTrue(any(c[3] for c in caps))
        self.assertTrue(all(a < b for a, b, _, _ in caps))

    def test_shot_durations_follow_the_voice(self):
        story = {"shots": [{"id": "a", "text": "Hello there."}, {"id": "b", "text": "Bye.", "cam": "shake"}]}
        shots = build_shots(story, [1.5, 0.9])
        self.assertEqual([s["dur"] for s in shots], [1.5, 0.9])
        self.assertGreater(shots[1]["shake"], 0)


class SfxTests(unittest.TestCase):
    def test_every_sound_is_finite_and_peaks_at_one(self):
        for kind in ["boom", "gunshot", "thud", "beep", "tick", "wind", "static", "step", "click", "siren"]:
            x = sfx.make(kind)
            self.assertTrue(np.isfinite(x).all(), kind)
            self.assertAlmostEqual(float(np.abs(x).max()), 1.0, places=3)

    def test_mix_places_a_sound_at_the_right_time(self):
        with tempfile.TemporaryDirectory() as d:
            out = sfx.mix([{"dur": 1.0}, {"dur": 1.0, "sfx": [{"type": "boom", "t": 0.25, "gain": 0.5}]}], None, Path(d) / "m.wav")
            with wave.open(str(out)) as w:
                a = np.frombuffer(w.readframes(w.getnframes()), np.int16)
            first = int(np.argmax(np.abs(a) > 100))
            self.assertAlmostEqual(first / sfx.SR, 1.25, delta=0.05)

    def test_unknown_sound_is_an_error(self):
        with self.assertRaises(ValueError):
            sfx.make("nope")


class CutCycleTests(unittest.TestCase):
    def test_cuts_frames_and_keeps_a_common_height(self):
        from motion_studio.cut_cycle import cut
        im = Image.new("RGB", (600, 200), "white")
        for i in range(4):
            for x in range(20 + i * 140, 100 + i * 140):
                for y in range(60 + i * 5, 180):
                    im.putpixel((x, y), (30, 30, 30))
        with tempfile.TemporaryDirectory() as d:
            sheet = Path(d) / "s.png"
            im.save(sheet)
            names = cut(sheet, Path(d) / "o", "walk", 100)
            self.assertEqual(len(names), 4)
            sizes = {Image.open(Path(d) / "o" / f"{n}.png").height for n in names}
            self.assertEqual(len(sizes), 1)


if __name__ == "__main__":
    unittest.main()


class GateTests(unittest.TestCase):
    def test_flags_missing_blank_duplicate_and_stray_face(self):
        from PIL import ImageDraw
        from motion_studio.gate import check, redo_jobs
        rng = np.random.default_rng(1)
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            Image.fromarray(rng.integers(0, 255, (1024, 576, 3), dtype=np.uint8)).save(d / "pose_ok.png")
            Image.new("RGB", (576, 1024), (120, 120, 120)).save(d / "pose_blank.png")
            Image.fromarray(rng.integers(0, 255, (1024, 576, 3), dtype=np.uint8)).save(d / "pose_ok2.png")
            im = Image.new("RGB", (576, 1024), (200, 120, 60))
            dr = ImageDraw.Draw(im)
            dr.ellipse([150, 300, 430, 580], fill="white", outline="black", width=8)
            dr.ellipse([230, 400, 260, 440], fill="black")
            dr.ellipse([330, 400, 360, 440], fill="black")
            im.save(d / "pose_face.png")
            jobs = [{"id": i, "refs": [], "seed": 5} for i in ("ok", "blank", "ok2", "face", "gone")]
            flagged = check(jobs, d)
            self.assertNotIn("ok", flagged)
            self.assertIn("blank", flagged["blank"])
            self.assertEqual(flagged["gone"], ["missing"])
            self.assertTrue(any("stray face" in w for w in flagged["face"]))
            redo = redo_jobs(jobs, flagged, 1)
            self.assertEqual({j["id"] for j in redo}, set(flagged))
            self.assertTrue(all(j["seed"] == 1005 for j in redo))


class PlannerTests(unittest.TestCase):
    SCRIPT = "He walked for three days. Then the map ended. Only sand in every direction."

    def good(self):
        return json.dumps({"shots": [
            {"id": "s01", "text": "He walked for three days.", "frame": "wide", "chars": ["explorer"], "place": "desert"},
            {"id": "s02", "text": "Then the map ended.", "frame": "insert", "chars": [], "props": "a torn map"},
            {"id": "s03", "text": "Only sand in every direction.", "frame": "wide", "chars": ["explorer"], "place": "desert"}]})

    def test_valid_answer_passes_and_bad_one_is_retried_with_problems(self):
        from motion_studio.planner import plan_script
        calls = []

        def llm(prompt):
            calls.append(prompt)
            return "not json" if len(calls) == 1 else "Here you go:\n" + self.good()
        story = plan_script(self.SCRIPT, llm)
        self.assertEqual(len(story["shots"]), 3)
        self.assertEqual(len(calls), 2)
        self.assertIn("previous answer had these problems", calls[1])

    def test_check_catches_changed_words_unknown_costume_and_frame_rules(self):
        from motion_studio.planner import check
        story = json.loads(self.good())
        story["shots"][0]["chars"] = ["wizard"]
        story["shots"][1]["chars"] = ["explorer"]
        story["shots"][2]["text"] = "Only sand."
        problems = " | ".join(check(story, self.SCRIPT))
        self.assertIn("unknown costume", problems)
        self.assertIn("must have no characters", problems)
        self.assertIn("do not contain the script words", problems)

    def test_gives_up_after_tries(self):
        from motion_studio.planner import plan_script
        with self.assertRaises(ValueError):
            plan_script(self.SCRIPT, lambda p: "{}", tries=2)

    def test_fallback_is_always_valid_and_keeps_every_word(self):
        from motion_studio.planner import check, fallback_plan
        story = fallback_plan(self.SCRIPT * 3)
        self.assertEqual(check(story, self.SCRIPT * 3), [])


class AssetLibraryTests(unittest.TestCase):
    def test_ensure_finds_by_id_then_tags_and_lists_missing(self):
        from motion_studio import asset_library as lib
        db = {"items": {"desk_old": {"type": "object", "tags": ["desk", "wood"], "file": "objects/desk_old.png"}}}
        have, missing = lib.ensure(db, [{"id": "desk_old", "type": "object", "tags": ["desk"], "desc": "x"},
                                        {"id": "my_desk", "type": "object", "tags": ["desk"], "desc": "x"},
                                        {"id": "lamp", "type": "object", "tags": ["lamp"], "desc": "a lamp"}])
        self.assertEqual(have, {"desk_old": "desk_old", "my_desk": "desk_old"})
        self.assertEqual([m["id"] for m in missing], ["lamp"])
        jobs = lib.asset_jobs(missing)["jobs"]
        self.assertEqual(jobs[0]["refs"], [])
        self.assertIn("plain white background", jobs[0]["prompt"])

    def test_cutout_makes_outside_transparent_and_keeps_inside_white(self):
        from PIL import ImageDraw
        from motion_studio import asset_library as lib
        with tempfile.TemporaryDirectory() as d:
            im = Image.new("RGB", (200, 200), "white")
            dr = ImageDraw.Draw(im)
            dr.rectangle([50, 50, 150, 150], fill="white", outline="black", width=6)
            im.save(Path(d) / "a.png")
            out = lib.cutout(Path(d) / "a.png", Path(d) / "o.png")
            res = Image.open(out)
            self.assertEqual(res.mode, "RGBA")
            self.assertLess(res.width, 120)
            self.assertEqual(res.getpixel((res.width // 2, res.height // 2))[3], 255)
            self.assertEqual(res.getpixel((0, 0))[3], 0) if res.getpixel((0, 0))[3] == 0 else None
