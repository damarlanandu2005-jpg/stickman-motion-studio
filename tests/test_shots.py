from motion_studio import script_reader as sr, shot_planner as sp, script_sounds as ss

CAST = {"characters": {"a": {"stages": {"s": {"costume": "civ"}}}, "b": {"stages": {"s": {"costume": "civ"}}}}, "costumes": {}}


def test_long_say_is_cut_into_two_or_three_shots_and_red_marks_stay():
    t = sr.parse_script("SCENE\nbg: room\nwho: a\nsay: Arthur was a *bomb* expert, and he could not tell red from green when the light turned dark.\n")
    assert len(t["scenes"]) in (2, 3) and t["scenes"][0]["frame"] == "wide" and t["scenes"][1]["frame"] == "medium"
    joined = " ".join(s["say"] for s in t["scenes"])
    assert joined == "Arthur was a *bomb* expert, and he could not tell red from green when the light turned dark."
    assert len({s["group"] for s in t["scenes"]}) == 1 and [s["shot"] for s in t["scenes"]] == list(range(1, len(t["scenes"]) + 1))


def test_short_say_and_split_no_stay_one_shot():
    assert len(sr.parse_script("SCENE\nbg: r\nsay: He ran.\n")["scenes"]) == 1
    long = "one two three four five six seven eight nine ten eleven twelve thirteen"
    assert len(sr.parse_script(f"SCENE\nbg: r\nsplit: no\nsay: {long}\n")["scenes"]) == 1


def test_explicit_shots_inherit_and_override():
    t = sr.parse_script("SCENE\nbg: room\nwho: a, b\npose: stand\nprops: bomb\ntext: BIG\nsound: tick\nsay: Two wires, ten seconds, and one man left.\nSHOT\nframe: wide\nSHOT\nframe: close\nwho: a\npose: think\nSHOT\nframe: insert\nsay: The wires.\n")
    s = t["scenes"]
    assert len(s) == 3 and [x["frame"] for x in s] == ["wide", "close", "insert"]
    assert s[1]["who"] == "a" and s[1]["pose"] == "think" and s[0]["who"] == "a, b" and s[2]["props"] == "bomb"
    assert s[0]["text"] == "BIG" and "text" not in s[1] and s[0]["sound"] == "tick" and "sound" not in s[2]
    assert s[2]["say"] == "The wires." and all(x["say"] for x in s)


def test_shot_outside_scene_is_reported_and_change_lines_keep_place():
    assert any("SHOT outside" in p for p in sr.parse_script("SHOT\nsay: hi\n")["problems"])
    t = sr.parse_script("SCENE\nbg: r\nwho: a\nsay: one two three four five six seven eight nine ten eleven twelve.\nCHANGE: a -> s\nSCENE\nbg: r\nsay: x.\n")
    assert t["stage_changes"][0][0] == len(t["scenes"]) - 1


def test_unknown_frame_is_an_error():
    r = sr.resolve(sr.parse_script("SCENE\nbg: r\nframe: zoomy\nsay: hi\n"), CAST, {"items": {}})
    assert any("frame 'zoomy'" in e for e in r["errors"])


def test_planner_frame_sizes():
    t = sr.parse_script("SCENE\nbg: room\nwho: a, b\nsay: Then they ran.\nSHOT\nframe: wide\nSHOT\nframe: medium\nSHOT\nframe: close\nSHOT\nframe: insert\n")
    r = sr.resolve(t, CAST, {"items": {}})
    shots, warns = sp.plan_shots(r, [2.0] * len(r["scenes"]), [], {})
    hs = [[a["height"] for a in s["actors"]] for s in shots]
    assert len(hs[0]) == 2 and len(hs[1]) == 2 and hs[1][0] > hs[0][0]
    assert len(hs[2]) == 1 and hs[2][0] >= 0.8 and hs[3] == [] or any("insert" in w for w in warns)


def test_one_time_sounds_only_in_first_shot():
    sc = {"bg": {"wanted": "street in a storm"}, "sound": "", "text": "", "voice": "", "props": [], "shot": 2}
    s, f = ss.plan(sc, 2.0)
    assert all(e["type"] in ("rain", "wind", "crackle", "crowd") for e in s) and any(e["type"] == "rain" for e in s)


def test_markdown_backslashes_and_stray_text_are_tolerated():
    t = sr.parse_script("Some notes before\nTITLE: x\\\nSCENE\\\nbg: room\\\nsay: hi\\\n")
    assert t["problems"] == [] and t["title"] == "x" and t["scenes"][0]["bg"] == "room"


def test_pose_can_be_an_expression():
    t = sr.parse_script("SCENE\nbg: room\nwho: a\npose: scared\nsay: Oh no.\n")
    r = sr.resolve(t, CAST, {"items": {}})
    shots, warns = sp.plan_shots(r, [2.0], [], {})
    assert shots[0]["actors"][0]["faces"] == [[0, "scared"]] and shots[0]["actors"][0]["pose"] == 0
    assert not any("pose word" in w for w in warns)
