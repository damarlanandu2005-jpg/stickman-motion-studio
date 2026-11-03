"""Bake Blender effects (particles + cloth) for a scene, so the engine can replay them in the reference look.

    python bake_effects.py scenes/<scene>.json            # writes scenes/<scene>.effects.json

Scene file blocks read here (positions are engine coordinates, metres, y up):
  "wind": [x, y, z]                               # scene wind, m/s-ish force; default none
  "emitters": [{"id", "kind", "at": [x,y,z], "from_s", "to_s", "count", "life_s", "speed", "dir": [x,y,z], "spread": 0..1,
                "gravity", "turbulence", "wind", "drag", "size_m", "size_end_m", "bounce", "spin", "seed"}]
      kind = smoke | fire | sparks | explosion | dust | splash | chunks | snow   (each kind has real-force defaults)
  "cloths": [{"id", "at": [x,y,z], "size": [w, h], "grid": [nx, ny], "wind": 0..3, "mass_kg", "stiffness", "seed"}]
      a flag/curtain: the left edge (x = at[0]) is pinned, it hangs down and is pushed by the wind.
Blender does the real physics: particle systems with gravity, drag, turbulence and wind force fields and a ground
collision plane; cloth with a pinned edge, gravity and wind. Everything is stepped frame by frame in order and written
per frame, so the engine only replays numbers (no simulation in the browser).
"""
from __future__ import annotations

import json
import math
import sys
import time
from pathlib import Path

import bpy
import bmesh
from mathutils import Matrix, Vector

# engine (y up) <-> Blender (z up): same mapping as bake_physics.py
TO_ENGINE = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
to_blender = lambda p: Vector((p[0], -p[2], p[1]))
to_engine = lambda v: (v.x, v.z, -v.y)

# Real-force defaults per kind. gravity is a multiplier of Earth gravity (negative = rises, as hot smoke does).
KINDS = {
    "smoke":     dict(count=70, life_s=2.4, speed=0.8, dir=(0, 1, 0), spread=0.25, gravity=-0.12, turbulence=1.0, wind=1.0, drag=0.6, size_m=0.35, size_end_m=1.5, bounce=0.0, spin=0.0),
    "fire":      dict(count=60, life_s=0.9, speed=1.6, dir=(0, 1, 0), spread=0.2,  gravity=-0.45, turbulence=1.6, wind=0.6, drag=0.9, size_m=0.5,  size_end_m=0.1, bounce=0.0, spin=0.0),
    "sparks":    dict(count=50, life_s=1.3, speed=5.0, dir=(0, 1, 0), spread=0.8,  gravity=0.9,   turbulence=0.0, wind=0.2, drag=0.1, size_m=0.12, size_end_m=0.03, bounce=0.35, spin=0.0),
    "explosion": dict(count=70, life_s=1.0, speed=7.0, dir=(0, 1, 0), spread=1.0,  gravity=0.0,   turbulence=1.2, wind=0.3, drag=3.0, size_m=0.7,  size_end_m=1.8, bounce=0.0, spin=0.0),
    "dust":      dict(count=40, life_s=1.5, speed=1.4, dir=(0, 0.4, 0), spread=1.0, gravity=0.05, turbulence=0.8, wind=1.0, drag=1.5, size_m=0.4,  size_end_m=1.1, bounce=0.0, spin=0.0),
    "splash":    dict(count=60, life_s=1.4, speed=4.2, dir=(0, 1, 0), spread=0.45, gravity=1.0,   turbulence=0.0, wind=0.1, drag=0.05, size_m=0.1, size_end_m=0.06, bounce=0.15, spin=0.0),
    "chunks":    dict(count=24, life_s=3.0, speed=3.2, dir=(0, 1, 0), spread=0.8,  gravity=1.0,   turbulence=0.0, wind=0.0, drag=0.02, size_m=0.22, size_end_m=0.2, bounce=0.35, spin=6.0),
    "snow":      dict(count=120, life_s=4.0, speed=0.0, dir=(0, -1, 0), spread=0.0, gravity=0.08, turbulence=1.2, wind=1.0, drag=2.0, size_m=0.07, size_end_m=0.07, bounce=0.0, spin=0.0),
}
EARTH_G = 9.81


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def add_ground(bounce: float):
    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0))
    g = bpy.context.view_layer.objects.active
    g.name = "ground"
    bpy.ops.object.modifier_add(type="COLLISION")
    g.collision.damping = 1.0 - bounce       # Blender: 0 = full bounce, 1 = all energy lost
    g.collision.friction_factor = 0.4
    return g


def add_fields(wind, turbulence_needed: bool):
    """One global wind and one global turbulence field; each emitter / cloth scales them with its own weight."""
    if any(abs(c) > 1e-9 for c in wind):
        mag = math.sqrt(sum(c * c for c in wind))
        bpy.ops.object.effector_add(type="WIND", location=(0, 0, 0))
        w = bpy.context.view_layer.objects.active
        w.field.strength = mag
        d = to_blender(wind).normalized()           # wind pushes along the object's local +z
        w.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        w.field.noise = 0.35
    if turbulence_needed:
        bpy.ops.object.effector_add(type="TURBULENCE", location=(0, 0, 0))
        t = bpy.context.view_layer.objects.active
        t.field.strength = 2.0
        t.field.size = 1.2
        t.field.flow = 0.0


def _ease(x: float) -> float:
    t = max(0.0, min(1.0, x))
    return t * t * (3 - 2 * t)


def follow_position(obj: dict, offset, time_s: float):
    """Where a scripted object is at time t (same rules as engine.ts poseAt for move / fly), plus an offset."""
    x, y, z = obj["at"][0], 0.0, obj["at"][1]
    for m in obj.get("moves") or []:
        if time_s < m["from_s"]:
            continue
        u = max(0.0, min(1.0, (time_s - m["from_s"]) / (m["to_s"] - m["from_s"])))
        if m["type"] in ("move", "walk", "hop"):
            k = u if m["type"] == "walk" else _ease(u)
            x, z = x + (m["to"][0] - x) * k, z + (m["to"][1] - z) * k
        elif m["type"] == "fly":
            k = _ease(u)
            x, y, z = x + (m["to"][0] - x) * k, y + (m["to"][1] - y) * k, z + (m["to"][2] - z) * k
    o = offset or (0, 0, 0)
    return (x + o[0], y + o[1], z + o[2])


def animate_follow(ob, e: dict, s: dict, fps: int, frames: int):
    """Keyframe the emitter so it travels with the object it follows (e.g. a rocket's exhaust)."""
    target = next((o for o in s["objects"] if o["id"] == e["follow"]), None)
    if target is None:
        raise ValueError(f"emitter {e['id']}: unknown follow target {e['follow']!r}")
    for f in range(1, frames + 1):
        ob.location = to_blender(follow_position(target, e.get("offset"), (f - 1) / fps))
        ob.keyframe_insert("location", frame=f)
    for fc in (ob.animation_data.action.fcurves if hasattr(ob.animation_data.action, "fcurves") else []):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"


def make_emitter(e: dict, fps: int, wind_on: bool):
    kind = e["kind"]
    if kind not in KINDS:
        raise ValueError(f"emitter {e['id']}: unknown kind {kind!r} (use {sorted(KINDS)})")
    p = {**KINDS[kind], **{k: v for k, v in e.items() if k in KINDS[kind]}}
    at = e["at"]
    # emitter body: a small icosphere (emission from its vertices gives an even spread in every direction)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.12 if kind != "snow" else 0.2, location=to_blender(at))
    if kind == "snow":   # snow falls from a wide flat sheet
        bpy.context.view_layer.objects.active.scale = (float(e.get("area_m", 12)) / 0.4, float(e.get("area_m", 12)) / 0.4, 0.02)
    ob = bpy.context.view_layer.objects.active
    ob.name = e["id"]
    ob.modifiers.new("fx", "PARTICLE_SYSTEM")
    ps = ob.particle_systems[0]
    st = ps.settings
    f0, f1 = 1 + round(e.get("from_s", 0) * fps), 1 + round(e.get("to_s", e.get("from_s", 0) + 0.2) * fps)
    st.count = int(p["count"])
    st.frame_start, st.frame_end = f0, max(f1, f0 + 1)
    st.lifetime = max(2, round(p["life_s"] * fps))
    st.lifetime_random = 0.3
    st.emit_from = "VERT" if kind != "snow" else "FACE"
    st.use_emit_random = True
    st.physics_type = "NEWTON"
    st.mass = 1.0
    st.normal_factor = float(p["speed"]) * float(p["spread"])             # outward from the emitter surface
    d = to_blender(p["dir"])
    st.object_align_factor = d * (float(p["speed"]) * (1.0 - 0.5 * float(p["spread"])))  # the main direction
    st.factor_random = float(p["speed"]) * 0.25
    st.use_rotations = kind == "chunks"
    st.use_dynamic_rotation = kind == "chunks"
    if kind == "chunks":
        st.angular_velocity_mode = "RAND"
        st.angular_velocity_factor = float(p["spin"])
        st.rotation_mode = "NONE"
    st.particle_size = 1.0       # size is read per particle and scaled over its life in code below
    st.size_random = 0.35
    st.damping = float(p["drag"]) * 0.1
    st.drag_factor = min(1.0, float(p["drag"]) * 0.12)
    st.use_modifier_stack = False
    st.render_type = "NONE"
    ew = st.effector_weights
    ew.gravity = float(p["gravity"])
    ew.turbulence = float(p["turbulence"]) * 0.5
    ew.wind = float(p["wind"]) if wind_on else 0.0
    ew.all = 1.0
    st.count = int(p["count"])
    ps.seed = int(e.get("seed", 1))
    return ob, p


def bake_emitters(s: dict, fps: int, frames: int) -> dict:  # noqa: C901
    out = {}
    emitters = s.get("emitters") or []
    live = []
    for e in emitters:
        ob, p = make_emitter(e, fps, bool(s.get("wind")))
        if e.get("follow"):
            animate_follow(ob, e, s, fps, frames)
        live.append((e, ob, p))
    sc = bpy.context.scene
    frames_data = {e["id"]: [] for e, _, _ in live}
    for f in range(1, frames + 1):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        for e, ob, p in live:
            ps = ob.evaluated_get(dg).particle_systems[0]
            row = []
            for i, q in enumerate(ps.particles):
                if q.alive_state != "ALIVE":
                    continue
                life = max(1.0, q.lifetime)
                u = max(0.0, min(1.0, (f - q.birth_time) / life))
                x, y, z = to_engine(q.location)
                size = (float(p["size_m"]) + (float(p["size_end_m"]) - float(p["size_m"])) * u) * (0.6 + 0.8 * min(1.5, q.size) / 1.0 * 0.5)
                rq = q.rotation
                rot = Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0))) @ rq.to_matrix() @ Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
                qq = rot.to_quaternion()
                row.append([i, round(x, 3), round(y, 3), round(z, 3), round(size, 3), round(u, 3),
                            round(qq.x, 3), round(qq.y, 3), round(qq.z, 3), round(qq.w, 3)])
            frames_data[e["id"]].append(row)
    for e, ob, p in live:
        out[e["id"]] = {"kind": e["kind"], "max": int(p["count"]), "frames": frames_data[e["id"]],
                        "peak_alive": max((len(r) for r in frames_data[e["id"]]), default=0)}
    return out


def make_cloth(c: dict):
    nx, ny = (c.get("grid") or [22, 14])
    w, h = c["size"]
    me = bpy.data.meshes.new(c["id"])
    bm = bmesh.new()
    grid = [[bm.verts.new((i / nx * w, 0.0, -j / ny * h)) for i in range(nx + 1)] for j in range(ny + 1)]  # j row 0 = top
    bm.verts.ensure_lookup_table()
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(c["id"], me)
    bpy.context.scene.collection.objects.link(ob)
    # hold the cloth where it will hang: top-left corner at the requested point; vertex order is j*(nx+1)+i
    at = c["at"]
    ob.location = to_blender([at[0], at[1] + h, at[2]])
    # pinned left edge (i == 0): the flag is attached to a pole along that edge
    vg = ob.vertex_groups.new(name="pin")
    vg.add([j * (nx + 1) for j in range(ny + 1)], 1.0, "REPLACE")
    bpy.context.view_layer.objects.active = ob
    cm = ob.modifiers.new("Cloth", "CLOTH")
    cs = cm.settings
    cs.quality = 8
    cs.mass = float(c.get("mass_kg", 0.25))
    cs.tension_stiffness = float(c.get("stiffness", 12.0))
    cs.compression_stiffness = float(c.get("stiffness", 12.0))
    cs.bending_stiffness = float(c.get("bending", 0.6))
    cs.air_damping = 1.0
    cs.vertex_group_mass = "pin"
    cs.effector_weights.gravity = 1.0
    cs.effector_weights.wind = float(c.get("wind", 1.0))
    cm.collision_settings.use_self_collision = False
    return ob, nx, ny


def bake_cloths(s: dict, fps: int, frames: int) -> dict:
    out = {}
    live = []
    for c in s.get("cloths") or []:
        ob, nx, ny = make_cloth(c)
        live.append((c, ob, nx, ny))
    if not live:
        return out
    sc = bpy.context.scene
    data = {c["id"]: [] for c, *_ in live}
    for f in range(1, frames + 1):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        for c, ob, nx, ny in live:
            ev = ob.evaluated_get(dg)
            me = ev.to_mesh()
            flat = []
            for v in me.vertices:
                x, y, z = to_engine(ob.matrix_world @ v.co)
                flat += [round(x, 3), round(y, 3), round(z, 3)]
            ev.to_mesh_clear()
            data[c["id"]].append(flat)
    for c, ob, nx, ny in live:
        fr = data[c["id"]]
        move = max(abs(a - b) for a, b in zip(fr[-1], fr[len(fr) // 2]))
        out[c["id"]] = {"nx": nx, "ny": ny, "frames": fr, "final_motion_m": round(move, 3)}
    return out


def main(scene_path: str) -> int:
    started = time.monotonic()
    scene_file = Path(scene_path).resolve()
    s = json.loads(scene_file.read_text(encoding="utf-8"))
    if not (s.get("emitters") or s.get("cloths")):
        print("scene has no emitters or cloths; nothing to bake")
        return 0
    fps, frames = s["fps"], round(s["duration_s"] * s["fps"])
    reset()
    sc = bpy.context.scene
    sc.render.fps = fps
    sc.frame_start, sc.frame_end = 1, frames
    wind = s.get("wind") or [0, 0, 0]
    add_ground(max([float(e.get("bounce", KINDS[e["kind"]]["bounce"])) for e in s.get("emitters", [])] or [0.3]))
    add_fields(wind, any(KINDS[e["kind"]]["turbulence"] > 0 or e.get("turbulence") for e in s.get("emitters", [])))
    em = bake_emitters(s, fps, frames)
    cl = bake_cloths(s, fps, frames)
    out = scene_file.with_suffix(".effects.json")
    out.write_text(json.dumps({"scene": s["id"], "fps": fps, "frames": frames, "blender": bpy.app.version_string,
                               "emitters": em, "cloths": cl, "bake_seconds": round(time.monotonic() - started, 2)}, separators=(",", ":")), encoding="utf-8")
    print(f"baked {len(em)} emitters + {len(cl)} cloths x {frames} frames with Blender {bpy.app.version_string} in "
          f"{time.monotonic() - started:.1f} s -> {out} ({out.stat().st_size / 1e6:.2f} MB); peak alive: "
          f"{ {k: v['peak_alive'] for k, v in em.items()} }")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1]))
