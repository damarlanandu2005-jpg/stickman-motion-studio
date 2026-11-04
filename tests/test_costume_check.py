import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

from motion_studio import costume_check as cc


def fake_sprites(d: Path):
    for i in range(12):
        im = Image.new("RGBA", (120, 200), (0, 0, 0, 0))
        dr = ImageDraw.Draw(im)
        dr.rectangle([50, 0, 70, 30], fill=(255, 255, 255, 255), outline=(20, 20, 20, 255))      # neck stub
        dr.rectangle([20, 30, 100, 200], fill=(170, 110, 50, 255), outline=(20, 20, 20, 255), width=4)  # brown body
        im.save(d / f"body_{i:02d}.png")


class CostumeCheck(unittest.TestCase):
    def test_pose_sheet_and_checks(self):
        with tempfile.TemporaryDirectory() as t:
            t = Path(t)
            fake_sprites(t)
            info = cc.build_pose_sheet(t, t / "ref.png")
            self.assertEqual(len(info), 12)
            ref = Image.open(t / "ref.png").convert("RGB")
            # drawn sheet: same shapes, green instead of brown -> passes
            green = Image.new("RGB", ref.size, "white")
            for c in info:
                x, y = c["pos"]; w, h = c["size"]
                dr = ImageDraw.Draw(green)
                dr.rectangle([x + w * 0.42, y, x + w * 0.58, y + h * 0.15], fill=(255, 255, 255), outline=(20, 20, 20))
                dr.rectangle([x + w * 0.17, y + h * 0.15, x + w * 0.83, y + h - 1], fill=(70, 120, 60), outline=(20, 20, 20), width=4)
            green.save(t / "green.png")
            res = cc.check_sheet(t / "green.png", t / "ref.png", info, (0.17, 0.45))
            self.assertTrue(all(r["pass"] for r in res), res[:2])
            # same sheet with a big white head drawn above the body -> fails the head check
            headed = green.copy()
            dr = ImageDraw.Draw(headed)
            for c in info:
                x, y = c["pos"]; w, h = c["size"]
                dr.ellipse([x + w * 0.1, y - 20, x + w * 0.9, y + h * 0.3], fill=(255, 255, 255), outline=(20, 20, 20), width=4)
            headed.save(t / "headed.png")
            res2 = cc.check_sheet(t / "headed.png", t / "ref.png", info, (0.17, 0.45))
            self.assertFalse(all(r["pass"] for r in res2))


if __name__ == "__main__":
    unittest.main()


def test_poses_download_pattern_accepts_capital_letters_in_job_names():
    import re
    from motion_studio.kaggle_runner import POSES_PATTERN
    for name in ("pose_suit_A_s0.png", "pose_suit_B_s2.png", "pose_walk_01.png", "poses_report.json", "result_klein.json"):
        assert re.search(POSES_PATTERN, name), name
    assert not re.search(POSES_PATTERN, "notes.txt")
