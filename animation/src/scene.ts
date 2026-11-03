// Scene file format: one JSON file describes a whole shot, so a new topic is a new JSON file, not new code.
// Units: metres and seconds. Ground is y = 0; positions on the ground are [x, z].
export type XZ = [number, number];
export type XYZ = [number, number, number];

export type Move =
  | { type: "move"; from_s: number; to_s: number; to: XZ; face_travel?: boolean; dust?: boolean }
  | { type: "walk"; from_s: number; to_s: number; to: XZ; steps_per_s?: number }
  | { type: "hop"; from_s: number; to_s: number; to: XZ; height_m?: number; keep_facing?: boolean }
  | { type: "fly"; from_s: number; to_s: number; to: XYZ }
  | { type: "float"; from_s: number; to_s: number; amp_m?: number; period_s?: number }
  | { type: "spin"; from_s: number; to_s: number; deg_per_s: number }
  | { type: "shake"; from_s: number; to_s: number; amp_m?: number };

export type Scatter = { type: "rocks"; count: number; radius: number; min_size: number; max_size: number; color: string; seed: number; keep_clear?: XYZ[] };

export type Scene = {
  id: string;
  description?: string;
  fps: number;
  duration_s: number;
  environment: { light: "day" | "golden"; sky_top: string; sky_horizon: string; ground: string; fog_near: number; fog_far: number; scatter?: Scatter[] };
  assets: Record<string, { file: string; height_m: number; brightness?: number; forward_deg?: number }>;
  objects: { id: string; asset: string; at: XZ; turn_deg?: number; moves?: Move[] }[];
  characters: { id: string; cards: string; height_m: number; at: XZ;
    poses: { at_s: number; pose: string; face?: "left" | "right" }[]; moves?: Move[] }[];
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
    for (const m of o.moves ?? []) { inTime(m.from_s, `object ${o.id} ${m.type}`); inTime(m.to_s, `object ${o.id} ${m.type}`); if (m.to_s <= m.from_s) p.push(`object ${o.id} ${m.type}: to_s must be after from_s`); }
  }
  for (const c of s.characters) {
    if (ids.has(c.id)) p.push(`duplicate id ${c.id}`); ids.add(c.id);
    if (!c.cards.includes("{pose}")) p.push(`character ${c.id}: cards must contain {pose}`);
    if (!c.poses.length || c.poses[0].at_s !== 0) p.push(`character ${c.id}: first pose must be at 0s`);
    for (const k of c.poses) inTime(k.at_s, `character ${c.id} pose`);
    for (const m of c.moves ?? []) { inTime(m.from_s, `character ${c.id} ${m.type}`); inTime(m.to_s, `character ${c.id} ${m.type}`); }
  }
  for (const e of s.effects ?? []) { if (!ids.has(e.on)) p.push(`effect ${e.type}: unknown target ${e.on}`); inTime(e.at_s, `effect ${e.type}`); }
  const cam = s.camera;
  if (!cam.length || cam[0].at_s !== 0) p.push("camera: first key must be at 0s");
  for (let i = 1; i < cam.length; i++) if (cam[i].at_s <= cam[i - 1].at_s) p.push(`camera: key ${i} is not after key ${i - 1}`);
  if (cam.length && cam[cam.length - 1].at_s < s.duration_s) p.push("camera: last key must be at or after the end");
  for (const k of cam) if (!Array.isArray(k.look) && !ids.has(k.look.follow)) p.push(`camera: unknown follow target ${k.look.follow}`);
  for (const k of s.kicks ?? []) inTime(k.at_s, "kick");
  return p;
}
