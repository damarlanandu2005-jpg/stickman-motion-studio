#!/usr/bin/env python3
"""Director's breakdowns for the three overnight shorts (db_cooper, jungle_fall, lightning_man).
usage: overnight_breakdowns.py [name ...]   -> writes ricks/projects/<name>/breakdown.json (then: breakdown.py check/build)"""
import json, os, sys
R = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "projects"))
def words(n): return json.load(open(os.path.join(R, n, "audio", "words.json")))["words"]
def tw(n, i): return words(n)[i]["t0"]
def L(say, place, subject=None, shot="medium", move="push", proof="", acts=None, extra=None, show=None, anchor=None):
    d = {"say": say, "place": place, "move": move, "proof": proof, "acts": acts or []}
    if subject: d["subject"] = subject; d["shot"] = shot
    else: d["anchor"] = anchor
    if extra: d["extra"] = extra
    if show: d["show"] = show
    return d
def A(dist=10, fov=40, yaw=0, pitch=2, **k): return dict(distance=dist, fov=fov, yaw=yaw, pitch=pitch, **k)
def card(img, pos, size): return {"type": "plane", "image": "props/%s.png" % img, "pos": pos, "size": size}
def C(i, char, place, pos, face=None, hat=None, flip=False, h=1.8):
    d = {"id": i, "char": char, "place": place, "pos": pos, "height": h}
    if face: d["face"] = face
    if hat: d["hat"] = hat
    if flip: d["flip"] = True
    return d
def act(who, at=0.0, **k): return dict(who=who, at=at, **k)
def hold(f, hand, sc): return {"file": "props/%s.png" % f, "hand": hand, "scale": sc}
def base(n, title, places, cast, lines, lighting, ground, musicDb=-17):
    return {"title": title, "period": "1970s", "audio": {"voice": "audio/voice.mp3", "music": "audio/music.mp3", "musicDb": musicDb}, "words": "audio/words.json",
            "ground": ground, "lighting": lighting, "places": places, "cast": cast, "props": [], "lines": lines}

def db_cooper():
    n = "db_cooper"
    places = {"tarmac": {"kit": "tarmac", "at": [0, 0, 0], "backdrop": "airport"}, "cabin": {"kit": "plane_cabin", "at": [70, 0, 0], "backdrop": None},
              "night": {"kit": "plane_tail_night", "at": [140, 0, 0], "backdrop": "night_forest"}, "river": {"kit": "river_bank", "at": [210, 0, 0], "backdrop": "river_forest"}}
    cast = [C("cooper_t", "cooper", "tarmac", [-1.0, 0, 0], "neutral"), C("agent_t", "agent", "tarmac", [1.3, 0, 0.1], "neutral", flip=True),
            C("pass1", "neighbor", "tarmac", [9, 0, -1.6], "nervous", flip=True), C("pass2", "wife", "tarmac", [10.5, 0, -1.8], "nervous", flip=True, h=1.65), C("pass3", "father", "tarmac", [12, 0, -1.5], "nervous", flip=True),
            C("cooper_c", "cooper", "cabin", [-0.7, 0, 0], "neutral"), C("att_c", "attendant", "cabin", [0.8, 0, 0.1], "neutral", flip=True, h=1.7), C("pilot_c", "pilot", "cabin", [2.0, 0, -1.4], "neutral", hat="pilot_cap", flip=True),
            C("cooper_n", "cooper", "night", [0, 0.9, -3.2], "neutral"),
            C("agent_r", "agent", "river", [-0.9, 0, 0], "neutral"), C("agent2_r", "agent", "river", [1.0, 0, 0.1], "confused", flip=True), C("boy_r", "boy", "river", [3.4, 0, 0.3], "neutral", flip=True, h=1.2)]
    Ls = [
     L("In nineteen seventy-one", "tarmac", None, move="craneUp", anchor=[0, 2.3, -9], proof="An airliner parked on the apron with a NOV 24 1971 date card",
       extra=A(15, 42, -12, 0, orbit=6, rise=2.5, zoom=2), show=[card("sign_1971", [4.2, 0, -3], [3.2, 1.48])]),
     L("jumped out with", "tarmac", "cooper_t", "medium", "push", "Cooper in a suit and sunglasses holding a $200,000 money bag",
       acts=[act("cooper_t", 0.0, face="neutral", hold=hold("money_bag", "R", 0.5), pose={"armR": -55})]),
     L("and was never seen", "tarmac", "cooper_t", "wide", "pull", "A NEVER FOUND wanted poster beside the empty-handed Cooper",
       acts=[act("cooper_t", 0.0, face="neutral")], show=[card("sign_wanted", [2.5, 0, -1.4], [3.2, 1.74])]),
     L("He bought a ticket", "cabin", "cooper_c", "close", "orbitR", "Cooper in the aisle with a FLIGHT 305 PORTLAND - SEATTLE board behind him",
       acts=[act("cooper_c", 0.0, face="neutral")], show=[card("sign_flight305", [0.6, 0.0, -2.0], [3.0, 1.1])]),
     L("Calm, polite", "cabin", "cooper_c", "medium", "push", "Cooper calmly bows politely in his suit and tie",
       acts=[act("cooper_c", 0.2, face="neutral", motion="bow")]),
     L("Mid-flight", "cabin", "cooper_c", "two", "orbitL", "Cooper hands a folded note to the flight attendant",
       acts=[act("cooper_c", 0.2, motion="give", hold=hold("note_bomb", "R", 0.32)), act("att_c", 0.2, face="neutral")]),
     L("It said he had a bomb", "cabin", "att_c", "close", "push", "The attendant reads the note: I HAVE A BOMB - shocked",
       acts=[act("att_c", 0.0, face="shocked", hold=hold("note_bomb", "L", 0.32))]),
     L("He showed her the wires", "cabin", None, move="push", anchor=[0, 0.8, -0.3], proof="An open briefcase packed with red sticks and wires",
       extra=A(3.2, 38, -8, 8, zoom=4, orbit=2, rise=0.3, frameY=0.0), show=[card("briefcase_wires", [0, 0.35, -0.3], [1.6, 1.07])]),
     L("Then he made his demands", "cabin", "cooper_c", "medium", "orbitR", "Cooper, calm and stern, laying out his demands",
       acts=[act("cooper_c", 0.2, face="neutral", motion="point")]),
     L("two hundred thousand", "cabin", None, move="push", anchor=[0, 0.9, -0.4], proof="A canvas bag marked $200,000",
       extra=A(3.0, 38, 6, 6, zoom=4, orbit=-2, rise=0.2), show=[card("money_bag", [0, 0.25, -0.4], [1.2, 1.3])]),
     L("and four parachutes", "cabin", None, move="craneUp", anchor=[0, 1.1, -0.5], proof="Four red-and-white parachutes in a row",
       extra=A(4.2, 40, -6, 3, zoom=3, rise=1.0), show=[card("parachute", [-1.7, 0.5, -0.5], [1.1, 0.97]), card("parachute", [-0.6, 0.5, -0.5], [1.1, 0.97]), card("parachute", [0.6, 0.5, -0.5], [1.1, 0.97]), card("parachute", [1.7, 0.5, -0.5], [1.1, 0.97])]),
     L("On the ground", "tarmac", "cooper_t", "two", "push", "On the apron an agent hands the money bag to Cooper",
       acts=[act("agent_t", 0.2, motion="give", hold=hold("money_bag", "R", 0.5)), act("cooper_t", 0.9, motion="take")]),
     L("He let the passengers go", "tarmac", "cooper_t", "wide", "orbitL", "Passengers walk away from the plane behind Cooper",
       acts=[act("pass1", 0.2, to=[-8, 0, -1.6], walk=True, over=2.2, flip=True), act("pass2", 0.4, to=[-9.5, 0, -1.8], walk=True, over=2.2, flip=True), act("pass3", 0.6, to=[-11, 0, -1.5], walk=True, over=2.2, flip=True)]),
     L("Then he ordered the pilots", "cabin", "cooper_c", "two", "push", "Cooper orders the nervous pilot",
       acts=[act("cooper_c", 0.2, face="neutral", motion="point"), act("pilot_c", 0.3, to=[0.9, 0, 0.0], walk=True, over=0.8, face="nervous")]),
     L("and to fly low", "tarmac", None, move="craneUp", anchor=[0, 2.0, -9], proof="The airliner pointed toward a MEXICO sign",
       extra=A(14, 42, 10, 0, orbit=-5, rise=2.0, zoom=2), show=[card("sign_mexico", [-5.2, 0, -2.2], [2.4, 2.8])]),
     L("Somewhere over the forests", "night", None, move="craneDown", anchor=[0, 3.5, -8], proof="The dark pine forest at night under a stormy sky, the airliner's tail",
       extra=A(14, 44, -14, 0, orbit=-4, rise=-2, zoom=2)),
     L("in the rain and the dark", "night", "cooper_n", "wide", "push", "Cooper stands at the dark open door of the plane in the night",
       acts=[act("cooper_n", 0.0, face="neutral")]),
     L("he opened the rear stairs", "night", "cooper_n", "medium", "craneDown", "Cooper at the top of the rear stairs steps off into the night",
       acts=[act("cooper_n", 0.4, face="neutral"), act("cooper_n", 1.5, motion="fall", to=[0, 0.0, -1.2], over=0.9)]),
     L("They searched for years", "river", "agent_r", "medium", "orbitR", "Two FBI agents search the riverbank, one pointing",
       acts=[act("agent_r", 0.2, motion="point"), act("agent2_r", 0.2, face="confused")]),
     L("The FBI never found him", "river", "agent2_r", "close", "push", "A confused FBI agent beside a NEVER FOUND wanted poster",
       acts=[act("agent2_r", 0.0, face="confused", motion="shrug")], show=[card("sign_wanted", [-1.6, 0, -0.8], [2.6, 1.42])]),
     L("The only trace", "river", None, move="push", anchor=[0, 0.3, -1.2], proof="A bundle of banknotes lying in the sand of the river bank",
       extra=A(3.0, 38, -6, 14, zoom=4, orbit=2, rise=0.1), show=[card("cash", [0, 0.05, -1.2], [1.0, 0.65])]),
     L("dug up by a boy", "river", "boy_r", "medium", "orbitL", "A boy holding the bundle of cash, shocked",
       acts=[act("boy_r", 0.0, face="shocked", hold=hold("cash", "R", 0.45), pose={"armR": -50})]),
     L("in nineteen eighty", "river", "boy_r", "wide", "pull", "The boy on the river bank under a 1980 date card",
       acts=[act("boy_r", 0.0, face="neutral")], show=[card("sign_1980", [3.4, 1.7, -0.6], [1.7, 0.9])]),
     L("It remains the only", "tarmac", None, move="pull", anchor=[0, 1.4, -3], proof="A large wanted poster: DAN COOPER - NEVER FOUND, an airliner behind",
       extra=A(7, 40, 6, 3, zoom=-3, orbit=-2, rise=1), show=[card("sign_wanted", [0, 0, -3], [4.2, 2.28])]),
    ]
    lighting = [{"t": 0, "mood": "day"}, {"t": round(tw(n, 20) - 0.1, 2), "mood": "bright", "fade": 0.3}, {"t": round(tw(n, 71) - 0.1, 2), "mood": "day", "fade": 0.3},
                {"t": round(tw(n, 84) - 0.1, 2), "mood": "bright", "fade": 0.3}, {"t": round(tw(n, 93) - 0.1, 2), "mood": "day", "fade": 0.3}, {"t": round(tw(n, 101) - 0.1, 2), "mood": "night", "fade": 0.8}, {"t": round(tw(n, 123) - 0.1, 2), "mood": "day", "fade": 0.8}]
    return base(n, "The Man Who Vanished", places, cast, Ls, lighting, {"texture": "grass", "repeat": [240, 240]})

def jungle_fall():
    n = "jungle_fall"
    places = {"sky": {"kit": "storm_sky", "at": [0, 0, 0], "backdrop": "storm_sky"}, "jungle": {"kit": "jungle", "at": [70, 0, 0], "backdrop": "jungle"},
              "crash": {"kit": "jungle_crash", "at": [140, 0, 0], "backdrop": "jungle"}, "river": {"kit": "jungle_river", "at": [210, 0, 0], "backdrop": "jungle"},
              "hut": {"kit": "jungle_hut", "at": [280, 0, 0], "backdrop": "jungle"}}
    cast = [C("jul_s", "juliane", "sky", [0, 3.0, 0], "scared", h=1.65), C("jul_j", "juliane", "jungle", [-0.9, 0, 0], "neutral", h=1.65), C("father_j", "father", "jungle", [1.0, 0, 0], "neutral", flip=True),
            C("jul_c", "juliane", "crash", [-0.9, 0, 0.2], "confused", h=1.65), C("jul_r", "juliane", "river", [0, 0.06, -1.0], "neutral", h=1.65), C("father_r", "father", "river", [-1.8, 0, 1.4], "neutral"),
            C("jul_h", "juliane", "hut", [-0.6, 0, 0.3], "nervous", h=1.65), C("logger_h", "logger", "hut", [1.3, 0, 0.1], "happy", hat="straw_hat", flip=True, h=1.75)]
    Ls = [
     L("A seventeen-year-old fell", "sky", "jul_s", "wide", "craneDown", "A teenage girl falling through dark storm clouds",
       acts=[act("jul_s", 0.2, face="scared", motion="fall")]),
     L("and walked out of", "jungle", "jul_j", "medium", "push", "The girl walks out of the rainforest toward the camera",
       acts=[act("jul_j", 0.2, face="neutral", to=[0.4, 0, 1.2], walk=True, over=2.3)]),
     L("On Christmas Eve", "sky", None, move="push", anchor=[0, 2.4, -7], proof="An airliner flying into dark thunderclouds with a 24 DEC 1971 PERU card",
       extra=A(13, 42, -10, 1, orbit=3, rise=0.6, zoom=4), show=[card("sign_peru", [-4.4, 0, -2.5], [3.3, 1.45])]),
     L("over the Peruvian Amazon", "jungle", None, move="pull", anchor=[0, 3, -12], proof="A dense green Amazon rainforest canopy seen from a distance",
       extra=A(16, 44, 8, 3, orbit=-3, rise=2, zoom=-2)),
     L("Lightning struck", "sky", None, move="push", anchor=[0, 2.4, -7], proof="A yellow lightning bolt strikes the airliner",
       extra=A(11, 42, 6, 1, orbit=-3, rise=0.4, zoom=4), show=[card("bolt", [3.2, 0, -6.2], [1.7, 4.4])]),
     L("The plane broke apart", "sky", None, move="orbitR", anchor=[0, 2.4, -7], proof="The airliner breaks apart, pieces tumbling through the storm",
       extra=A(11, 42, -6, 1, orbit=5, rise=0.5, zoom=3), show=[
         {"type": "box", "pos": [-3.2, 3.8, -6.5], "size": [1.6, 0.25, 0.9], "color": "#e6e8ec"}, {"type": "box", "pos": [3.6, 1.0, -6.0], "size": [1.2, 0.3, 0.8], "color": "#cfd3d8"},
         {"type": "box", "pos": [-5.0, 1.2, -6.5], "size": [0.9, 0.2, 0.7], "color": "#d6dade"}, {"type": "box", "pos": [5.0, 3.6, -6.4], "size": [1.0, 0.25, 0.7], "color": "#e6e8ec"}]),
     L("Still strapped to her seat", "sky", "jul_s", "close", "push", "The girl strapped to a blue airliner seat in the storm",
       acts=[act("jul_s", 0.0, face="scared")], show=[{"type": "box", "pos": [0, 2.45, 0.0], "size": [1.0, 0.55, 0.9], "color": "#2f5f9a"}, {"type": "box", "pos": [0, 3.0, -0.4], "size": [1.0, 1.0, 0.18], "color": "#2a5588"}]),
     L("she fell two miles", "sky", "jul_s", "medium", "craneDown", "The girl and her seat plunge down through the clouds",
       acts=[act("jul_s", 0.0, face="scared", motion="fall")], show=[{"type": "box", "pos": [0, 2.45, 0.0], "size": [1.0, 0.55, 0.9], "color": "#2f5f9a"}]),
     L("When she woke", "crash", "jul_c", "wide", "pull", "Alone on the rainforest floor beside wrecked airliner seats",
       acts=[act("jul_c", 0.2, face="confused"), act("jul_c", 1.5, face="sad")]),
     L("Ninety-one other people", "crash", None, move="push", anchor=[0, 0.6, -3.4], proof="The wreckage: crashed seats, suitcases and torn metal in the jungle",
       extra=A(8, 42, -8, 4, orbit=3, rise=0.6, zoom=4), show=[card("suitcase", [-0.4, 0, -1.6], [0.9, 0.62])]),
     L("She had a broken collarbone", "crash", "jul_c", "close", "orbitL", "Juliane hurt and crying: a swollen eye and deep cuts",
       acts=[act("jul_c", 0.2, face="sad"), act("jul_c", 1.6, face="crying", motion="cower")]),
     L("Her parents were biologists", "jungle", "father_j", "two", "orbitR", "Her biologist father in khaki beside her in the jungle",
       acts=[act("father_j", 0.2, face="happy", motion="nod"), act("jul_j", 0.2, face="happy")]),
     L("She remembered one thing", "jungle", "jul_j", "close", "push", "Juliane thinking, remembering her father's lesson",
       acts=[act("jul_j", 0.1, face="neutral")]),
     L("find running water", "river", "father_r", "medium", "orbitL", "Her father points downstream along the river; a blue water drop",
       acts=[act("father_r", 0.2, face="neutral", motion="point")], show=[card("water_drop", [-0.4, 2.1, -1.0], [0.9, 0.9])]),
     L("Water leads to people", "river", "jul_r", "close", "push", "Juliane standing in the river, pointing downstream",
       acts=[act("jul_r", 0.1, face="happy", motion="point")]),
     L("So she followed the water", "river", "jul_r", "wide", "orbitR", "Juliane wading along the river for days",
       acts=[act("jul_r", 0.1, face="neutral", to=[2.8, 0.06, -1.0], walk=True, over=1.5, flip=False)]),
     L("She ran out of food", "river", "jul_r", "close", "push", "Juliane hungry and weak, face sad",
       acts=[act("jul_r", 0.1, face="sad")]),
     L("Maggots burrowed into her wounds", "river", "jul_r", "close", "orbitL", "Juliane in pain, scared, clutching her arm",
       acts=[act("jul_r", 0.1, face="scared", motion="cower")]),
     L("She passed the bodies", "crash", "jul_c", "wide", "orbitR", "Juliane walks sadly past the crashed seats and wreckage",
       acts=[act("jul_c", 0.1, face="sad", to=[3.4, 0, 0.4], walk=True, over=1.9)]),
     L("On the tenth day", "hut", "jul_h", "medium", "push", "Juliane finds a small boat and a hut under a DAY 10 card",
       acts=[act("jul_h", 0.2, face="happy", motion="wave")], show=[card("sign_day10", [-2.5, 1.9, -1.0], [1.6, 1.0])]),
     L("Loggers found her", "hut", "logger_h", "two", "orbitL", "A logger in a straw hat helps Juliane under a DAY 11 card",
       acts=[act("logger_h", 0.2, face="happy", motion="wave"), act("jul_h", 0.2, face="happy")], show=[card("sign_day11", [-2.5, 1.9, -1.0], [1.6, 1.0])]),
     L("Out of ninety-two people", "hut", "jul_h", "close", "pull", "Juliane, the only survivor, standing safe by the hut",
       acts=[act("jul_h", 0.1, face="happy"), act("jul_h", 1.8, face="neutral")]),
    ]
    lighting = [{"t": 0, "mood": "day"}, {"t": round(tw(n, 18) - 0.1, 2), "mood": "storm", "fade": 0.6}, {"t": round(tw(n, 31) + 0.15, 2), "mood": "flash", "fade": 0.05}, {"t": round(tw(n, 31) + 0.35, 2), "mood": "storm", "fade": 0.25},
                {"t": round(tw(n, 52) - 0.1, 2), "mood": "day", "fade": 0.8}]
    return base(n, "The Girl Who Fell From the Sky", places, cast, Ls, lighting, {"texture": "jungle_floor", "repeat": [240, 240]})

def lightning_man():
    n = "lightning_man"
    places = {"road": {"kit": "ranger_road", "at": [0, 0, 0], "backdrop": "blue_ridge"}, "tower": {"kit": "fire_tower", "at": [70, 0, 0], "backdrop": "blue_ridge"},
              "yard": {"kit": "mountain_yard", "at": [140, 0, 0], "backdrop": "blue_ridge"}}
    cast = [C("roy_r", "roy", "road", [0, 0, 0], "neutral", hat="ranger_hat"), C("roy_f", "roy", "tower", [0, 0, 0], "neutral", hat="ranger_hat"),
            C("roy_y", "roy", "yard", [-0.6, 0, 0], "neutral", hat="ranger_hat"), C("wife_y", "wife", "yard", [1.2, 0, 0.1], "neutral", flip=True, h=1.65), C("nbr_y", "neighbor", "yard", [-2.6, 0, 0.2], "neutral")]
    bolt = lambda x, z=-2.0, w=1.3: card("bolt", [x, 0, z], [w, w * 2.62])
    Ls = [
     L("One man was struck", "road", "roy_r", "medium", "push", "A park ranger with a lightning bolt crashing down beside him",
       acts=[act("roy_r", 0.2, face="shocked")], show=[bolt(1.6, -2.0, 1.5)]),
     L("and survived every", "road", "roy_r", "close", "orbitR", "The ranger, unharmed, giving a calm nod",
       acts=[act("roy_r", 0.2, face="neutral", motion="nod")]),
     L("Roy Sullivan was", "tower", "roy_f", "medium", "orbitL", "Roy in his ranger hat and uniform before the fire lookout tower",
       acts=[act("roy_f", 0.2, face="neutral")]),
     L("The first bolt", "tower", "roy_f", "medium", "push", "A bolt hits Roy by the tower: STRIKE 1, 1942",
       acts=[act("roy_f", 0.1, face="shocked", motion="cower")], show=[bolt(0.5, -0.3, 1.0), card("sign_strike1", [-2.0, 1.8, -1.0], [1.6, 1.0])]),
     L("and blew off", "tower", None, move="push", anchor=[0, 0.4, -0.3], proof="A scorched work boot with a hole where the big toenail was",
       extra=A(2.6, 38, 6, 6, zoom=4, orbit=-2, rise=0.1), show=[card("boot", [0, 0, -0.3], [0.8, 0.76])]),
     L("Years later, lightning", "road", "roy_r", "wide", "orbitL", "A bolt strikes the ranger truck as Roy drives: STRIKE 2, 1969",
       acts=[act("roy_r", 0.2, face="shocked")], show=[bolt(-5.2, -2.4, 1.4), card("sign_strike2", [2.2, 1.9, -1.0], [1.6, 1.0])]),
     L("Then again, in", "yard", "roy_y", "medium", "orbitR", "A bolt hits in Roy's front yard by the house: STRIKE 3, 1970",
       acts=[act("roy_y", 0.2, face="shocked", motion="cower")], show=[bolt(1.1, -1.0, 1.3), card("sign_strike3", [-2.2, 1.9, -1.0], [1.6, 1.0])]),
     L("Then it set his hair", "yard", "roy_y", "close", "push", "Flames burn above Roy's head: STRIKE 4 and STRIKE 5",
       acts=[act("roy_y", 0.1, face="shouting", motion="cower")], show=[card("flame", [-0.1, 1.55, 0.15], [0.6, 0.78]), card("flame", [0.25, 1.5, 0.1], [0.5, 0.65]), card("sign_strike4", [-1.8, 2.1, -1.0], [1.3, 0.8]), card("sign_strike5", [1.8, 2.1, -1.0], [1.3, 0.8])]),
     L("People began to back", "yard", "nbr_y", "two", "orbitL", "A neighbour backs away from Roy while the storm rolls in",
       acts=[act("nbr_y", 0.2, face="nervous", flip=True, to=[-5.0, 0, 0.2], walk=True, over=2.0), act("roy_y", 0.2, face="sad")]),
     L("Even his wife", "yard", "wife_y", "close", "push", "Roy's wife struck by lightning at the clothesline",
       acts=[act("wife_y", 0.1, face="shocked")], show=[bolt(2.4, -1.2, 1.4)]),
     L("in the yard beside", "yard", "roy_y", "two", "orbitR", "Roy stands beside his shocked wife in the yard",
       acts=[act("roy_y", 0.1, face="nervous"), act("wife_y", 0.1, face="shocked")]),
     L("Seven times, the sky", "road", "roy_r", "close", "craneUp", "A giant bolt behind Roy: STRIKE 7, 1977",
       acts=[act("roy_r", 0.1, face="scared")], show=[bolt(0.2, -2.6, 2.4), card("sign_strike7", [1.9, 1.6, -1.2], [1.6, 1.0])]),
     L("Seven times, he got", "road", "roy_r", "medium", "craneUp", "Roy rises, scorched but standing",
       acts=[act("roy_r", 0.1, face="neutral", motion="nod")]),
     L("Guinness World Records says", "yard", None, move="pull", anchor=[0, 1.2, -2], proof="A GUINNESS WORLD RECORDS - 7 STRIKES plaque",
       extra=A(6, 40, -6, 3, zoom=-3, orbit=2, rise=0.8), show=[card("sign_guinness", [0, 0, -2], [3.0, 1.63])]),
     L("and people called him", "road", "roy_r", "close", "push", "Roy beside a lightning-rod pole with a bolt striking it",
       acts=[act("roy_r", 0.1, face="neutral")], show=[{"type": "post", "pos": [1.0, 0, -0.6], "h": 3.6, "color": "#b8bcc4"}, bolt(1.0, -0.8, 1.1)]),
     L("No one could explain", "yard", "roy_y", "close", "orbitL", "Roy confused, thinking",
       acts=[act("roy_y", 0.1, face="confused")]),
     L("The odds of being hit", "yard", None, move="push", anchor=[0, 1.2, -2], proof="A THE ODDS? card with a single small bolt",
       extra=A(5, 40, 5, 3, zoom=4, orbit=-2, rise=0.3), show=[card("sign_odds", [0, 0, -2], [2.6, 1.33]), bolt(1.9, -2.0, 0.8)]),
     L("The odds of seven", "tower", "roy_f", "wide", "push", "Seven bolts across the sky behind Roy, who shrugs",
       acts=[act("roy_f", 0.1, face="confused", motion="shrug")], show=[bolt(x, -6.0, 1.1) for x in (-4.5, -3.0, -1.5, 0.0, 1.5, 3.0, 4.5)]),
     L("In the end", "yard", "roy_y", "wide", "orbitR", "Roy, in sunshine, walks slowly across his yard",
       acts=[act("roy_y", 0.1, face="neutral", to=[2.6, 0, 0.3], walk=True, over=2.0)]),
     L("Roy died in nineteen", "yard", None, move="craneUp", anchor=[0, 1.0, -1.5], proof="A ROY SULLIVAN 1912 - 1983 memorial plaque",
       extra=A(6, 40, 4, 2, zoom=2, orbit=1, rise=1.0), show=[card("sign_roy", [0, 0, -1.5], [3.0, 1.32])]),
     L("Lightning never got him", "yard", "roy_y", "close", "pull", "Roy smiles quietly in the sun",
       acts=[act("roy_y", 0.1, face="smug")]),
    ]
    # flashes at strike moments (numeric seconds from the voice timings)
    lt = [{"t": 0, "mood": "storm"}]
    for wi in (5, 23, 38, 44, 54, 56, 74):
        t = tw(n, wi); lt += [{"t": round(t, 2), "mood": "flash", "fade": 0.05}, {"t": round(t + 0.14, 2), "mood": "storm", "fade": 0.25}]
    for wi in (84, 105, 113): t = tw(n, wi); lt += [{"t": round(t, 2), "mood": "flash", "fade": 0.05}, {"t": round(t + 0.14, 2), "mood": "storm", "fade": 0.25}]
    lt += [{"t": round(tw(n, 137) - 0.1, 2), "mood": "day", "fade": 0.8}]
    lt.sort(key=lambda e: e["t"])
    return base(n, "The Man Lightning Wouldn't Leave Alone", places, cast, Ls, lt, {"texture": "grass", "repeat": [240, 240]})

if __name__ == "__main__":
    for nm in (sys.argv[1:] or ["db_cooper", "jungle_fall", "lightning_man"]):
        B = globals()[nm](); json.dump(B, open(os.path.join(R, nm, "breakdown.json"), "w"), indent=1); print("wrote", nm, len(B["lines"]), "lines")
