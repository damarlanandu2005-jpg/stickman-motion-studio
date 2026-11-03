"""Bake real rigid-body physics for a scene with Blender (bpy), so the engine can replay it in the reference look.

    python bake_physics.py scenes/<scene>.json            # writes scenes/<scene>.physics.json

Objects with a "physics" block in the scene are simulated by Blender's Bullet rigid-body solver on a ground plane:
  "physics": {"type": "dynamic" | "passive", "mass_kg": 50, "shape": "convex" | "box" | "mesh",
              "friction": 0.6, "bounce": 0.2, "drop_m": 6, "tilt_deg": [10, 0, 25]}
"dynamic" objects fall, bounce and collide; "passive" ones stay put but are hit (e.g. a rocket, a wall).
Each object is scaled to its library height and placed exactly like the engine places it (bottom-centre on the
ground at "at", turned by "turn_deg"); "drop_m" lifts it, "tilt_deg" rotates it before the fall.
Output: per frame, the position + quaternion of every simulated object's bottom-centre point in engine coordinates
(y up). Blender is z up; the glTF importer maps engine (x, y, z) to Blender (x, -z, y), and the conversion back is exact.
"""
from __future__ import annotations

import json
import math
import sys
import time
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

# engine (y up)  <->  Blender (z up)
TO_ENGINE = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
TO_BLENDER = TO_ENGINE.inverted()


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_asset(path: Path, name: str):
    """Import a GLB and join its meshes into one object with all transforms applied."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"{path} has no mesh")
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    for o in new:
        if o != obj and o.name in bpy.data.objects:
            bpy.data.objects.remove(o, do_unlink=True)
    obj.name = name
    return obj


def bounds(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def place(obj, height_m: float, at, turn_deg: float, drop_m: float, tilt_deg):
    """Same placement as engine.ts: scale to height, bottom-centre at the origin; then turn, tilt, lift, move."""
    lo, hi = bounds(obj)
    s = height_m / (hi.z - lo.z)  # Blender z = engine y = height
    obj.scale = (s, s, s)
    bpy.ops.object.select_all(action="DESELECT"); obj.select_set(True); bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    lo, hi = bounds(obj)
    bottom_centre = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    # centre of mass at the bounds centre; remember where the engine's bottom-centre root sits relative to it
    centre = (lo + hi) / 2
    obj.data.transform(Matrix.Translation(-centre))
    obj.location = (0, 0, 0)
    root_offset = bottom_centre - centre  # in object-local coordinates (no rotation yet)
    # engine turn_deg rotates about engine y = Blender z; tilt is given in engine axes (x, y, z) degrees
    tx, ty, tz = (math.radians(a) for a in (tilt_deg or (0, 0, 0)))
    tilt_engine = Euler((tx, ty, tz), "XYZ").to_matrix().to_4x4()
    tilt_blender = TO_BLENDER @ tilt_engine @ TO_ENGINE
    turn = Matrix.Rotation(math.radians(turn_deg or 0), 4, "Z")
    rot = turn @ tilt_blender
    # place so that the root (bottom-centre) would be at engine [x, drop, z] if untilted
    root_world = Vector((at[0], -at[1], drop_m))
    obj.matrix_world = Matrix.Translation(root_world - (rot.to_3x3() @ root_offset)) @ rot
    return root_offset


def add_ground(size=200.0):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    g = bpy.context.view_layer.objects.active
    g.name = "ground"
    bpy.ops.rigidbody.object_add(type="PASSIVE")
    g.rigid_body.friction = 0.8
    g.rigid_body.restitution = 0.1
    g.rigid_body.collision_shape = "BOX"
    return g


def engine_pose(obj, root_offset):
    m = obj.matrix_world @ Matrix.Translation(root_offset)  # world transform of the engine root point
    e = TO_ENGINE @ m @ TO_BLENDER
    loc, rot, _ = e.decompose()
    return [round(loc.x, 5), round(loc.y, 5), round(loc.z, 5), round(rot.x, 6), round(rot.y, 6), round(rot.z, 6), round(rot.w, 6)]


def main(scene_path: str) -> int:
    started = time.monotonic()
    scene_file = Path(scene_path).resolve()
    root = scene_file.parent.parent
    s = json.loads(scene_file.read_text(encoding="utf-8"))
    sim = [o for o in s["objects"] if o.get("physics")]
    if not sim:
        print("scene has no physics objects; nothing to bake")
        return 0
    bake = s.get("physics_bake", {})
    fps, frames = s["fps"], round(s["duration_s"] * s["fps"])
    from_f = round(bake.get("from_s", 0) * fps)

    clear_scene()
    sc = bpy.context.scene
    sc.render.fps = fps
    sc.frame_start, sc.frame_end = 1, frames + 1
    bpy.ops.rigidbody.world_add()
    world = sc.rigidbody_world
    world.substeps_per_frame = int(bake.get("substeps", 10))
    world.solver_iterations = int(bake.get("iterations", 20))
    world.point_cache.frame_start = 1 + from_f
    world.point_cache.frame_end = frames + 1
    add_ground()

    offsets = {}
    for o in sim:
        a, ph = s["assets"][o["asset"]], o["physics"]
        obj = import_asset(root / a["file"], o["id"])
        offsets[o["id"]] = (obj, place(obj, a["height_m"], o["at"], o.get("turn_deg", 0), ph.get("drop_m", 0.0), ph.get("tilt_deg")))
        bpy.ops.object.select_all(action="DESELECT"); obj.select_set(True); bpy.context.view_layer.objects.active = obj
        bpy.ops.rigidbody.object_add(type="PASSIVE" if ph.get("type") == "passive" else "ACTIVE")
        rb = obj.rigid_body
        rb.collision_shape = {"convex": "CONVEX_HULL", "box": "BOX", "mesh": "MESH"}[ph.get("shape", "convex")]
        rb.mass = float(ph.get("mass_kg", 10.0))
        rb.friction = float(ph.get("friction", 0.6))
        rb.restitution = float(ph.get("bounce", 0.2))
        rb.use_margin = True
        rb.collision_margin = 0.01
        rb.linear_damping = float(ph.get("linear_damping", 0.04))
        rb.angular_damping = float(ph.get("angular_damping", 0.1))

    tracks = {o["id"]: [] for o in sim}
    for f in range(1, frames + 2):  # step frame by frame so Bullet simulates in order
        sc.frame_set(f)
        if f == 1:
            continue
        for oid, (obj, off) in offsets.items():
            tracks[oid].append(engine_pose(obj, off))
    # frame 0 = the placed start pose (before any simulation step)
    sc.frame_set(1)
    for oid, (obj, off) in offsets.items():
        tracks[oid].insert(0, engine_pose(obj, off))
        tracks[oid] = tracks[oid][:frames]

    out = scene_file.with_suffix(".physics.json")
    rest = {}
    for oid, tr in tracks.items():
        a, b = tr[-2], tr[-1]
        rest[oid] = round(math.dist(a[:3], b[:3]) * fps, 4)  # speed at the end (m/s), ~0 when settled
    out.write_text(json.dumps({"scene": s["id"], "fps": fps, "frames": frames, "blender": bpy.app.version_string,
                               "objects": tracks, "final_speed_m_s": rest,
                               "bake_seconds": round(time.monotonic() - started, 2)}), encoding="utf-8")
    print(f"baked {len(tracks)} objects x {frames} frames with Blender {bpy.app.version_string} in "
          f"{time.monotonic() - started:.1f} s -> {out}  final speeds m/s: {rest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1]))
