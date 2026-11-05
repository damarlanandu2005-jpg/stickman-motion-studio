from pathlib import Path
from motion_studio import shot_planner as pl, voice_first as vf

IR = {"scenes": [
    {"n": 1, "voice": "He was scared of the bomb.", "red": [], "bg": {"wanted": "office", "library_id": "bg_x", "match": 1.0},
     "who": [{"character": "a", "stage": "s", "costume": "civ", "costume_status": "ready"}], "pose": ["point"], "props": [{"wanted": "bomb", "library_id": "obj_b", "match": 1.0}], "text": "41", "camera": "auto"},
    {"n": 2, "voice": "Fine.", "red": [], "bg": {"wanted": "lab", "library_id": None, "match": 0.0},
     "who": [{"character": "a", "stage": "s", "costume": "bombsuit", "costume_status": "bodies_only"}, {"character": "b", "stage": "s", "costume": "civ", "costume_status": "ready"}],
     "pose": ["dance"], "props": [], "text": "", "camera": "pull"}]}
WORDS = [(0.2, 0.5, "He", False), (0.5, 0.9, "was", False), (0.9, 1.6, "scared", True), (2.0, 2.4, "Fine.", False)]


def test_scene_lengths_follow_the_voice_and_never_stretch():
    d = vf.scene_durations([3.0, 0.2])
    assert abs(d[0] - (3.0 + vf.BREATH + vf.LEAD)) < 1e-6 and d[1] == vf.MIN_SCENE


def test_word_times_cover_the_voice_and_mark_red():
    w = vf.word_times("Arthur was normal", 1.0, 2.0, ["normal"])
    assert abs(w[0][0] - 1.0) < 1e-6 and abs(w[-1][1] - 3.0) < 1e-6 and [x[3] for x in w] == [False, False, True]


def test_face_from_words():
    assert pl.face_for("He was scared") == "scared" and pl.face_for("Why?") == "surprised" and pl.face_for("He walked home") == "neutral"


def test_plan_placeholder_standin_pose_and_camera(tmp_path):
    (tmp_path / "animation/assets2d/role_civ").mkdir(parents=True)
    shots, warns = pl.plan_shots(IR, [2.5, 1.4], WORDS, {"costumes": {}}, tmp_path)
    assert shots[0]["bg"] == "lib:bg_x" and shots[1]["bg"] == "solid:placeholder"
    assert shots[0]["actors"][0]["pose"] == 1 and shots[0]["actors"][0]["faces"] == [[0, "scared"]] and shots[0]["actors"][0]["outfit"] == "role_civ"
    assert shots[0]["objects"][0]["lib"] == "obj_b" and shots[0]["texts"][0]["text"] == "41"
    assert shots[1]["cam"] == pl.PULL and shots[1]["actors"][0]["outfit"] == "explorer" and len(shots[1]["actors"]) == 2
    text = " ".join(warns)
    assert "not in the library" in text and "bodies_only" in text and "not known, stand used" in text


def test_captions_are_cut_into_the_right_shot(tmp_path):
    shots, _ = pl.plan_shots(IR, [2.0, 1.4], WORDS, {}, tmp_path)
    assert any(c[2] == "SCARED".lower() or c[2].lower().endswith("scared") for c in shots[0]["caps"]) and shots[1]["caps"]


def test_only_the_keyword_is_red():
    assert pl.key_words("gave him one", {"one"}) == ["one"] and pl.key_words("a man", {"one"}) == []


def test_caption_colours_only_the_keyword():
    from PIL import Image
    import numpy as np
    from motion_studio import shot2d
    im = Image.new("RGB", (shot2d.W, shot2d.H), (40, 40, 40)); shot2d._caption(im, "gave him one", ["one"], 0.68)
    a = np.asarray(im).astype(int); band = a[int(shot2d.H * 0.68):int(shot2d.H * 0.68) + 70]
    red = ((band[:, :, 0] > 190) & (band[:, :, 1] < 70)); white = (band.min(2) > 235)
    xs_red, xs_white = np.nonzero(red)[1], np.nonzero(white)[1]
    assert len(xs_red) > 50 and len(xs_white) > 50 and xs_red.min() > np.median(xs_white)
