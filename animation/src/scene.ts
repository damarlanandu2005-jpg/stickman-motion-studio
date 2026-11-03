// Scene file format: one JSON file describes a whole shot, so a new topic is a new JSON file, not new code.
// Units: metres and seconds. Ground is y = 0; positions on the ground are [x, z].
import type { Action } from "./motion";
export type { Action };
export type XZ = [number, number];
export type XYZ = [number, number, number];

export type Move =
  | { type: "move"; from_s: number; to_s: number; to: XZ; face_travel?: boolean; dust?: boolean; /** constant speed instead of easing in and out (a vehicle that must hit something at full speed) */ linear?: boolean }
  | { type: "walk"; from_s: number; to_s: number; to: XZ; steps_per_s?: number }
  | { type: "hop"; from_s: number; to_s: number; to: XZ; height_m?: number; keep_facing?: boolean }
  | { type: "fly"; from_s: number; to_s: number; to: XYZ }
  | { type: "float"; from_s: number; to_s: number; amp_m?: number; period_s?: number }
  | { type: "spin"; from_s: number; to_s: number; deg_per_s: number }
  | { type: "shake"; from_s: number; to_s: number; amp_m?: number }
  /** put the thing at a ground position from this time on (e.g. where a rider steps off a vehicle) */
  | { type: "place"; at_s: number; to: XZ };

export type Scatter = { type: "rocks"; count: number; radius: number; min_size: number; max_size: number; color: string; seed: number; keep_clear?: XYZ[] };

export type Physics = { type: "dynamic" | "passive"; mass_kg?: number; shape?: "convex" | "box" | "mesh"; friction?: number;
  bounce?: number; drop_m?: number; tilt_deg?: XYZ; linear_damping?: number; angular_damping?: number };

export type EmitterKind = "smoke" | "fire" | "sparks" | "explosion" | "dust" | "splash" | "chunks" | "snow";
/** Blender particle effect (bake_effects.py): real gravity, drag, turbulence and wind; every key but id, kind, at is optional */
export type Emitter = { id: string; kind: EmitterKind; at: XYZ; from_s: number; to_s: number; count?: number; life_s?: number; speed?: number;
  dir?: XYZ; spread?: number; gravity?: number; turbulence?: number; wind?: number; drag?: number; size_m?: number; size_end_m?: number;
  bounce?: number; spin?: number; seed?: number; color?: string; area_m?: number;
  /** travel with a scripted object (e.g. the rocket), `at` is then ignored and `offset` is added to its position */
  follow?: string; offset?: XYZ };
/** a flag or curtain: the left edge is pinned, the rest hangs and is pushed by the wind (Blender cloth) */
export type Cloth = { id: string; at: XYZ; size: [number, number]; grid?: [number, number]; wind?: number; mass_kg?: number; stiffness?: number;
  bending?: number; seed?: number; color?: string; color2?: string; pole?: boolean };
export type EffectTracks = { scene: string; fps: number; frames: number; blender: string;
  emitters: Record<string, { kind: EmitterKind; max: number; peak_alive: number; frames: number[][][] }>;
  cloths: Record<string, { nx: number; ny: number; frames: number[][]; final_motion_m: number }> };

export type PhysicsTracks = { scene: string; fps: number; frames: number; blender: string; objects: Record<string, number[][]> };

/** what an object can DO, kept next to its model in the library (library/behaviors/<id>.json). The engine reads it; scenes never hard-code it. */
export type Behavior = {
  id: string; type: "vehicle" | "prop" | "building";
  max_speed_mps?: number; mass_kg?: number;
  /** ground circle used for crashes, around the object centre */
  collide_radius_m?: number;
  /** a part of the model cut out by a box (0..1 of the model's own bounding box) so it can swing about a hinge */
  parts?: { id: string; region: { min: XYZ; max: XYZ; /** only triangles facing this way (e.g. the outside skin of a door) */ facing?: XYZ; facing_min?: number; /** only triangles within this distance of the hinge in x/y (fraction of the model height): cuts a round wheel out of a box */ disc_r?: number }; hinge: XYZ; axis: XYZ;
    /** "hinge" (default): swings open_deg about the hinge. "spin": a wheel that turns as the object moves, radius_m from the model */
    kind?: "hinge" | "spin"; open_deg?: number; open_s?: number; radius_m?: number }[];
  /** a part opens when any character comes this close and the object is (almost) standing still */
  triggers?: { on: "character_near"; part: string; within_m: number; max_speed_mps?: number }[];
  /** at or above this speed, hitting a solid thing is a crash */
  crash?: { min_speed_mps: number; crumple: number; recoil_m?: number; open_parts?: string[]; kick?: number };
};

export type Scene = {
  id: string;
  description?: string;
  fps: number;
  duration_s: number;
  environment: { light: "day" | "golden"; sky_top: string; sky_horizon: string; ground: string; fog_near: number; fog_far: number; scatter?: Scatter[] };
  assets: Record<string, { file: string; height_m: number; brightness?: number; forward_deg?: number; /** behavior file (library/behaviors): parts, triggers, crash rule */ behavior?: string }>;
  /** objects with a physics block are simulated by Blender (bake_physics.py) and replayed from the baked tracks */
  objects: { id: string; asset: string; at: XZ; turn_deg?: number; /** a wall/rock/rocket other things can crash into (ground circle) */ solid_radius_m?: number; moves?: Move[]; physics?: Physics;
    /** hidden until this time (e.g. crystals that start falling at physics_bake.from_s) */ appear_s?: number }[];
  /** scene wind (force vector) pushing particles and cloth */
  wind?: XYZ;
  emitters?: Emitter[];
  cloths?: Cloth[];
  physics_bake?: { from_s?: number; substeps?: number; iterations?: number };
  characters: { id: string; cards?: string; height_m: number; at: XZ;
    /** a 3D stickman: one skeleton, a costume layer, scripted actions (see motion.ts); replaces cards and poses */
    rig?: { costume: string; face?: string }; actions?: Action[]; expressions?: { at_s: number; face: string }[];
    /** a pose name that plays several cards in turn, e.g. walk -> walk_1..walk_4 at hz pictures per second */
    cycles?: Record<string, { frames: string[]; hz: number }>;
    poses?: { at_s: number; pose: string; face?: "left" | "right" }[]; moves?: Move[] }[];
  effects?: { type: "burst" | "stars" | "puff"; at_s: number; dur_s: number; on: string; size_m: number; color?: string; lift_m?: number }[];
  /** look is a fixed point, or { follow: id, offset } to keep a moving object or character in frame */
  camera: { at_s: number; pos: XYZ; look: XYZ | { follow: string; offset?: XYZ }; fov: number; cut?: boolean }[];
  kicks?: { at_s: number; amp: number }[];
};

/** Plain-code checks before anything is rendered. Returns human-readable problems; empty means OK. */
export function validateScene(s: Scene): string[] {
  const p: string[] = [];
  const inTime = (t: number, what: string) => { if (!(t >= 0 && t <= s.duration_s)) p.push(`${what}: time ${t}s is outside 0..${s.duration_s}s`); };
  if (!(s.fps > 0 && s.duration_s > 0)) p.push("fps and duration_s must be positive");
  const ids = new Set<string>();
  for (const o of s.objects) {
    if (ids.has(o.id)) p.push(`duplicate id ${o.id}`); ids.add(o.id);
    if (!s.assets[o.asset]) p.push(`object ${o.id}: unknown asset ${o.asset}`);
    if (o.appear_s !== undefined) inTime(o.appear_s, `object ${o.id} appear_s`);
    if (o.physics && o.moves?.length) p.push(`object ${o.id}: use either physics or moves, not both`);
    for (const m of o.moves ?? []) { if (m.type === "place") { inTime(m.at_s, `object ${o.id} place`); continue; } inTime(m.from_s, `object ${o.id} ${m.type}`); inTime(m.to_s, `object ${o.id} ${m.type}`); if (m.to_s <= m.from_s) p.push(`object ${o.id} ${m.type}: to_s must be after from_s`); }
  }
  for (const c of s.characters) {
    if (ids.has(c.id)) p.push(`duplicate id ${c.id}`); ids.add(c.id);
    if (c.rig) {
      if (!c.actions?.length || c.actions[0].at_s !== 0) p.push(`character ${c.id}: first action must be at 0s`);
      for (let i = 1; i < (c.actions?.length ?? 0); i++) if (c.actions![i].at_s <= c.actions![i - 1].at_s) p.push(`character ${c.id}: action ${i} is not after action ${i - 1}`);
      for (const a of c.actions ?? []) { inTime(a.at_s, `character ${c.id} action ${a.do}`);
        if (a.do === "ride") { if (!a.vehicle || !a.seat || a.to_s === undefined) p.push(`character ${c.id}: ride needs vehicle, seat and to_s`); else if (!s.objects.some((o) => o.id === a.vehicle)) p.push(`character ${c.id}: unknown vehicle ${a.vehicle}`); } }
    } else {
      if (!c.cards?.includes("{pose}")) p.push(`character ${c.id}: cards must contain {pose}`);
      for (const [n, cy] of Object.entries(c.cycles ?? {})) if (!cy.frames.length || !(cy.hz > 0)) p.push(`character ${c.id}: cycle ${n} needs frames and a positive hz`);
      if (!c.poses?.length || c.poses[0].at_s !== 0) p.push(`character ${c.id}: first pose must be at 0s`);
      for (const k of c.poses ?? []) inTime(k.at_s, `character ${c.id} pose`);
    }
    for (const m of c.moves ?? []) { if (m.type === "place") { inTime(m.at_s, `character ${c.id} place`); continue; } inTime(m.from_s, `character ${c.id} ${m.type}`); inTime(m.to_s, `character ${c.id} ${m.type}`); }
  }
  for (const e of s.effects ?? []) { if (!ids.has(e.on)) p.push(`effect ${e.type}: unknown target ${e.on}`); inTime(e.at_s, `effect ${e.type}`); }
  const cam = s.camera;
  if (!cam.length || cam[0].at_s !== 0) p.push("camera: first key must be at 0s");
  for (let i = 1; i < cam.length; i++) if (cam[i].at_s <= cam[i - 1].at_s) p.push(`camera: key ${i} is not after key ${i - 1}`);
  if (cam.length && cam[cam.length - 1].at_s < s.duration_s) p.push("camera: last key must be at or after the end");
  for (const k of cam) if (!Array.isArray(k.look) && !ids.has(k.look.follow)) p.push(`camera: unknown follow target ${k.look.follow}`);
  for (const k of s.kicks ?? []) inTime(k.at_s, "kick");
  const KINDS = ["smoke", "fire", "sparks", "explosion", "dust", "splash", "chunks", "snow"];
  for (const e of s.emitters ?? []) {
    if (ids.has(e.id)) p.push(`duplicate id ${e.id}`); ids.add(e.id);
    if (e.follow && !s.objects.some((o) => o.id === e.follow)) p.push(`emitter ${e.id}: unknown follow target ${e.follow}`);
    if (!KINDS.includes(e.kind)) p.push(`emitter ${e.id}: unknown kind ${e.kind}`);
    if (!(e.to_s >= e.from_s)) p.push(`emitter ${e.id}: to_s must not be before from_s`);
    inTime(e.from_s, `emitter ${e.id}`); inTime(e.to_s, `emitter ${e.id}`);
    if (e.count !== undefined && !(e.count > 0 && e.count <= 400)) p.push(`emitter ${e.id}: count must be 1..400`);
  }
  for (const c of s.cloths ?? []) {
    if (ids.has(c.id)) p.push(`duplicate id ${c.id}`); ids.add(c.id);
    if (!(c.size[0] > 0 && c.size[1] > 0)) p.push(`cloth ${c.id}: size must be positive`);
  }
  return p;
}
