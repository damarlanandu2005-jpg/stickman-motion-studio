"""Recreation of owner reference v3 ("He Defused 41 Bombs Without Seeing COLOR") in the LAYERED way.

Shot cuts and lengths are the REAL ones measured from the v3 mp4 (animation/scenes/ref_v3_cuts.json: 50 segments, 73.10 s).
Pictures: library backgrounds / inserts (drawn by Kaggle, no text). All text and numbers are drawn here by code.
Characters: explorer sprites recoloured per role (motion_studio/roles.py); the only cast we have.

    python -m motion_studio.v3_story models_dir out.mp4
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from . import shot2d
from .v3_voice import caption_groups, synth

ROOT = Path(__file__).resolve().parents[1]
CUTS = json.loads((ROOT / "animation" / "scenes" / "ref_v3_cuts.json").read_text())

PUSH = {"z0": 1.0, "z1": 1.16}
PULL = {"z0": 1.16, "z1": 1.0}
PAN = {"z0": 1.06, "z1": 1.06, "x0": 0.45, "x1": 0.55}
STILL = {"z0": 1.0, "z1": 1.0}

# y of the floor line (where feet stand) per background, as a fraction of the picture height (tuned after looking at the pictures)
FEET = {"bg_v3_street_barrier": 0.9, "bg_v3_garage": 0.88, "bg_v3_street_corner": 0.9, "bg_v3_hospital": 0.88, "bg_v3_bulletin": 0.88,
        "bg_v3_police_steps": 0.9, "bg_v3_night_study": 0.9, "bg_v3_dispatch": 0.9, "bg_v3_warehouse": 0.9, "bg_v3_classroom": 0.9, "bg_v3_skyline": 0.9}


def A(role: str, pose: int, x: float, h: float, face: str = "neutral", feet: float = 0.88, **kw) -> dict:
    """One character. role = recolour (tech, civ, doc, chief, cop, radio); h = body height as a fraction of the picture height."""
    d = {"outfit": f"role_{role}", "pose": pose, "x": x, "feet": feet, "height": h, "faces": [[0, face]]}
    d.update(kw)
    return d


def T(text: str | None = None, **kw) -> dict:
    d = {"text": text} if text is not None else {}
    d.update(kw)
    return d


def spec() -> list[dict]:
    """The 50 shots in v3 order. Each: bg (library id), cam, actors, texts (code-drawn), flash. Keep the order = G1..G50 of the contact sheets."""
    S = []
    add = S.append
    # G1 technician kneeling at the bomb, timer counts 5 -> 3
    add({"bg": "var_v3_barrier_bomb", "cam": PUSH, "actors": [A("tech", 0, 0.34, 0.36, "scared", 0.9)],
         "texts": [T(count=[5, 3], x=0.76, y=0.66, size=0.028, font="mono", color=(255, 80, 60), bg=(0, 0, 0, 230))]})
    add({"bg": "var_v3_barrier_bomb", "cam": PULL, "actors": [A("tech", 0, 0.34, 0.36, "surprised", 0.9)], "flash": [[0, 0.07, 0.9]],
         "texts": [T("0:03", x=0.76, y=0.66, size=0.028, font="mono", color=(255, 80, 60), bg=(0, 0, 0, 230))]})  # G2 flash
    add({"bg": "ins_explosion", "cam": PULL})                                             # G3 fireball
    add({"bg": "var_v3_barrier_smoke", "cam": PUSH, "actors": [A("tech", 3, 0.5, 0.36, "neutral", 0.9)]})  # G4 smoke
    add({"bg": "bg_v3_garage", "cam": PUSH, "actors": [A("cop", 3, 0.2, 0.22, "smug", 0.9), A("chief", 0, 0.5, 0.2, "neutral", 0.88), A("cop", 3, 0.8, 0.22, "happy", 0.9)]})  # G5 team
    add({"bg": "var_v3_corner_light", "cam": PUSH, "actors": [A("civ", 0, 0.5, 0.25, "surprised", 0.92)]})  # G6
    add({"bg": "ins_traffic_grey", "cam": PUSH})                                           # G7
    add({"bg": "bg_v3_hospital", "cam": PAN, "actors": [A("civ", 0, 0.3, 0.27, "sad", 0.9)]})  # G8 (daughter missing)
    add({"bg": "bg_v3_hospital", "cam": PAN, "actors": [A("doc", 1, 0.28, 0.3, "neutral", 0.9), A("civ", 0, 0.72, 0.28, "scared", 0.9)]})  # G9
    add({"bg": "var_v3_bulletin_notes", "cam": PAN, "actors": [A("civ", 1, 0.3, 0.3, "neutral", 0.9)],
         "texts": [T("TRAFFIC $", x=0.27, y=0.3, size=0.014, font="hand", color=(50, 50, 50)), T("BOMB SQUAD", x=0.5, y=0.3, size=0.014, font="hand", color=(50, 50, 50)),
                   T("PATROL $$", x=0.73, y=0.3, size=0.014, font="hand", color=(50, 50, 50))]})  # G10
    add({"bg": "bg_v3_police_steps", "cam": PUSH, "actors": [A("civ", 0, 0.25, 0.14, "angry", 0.74)],
         "texts": [T("POLICE", x=0.5, y=0.285, size=0.03, font="bold", color=(50, 60, 80))]})  # G11
    add({"bg": "bg_v3_garage", "cam": PUSH, "actors": [A("tech", 0, 0.5, 0.62, "neutral", 1.05, head=0.9)]})  # G12 close
    add({"bg": "bg_v3_garage", "cam": PUSH, "actors": [A("tech", 0, 0.5, 0.66, "surprised", 1.08, head=0.9)]})  # G13 close
    add({"bg": "bg_v3_hospital", "cam": PAN, "actors": [A("doc", 1, 0.3, 0.3, "neutral", 0.9), A("civ", 5, 0.72, 0.28, "scared", 0.9)]})  # G14
    add({"bg": "bg_v3_night_study", "cam": PUSH, "actors": [A("civ", 0, 0.62, 0.3, "neutral", 1.0)],
         "texts": [T("12", x=0.8, y=0.62, size=0.03, font="hand", color=(40, 40, 40), bg=(255, 255, 255, 235))]})  # G15
    add({"bg": "ins_orange_blank", "cam": PUSH, "texts": [T("12", x=0.5, y=0.47, size=0.12, font="hand", color=(215, 90, 40), disc=(255, 255, 255, 255))]})  # G16 plate
    add({"bg": "var_v3_hospital_desk", "cam": PUSH, "actors": [A("civ", 0, 0.38, 0.28, "smug", 0.9)]})  # G17
    add({"bg": "bg_v3_hospital", "cam": PAN, "actors": [A("doc", 1, 0.3, 0.3, "happy", 0.9), A("civ", 0, 0.72, 0.28, "smug", 0.9)],
         "texts": [T("74!", x=0.62, y=0.42, size=0.03, font="hand", color=(40, 40, 40), bg=(255, 255, 255, 240))]})  # G18
    add({"bg": "bg_v3_garage", "cam": PUSH, "actors": [A("cop", 3, 0.2, 0.22, "smug", 0.9), A("chief", 0, 0.5, 0.2, "neutral", 0.88), A("cop", 3, 0.8, 0.22, "happy", 0.9)]})  # G19
    add({"bg": "var_v3_corner_truck", "cam": PULL})                                        # G20
    add({"bg": "var_v3_garage_truck", "cam": PUSH, "actors": [A("cop", 4, 0.66, 0.3, "scared", 0.95)]})  # G21
    add({"bg": "bg_v3_dispatch", "cam": PAN, "actors": [A("radio", 1, 0.5, 0.3, "happy", 0.95)]})  # G22
    add({"bg": "ins_timer_dark", "cam": PUSH, "texts": [T("0:30", x=0.5, y=0.27, size=0.035, font="mono", color=(255, 255, 255))]})  # G23
    add({"bg": "ins_timer_dark@gray", "cam": PULL, "texts": [T("0:30", x=0.5, y=0.27, size=0.035, font="mono", color=(255, 255, 255))]})  # G24
    add({"bg": "bg_v3_garage", "cam": PUSH, "actors": [A("cop", 0, 0.5, 0.7, "scared", 1.1, head=0.9)]})  # G25 close
    add({"bg": "bg_v3_night_study", "cam": PAN, "actors": [A("civ", 0, 0.62, 0.3, "sad", 1.0)]})  # G26
    add({"bg": "ins_blueprints_orange", "cam": PUSH, "texts": [T("TIMER MODEL 7", x=0.4, y=0.31, size=0.014, font="mono", color=(255, 255, 255), rot=8),
                                                               T("88:88", x=0.4, y=0.37, size=0.03, font="mono", color=(255, 255, 255), rot=8)]})  # G27
    add({"bg": "ins_blueprint_battery", "cam": PUSH, "texts": [T("BATTERY PACK 6V", x=0.45, y=0.38, size=0.014, font="mono", color=(255, 255, 255))]})  # G28
    add({"bg": "var_v3_night_files", "cam": PAN, "actors": [A("civ", 0, 0.7, 0.28, "smug", 1.0)]})  # G29
    add({"bg": "ins_blueprint_circuit", "cam": PUSH, "texts": [T("CIRCUIT BOARD C-200", x=0.45, y=0.35, size=0.014, font="mono", color=(255, 255, 255))]})  # G30
    add({"bg": "ins_cards_orange", "cam": PULL})                                           # G31
    add({"bg": "bg_v3_garage", "cam": PUSH, "actors": [A("cop", 4, 0.5, 0.3, "smug", 0.96)],
         "texts": [T("24", x=0.45, y=0.17, size=0.07, font="hand", color=(210, 40, 40), rot=-6),
                   T("\u2713 \u2713 \u2713 \u2713 \u2713 \u2713 \u2713", x=0.5, y=0.31, size=0.05, font="sym", color=(30, 165, 75), stroke=2),
                   T("\u2713 \u2713", x=0.2, y=0.37, size=0.05, font="sym", color=(30, 165, 75), stroke=2)]})  # G32
    add({"bg": "ins_calendar", "cam": PUSH, "texts": [T("YEAR 2", x=0.5, y=0.5, size=0.04, font="hand", color=(50, 50, 60))]})  # G33
    add({"bg": "var_v3_warehouse_box", "cam": PUSH, "actors": [A("chief", 0, 0.12, 0.2, "scared", 0.95), A("cop", 0, 0.4, 0.3, "neutral", 0.96)]})  # G34
    add({"bg": "ins_wires_straight_grey", "cam": PUSH})                                    # G35
    add({"bg": "bg_v3_street_barrier", "cam": PUSH, "actors": [A("chief", 6, 0.5, 0.42, "angry", 1.0)]})  # G36
    add({"bg": "bg_v3_street_barrier", "cam": PUSH, "actors": [A("chief", 6, 0.5, 0.55, "angry", 1.1)]})  # G37
    add({"bg": "ins_wires_cut_red_pliers", "cam": PUSH})                                   # G38
    add({"bg": "ins_timer_red", "cam": PUSH, "texts": [T("0:10", x=0.5, y=0.3, size=0.05, font="mono", color=(255, 130, 130))]})  # G39
    add({"bg": "var_v3_warehouse_box", "cam": PUSH, "actors": [A("cop", 3, 0.4, 0.34, "angry", 0.98)],
         "texts": [T(count=[8, 8], x=0.1, y=0.09, size=0.03, font="mono", color=(255, 255, 255), stroke=3, screen=True)]})  # G40
    add({"bg": "bg_v3_warehouse", "cam": PUSH, "actors": [A("cop", 0, 0.5, 0.7, "neutral", 1.1, head=0.9)],
         "texts": [T("0:07", x=0.1, y=0.09, size=0.03, font="mono", color=(255, 255, 255), stroke=3, screen=True)]})  # G41
    add({"bg": "ins_wires_knot_grey", "cam": PUSH, "texts": [T("0:05", x=0.1, y=0.09, size=0.03, font="mono", color=(255, 255, 255), stroke=3, screen=True)]})  # G42
    add({"bg": "ins_wires_knot_grey", "cam": {"z0": 1.3, "z1": 1.42}, "texts": [T("0:03", x=0.1, y=0.09, size=0.03, font="mono", color=(255, 255, 255), stroke=3, screen=True)]})  # G43
    add({"bg": "ins_timer_dark", "cam": PUSH, "texts": [T("0:01", x=0.5, y=0.27, size=0.045, font="mono", color=(255, 255, 255))]})  # G44
    add({"bg": "bg_v3_garage", "cam": PUSH, "actors": [A("chief", 6, 0.35, 0.3, "surprised", 0.95), A("cop", 0, 0.75, 0.22, "sad", 0.95)]})  # G45
    add({"bg": "bg_v3_garage", "cam": PUSH, "actors": [A("chief", 6, 0.35, 0.3, "laugh", 0.95), A("cop", 0, 0.75, 0.22, "sad", 0.95)]})  # G46
    add({"bg": "bg_v3_garage", "cam": PUSH, "actors": [A("chief", 1, 0.35, 0.32, "angry", 0.95)],
         "texts": [T("FIRED", x=0.5, y=0.2, size=0.06, font="bold", color=(205, 40, 40), rot=12, stroke=0)]})  # G47
    add({"bg": "bg_v3_classroom", "cam": PAN, "actors": [A("cop", 0, 0.15, 0.22, "happy", 0.95), A("cop", 4, 0.45, 0.25, "neutral", 0.97), A("cop", 4, 0.8, 0.28, "smug", 0.98)],
         "texts": [T("HEAD INSTRUCTOR", x=0.5, y=0.2, size=0.025, font="hand", color=(60, 40, 20))]})  # G48
    add({"bg": "bg_v3_skyline", "cam": PUSH})                                              # G49
    add({"bg": "var_v3_classroom_bucket", "cam": PUSH, "actors": [A("cop", 4, 0.2, 0.25, "sad", 0.97), A("cop", 4, 0.78, 0.3, "smug", 0.99)]})  # G50
    return S


def build(words: list, durs: list[float] | None = None, bg_prefix: str = "lib:") -> list[dict]:
    durs = durs or CUTS["durs"]
    groups = caption_groups(words)
    shots, t = [], 0.0
    sp = spec()
    assert len(sp) == len(durs), (len(sp), len(durs))
    for s, d in zip(sp, durs):
        caps = [[round(max(a - t, 0), 3), round(min(b - t, d), 3), txt, red] for a, b, txt, red in groups if b > t + 0.05 and a < t + d - 0.05]
        sh = dict(s, bg=bg_prefix + s["bg"], dur=d, caps=caps, cap_y=0.68)
        for tx in sh.get("texts", []):
            if tx.get("count") and tx["count"][0] == tx["count"][1]:
                tx["text"] = f"0:{tx['count'][0]:02d}"; tx.pop("count")
        shots.append(sh)
        t += d
    return shots


def main(argv: list[str]) -> int:
    models, out = Path(argv[0]), Path(argv[1])
    work = out.parent / (out.stem + "_work")
    wav, report, words = synth(models, work, sum(CUTS["durs"]))
    shots = build(words)
    (work / "shots.json").write_text(json.dumps(shots, indent=1))
    (work / "voice_report.json").write_text(json.dumps(report, indent=1))
    print(shot2d.render_video(shots, out, audio=wav))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
