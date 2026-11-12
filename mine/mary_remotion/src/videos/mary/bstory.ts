// The Mary Celeste, 1892 frames @ 30 fps, 7 scenes / 19 shots, hard cuts only, locked to the placeholder Kokoro voice.
// OWNER: cam agent (this file). Contracts: SHOTS / camAt / dofAt / STATE / TRANS / layersAt are read by bellworld.ts, bellcast.ts, Bell.tsx.
// Shot starts are 3 frames before the first word of their sentence (timing.json from engine/tools/voice_timed.py).
// RE-TIME every number in SC and the c7 drift frame (DRIFT0) when the real voiceover arrives.
export const FPS = 30;
export const TOTAL = 1892;
export type V3 = [number, number, number];
export type RCam = { pos: V3; look: V3; fov: number; roll: number };
export type Light = "day" | "indoor" | "grey" | "golden";
export type Place = "SEA" | "HARBOR" | "CABIN" | "TABLE";
export type Key = { f: number; pos: V3; look: V3; fov: number };
export type RShot = { id: string; n: number; a: number; b: number; place: Place; light: Light; k: [Key, Key] };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smoother = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lv = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const fl = (a: number, b: number, p0: V3, l0: V3, f0: number, p1: V3, l1: V3, f1: number): [Key, Key] => [{ f: a, pos: p0, look: l0, fov: f0 }, { f: b, pos: p1, look: l1, fov: f1 }];
// id, first frame, last frame, place, light (cuts 3 frames before the first word of their line)
const SC: [string, number, number, Place, Light][] = [
  ["c1a", 0, 111, "SEA", "grey"],
  ["c1b", 112, 161, "SEA", "grey"],
  ["c1c", 162, 280, "SEA", "grey"],
  ["c2a", 281, 489, "HARBOR", "day"],
  ["c2b", 490, 540, "HARBOR", "day"],
  ["c2c", 541, 697, "HARBOR", "day"],
  ["c3a", 698, 761, "SEA", "grey"],
  ["c3b", 762, 814, "SEA", "grey"],
  ["c3c", 815, 887, "SEA", "grey"],
  ["c4a", 888, 954, "SEA", "grey"],
  ["c4b", 955, 1005, "SEA", "grey"],
  ["c4c", 1006, 1135, "SEA", "grey"],
  ["c5a", 1136, 1210, "CABIN", "indoor"],
  ["c5b", 1211, 1287, "CABIN", "indoor"],
  ["c6a", 1288, 1340, "SEA", "grey"],
  ["c6b", 1341, 1477, "SEA", "grey"],
  ["c7a", 1478, 1624, "TABLE", "indoor"],
  ["c7b", 1625, 1734, "SEA", "golden"],
  ["c7c", 1735, 1891, "SEA", "golden"],
];
const CAM: Record<string, [Key, Key]> = {
  c1a: fl(0, 0, [-4, 3.2, 76], [0, 6.5, 0], 36, [-3, 3.2, 66], [0, 6.5, 0], 34),
  c1b: fl(280, 0, [3, 3.0, 9], [9.8, 2.5, 0], 40, [5, 2.9, 7.5], [9.8, 2.5, 0], 38),
  c1c: fl(0, 0, [1.4, 2.6, 6.5], [3.4, 2.2, 1.8], 34, [1.4, 2.6, 6.5], [-3, 2.6, 0.5], 40),
  c2a: fl(0, 0, [-12, 6, 52], [0, 5, -12], 40, [-8, 5.5, 46], [2, 5, -12], 40),
  c2b: fl(0, 0, [0, 2.4, -26], [0, 2.3, -6], 40, [0.3, 2.4, -24.5], [0, 2.3, -6], 38),
  c2c: fl(0, 0, [0, 3.2, 9.5], [0, 2.2, 1.2], 32, [0.2, 3.1, 8.4], [0, 2.2, 1.2], 30),
  c3a: fl(0, 0, [-12, 5, 70], [-20, 5, -20], 54, [-10, 5, 62], [-22, 5, -20], 52),
  c3b: fl(0, 0, [-44, 2.8, -24], [-56, 2.6, -40], 34, [-45, 2.8, -26], [-56, 2.6, -40], 32),
  c3c: fl(0, 0, [3, 2.2, 13], [-2, 1.6, 6], 36, [2, 2.1, 12], [-2, 1.6, 6], 34),
  c4a: fl(0, 0, [0, 2.8, 10], [0, 2.4, 1.5], 32, [0.2, 2.8, 8.6], [0, 2.4, 1.5], 30),
  c4b: fl(0, 0, [-8.8, 2.4, 6], [-11.5, 2.5, 0.5], 34, [-9.2, 2.4, 5.4], [-11.5, 2.5, 0.5], 32),
  c4c: fl(0, 0, [2.8, 3.4, 4.6], [2.8, 1.7, 0], 36, [2.8, 3.2, 3.6], [2.8, 1.7, 0], 34),
  c5a: fl(0, 0, [0.0, 1.45, 4.6], [-0.1, 0.95, -1.7], 64, [0.1, 1.45, 4.2], [-0.1, 0.95, -1.7], 60),
  c5b: fl(0, 0, [0.9, 1.45, 0.9], [0.6, 0.85, -0.2], 36, [0.85, 1.4, 0.7], [0.6, 0.85, -0.2], 34),
  c6a: fl(0, 0, [0, 3.0, 10], [0, 3.0, 3.1], 34, [0, 3.0, 8.6], [0, 3.0, 3.1], 32),
  c6b: fl(0, 0, [14, 3.5, 72], [0, 7, 0], 36, [11, 3.5, 62], [0, 7, 0], 34),
  c7a: fl(0, 0, [0, 5.8, 0.001], [0, 1, 0], 50, [0.2, 4.9, 0.001], [0.2, 1, 0], 46),
  c7b: fl(0, 0, [-8, 2.2, 92], [0, 5, 0], 30, [-6, 2.2, 82], [0, 5, 0], 28),
  c7c: fl(0, 0, [-6, 2.2, 82], [0, 5, -6], 28, [-5, 2.2, 74], [0, 5, -16], 26),
};
export const SHOTS: RShot[] = SC.map(([id, a, b, place, light], i) => ({ id, n: i + 1, a, b, place, light, k: [{ ...CAM[id][0], f: a }, { ...CAM[id][1], f: b }] as [Key, Key] }));
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f <= s.b) ?? SHOTS[SHOTS.length - 1];
export const shotById = (id: string) => SHOTS.find((s) => s.id === id)!;
// camera grammar: smootherstep glide, then a creeping push-in, never a static hold
const LONG: Record<string, number> = { c1a: 0.95, c2a: 0.95, c1c: 0.95, c7a: 0.95 };
const CREEP = 0.0016;
const glideP = (S: RShot, f: number) => {
  const len = S.b - S.a, u = clamp01((f - S.a) / len), G = LONG[S.id] ?? Math.min(1, 40 / len);
  if (G >= 0.9) return smoother(u / G);
  const share = 0.82;
  return u <= G ? share * smoother(u / G) : share + (1 - share) * ((u - G) / (1 - G));
};
const creepAt = (S: RShot, f: number) => (LONG[S.id] ? 0 : Math.min(0.12, CREEP * (f - S.a)));
export const camAt = (f: number, id?: string): RCam => {
  const S = id ? shotById(id) : shotAt(f);
  const [k0, k1] = S.k, t = glideP(S, f);
  const look = lv(k0.look, k1.look, t);
  const pos = lv(lv(k0.pos, k1.pos, t), look, creepAt(S, f));
  const o = ORIGIN[S.place];
  return { pos: [pos[0] + o[0], pos[1] + o[1], pos[2] + o[2]], look: [look[0] + o[0], look[1] + o[1], look[2] + o[2]], fov: lerp(k0.fov, k1.fov, t), roll: 0 };
};
/** depth of field (cInf px at 1080): close-ups 12-15, mediums 10-12, the town 0; focus on the eyes (castAt) or the look point */
const DOF: Record<string, number> = { c1a: 6, c1b: 10, c1c: 10, c2a: 6, c2b: 9, c2c: 11, c3a: 5, c3b: 10, c3c: 10, c4a: 10, c4b: 11, c4c: 11, c5a: 8, c5b: 12, c6a: 11, c6b: 6, c7a: 8, c7b: 5, c7c: 5 };
export const dofAt = (f: number): { cInf: number } => ({ cInf: DOF[shotAt(f).id] ?? 0 });
/** hard cuts only */
export const TRANS: { b: number; kind: "cut" }[] = SHOTS.slice(1).map((s) => ({ b: s.a, kind: "cut" as const }));
export const layersAt = (f: number): { id: string; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];
/** where each place sits in the world (local camera and cast coordinates are added to this origin) */
export const ORIGIN: Record<Place, V3> = { SEA: [0, 0, -30], HARBOR: [0, 0, -8], CABIN: [400, 0, 0], TABLE: [-400, 0, 0] };
/** the ship slowly drifts away along -z in the last two shots (sea-local metres) */
export const DRIFT0 = 1625;
export const driftZ = (f: number) => -Math.max(0, Math.min(f - DRIFT0, 270)) * 0.06;
/** ship yaw per shot (only the wide shots with nobody aboard turn the ship to a three-quarter view) */
export const YAW: Record<string, number> = { c1a: 0.5, c6b: -0.5, c7b: 0.35, c7c: 0.35 };
