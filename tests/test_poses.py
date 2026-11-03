import json
import tempfile
import unittest
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:  # CI installs Pillow only where it is needed
    Image = None

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipIf(Image is None, "Pillow not installed")
class CardTests(unittest.TestCase):
    def setUp(self):
        from motion_studio import poses
        self.poses = poses
        self.tmp = Path(tempfile.mkdtemp())

    def drawing(self, name, box, ring=False, size=(400, 600)):
        im = Image.new("RGB", size, "white")
        d = ImageDraw.Draw(im)
        d.rectangle(box, fill="white", outline="black", width=6)  # white body with an ink outline, like the suit
        d.rectangle([box[0] + 20, box[1] + 20, box[0] + 60, box[1] + 60], fill="blue")
        im.save(self.tmp / name)

    def test_background_goes_transparent_but_white_suit_stays(self):
        self.drawing("a.png", (100, 100, 300, 500))
        out = self.poses.cutout(Image.open(self.tmp / "a.png"))
        self.assertEqual(out.getpixel((5, 5))[3], 0)       # background
        self.assertEqual(out.getpixel((200, 300))[3], 255)  # white inside the outline stays solid

    def test_cards_share_one_scale_and_canvas(self):
        self.drawing("tall.png", (100, 60, 300, 540))
        self.drawing("tall2.png", (120, 80, 300, 520))
        self.drawing("low.png", (40, 300, 360, 520))
        picks = {"stand": "tall.png", "walk_1": "tall2.png", "sit": "low.png"}
        rep = self.poses.build_cards(picks, self.tmp, self.tmp / "cards")
        self.assertEqual(rep["problems"], [])
        for n in picks:
            self.assertEqual(Image.open(self.tmp / "cards" / f"stickman_{n}.png").size, self.poses.CANVAS)
        # same scale: the low pose keeps its real proportions relative to the standing one
        self.assertAlmostEqual(rep["poses"]["sit"]["card_h"] / rep["poses"]["stand"]["card_h"], 220 / 480, delta=0.03)

    def test_cut_off_limb_is_reported(self):
        self.drawing("edge.png", (100, 0, 300, 500))
        rep = self.poses.build_cards({"stand": "edge.png"}, self.tmp, self.tmp / "cards")
        self.assertTrue(any("touches the picture edge" in p for p in rep["problems"]))


if __name__ == "__main__":
    unittest.main()
