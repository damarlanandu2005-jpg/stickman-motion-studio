import numpy as np
from PIL import Image
from motion_studio import costume_auto as ca


def fig(stray=False):
    a = np.zeros((300, 200, 4), np.uint8)
    a[40:260, 60:140] = (40, 90, 40, 255)
    a[120:160, 40:60] = (255, 255, 255, 255)       # round-ish hand
    if stray:
        a[170:260, 85:105] = (255, 255, 255, 255)  # long bare shin
    return Image.fromarray(a, "RGBA")


def test_clean_figure_has_no_stray_white():
    assert ca.stray_white(fig()) == []


def test_long_white_limb_is_caught():
    assert ca.stray_white(fig(True))


def test_silhouette_identical_and_shifted():
    assert min(ca.silhouette(fig(), fig())) > 0.99
    shifted = Image.new("RGBA", (200, 300)); shifted.paste(fig(), (70, 0), fig())
    assert min(ca.silhouette(shifted, fig())) < 0.8


def P(score, rgb=(60, 100, 50), ok=True):
    return {"pass": ok, "score": score, "rgb": list(rgb), "outline_ratio": 1.0}


def test_pick_best_keeps_anchor_sheet_and_flags_missing():
    s = {"a": [P(1.0), P(1.0), P(1, ok=False)], "b": [P(1.5), P(1.0, ok=False), P(1, ok=False)]}
    p = ca.pick_best(s)
    assert p[0][0] == "a" and p[1] is not None and p[2] is None


def test_gap_filled_only_from_sheet_with_matching_suit_colour():
    f = P(1, ok=False)
    s = {"a": [P(1.0), P(1.0), P(1.0), f], "b": [P(1.0), f, f, P(1.2, rgb=(150, 60, 60))], "c": [P(1.0), f, f, P(1.0, rgb=(61, 100, 49))]}
    p = ca.pick_best(s)
    assert p[3][0] == "c" and p[0][0] == "a"


def test_four_white_parts_is_caught():
    a = np.zeros((300, 200, 4), np.uint8); a[40:260, 60:140] = (40, 90, 40, 255)
    for x in (30, 150):
        a[120:150, x:x + 25] = 255
    a[10:40, 95:105] = 255
    a[240:262, 60:75] = 255; a[240:262, 125:140] = 255
    assert any("extra white" in w for w in ca.stray_white(Image.fromarray(a, "RGBA")))


def test_redraw_jobs_use_new_seeds_per_round():
    a = ca.redraw_jobs("x", "p", [10], 1, "o.png", "a.png"); b = ca.redraw_jobs("x", "p", [10], 2, "o.png", "a.png")
    assert not {j["seed"] for j in a} & {j["seed"] for j in b} and a[0]["wanted_poses"] == [10]
