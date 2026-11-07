#!/usr/bin/env python3
"""Write kit/reference/knowledge/topic_profiles.json: per-video values and per-topic medians (topic labels are Claude's, small groups = preliminary).
   python3 kit/tools/build_profiles.py     (run after ref_study.py rules / ref_measure.py / ref_look.py)"""
import json, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE); R = lambda *a: os.path.join(KIT, "reference", *a)
G = {"history_war": ["pirate_cannonballs", "second_draw", "vp5", "knight_loophole", "mirror_horse_race", "storm_oil"],
     "money_gamble_crime": ["vp3", "vp4", "slot_machines", "winning_tickets", "random_numbers", "memory_price"],
     "engineering_system": ["perfect_railroads", "roller_coasters", "town_button"], "science_mind": ["idea_zone"], "night_horror": ["grave_bell"]}


def val(n):
    db = json.load(open(R("db", n + ".json"))); st = json.load(open(R("study", n + ".json"))); s = st["summary"]; lk = json.load(open(R("look", n + ".json")))
    return dict(brightness=db["mean"]["p50"], saturation=db["sat"]["p50"], palette=db["palette"]["p50"], edge=db["edge"]["p50"], frame_change=db["motion_diff_p50"],
                hard_cuts_per_min=s["hard_cuts_per_min"], scene_changes_per_min=st["scenes"]["per_min"], flights_per_min=s["flights"]["per_min"], time_fast=s["time_share"]["moving_fast"],
                time_still=s["time_share"]["nearly_still"], parallax=s["flights"]["parallax_ratio_p50"], flat=lk["colour"]["surface"]["flat"], gradient=lk["colour"]["surface"]["smooth_gradient"],
                warm=lk["colour"]["warm_share"], cool=lk["colour"]["cool_share"], dissolve_per_min=st["transitions"]["per_min"]["dissolve"], camera_move_per_min=st["transitions"]["per_min"]["camera_move"])


V = {n: val(n) for g in G.values() for n in g}; keys = list(next(iter(V.values())).keys())
P = {g: dict({k: round(float(np.median([V[n][k] for n in ns])), 3) for k in keys}, n=len(ns)) for g, ns in G.items()}
al = {k: [round(float(np.percentile([v[k] for v in V.values()], q)), 3) for q in (0, 10, 50, 90, 100)] for k in keys}
json.dump(dict(note="PRELIMINARY. Topic labels are Claude's. Groups of 1 to 6 videos: examples, not ranges. all_p0_10_50_90_100 is over the 17 videos.", genres=G, per_genre_median=P, all_p0_10_50_90_100=al,
               per_video={n: {k: round(x, 3) for k, x in v.items()} for n, v in V.items()}), open(R("knowledge", "topic_profiles.json"), "w"), indent=1)
print("profiles for", len(V), "videos"); [print(g, p) for g, p in P.items()]
