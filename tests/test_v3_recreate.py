import unittest

from PIL import Image

from motion_studio import shot2d, v3_story, v3_voice
from motion_studio.roles import recolour


class V3Recreate(unittest.TestCase):
    def test_spec_matches_real_cuts(self):
        self.assertEqual(len(v3_story.spec()), len(v3_story.CUTS["durs"]))
        self.assertAlmostEqual(sum(v3_story.CUTS["durs"]), 73.1, delta=0.05)

    def test_caption_groups_are_one_to_three_words(self):
        words = [(i * 0.3, i * 0.3 + 0.3, w, w == "wire") for i, w in enumerate("never ask which wire to cut, because his team".split())]
        for a, b, txt, red in v3_voice.caption_groups(words):
            self.assertTrue(1 <= len(txt.split()) <= 3)
            self.assertLess(a, b)

    def test_recolour_keeps_white_and_alpha(self):
        im = Image.new("RGBA", (2, 1))
        im.putpixel((0, 0), (255, 255, 255, 255))      # white skin stays white
        im.putpixel((1, 0), (200, 150, 80, 255))        # khaki becomes green
        out = recolour(im, 0.33, 1.0, 1.0, 0.0)
        self.assertEqual(out.getpixel((0, 0)), (255, 255, 255, 255))
        r, g, b, a = out.getpixel((1, 0))
        self.assertGreater(g, r)
        self.assertEqual(a, 255)

    def test_draw_text_countdown(self):
        im = Image.new("RGBA", (200, 200), (0, 0, 0, 255))
        shot2d.draw_text(im, {"count": [5, 3], "x": 0.5, "y": 0.5, "size": 0.2, "font": "mono"}, 0.0, 2.0)
        self.assertNotEqual(im.getbbox() and im.convert("RGB").getextrema(), ((0, 0), (0, 0), (0, 0)))
        self.assertEqual(shot2d._fmt_clock(65), "1:05")


if __name__ == "__main__":
    unittest.main()
