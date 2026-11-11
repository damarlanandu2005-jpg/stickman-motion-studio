// Railroad story ("two companies race to build a railroad across a canyon"), 1701 frames @ 30 fps, 19 scenes.
// Ported from the a1 engine story (mine/railroads_a1/web/story.js): same scene list, camera flights and story state.
// OWNER: cam agent (this file). Contracts: SHOTS/camAt/dofAt/STATE/TRANS/layersAt are read by railworld.ts, railcast.ts, Rail.tsx.
export const FPS = 30;
export const TOTAL = 1701;
export type V3 = [number, number, number];
export type RCam = { pos: V3; look: V3; fov: number; roll: number };
export type Light = "day" | "golden" | "indoor";
export type Place = "OUTDOOR" | "OFFICE";
export type Key = { f: number; pos: V3; look: V3; fov: number; path?: V3[] };
export type RShot = { id: string; n: number; a: number; b: number; place: Place; light: Light; k: Key[] };
export const RX = 4.5, LX = -4.5, G = 0.72, JZ = 32; // right (his) track x, left (perfect) track x, half gauge, joint the close-ups look at
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smoother = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lv = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const fl = (a: number, b: number, p0: V3, l0: V3, f0: number, p1: V3, l1: V3, f1: number, via?: V3[]): Key[] =>
  [{ f: a, pos: p0, look: l0, fov: f0 }, { f: b, pos: p1, look: l1, fov: f1, path: via }];
const SC: [string, number, number, Place, Light][] = [
  ["c1", 0, 89, "OUTDOOR", "day"], ["c2", 90, 218, "OUTDOOR", "day"], ["c3", 219, 297, "OFFICE", "indoor"], ["c4", 298, 352, "OUTDOOR", "day"],
  ["c5", 353, 484, "OUTDOOR", "day"], ["c6", 485, 524, "OUTDOOR", "day"], ["c7", 525, 576, "OUTDOOR", "day"], ["c8", 577, 691, "OUTDOOR", "day"],
  ["c9", 692, 823, "OUTDOOR", "day"], ["c10", 824, 955, "OFFICE", "indoor"], ["c11", 956, 1023, "OUTDOOR", "golden"], ["c12", 1024, 1076, "OUTDOOR", "golden"],
  ["c13", 1077, 1138, "OUTDOOR", "golden"], ["c14", 1139, 1208, "OUTDOOR", "golden"], ["c15", 1209, 1263, "OUTDOOR", "golden"], ["c16", 1264, 1418, "OUTDOOR", "golden"],
  ["c17", 1419, 1473, "OUTDOOR", "golden"], ["c18", 1474, 1548, "OUTDOOR", "golden"], ["c19", 1549, 1700, "OUTDOOR", "golden"],
];
const CAM: Record<string, Key[]> = {
  c1: fl(0, 89, [3.9, 0.3, 36.0], [4.5, 0.7, 30.6], 38, [4.3, 0.32, 34.6], [4.5, 0.72, 30.6], 36),
  c2: fl(90, 218, [-9, 22, 58], [0, 2.0, 34], 50, [-9, 22, -12], [0, 2.0, -34], 50),
  c3: fl(219, 297, [0, 1.5, 5], [0, 1.25, -1], 46, [0.3, 1.45, 3.2], [0, 1.4, -1], 40),
  c4: fl(298, 352, [1.2, 1.5, 27.5], [5.8, 1.2, 18.5], 36, [2.0, 1.4, 26.0], [5.9, 1.2, 18.5], 34),
  c5: fl(353, 484, [4.9, 0.3, 28.5], [3.3, 1.65, 20.8], 36, [4.4, 0.25, 26.8], [3.3, 1.75, 20.8], 34),
  c6: fl(485, 524, [2.0, 1.35, 26.8], [4.5, 1.3, 19.5], 34, [2.7, 1.3, 25.8], [4.5, 1.3, 19.5], 32),
  c7: fl(525, 576, [2.6, 2.4, 26.5], [5.9, 0.9, 19.5], 36, [3.2, 2.2, 25.8], [5.9, 0.9, 19.5], 34),
  c8: fl(577, 691, [-3.9, 0.8, 31], [-3.6, 1.1, 22], 36, [-4.3, 1.0, 24.6], [-3.5, 1.4, 20], 40),
  c9: fl(692, 823, [-3.0, 13, 34], [-1.0, 0.0, -10], 50, [1.5, 12, 33], [2.5, 0.0, -14], 48),
  c10: fl(824, 955, [0.6, 2.05, -0.2], [-0.2, 1.35, -3.2], 38, [0.1, 1.95, -1.1], [-0.2, 1.5, -3.3], 33),
  c11: fl(956, 1023, [8.9, 1.4, 29.6], [4.9, 1.1, 23.4], 36, [8.5, 1.5, 28.7], [4.9, 1.2, 23.4], 34),
  c12: fl(1024, 1076, [6.5, 0.42, 34.3], [5.22, 0.27, 32.0], 34, [6.2, 0.4, 33.7], [5.22, 0.27, 32.0], 31),
  c13: fl(1077, 1138, [3.0, 1.1, 36.0], [5.5, 0.8, 31.6], 34, [3.4, 1.1, 35.2], [5.5, 0.8, 31.6], 32),
  c14: fl(1139, 1208, [5.0, 1.25, 36.6], [4.1, 1.2, 31.2], 32, [4.9, 1.25, 36.2], [4.1, 1.2, 31.2], 31),
  c15: fl(1209, 1263, [4.55, 1.35, 35.5], [4.55, 1.15, 24], 38, [4.55, 1.35, 34.3], [4.55, 1.15, 24], 36),
  c16: fl(1264, 1418, [-3.2, 0.5, 8], [-4.5, 0.3, -10], 34, [-3.6, 0.55, 2], [-4.5, 0.3, -10], 34),
  c17: fl(1419, 1473, [-0.5, 2.7, 19], [-4.2, 1.0, 5], 42, [-1.0, 2.6, 14.5], [-4.3, 1.0, 4], 40),
  c18: fl(1474, 1548, [2.4, 1.0, 38.0], [5.7, 0.8, 31.6], 36, [3.0, 1.0, 37.0], [5.7, 0.8, 31.6], 34),
  c19: fl(1549, 1700, [-12, 10, 30], [-4.5, 0.5, -6], 44, [-34, 24, -6], [-4.5, 0, -28], 46),
};
/** inserts: hard-cut close-ups inside a scene (frames a..b), own two keys with a slow smoother drift; castAt/STATE still follow the scene id */
const INS: Record<string, { a: number; b: number; k: [Key, Key] }[]> = {
  // c5: the finger-wide gap in the right rail at the joint nearest the boss (z 22.4), then back to the boss turning purple
  c5: [{ a: 400, b: 429, k: [{ f: 0, pos: [4.1, 0.5, 24.5], look: [5.0, 0.3, 22.4], fov: 32 }, { f: 0, pos: [4.3, 0.46, 24.1], look: [5.0, 0.3, 22.4], fov: 29 }] }],
  // c14: a sheet of paper slid into the joint, then the boss
  c14: [{ a: 1139, b: 1165, k: [{ f: 0, pos: [4.5, 0.55, 33.9], look: [5.22, 0.32, 32.0], fov: 32 }, { f: 0, pos: [4.7, 0.5, 33.5], look: [5.22, 0.32, 32.0], fov: 28 }] }],
  // c16: engineer on HIS trestle (right), then the rival's bridge mid-span with the strain
  c16: [
    { a: 1311, b: 1360, k: [{ f: 0, pos: [7.0, 1.4, -1.0], look: [4.6, 1.1, -8.5], fov: 40 }, { f: 0, pos: [6.7, 1.4, -2.0], look: [4.6, 1.1, -8.5], fov: 37 }] },
    { a: 1361, b: 1418, k: [{ f: 0, pos: [-0.5, 3.0, 10], look: [-4.5, 0.4, -28], fov: 36 }, { f: 0, pos: [-1.5, 2.5, 2], look: [-4.5, 0.4, -28], fov: 34 }] },
  ],
};
export const SHOTS: RShot[] = SC.map(([id, a, b, place, light], i) => ({ id, n: i + 1, a, b, place, light, k: CAM[id] }));
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f <= s.b) ?? SHOTS[SHOTS.length - 1];
export const shotById = (id: string) => SHOTS.find((s) => s.id === id)!;
// ---- his camera grammar: smootherstep glide (18-40 f) then a creeping push-in, never a static hold; flip kicks on impacts; 4-5 degree rolls on emphasis only ----
/** shots that are the move itself (aerials, tracking shots): the glide takes (almost) the whole shot */
const LONG: Record<string, number> = { c2: 0.95, c8: 0.95, c9: 0.95, c16: 0.95, c17: 0.95, c19: 0.95 };
/** creep push-in per frame as a fraction of the lens-to-target distance (0.15-0.35 %/f), 0.6 %/f on punch words */
const CREEP = 0.0022;
const PUNCH: Record<string, [number, number][]> = { c5: [[430, 448]], c7: [[540, 556]], c14: [[1160, 1172]], c15: [[1220, 1232]] };
/** impact frames: the flip kick starts here and decays over 7 frames */
const KICKS: Record<string, number[]> = { c5: [353], c19: [1650, 1688] };
/** rolls (degrees) on emphasis: [start frame, glide frames, end degrees]; a roll holds until the shot ends */
const ROLLS: Record<string, [number, number, number][]> = { c5: [[430, 18, 4.5]], c7: [[535, 22, -4]], c10: [[880, 24, 4]], c19: [[1650, 14, -4.8]] };
const glideP = (S: RShot, f: number) => {
  if (S.id === "c2") return clamp01((f - S.a) / (S.b - S.a)); // tracking the train at its own speed
  const len = S.b - S.a, u = clamp01((f - S.a) / len), G = LONG[S.id] ?? Math.min(1, 40 / len);
  if (G >= 0.9) return smoother(u / G);
  const share = 0.82;
  return u <= G ? share * smoother(u / G) : share + (1 - share) * ((u - G) / (1 - G));
};
const CAP: Record<string, number> = { c14: 0.06, c15: 0.05, c12: 0.12, c10: 0.1 };
const creepAt = (S: RShot, f: number) => {
  if (S.id === "c2") return 0;
  if (LONG[S.id]) return 0.0009 * (f - S.a);
  let c = CREEP * (f - S.a);
  for (const [p0, p1] of PUNCH[S.id] ?? []) c += 0.0038 * Math.max(0, Math.min(f, p1) - p0);
  return Math.min(CAP[S.id] ?? 0.26, c);
};
export const camAt = (f: number, id?: string): RCam => {
  const S = id ? shotById(id) : shotAt(f);
  for (const I of INS[S.id] ?? []) if (f >= I.a && f <= I.b) {
    const t = smoother((f - I.a) / (I.b - I.a)), [a, b] = I.k;
    return { pos: lv(a.pos, b.pos, t), look: lv(a.look, b.look, t), fov: lerp(a.fov, b.fov, t), roll: 0 };
  }
  const [k0, k1] = S.k;
  const t = glideP(S, f);
  let pos = lv(k0.pos, k1.pos, t);
  if (k1.path) { const v = k1.path[0], a = lv(k0.pos, v, t), b = lv(v, k1.pos, t); pos = lv(a, b, t); }
  const look = lv(k0.look, k1.look, t);
  const c = creepAt(S, f);
  pos = lv(pos, look, c);
  let roll = 0;
  for (const [r0, n, deg] of ROLLS[S.id] ?? []) roll += (deg * Math.PI / 180) * smoother((f - r0) / n);
  let py = 0, lyk = 0;
  for (const k of KICKS[S.id] ?? []) {
    const d = f - k;
    if (d >= 0 && d < 7) { const a = (1 - d / 7) ** 1.5 * (d % 2 ? -1 : 1), dist = Math.hypot(pos[0] - look[0], pos[1] - look[1], pos[2] - look[2]); py += a * 0.014 * dist; lyk += a * 0.006 * dist; roll += a * 0.02; }
  }
  return { pos: [pos[0], pos[1] + py, pos[2]], look: [look[0], look[1] + lyk, look[2]], fov: lerp(k0.fov, k1.fov, t), roll };
};
/** depth of field (cInf px at 1080, SKILL.md): hook / CU 14-16, close-ups 12-14, MS 10-12, park 7, golden sway 5, wides and aerials 0; focus on the eyes */
const DOF: Record<string, number | [number, number]> = {
  c1: 15, c2: 0, c3: 11, c4: 10, c5: [12, 14], c6: 11, c7: 12, c8: 10, c9: 0, c10: [12, 14], c11: [7, 0], c12: 9, c13: 14, c14: 14, c15: 10, c16: 5, c17: 0, c18: 13, c19: 0,
};
export const dofAt = (f: number): { cInf: number } => {
  const S = shotAt(f), d = DOF[S.id] ?? 0;
  if (typeof d === "number") return { cInf: d };
  return { cInf: lerp(d[0], d[1], smoother((f - S.a) / (S.b - S.a))) };
};
/** scene changes: n = blend frames centred on the boundary b. kinds: dissolve / fly / cut */
export const TRANS: { b: number; kind: "dissolve" | "fly" | "cut"; n?: number; from?: string; to?: string }[] = [
  { b: 90, kind: "cut" }, { b: 219, kind: "cut" }, { b: 298, kind: "fly", n: 10, from: "c3", to: "c4" },
  { b: 353, kind: "cut" }, { b: 485, kind: "cut" }, { b: 525, kind: "cut" }, { b: 577, kind: "cut" },
  { b: 692, kind: "cut" }, { b: 824, kind: "cut" }, { b: 956, kind: "fly", n: 10, from: "c10", to: "c11" },
  { b: 1024, kind: "cut" }, { b: 1077, kind: "cut" }, { b: 1139, kind: "cut" }, { b: 1209, kind: "cut" },
  { b: 1264, kind: "cut" }, { b: 1419, kind: "cut" }, { b: 1474, kind: "cut" },
  { b: 1549, kind: "fly", n: 10, from: "c18", to: "c19" },
];
/** layers to draw at frame f: base shot plus the incoming shot fading in over a dissolve */
export const layersAt = (f: number): { id: string; alpha: number }[] => {
  for (const t of TRANS) if (t.kind !== "cut" && t.n && f >= t.b - t.n / 2 && f < t.b + t.n / 2) return [{ id: t.from!, alpha: 1 }, { id: t.to!, alpha: (f - (t.b - t.n / 2) + 1) / (t.n + 1) }];
  return [{ id: shotAt(f).id, alpha: 1 }];
};
const ss = (a: number, b: number, f: number) => { const t = clamp01((f - a) / (b - a)); return t * t * (3 - 2 * t); };
export type State = { gapR: number; heatR: number; heatL: number; buckle: number; trainL: number | null; trainR: number | null; saw: number | null; coin: boolean; paper: boolean };
/** story state read by the world every frame: rail gap, heat, buckle, train positions, props */
export const STATE = (f: number, id: string): State => {
  const o: State = { gapR: 0.2, heatR: 0, heatL: 0, buckle: 0, trainL: null, trainR: null, saw: null, coin: false, paper: false };
  if (id === "c1") { o.gapR = 0.2 * ss(28, 84, f); o.saw = f < 86 ? f / 30 : null; }
  if (id === "c12") o.gapR = lerp(0.2, 0.1, ss(1024, 1076, f));
  if (id === "c13") { o.gapR = lerp(0.1, 0.07, ss(1077, 1138, f)); o.coin = true; }
  if (id === "c14") { o.gapR = lerp(0.07, 0.02, ss(1139, 1170, f)); o.paper = true; }
  if (id === "c15") o.gapR = 0.02;
  if (id === "c16" || id === "c17") o.gapR = lerp(0.02, 0.012, ss(1264, 1473, f));
  if (id === "c18") o.gapR = lerp(0.012, 0, ss(1474, 1530, f));
  if (id === "c19") o.gapR = 0;
  o.heatR = f < 1024 ? 0 : f < 1264 ? lerp(0, 0.12, ss(1024, 1264, f)) : lerp(0.12, 0.38, ss(1264, 1548, f));
  o.heatL = f < 1264 ? 0 : f < 1419 ? lerp(0.18, 0.72, ss(1264, 1418, f)) : lerp(0.72, 1, ss(1419, 1700, f));
  o.buckle = f < 1300 ? 0 : f < 1549 ? 0.1 * ss(1300, 1548, f) : lerp(0.1, 1, Math.pow(ss(1549, 1660, f), 1.5));
  if (id === "c2") o.trainR = 30 - (f - 90) * 0.55;
  if (id === "c9") { o.trainL = 22 - (f - 692) * 0.5; if (f >= 752) o.trainR = 32 - (f - 752) * 0.5; }
  if (id === "c19") o.trainL = 36 - (f - 1549) * 0.42;
  return o;
};
