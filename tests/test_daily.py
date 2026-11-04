from motion_studio import daily


def q(tmp_path, names):
    d = tmp_path / "q"; d.mkdir()
    for n in names:
        (d / f"{n}.txt").write_text("x")
    return d


def test_pick_in_order_skips_done_and_exhausted(tmp_path):
    d = q(tmp_path, ["a", "b", "c", "d", "e"]); led = tmp_path / "l.json"
    daily.record(led, "a", "done"); daily.record(led, "b", "failed", "x"); daily.record(led, "c", "failed"); daily.record(led, "c", "failed")
    daily.record(led, "d", "script_error", "bad")
    assert [p.split("/")[-1] for p in daily.pick(d, led, 3)] == ["b.txt", "e.txt"]
    assert len(daily.pick(d, led, 1)) == 1


def test_record_counts_tries_not_for_success_or_script_error(tmp_path):
    led = tmp_path / "l.json"
    daily.record(led, "a", "failed"); daily.record(led, "a", "done_with_warnings", "w")
    daily.record(led, "s", "script_error", "no bg")
    d = daily.load(led)
    assert d["a"]["tries"] == 1 and d["s"]["tries"] == 0


def test_morning_note_lists_needs_you(tmp_path):
    led = tmp_path / "l.json"
    daily.record(led, "a", "done", "heads borrowed", video="shorts/a.mp4"); daily.record(led, "b", "failed", "kaggle timeout")
    t = daily.morning_note(led, ["a", "b"], "2026-11-05")
    assert "1 of 2" in t and "Needs you" in t and "kaggle timeout" in t and "shorts/a.mp4" in t
    assert "No scripts" in daily.morning_note(led, [])
