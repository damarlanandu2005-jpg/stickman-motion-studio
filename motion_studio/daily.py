"""Daily run bookkeeping: which scripts are next, what happened to each, and the morning note.

Rules (decided with the owner): scripts are made ONE AT A TIME; every step has a bounded number of tries; if a step cannot be
fixed it is skipped, the reason is written down, and the next script starts. Nothing here loops until it works.

    pick(queue, ledger, n)          next n scripts that are not done and have tries left
    record(ledger, name, status, note, steps)  status: done | done_with_warnings | failed | skipped
    morning_note(ledger, run)       markdown the owner reads in the morning
Ledger = JSON file {script name: {status, tries, notes[], last_run, video}}.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

MAX_TRIES = 2          # a script that failed twice (on two different days) waits for the owner
DONE = ("done", "done_with_warnings")


def load(ledger: Path) -> dict:
    try:
        return json.loads(Path(ledger).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save(ledger: Path, data: dict) -> None:
    Path(ledger).parent.mkdir(parents=True, exist_ok=True)
    Path(ledger).write_text(json.dumps(data, indent=1, sort_keys=True), encoding="utf-8")


def pick(queue: Path, ledger: Path, n: int, max_tries: int = MAX_TRIES) -> list[str]:
    """Oldest file name first (the owner names scripts so they sort in the order wanted, e.g. 2026-11-05_01_title.txt)."""
    led = load(ledger)
    out = []
    for f in sorted(Path(queue).glob("*.txt")):
        e = led.get(f.stem, {})
        if e.get("status") in DONE or e.get("tries", 0) >= max_tries or e.get("status") == "script_error":
            continue
        out.append(str(f))
        if len(out) >= n:
            break
    return out


def record(ledger: Path, name: str, status: str, note: str = "", steps: dict | None = None, run: str = "", video: str = "") -> dict:
    led = load(ledger)
    e = led.setdefault(name, {"tries": 0, "notes": []})
    e["status"] = status; e["last_run"] = run or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    if status not in DONE:
        e["tries"] = e.get("tries", 0) + (0 if status == "script_error" else 1)
    if note:
        e["notes"] = (e.get("notes", []) + [note])[-8:]
    if steps:
        e["steps"] = steps
    if video:
        e["video"] = video
    save(ledger, led); return e


def morning_note(ledger: Path, names: list[str], run: str = "") -> str:
    led = load(ledger)
    lines = [f"# Morning note {run}".strip(), ""]
    good = [n for n in names if led.get(n, {}).get("status") in DONE]
    bad = [n for n in names if n not in good]
    lines.append(f"{len(good)} of {len(names)} shorts finished." if names else "No scripts were waiting in the queue.")
    for n in good:
        e = led[n]; lines.append(f"- {n}: {e['status']}" + (f", video {e['video']}" if e.get("video") else ""))
        for w in e.get("notes", [])[-3:]:
            lines.append(f"    - note: {w}")
    if bad:
        lines += ["", "## Needs you"]
        for n in bad:
            e = led.get(n, {}); lines.append(f"- {n}: {e.get('status', 'not started')} (tries {e.get('tries', 0)}/{MAX_TRIES})")
            for w in e.get("notes", [])[-4:]:
                lines.append(f"    - {w}")
    lines += ["", "Every video is checked by code only. A person has not reviewed it."]
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(); sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("pick"); a.add_argument("--queue", default="scripts_queue"); a.add_argument("--ledger", required=True); a.add_argument("-n", type=int, default=3)
    r = sub.add_parser("record"); r.add_argument("--ledger", required=True); r.add_argument("--name", required=True); r.add_argument("--status", required=True)
    r.add_argument("--note", default=""); r.add_argument("--run", default=""); r.add_argument("--video", default="")
    m = sub.add_parser("note"); m.add_argument("--ledger", required=True); m.add_argument("--run", default=""); m.add_argument("names", nargs="*")
    x = p.parse_args(argv)
    if x.cmd == "pick":
        print("\n".join(pick(Path(x.queue), Path(x.ledger), x.n)))
    elif x.cmd == "record":
        record(Path(x.ledger), x.name, x.status, x.note, run=x.run, video=x.video)
    else:
        print(morning_note(Path(x.ledger), x.names, x.run))
    return 0


if __name__ == "__main__":
    sys.exit(main())
