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


def test_pick_best_prefers_highest_passing_score_and_flags_missing():
    s = {"a": [{"pass": True, "score": 1.0}, {"pass": False, "score": 9}], "b": [{"pass": True, "score": 1.5}, {"pass": False, "score": 9}]}
    p = ca.pick_best(s)
    assert p[0][0] == "b" and p[1] is None


def test_redraw_jobs_use_new_seeds_per_round():
    a = ca.redraw_jobs("x", "p", [10], 1, "o.png", "a.png"); b = ca.redraw_jobs("x", "p", [10], 2, "o.png", "a.png")
    assert not {j["seed"] for j in a} & {j["seed"] for j in b} and a[0]["wanted_poses"] == [10]
