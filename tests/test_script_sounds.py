import numpy as np
from PIL import Image

from motion_studio import effects, script_sounds as ss, sfx


def sc(bg="", sound="", text="", voice="", props=()):
    return {"bg": {"wanted": bg}, "sound": sound, "text": text, "voice": voice, "props": [{"wanted": p} for p in props]}


def test_rain_scene_gets_rain_fx_and_sound():
    s, f = ss.plan(sc(bg="city street in the rain"), 4.0)
    assert [e["type"] for e in f] == ["rain"] and any(e["type"] == "rain" and e["dur"] == 4.0 for e in s)


def test_water_fall_gets_splash_ripples_bubbles():
    s, f = ss.plan(sc(sound="he falls into the water"), 3.0)
    assert {e["type"] for e in f} == {"ripples", "bubbles"} and "splash" in {e["type"] for e in s}
    assert next(e for e in f if e["type"] == "bubbles")["t0"] == 1.5


def test_sound_none_is_silence_and_plain_scene_is_quiet():
    assert ss.plan(sc(bg="rain", sound="none"), 3) == ([], [])
    assert ss.plan(sc(bg="a calm room with a desk", voice="He sat down."), 3) == ([], [])


def test_narration_only_event_words_count():
    s, _ = ss.plan(sc(bg="room", voice="Then the explosion shook the town."), 3)
    assert any(e["type"] == "boom" for e in s)
    s, f = ss.plan(sc(bg="room", voice="It was raining in his heart."), 3)
    assert f == [] and s == []                   # narration weather words alone do not make rain


def test_all_new_sounds_make_audio():
    for k in ("rain", "thunder", "bubbles", "splash", "crackle", "door", "crowd"):
        x = sfx.make(k, 2.0)
        assert len(x) > 1000 and np.isfinite(x).all() and abs(x).max() <= 1.0


def test_effects_change_frame_and_are_deterministic():
    base = Image.new("RGB", (720, 1280), (90, 120, 150))
    for typ in effects.TYPES:
        a = effects.draw(base, [{"type": typ}], 0.7, 3.0, 5); b = effects.draw(base, [{"type": typ}], 0.7, 3.0, 5)
        assert np.array_equal(np.asarray(a), np.asarray(b)) and not np.array_equal(np.asarray(a), np.asarray(base)), typ
    c = effects.draw(base, [{"type": "rain"}], 0.9, 3.0, 5)
    assert not np.array_equal(np.asarray(a), np.asarray(c))
    assert effects.draw(base, [{"type": "rain", "t0": 2.0}], 0.5, 3.0) is base
