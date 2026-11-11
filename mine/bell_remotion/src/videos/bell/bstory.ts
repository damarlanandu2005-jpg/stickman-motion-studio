// Bell's first phone call (1876), 1326 frames @ 30 fps, 9 scenes / 11 shots, hard cuts only, locked to the placeholder Kokoro voice.
// OWNER: cam agent (this file). Contracts: SHOTS / camAt / dofAt / STATE / TRANS / layersAt are read by bellworld.ts, bellcast.ts, Bell.tsx.
// Shot starts are 3 frames before the first word of their sentence (timing.json from engine/tools/voice_timed.py).
// RE-TIME every number in SC and in the STATE frames when the real voiceover arrives.
export const FPS = 30;
export const TOTAL = 1326;
export type V3 = [number, number, number];
export type RCam = { pos: V3; look: V3; fov: number; roll: number };
export type Light = "day" | "indoor";
export type Place = "WORKSHOP" | "TOWN";
export type Key = { f: number; pos: V3; look: V3; fov: number };
export type RShot = { id: string; n: number; a: number; b: number; place: Place; light: Light; k: [Key, Key] };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smoother = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lv = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const fl = (a: number, b: number, p0: V3, l0: V3, f0: number, p1: V3, l1: V3, f1: number): [Key, Key] => [{ f: a, pos: p0, look: l0, fov: f0 }, { f: b, pos: p1, look: l1, fov: f1 }];
// id, first frame, last frame, place, light
const SC: [string, number, number, Place, Light][] = [
  ["c1", 0, 194, "WORKSHOP", "indoor"],     // date, Boston, Bell in his workshop
  ["c2", 195, 349, "WORKSHOP", "indoor"],   // patent, nobody has heard it: the machine and its wire
  ["c3", 350, 498, "WORKSHOP", "indoor"],   // Watson waits in the next room (the dark beyond the doorway), receiver at his ear
  ["c4a", 499, 628, "WORKSHOP", "indoor"],  // Bell leans over the machine, knocks over the acid jar (frame 564)
  ["c4b", 629, 685, "WORKSHOP", "indoor"],  // insert: it spills on his clothes
  ["c5", 686, 837, "WORKSHOP", "indoor"],   // he shouts into the device
  ["c6a", 838, 975, "WORKSHOP", "indoor"],  // Watson hears a voice
  ["c6b", 976, 1025, "WORKSHOP", "indoor"], // he runs to the door
  ["c7", 1026, 1146, "WORKSHOP", "indoor"], // first phone call is not a speech, it is a cry for help: the horn
  ["c8", 1147, 1243, "TOWN", "day"],        // thousands of homes had a phone
  ["c9", 1244, 1325, "WORKSHOP", "indoor"], // insert: and it all began with a spill
];
const CAM: Record<string, [Key, Key]> = {
  c1: fl(0, 194, [-0.5, 1.5, 1.4], [-1.0, 1.25, -3.3], 40, [-0.7, 1.45, 1.0], [-1.0, 1.25, -3.3], 36),
  c2: fl(195, 349, [0.3, 1.75, -0.8], [-0.5, 1.35, -3.9], 36, [1.4, 1.5, -1.3], [1.2, 0.8, -4.0], 40),
  c3: fl(350, 498, [0.6, 1.6, -4.1], [5.7, 1.45, -4.1], 36, [1.4, 1.6, -4.1], [5.7, 1.45, -4.1], 30),
  c4a: fl(499, 628, [-0.3, 1.6, 2.0], [-0.85, 1.3, -3.5], 40, [-0.4, 1.58, 1.6], [-0.85, 1.3, -3.5], 38),
  c4b: fl(629, 685, [-0.2, 1.35, -0.6], [-1.0, 1.2, -3.2], 34, [-0.3, 1.3, -0.9], [-1.0, 1.2, -3.2], 31),
  c5: fl(686, 837, [0.2, 1.65, -0.4], [-0.8, 1.5, -3.3], 36, [0.1, 1.65, -0.7], [-0.8, 1.5, -3.3], 32),
  c6a: fl(838, 975, [2.4, 1.6, -4.1], [5.7, 1.55, -4.1], 30, [3.2, 1.6, -4.1], [5.7, 1.55, -4.1], 26),
  c6b: fl(976, 1025, [1.4, 1.6, -4.1], [4.4, 1.4, -4.1], 38, [1.4, 1.6, -4.1], [3.9, 1.4, -4.1], 38),
  c7: fl(1026, 1146, [-0.1, 1.85, -0.9], [-0.55, 1.8, -3.7], 28, [-0.2, 1.85, -1.5], [-0.55, 1.8, -3.7], 28),
  c8: fl(1147, 1243, [-5.5, 9, 14], [1.5, 2.5, -22], 48, [-3.4, 7.6, 9.5], [1.5, 2.5, -26], 48),
  c9: fl(1244, 1325, [0.9, 1.9, -1.9], [0.35, 1.15, -3.72], 32, [0.8, 1.8, -2.3], [0.35, 1.15, -3.72], 28),
};
export const SHOTS: RShot[] = SC.map(([id, a, b, place, light], i) => ({ id, n: i + 1, a, b, place, light, k: CAM[id] }));
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f <= s.b) ?? SHOTS[SHOTS.length - 1];
export const shotById = (id: string) => SHOTS.find((s) => s.id === id)!;
// camera grammar: smootherstep glide, then a creeping push-in, never a static hold
const LONG: Record<string, number> = { c2: 0.95, c8: 0.95, c6b: 0.95 };
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
  return { pos, look, fov: lerp(k0.fov, k1.fov, t), roll: 0 };
};
/** depth of field (cInf px at 1080): close-ups 12-15, mediums 10-12, the town 0; focus on the eyes (castAt) or the look point */
const DOF: Record<string, number> = { c1: 11, c2: 8, c3: 12, c4a: 11, c4b: 14, c5: 14, c6a: 14, c6b: 10, c7: 10, c8: 0, c9: 12 };
export const dofAt = (f: number): { cInf: number } => ({ cInf: DOF[shotAt(f).id] ?? 0 });
/** hard cuts only */
export const TRANS: { b: number; kind: "cut" }[] = SHOTS.slice(1).map((s) => ({ b: s.a, kind: "cut" as const }));
export const layersAt = (f: number): { id: string; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];
const ss = (a: number, b: number, f: number) => { const t = clamp01((f - a) / (b - a)); return t * t * (3 - 2 * t); };
/** the spill, global so it stays true in every later shot: jar tips at 564 ("knocks"), puddle grows, the stain on Bell's sleeve appears at 634 ("spills") */
export const KNOCK = 564, SPILL = 634;
export type State = { jarTip: number; puddle: number; stain: number };
export const STATE = (f: number): State => ({ jarTip: ss(KNOCK, KNOCK + 11, f), puddle: ss(KNOCK + 6, KNOCK + 70, f), stain: ss(SPILL, SPILL + 26, f) });
