import subprocess

from motion_studio import video_check as vc


def make(path, secs, size="720x1280", audio=True, src="testsrc2"):
    spec = f"color=c=black:s={size}:d={secs}:r=10" if src == "black" else f"{src}=s={size}:d={secs}:r=10"
    cmd = ["ffmpeg", "-nostdin", "-y", "-v", "error", "-f", "lavfi", "-i", spec]
    if audio:
        cmd += ["-f", "lavfi", "-i", f"sine=f=440:d={secs}", "-shortest"]
    subprocess.run(cmd + ["-pix_fmt", "yuv420p", str(path)], check=True)


def test_good_video_passes(tmp_path):
    p = tmp_path / "a.mp4"; make(p, 10)
    r = vc.check(p, expect_seconds=10)
    assert r["ok"], r


def test_short_silent_black_and_missing_fail(tmp_path):
    p = tmp_path / "s.mp4"; make(p, 3)
    assert any("long" in f for f in vc.check(p)["fails"])
    p = tmp_path / "n.mp4"; make(p, 10, audio=False)
    assert "no audio" in vc.check(p)["fails"]
    p = tmp_path / "b.mp4"; make(p, 10, src="black")
    f = vc.check(p)["fails"]; assert "picture is black" in f
    assert not vc.check(tmp_path / "none.mp4")["ok"]
