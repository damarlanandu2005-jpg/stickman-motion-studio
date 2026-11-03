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

    def test_object_only_shot_still_gets_a_style_reference(self):
        jobs = make_jobs([{"id": "x", "frame": "insert", "props": "a clock"}])["jobs"]
        self.assertEqual(len(jobs[0]["refs"]), 1)
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
