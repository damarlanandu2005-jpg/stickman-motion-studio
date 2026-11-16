#!/usr/bin/env python3
"""Builds scene/catalogue.json: what the library can actually make. The director plans from this list.
Piece ids are read from inkbeat/src/lib/pieces.tsx so the catalogue cannot drift from the code."""
import json, re, os
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "../inkbeat/src/lib/pieces.tsx")).read()
body = src[src.index("export const PIECES"):src.index("export const PIECE_IDS")]
groups, cur = {}, "misc"
for line in body.splitlines():
    m = re.match(r"\s*// -+ (.+?) -+", line)
    if m: cur = m.group(1).split(" (")[0]; continue
    m = re.match(r"\s*([a-z_0-9]+): \(", line)
    if m: groups.setdefault(cur, []).append(m.group(1))
cat = {
 "_about": "What the set and character library can make today. Plans may only ask for these (or a kit dressed with these). Regenerate with scene/make_catalogue.py.",
 "kits": {
  "room": {"use": "any interior: office, station, hall, shop, lab, archive, living room", "enclosed": True, "options": ["size", "wall colour", "floor colour and texture", "number of windows", "windows lit (night)", "ceiling light"],
           "slots": ["front_left", "front_right", "centre", "back_left", "back_right", "at_wall"], "features": ["walls", "floor", "ceiling light", "windows"]},
  "ground": {"use": "any open place: yard, park, road side, field, tarmac, clearing", "enclosed": False, "options": ["surface: grass, lawn, sand, stone, tarmac, mud", "backdrop: none, pines, jungle, hills, houses"],
             "slots": ["front_left", "front_right", "centre", "mid_left", "mid_right", "far"], "features": ["surface", "backdrop trees", "backdrop hills", "backdrop houses"]},
  "water_edge": {"use": "river bank, lake shore, beach", "enclosed": False, "options": ["bank: sand, mud, grass", "far bank: pines, jungle"], "slots": ["bank_left", "bank_right", "bank_centre", "waterline", "in_water"], "features": ["river", "bank", "far bank trees"]},
  "sky": {"use": "anything in the air: flight, fall, parachute, storm", "enclosed": False, "options": ["below: pines, jungle, none", "cloud count and colour"], "slots": ["air_near", "air_mid", "air_far"], "features": ["forest below", "clouds"]},
  "airliner_cabin": {"use": "passenger aircraft interior with seated passengers", "enclosed": True, "options": ["length"], "slots": ["aisle_front_left", "aisle_front_right", "aisle_mid"], "features": ["seat rows", "overhead bins", "window row", "ceiling light panels", "aisle carpet", "seated passengers"]},
 },
 "pieces": groups,
 "hand_props": ["briefcase (opens to show a bomb)", "money_bag"],
 "aircraft_ids": ["airliner", "helicopter"], "effect_ids": ["rain", "parachute", "flame", "smoke"],
 "aircraft": ["airliner (parked with gear, flying, with rear airstair)", "helicopter"],
 "effects": ["rain", "lightning", "flame", "smoke", "parachute canopy"],
 "labels": "any short text on a panel, sign, paper, book or stamp",
 "character": {
  "leg_poses": ["stand", "walk", "sit", "kneel", "crouch"],
  "arm_poses": "each arm set by two angles: reach, point, hold up, hand over, raise both",
  "faces": {"eyes": ["open", "wide", "half", "closed", "squint", "angry"], "mouth": ["smile", "grin", "open", "yell", "flat", "frown", "o", "smirk"], "brows": ["neutral", "angry", "worried", "raised"]},
  "outfits": ["jacket", "vest", "shirt", "sweater", "apron", "overalls"], "hats": ["cap", "flat", "beanie", "sunhat", "none"], "extras": ["glasses", "moustache", "beard", "height and build"],
  "cannot_yet": ["lie down", "crawl", "swim or wade", "finger work in close-up (writing, digging, turning a key)", "drive (seated at a wheel is possible, steering is not animated)", "dresses and skirts", "long hair styles beyond bob and bun"],
 },
 "crowd": ["seated passengers (cabin)", "walkers crossing or leaving (up to about 10 full characters)"],
}
json.dump(cat, open(os.path.join(HERE, "catalogue.json"), "w"), indent=1)
print("pieces:", sum(len(v) for v in groups.values()), {k: len(v) for k, v in groups.items()})
