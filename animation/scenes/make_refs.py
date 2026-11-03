"""Shot lists that recreate the STRUCTURE of the owner's 4 reference shorts with our own costumes (not their content):
same number of shots, same shot lengths, same mix of frame types. Each row: id, frame, chars, place, action/props, caption, cam, sfx.
Run: python animation/scenes/make_refs.py   (writes ref_v1.json ... ref_v4.json)"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from motion_studio.short_story import captions

HERE = Path(__file__).parent
W = {"c": "winter", "note": "wearing a brown fur-flap ushanka hat with a red star and an olive green winter coat"}
SOLDIER2 = {"c": "winter", "note": "wearing a brown fur-flap ushanka hat with a red star and an olive green winter coat, with a beard and a different tired face"}
OFFICER = {"c": "soldier", "note": "wearing a peaked officer cap with a red band and a thick moustache"}

V1 = [  # frame, chars, place, action, props, caption, cam
 ("wide", [W], "snowy trench at a ruined city, bare trees, grey sky", "lies behind sandbags aiming a long rifle", "a wooden sign board hanging top left", "SHOOTING", "push"),
 ("medium", [W], "snowy trench with sandbags", "aims a long rifle over the sandbags", "", "BUT IF ANYONE", "push"),
 ("medium", [W], "dark blue night in a trench", "stands with arms crossed, worried face", "", "ALONE", "push"),
 ("wide", [W], "snowy trench, ruined city skyline, grey sky", "aims rifle, a bright flash near him", "", "A SHRAPNEL FLASH", "drift"),
 ("wide", [W], "snowy trench, ruined city skyline", "aims rifle, a small red cloth on his shoulder", "", "A SHRAPNEL FLASH", "push"),
 ("close", [W], "snowy background", "covers one eye with his hand, gritted teeth", "", "RETINA OF HIS", "push"),
 ("medium", [W], "pale snowy sky", "covers one eye with his hand, worried face", "", "FEET TURNED INTO", "pull"),
 ("wide", [{"c": "soldier", "note": "a medic with a red cross armband"}], "army medical tent", "points at a wall eye-chart", "an eye-test chart on the wall", "IF THE MEDICS", "push"),
 ("medium", [W], "snowy trench", "stands with hands together, a long rifle leaning behind him", "", "LEAVING HIS", "drift"),
 ("medium", [W], "dark blue night at a sniper post", "stands with arms crossed", "", "SNIPER POST", "push"),
 ("wide", [W, SOLDIER2], "snowy trench, ruined city, grey sky", "stand side by side, one holds the other's shoulder", "", "BROTHER ACT AS", "push"),
 ("medium", [W, SOLDIER2], "snowy trench with sandbags", "one points ahead with a rifle, the other has eyes closed", "", "TAP HIS LEFT", "drift"),
 ("wide", [W, SOLDIER2], "snowy field, ruined city, grey sky", "stand side by side looking ahead", "", "EVERY SINGLE", "pull"),
 ("close", [W], "snowy background", "big calm face looking straight at the viewer", "", "COMPLETELY BLIND", "push"),
 ("close", [W, SOLDIER2], "snowy background", "two big faces side by side, one points", "", "GUIDED ONLY BY", "drift"),
 ("wide", [W, SOLDIER2], "snowy trench, ruined city", "kneel behind sandbags, one holds a rifle", "", "FINGERS ON HIS", "push"),
 ("card", [], "plain cream background", "", "a red and white tear-off wall calendar showing DAY 14", "FOR THREE WEEKS", "push"),
 ("wide", [OFFICER, {"c": "soldier", "note": "a second officer in a flat cap"}], "dim wooden hut with a window", "two officers stand with worried faces", "", "COULDN'T FIGURE", "push"),
 ("card", [], "plain black background", "", "two big round binocular views showing a pale snowy field", "SINGLE MARKSMAN", "pull"),
 ("wide", [W, SOLDIER2], "heavy snowstorm, everything pale and faded", "stand with rifles", "", "SNOWSTORMS", "push"),
 ("close", [OFFICER, W], "wooden hut", "one big wide-eyed officer face at left, a soldier face at right", "", "BLINDED EYE", "drift"),
 ("insert", [], "wide pale snowy field", "", "a single wooden post far away in the snow", "THREE HUNDRED", "push"),
 ("medium", [W, SOLDIER2], "inside a wooden hut with a window", "stand close, one holds a rifle", "", "THE SHOULDER", "drift"),
 ("insert", [], "pale snow background", "", "a wooden post with a coin flying above it and small sparkles", "COIN IN HALF", "push"),
 ("medium", [OFFICER, {"c": "winter", "note": "a small soldier"}], "wooden hut with a window and sandbags", "the officer stands behind the small soldier", "", "AND THE OFFICER", "push"),
 ("wide", [OFFICER], "snowy ruined city background", "stands alone with one hand raised", "", "WITHOUT FILING", "pull"),
]


S = "soldier"
V2 = [
 ("close", [S], "dark night with tall grass", "covers one eye with a hand, helmet with night-vision goggles on top", "", "A NAVY", "push"),
 ("wide", [S, {"c": "soldier", "note": "second soldier"}], "night vision green circular view of a dark cornfield", "two soldiers crouch with rifles", "", "PITCH-BLACK", "push"),
 ("medium", [S], "green night-vision circle view, tall grass", "soldier crouches with a rifle, angry face, a hand pointing", "", "FEET AWAY", "drift"),
 ("close", [S], "dark night field", "big worried face with helmet and night-vision goggles", "", "HE WAS SHOT", "push"),
 ("medium", [S, {"c": "soldier", "note": "wounded, lying on the ground"}], "night battlefield with fire glow", "one soldier kneels over his wounded friend", "", "REFUSING TO", "drift"),
 ("medium", [S, {"c": "soldier", "note": "second soldier"}], "dark rocky hill at night", "one soldier helps another walk", "", "DESPERATE CHOICE", "push"),
 ("insert", [], "dark screen with white corner frame marks", "", "an overhead infrared drone camera view with a crosshair on tiny white figures", "DIRECTLY ONTO", "push"),
 ("wide", [{"c": "sailor", "note": "wearing a headset and a moustache"}], "military control room with a big map and a monitor", "sits at a desk with arms down", "", "THE STRIKE COULD", "pull"),
 ("close", [S], "night sky", "grinning face with a radio on his shoulder", "", "WE'RE GOING TO", "push"),
 ("insert", [], "night sky with stars", "", "a big military cargo plane in the distance with an orange explosion flash", "DIE ANYWAY THE", "drift"),
 ("insert", [], "night sky", "", "a giant orange fire explosion with dark smoke over a black ridge and a grey rock in front", "INSTANTLY WIPED", "push"),
 ("insert", [], "night sky", "", "a bright yellow and orange explosion with black smoke over a grey rock", "OUT THE ENEMY", "push"),
 ("wide", [S, {"c": "soldier", "note": "second soldier"}, {"c": "soldier", "note": "third soldier"}], "dark rocky hill under stars", "three tiny soldiers huddle behind a big grey rock", "", "EVERY SINGLE", "pull"),
 ("medium", [{"c": "doctor", "note": "patient wearing a hospital gown, eyes closed"}], "hospital room with a heart monitor", "lies in a hospital bed", "", "AND EVEN THOUGH", "drift"),
 ("card", [], "pale blue-grey background", "", "a brown clipboard with many red tally marks", "53 SURGERIES", "push"),
 ("wide", [{"c": "doctor", "note": "wearing a hospital gown, holding an IV pole"}], "hospital hallway with a brown door", "walks slowly", "", "RECOVERY WAS", "push"),
 ("card", [], "plain orange background", "", "a big orange clipboard with the pen on top", "NO REGRETS AND", "push"),
]

Y = {"c": "explorer", "note": "wearing a mustard yellow coat and no hat, brown hair"}
COP = {"c": "sailor", "note": "dressed as a police officer in a dark navy uniform and cap"}
COPH = {"c": "sailor", "note": "police officer wearing a headset with a microphone"}
BOMB = {"c": "soldier", "note": "wearing a thick green bomb disposal suit with a round helmet"}
DOC = {"c": "doctor", "note": "an old doctor with glasses and a white coat"}
V3 = [
 ("medium", [BOMB], "grey street barrier with yellow tape", "kneels over a box of coloured wires with a timer showing 0:03", "", "TECHNICIAN COULD", "push"),
 ("medium", [BOMB], "grey smoky street", "stands fading in smoke", "", "WIRE TO CUT", "pull"),
 ("wide", [COP, COPH, COP], "police garage", "three officers stand in a row, one with a moustache", "", "BECAUSE HIS TEAM", "push"),
 ("wide", [Y], "city street corner with a red traffic light and shops", "stands looking up", "", "COMPLETELY", "push"),
 ("insert", [], "plain grey background", "", "a big black traffic light with all lights off", "COLORBLIND", "push"),
 ("wide", [DOC, Y], "bright clinic room", "the doctor holds a red heart card up to the man", "", "HEART SURGERY", "drift"),
 ("wide", [Y], "police station wall with a notice board and notes", "points at the notice board", "", "HIGHEST PAYING", "drift"),
 ("wide", [], "front of a grey police department building with columns and steps and a sign", "", "", "DEPARTMENT", "push"),
 ("close", [BOMB], "grey background", "big round helmet face with wide eyes behind the visor", "", "ORDNANCE", "push"),
 ("wide", [DOC, Y], "clinic with a wall chart and a clock", "the doctor holds up a chart, the man looks at it", "", "MEDICAL EXAM", "drift"),
 ("medium", [Y], "dark night room with a desk lamp and a window with a moon", "sits at a desk studying", "", "COLORBLINDNESS", "push"),
 ("card", [], "plain orange background", "", "a big round white clock face showing 12", "BACKWARDS AND", "push"),
 ("wide", [DOC, Y], "bright clinic room", "they walk together", "", "WALKING INTO THE", "drift"),
 ("wide", [COP, COPH, COP], "garage with grey roller doors", "three officers raise their hands and cheer", "", "ON THE SQUAD", "push"),
 ("wide", [], "city street with a blue armoured police truck and shops", "", "", "EVERY CALL WAS", "pull"),
 ("medium", [COPH], "garage wall", "stands thinking with a thought bubble holding a green check mark", "", "NIGHTMARE", "push"),
 ("wide", [{"c": "sailor", "note": "police officer with a headset and moustache"}], "control room with a city map and monitors", "points at the map", "", "RAIDED", "drift"),
 ("insert", [], "dark grey bomb casing", "", "a digital timer showing 0:30 above red green yellow and blue wires", "NOT THE GREEN", "push"),
 ("close", [COPH], "grey background", "big worried face with a sweat drop, headset microphone", "", "DIFFERENCE", "push"),
 ("medium", [Y], "dark night room with a desk lamp, moon in the window and a clock", "sits asleep over a book", "", "HE STAYED UP", "drift"),
 ("card", [], "orange background", "", "three blue blueprint sheets with simple technical diagrams of a factory", "FACTORY", "push"),
 ("card", [], "plain blue background", "", "a blueprint drawing of four batteries in a row", "BATTERY", "push"),
 ("medium", [Y], "night desk with a tall stack of colourful books", "sits relaxed with half-closed eyes", "", "MARKET", "drift"),
 ("card", [], "plain blue background", "", "a blueprint circuit board drawing with a hand pointing at a terminal", "WHICH TERMINAL", "push"),
 ("card", [], "plain orange background", "", "four coloured paper strips red green yellow blue fanned out", "NEVER BY THEIR", "pull"),
 ("medium", [COPH], "garage wall with a row of green check marks and a big red number 23", "stands with arms crossed", "", "FORTY-ONE BOMBS", "push"),
 ("card", [], "plain beige background", "", "a tear-off wall calendar showing YEAR 2", "IN THREE YEARS", "push"),
 ("wide", [COP, DOC], "dark warehouse with a spotlight and a box of coloured wires", "they look at a device on the floor", "", "DEVICE BUILT", "drift"),
 ("insert", [], "grey background", "", "a bundle of grey twisted wires", "WIRES TWISTED", "push"),
 ("close", [{"c": "sailor", "note": "police chief with a white shirt, cap and moustache, holding a radio to his mouth"}], "police street scene with yellow tape", "shouting into the radio", "", "SCREAMED OVER", "push"),
 ("insert", [], "dark background", "", "a timer showing 0:08 above a cut bundle of red blue yellow wires with sparks", "CUT THE BLUE", "push"),
 ("medium", [COPH], "dark warehouse with a spotlight", "holds both hands on his headset", "", "ARTHUR TOOK OFF", "push"),
 ("close", [COPH], "dark background", "huge calm face with eyes nearly closed", "", "FELT THE", "push"),
 ("insert", [], "pale grey background", "", "a grey bundle of wires with a timer showing 0:05", "INSULATION WITH", "drift"),
 ("insert", [], "pale grey background", "", "a tangled knot of grey wires with a timer showing 0:03 and a red wire in a clamp", "HIGHER-GAUGE", "push"),
 ("insert", [], "dark crate in a warehouse", "", "a digital timer showing 0:01 above red blue yellow green wires on a wooden crate", "ONE SECOND ON", "push"),
 ("wide", [{"c": "sailor", "note": "police chief in white shirt and cap with moustache"}, COPH], "garage with grey roller doors", "the chief talks, the other officer listens with a speech bubble showing the number 74", "", "COULDN'T SEE", "drift"),
 ("wide", [{"c": "doctor", "note": "head instructor"}, COPH, COP], "classroom with a wooden sign on the wall and desks", "the instructor points at the students", "", "HEAD INSTRUCTOR", "drift"),
 ("insert", [], "city skyline at sunset over water, orange and purple sky", "", "", "THE ONLY MAN", "pull"),
 ("wide", [COPH, BOMB], "classroom with a green board", "one is holding a paint can, both smiling", "", "ON PAINT TO", "push"),
]

PA = {"c": "explorer", "note": "young man in a blue long robe and a small red cap, big smile"}
PB = {"c": "egypt", "note": "a sultan in a red robe with a tall white turban and a thick black moustache and beard"}
PC = {"c": "winter", "note": "an older man in a green robe and a white-green turban"}
PG = {"c": "soldier", "note": "palace guard in a blue coat with a tall white and yellow ceremonial hat"}
OT = "old Ottoman city"
V4 = [
 ("wide", [PA, PB], OT + " plaza in front of a big round stone tower, warm sunny day", "stand side by side", "", "of", "push"),
 ("wide", [PG, PG], "castle gate with battlements", "two guards stand proudly", "", "guards", "push"),
 ("medium", [PG, PG], "castle gate", "two guards laugh with crossed axes", "", "laughing", "drift"),
 ("wide", [PB], "hilltop above the old city skyline with domes and minarets", "stands facing the viewer", "", "tallest", "pull"),
 ("wide", [PA], "building site with wooden scaffolding and stone blocks", "carries a stone block", "", "this", "push"),
 ("wide", [PA], "green field with a small stone tower and a pointed roof", "smiles", "", "in", "drift"),
 ("medium", [PA, PB], "palace room with blue tiles and a red carpet", "talk with crossed arms", "", "anything", "push"),
 ("wide", [PA], "harbour with a big wooden sailing ship with two masts", "stands on the dock", "", "ship", "drift"),
 ("wide", [PA], "street with a brown wooden house and cypress trees", "stands with arms crossed", "", "by", "push"),
 ("medium", [PA, PC], "treasury with shelves of gold cups", "the green robed man hands gold to the young man", "", "gold", "drift"),
 ("wide", [PA, PB], "palace garden with arches and cypress trees", "stand talking", "", "he", "push"),
 ("wide", [PA, PB, PC], "palace garden with arches and cypress trees", "talk and laugh", "", "silver", "drift"),
 ("wide", [PA, PB], "throne room with a golden throne and a red carpet", "stand beside the throne", "", "wasn't", "push"),
 ("wide", [PA], "huge curved stone staircase going up a tower", "points at the steps", "", "step", "push"),
 ("wide", [PA], "inside a stone tower, an arched window and a staircase", "stands scratching his head", "", "all", "drift"),
 ("insert", [], "green hills under a blue sky with an old city far below", "", "a very tall thin stone tower with a spiral staircase wrapped around it", "forty-eight", "pull"),
 ("medium", [PB], "green and gold palace hall with a patterned wall", "smiles with a hand on his belly", "", "smiled", "push"),
 ("wide", [PB, {"c": "winter", "note": "advisor in a purple robe"}, {"c": "winter", "note": "advisor in an orange robe"}], "palace hall with a patterned carpet", "the sultan stands between two advisors", "", "a", "drift"),
 ("wide", [PB, PG, PG, PC], "castle courtyard with a tower behind", "a big group stands together", "", "word", "pull"),
 ("wide", [PC], "stone steps on a tall tower with a curved wall and blue sea", "walks up the steps", "", "went", "push"),
 ("wide", [PC], "a spiral stone staircase inside a tower", "points forward", "", "a", "drift"),
 ("wide", [PC], "a spiral stone staircase", "carries a heavy sack on his back and a pile of coins on a step", "", "15", "push"),
 ("wide", [PC], "stone staircase with an arch window", "bends under a heavy brown sack", "", "heavy", "push"),
 ("wide", [PC], "a stone staircase going up with a sea view", "walks beside a grey donkey carrying baskets", "", "carrying", "drift"),
 ("medium", [PC], "treasury room with a blue tiled wall and a wooden chest", "stands holding an abacus", "", "treasurer's", "push"),
 ("wide", [PC], "dark treasury with a stone arch and a wooden chest", "stands with his arms raised", "", "treasury", "drift"),
 ("wide", [PC, PB], "stone room with an iron-bound chest and barrels", "talk, the sultan is happy", "", "being", "push"),
 ("wide", [PC], "stone staircase of a tall tower, bright sky", "runs up the stairs", "", "ran", "push"),
 ("wide", [PC, PB], "old city rooftops in the background", "one bends over out of breath, the other stands proudly", "", "breath", "drift"),
 ("insert", [], "dark stone wall", "", "a glowing orange stone furnace with a black pot and bubbling steam", "every", "push"),
 ("insert", [], "wooden table", "", "an old hand-drawn map of the world with black dots", "to", "drift"),
 ("wide", [PC, PB], "palace arch with a view to the sea", "a very tall wooden measuring rod stands next to the sultan and the green robed man", "", "still", "push"),
 ("card", [PA], "yellow sunburst rays background", "holds an abacus and smiles", "", "was", "push"),
 ("card", [], "plain sand beige sky background", "", "a set of rising beige stone blocks like steps", "held", "pull"),
 ("card", [], "dark blue sunburst rays background", "", "a golden balance scale with coins on one side", "below", "push"),
 ("wide", [PA], "green field with a very tall stone spiral tower far away, old city below", "stands seen from behind looking up", "", "steps", "pull"),
 ("wide", [PB, PG, PG, PC, PA], "palace courtyard crowded with people in front of a castle tower", "a crowd stands facing the viewer", "", "in", "push"),
 ("medium", [PB, PC], "palace room with hanging lanterns", "talk closely", "", "be", "drift"),
 ("medium", [PB], "red throne with a gold canopy", "leans back on the throne", "", "leaned", "push"),
 ("wide", [PA, PB], "red and gold throne room", "cheer with raised arms", "", "every", "push"),
 ("wide", [PA, PB], "treasury room with scrolls and chests", "inspect the treasure", "", "so", "drift"),
 ("wide", [PC, PA, PB], "stone doorway with iron door", "three men look at the viewer", "", "my", "push"),
 ("medium", [PC], "stone arch with empty shelves", "stands with arms out", "", "was", "drift"),
 ("medium", [PC], "dim room with a calendar on the wall and a candle", "points at the calendar", "", "million", "push"),
 ("medium", [PC], "room with an arched window and a view of the city at sunset", "stands with arms out, worried", "", "280", "push"),
 ("medium", [{"c": "winter", "note": "old man with a white beard and white-green turban, tired"}], "dim room at sunset with scattered papers and gold coins on the floor", "stands alone", "", "himself", "drift"),
 ("wide", [PC], "base of a tall stone tower with steps and green plants", "stands leaning with a sad smile", "", "got", "pull"),
]

CAMS = {"push": {"z0": 1.0, "z1": 1.16}, "pull": {"z0": 1.16, "z1": 1.0}, "drift": {"z0": 1.06, "z1": 1.06, "x0": 0.45, "x1": 0.55}}


FACES4 = ["proud smiles", "stern proud faces", "laughing with wide open mouths", "smug half-closed eyes and a smirk", "determined", "happy", "the sultan smug, the young man respectful", "curious", "proud", "the old man generous, the young man amazed",
          "friendly", "laughing", "the sultan amused, the young man hopeful", "puzzled, one eyebrow up", "tired and puzzled", "", "a proud smug smile", "pleased", "serious", "determined",
          "excited", "straining with effort", "exhausted, sweating", "patient", "proud", "arms up, wide-eyed", "the sultan satisfied, the old man nervous", "panting and sweating", "one exhausted, one smug", "",
          "", "the sultan amused", "proud smile", "", "", "awed", "solemn", "worried whispering", "smug, leaning back", "both thrilled", "greedy happy", "nervous", "sad and worried", "very worried", "sad and tired", "sad", "tired smile"]


def build(name, rows, durs, prefix):
    shots, plan = [], []
    for i, (frame, chars, place, action, props, cap, cam) in enumerate(rows):
        sid = f"{prefix}{i + 1:02d}"
        item = {"id": sid, "frame": frame, "chars": chars, "place": place, "action": action, "props": props}
        if name == "v4" and i < len(FACES4) and FACES4[i]:
            item["face"] = FACES4[i]
        plan.append(item)
        d = durs[i]
        caps = captions(cap, d)
        shots.append({"id": sid, "dur": d, "cam": CAMS[cam], "caps": caps})
    (HERE / f"ref_{name}_plan.json").write_text(json.dumps(plan, indent=1))
    (HERE / f"ref_{name}_shots.json").write_text(json.dumps(shots, indent=1))
    print(name, len(rows), "shots", round(sum(durs[:len(rows)]), 1), "s")


if __name__ == "__main__":
    d = json.loads((HERE / "ref_durations.json").read_text())
    build("v1", V1, d["v1"], "a")
    build("v2", V2, d["v2"], "b")
    build("v3", V3, d["v3"], "c")
    build("v4", V4, d["v4"], "d")
