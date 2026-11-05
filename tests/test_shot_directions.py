from motion_studio import shot_directions as sd


def test_where_positions_and_distance():
    w = sd.parse_where("arthur centre near, chief far right far", ["arthur", "chief"])
    assert w["arthur"] == {"x": 0.5, "height": 0.44, "feet": 0.95} and w["chief"]["x"] == 0.87 and w["chief"]["height"] == 0.2


def test_face_changes_and_per_person():
    assert sd.parse_face("worried -> scared -> shocked", ["arthur"], 3.0)["arthur"] == [[0.0, "sad"], [1.0, "scared"], [2.0, "surprised"]]
    f = sd.parse_face("cop: laugh, chief: smug", ["cop", "chief"], 2.0)
    assert f == {"cop": [[0.0, "laugh"]], "chief": [[0.0, "smug"]]}


def test_move_items():
    m = sd.parse_move("timer 0:05 -> 0:01 at 0.76 0.66, sweat, flash end, shake, gunfire, arthur walks left -> centre, dance", ["arthur"], 2.0)
    t = m["texts"][0]
    assert t["count"] == [5, 1] and t["x"] == 0.76 and not t["screen"]
    assert m["sweat"] == ["arthur"] and m["flash"] == [[1.75, 2.0, 0.9]] and m["shake"]
    assert m["walk"]["arthur"] == (0.27, 0.5) and [f["type"] for f in m["fx"]] == ["tracers"] and m["unknown"] == ["dance"]


def test_camera_words():
    assert sd.camera("still") == {"z0": 1.0, "z1": 1.0} and sd.camera("slow push")["z1"] <= 1.08 and sd.camera("zoomy") is None
