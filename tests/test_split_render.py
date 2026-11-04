from motion_studio import split_render as sr


def test_ranges_cover_every_frame_once():
    for frames, n in [(150, 1), (150, 4), (1351, 7), (5, 10), (1, 3)]:
        r = sr.split_frames(frames, n)
        assert r[0]["start"] == 0 and r[-1]["end"] == frames
        assert all(a["end"] == b["start"] for a, b in zip(r, r[1:]))
        assert max(x["end"] - x["start"] for x in r) - min(x["end"] - x["start"] for x in r) <= 1


def test_choose_parts_grows_with_length_and_is_capped():
    assert sr.choose_parts(60) == 1                      # tiny video: one job
    a, b, c = sr.choose_parts(450), sr.choose_parts(1350), sr.choose_parts(100000)
    assert 1 <= a <= b <= c == sr.MAX_PARTS
    assert sr.choose_parts(3) <= 3
