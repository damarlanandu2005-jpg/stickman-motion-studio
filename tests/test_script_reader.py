import json
from pathlib import Path
import pytest
from motion_studio import script_reader as sr

CAST = {"characters": {"arthur": {"default_stage": "normal", "stages": {"normal": {"costume": "civ"}, "squad": {"costume": "bombsuit"}}},
                       "chief": {"stages": {"main": {"costume": "chief"}}}},
        "costumes": {"bombsuit": {"look": "a thick padded olive-green suit", "colour": "olive green"}}}
DB = {"items": {"bg_office": {"type": "background", "tags": ["bomb", "squad", "office", "inside"], "file": "x"},
                "obj_bomb": {"type": "object", "tags": ["bomb"], "file": "y"}}}
TEXT = """TITLE: T
VOICE: am_fenrir
SCENE
bg: bomb squad office inside
who: arthur, chief
props: bomb
say: Arthur was a *normal* man.
camera: push

CHANGE: arthur -> squad

SCENE
bg: bomb squad office
who: arthur
say: Now the *squad* suit.
"""


def root(tmp, dirs=()):
    for d in dirs:
        (tmp / "animation" / "assets2d" / d).mkdir(parents=True)
    return tmp


def test_parse_reads_header_scenes_and_stage_change():
    s = sr.parse_script(TEXT)
    assert s["title"] == "T" and len(s["scenes"]) == 2 and s["stage_changes"] == [(1, "arthur", "squad")] and not s["problems"]


def test_red_words_and_clean_voice():
    assert sr.red_marks("Arthur was a *normal* man.") == ("Arthur was a normal man.", ["normal"])


def test_stage_follows_change_and_library_match(tmp_path):
    r = sr.resolve(sr.parse_script(TEXT), CAST, DB, root(tmp_path, ["role_civ", "role_chief"]))
    assert r["scenes"][0]["who"][0]["costume"] == "civ" and r["scenes"][1]["who"][0]["costume"] == "bombsuit"
    assert r["scenes"][0]["bg"]["library_id"] == "bg_office" and r["scenes"][0]["props"][0]["library_id"] == "obj_bomb"
    assert r["missing_costumes"] == ["bombsuit"] and not r["errors"] and not r["missing_assets"]


def test_errors_are_plain_and_name_the_line():
    bad = "SCENE\nbg: x\nwho: bob\nsay: hi\ncamera: zoom\nfoo: 1\n"
    r = sr.resolve(sr.parse_script(bad), CAST, DB, Path("."))
    text = " ".join(r["errors"])
    assert "unknown character 'bob'" in text and "camera 'zoom'" in text and "unknown field 'foo'" in text and not r["ok"]


def test_missing_say_and_bg_are_errors():
    r = sr.resolve(sr.parse_script("SCENE\nwho: arthur\n"), CAST, DB, Path("."))
    assert any("missing 'say:'" in e for e in r["errors"]) and any("missing 'bg:'" in e for e in r["errors"])


def test_unmatched_background_becomes_a_drawing_need(tmp_path):
    r = sr.resolve(sr.parse_script("SCENE\nbg: volcano lab\nsay: hi\n"), CAST, DB, tmp_path)
    assert r["missing_assets"][0]["type"] == "background" and r["missing_assets"][0]["tags"] == ["volcano", "lab"]


def test_missing_costume_gets_spec_stub_from_cast_look_and_colour(tmp_path):
    r = sr.resolve(sr.parse_script(TEXT), CAST, DB, root(tmp_path, ["role_civ", "role_chief"]))
    made = sr.write_specs(r, CAST, tmp_path / "specs")
    spec = json.loads(Path(made[0]).read_text())
    assert spec["name"] == "bombsuit" and spec["target_hue"] == [0.17, 0.45] and "padded olive-green suit" in spec["prompt_first"]
    assert "shins" in spec["prompt_first"] and spec["max_rounds"] >= 2


def test_unsupported_colour_is_refused_not_guessed():
    with pytest.raises(sr.ScriptError):
        sr.make_costume_spec("x", "a brown coat", "brown")


def test_missing_costume_without_look_is_an_error(tmp_path):
    cast = {"characters": {"a": {"stages": {"s": {"costume": "ghost"}}}}}
    r = sr.resolve(sr.parse_script("SCENE\nbg: x\nwho: a\nsay: hi\n"), cast, DB, tmp_path)
    sr.write_specs(r, cast, tmp_path / "specs")
    assert any("no 'look' and 'colour'" in e for e in r["errors"])
