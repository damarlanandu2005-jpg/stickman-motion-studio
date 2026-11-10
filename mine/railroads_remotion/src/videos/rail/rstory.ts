// Railroad short: 19 authored shots, timed to the 56.7 s narration.
// Camera grammar follows the bridge production playbook: deliberate glides, motivated cuts,
// close focus on the active subject, and no random handheld motion. The story and staging are original.
import type { V3 } from "./story";
import type { Expr } from "./toon";

export const FPS = 30;
export const TOTAL = 1701;
export const QA_FRAMES = [45,154,258,325,419,505,551,634,758,890,990,1050,1108,1174,1236,1340,1445,1511,1625];
export type RCam = { pos: V3; look: V3; fov: number; roll: number };
export type Who = "eng" | "boss" | "cond" | "tourist";
export type Guy = {
  who: Who; x: number; z: number; y?: number; expr?: Expr;
  look?: number; scale?: number; mode?: "stand" | "sit" | "stroll"; yaw?: number;
};
export type RShot = {
  id: number; a: number; b: number; light: "day" | "golden";
  place: "OUTDOOR" | "OFFICE"; cam: (u: number) => RCam; cast: Guy[];
  dof?: { focus: V3; cInf: number };
};

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (u: number) => { const x = clamp(u); return x * x * (3 - 2 * x); };
const mix3 = (a: V3, b: V3, k: number): V3 => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];
const flight = (p0: V3, p1: V3, l0: V3, l1: V3, f0: number, f1: number, roll = 0) =>
  (u: number): RCam => {
    const k = smooth(u);
    return {
      pos: mix3(p0, p1, k),
      look: mix3(l0, l1, k),
      fov: f0 + (f1 - f0) * k,
      roll: roll * Math.sin(Math.PI * u),
    };
  };
const still = (p: V3, l: V3, fov = 42) => flight(p, [p[0] - 0.08, p[1] + 0.05, p[2] - 0.35], l, l, fov, fov - 1);
const guy = (who: Who, x: number, z: number, expr: Expr = "neutral", scale = 1): Guy => ({ who, x, z, expr, scale, look: 0 });

export const SHOTS: RShot[] = [
  // 01 — Hook: the engineer's saw opens a visible joint in the rail.
  { id: 1, a: 0, b: 90, light: "day", place: "OUTDOOR",
    cam: flight([6.4, 0.75, 34.2], [7.2, 1.6, 35.8], [5.22, 0.45, 32], [5.0, 0.5, 31.6], 36, 34),
    cast: [guy("eng", 6.9, 29.4, "stern", 1.18)], dof: { focus: [6.9, 1.45, 29.4], cInf: 11 } },
  // 02 — Two companies race along the canyon. Both lines and both crews must read in one wide.
  { id: 2, a: 90, b: 219, light: "day", place: "OUTDOOR",
    cam: flight([-4.5, 4.2, 14], [-2.0, 6.5, 9], [3.0, -3.5, -22], [4.2, -6, -30], 52, 54, -0.025),
    cast: [
      guy("eng", -4.5, -18, "stern", 1.05), guy("cond", -4.5, -24, "neutral"),
      guy("tourist", -4.5, -29, "neutral"), guy("eng", 4.5, -18, "stern", 1.05),
      guy("boss", 4.5, -24, "grin"), guy("cond", 4.5, -29, "neutral"),
    ] },
  // 03 — Office: the contract makes the race worth winning.
  { id: 3, a: 219, b: 298, light: "day", place: "OFFICE",
    cam: flight([0, 1.5, 5], [0.3, 1.45, 3.2], [0, 1.25, -1], [0, 1.4, -1], 46, 40),
    cast: [guy("boss", 0, -1, "grin", 1.22)], dof: { focus: [0, 1.4, -1], cInf: 7 } },
  // 04 — The young engineer checks his work.
  { id: 4, a: 298, b: 353, light: "day", place: "OUTDOOR",
    cam: flight([3.0, 1.3, 26], [6.2, 1.45, 25.2], [4.5, 1.35, 22], [4.5, 1.4, 22], 38, 36),
    cast: [guy("eng", 4.5, 22, "grin", 1.12)], dof: { focus: [4.5, 1.4, 22], cInf: 6 } },
  // 05 — Boss sees the finger-wide expansion gap.
  { id: 5, a: 353, b: 485, light: "day", place: "OUTDOOR",
    cam: flight([4.9, 0.55, 26], [4.3, 0.7, 25.2], [3.4, 1.25, 20.8], [3.4, 1.3, 20.8], 36, 36),
    cast: [guy("boss", 3.3, 20.8, "shock", 1.28)], dof: { focus: [3.3, 1.5, 20.8], cInf: 9 } },
  // 06 — The argument: two-shot, characters face each other, not a lineup.
  { id: 6, a: 485, b: 525, light: "day", place: "OUTDOOR",
    cam: flight([4.5, 0.6, 27], [4.5, 0.7, 26.2], [4.5, 1.2, 19.5], [4.5, 1.25, 19.5], 36, 36),
    cast: [guy("boss", 3.9, 19.5, "stern", 1.22), guy("eng", 5.1, 19.5, "neutral", 1.18)],
    dof: { focus: [4.5, 1.45, 19.5], cInf: 6 } },
  // 07 — The engineer refuses to remove the joints.
  { id: 7, a: 525, b: 577, light: "day", place: "OUTDOOR",
    cam: flight([4.7, 0.55, 25.2], [5.1, 0.7, 24.5], [5.9, 1.2, 19.5], [5.9, 1.25, 19.5], 36, 36),
    cast: [guy("eng", 5.9, 19.5, "stern", 1.2)], dof: { focus: [5.9, 1.45, 19.5], cInf: 6 } },
  // 08 — The rival company believes its continuous rail is superior.
  { id: 8, a: 577, b: 692, light: "day", place: "OUTDOOR",
    cam: flight([-3.8, 0.5, 34], [-4.4, 0.9, 6], [-4.5, 0.35, 24], [-4.5, 0.3, -10], 40, 42),
    cast: [guy("cond", -2.7, 20, "grin", 1.18)], dof: { focus: [-2.7, 1.4, 20], cInf: 5 } },
  // 09 — The race: both trains approach on separate tracks.
  { id: 9, a: 692, b: 824, light: "day", place: "OUTDOOR",
    cam: flight([0.5, 7.5, 31], [3.5, 10.5, 25], [-4.5, 1, 70], [-2.5, 0, 55], 48, 50),
    cast: [guy("tourist", -5.7, 8, "neutral", 0.9), guy("tourist", 5.7, 8, "neutral", 0.9)] },
  // 10 — The boss studies the numbers as the temperature rises.
  { id: 10, a: 824, b: 956, light: "day", place: "OFFICE",
    cam: flight([0.7, 1.45, 1.8], [0.1, 1.5, 0.6], [-0.1, 1.3, -3.6], [-0.1, 1.3, -3.6], 40, 36),
    cast: [guy("boss", 0, -3.6, "pained", 1.2)], dof: { focus: [0, 1.4, -3.6], cInf: 7 } },
  // 11 — Time jump: the engineer returns under a low golden sun.
  { id: 11, a: 956, b: 1024, light: "golden", place: "OUTDOOR",
    cam: flight([5.4, 1.2, 30], [8.5, 5.5, 38], [4.7, 1.5, 23], [4.5, 1.0, 10], 44, 50),
    cast: [guy("eng", 4.9, 23.5, "neutral", 1.1)], dof: { focus: [4.9, 1.4, 23.5], cInf: 5 } },
  // 12 — Close-up: the gap is now smaller as the rail warms.
  { id: 12, a: 1024, b: 1077, light: "golden", place: "OUTDOOR",
    cam: flight([6.6, 0.7, 34.2], [6.0, 0.62, 33.0], [5.22, 0.42, 32], [5.22, 0.42, 32], 36, 30),
    cast: [], dof: { focus: [5.22, 1.0, 32], cInf: 12 } },
  // 13 — The engineer points out the joint.
  { id: 13, a: 1077, b: 1139, light: "golden", place: "OUTDOOR",
    cam: flight([3.9, 0.9, 33.6], [4.2, 0.75, 33.0], [5.22, 0.55, 32], [5.22, 0.55, 32], 30, 28),
    cast: [guy("eng", 6.8, 29.5, "neutral", 1.12)], dof: { focus: [6.8, 1.4, 29.5], cInf: 12 } },
  // 14 — The boss measures the remaining gap with his finger.
  { id: 14, a: 1139, b: 1209, light: "golden", place: "OUTDOOR",
    cam: flight([6.8, 0.95, 33.8], [6.4, 0.8, 33.2], [5.22, 0.55, 32], [5.22, 0.55, 32], 30, 28),
    cast: [guy("boss", 3.3, 29.8, "grin", 1.2)], dof: { focus: [3.3, 1.4, 29.8], cInf: 12 } },
  // 15 — A final exchange before the heat test.
  { id: 15, a: 1209, b: 1264, light: "golden", place: "OUTDOOR",
    cam: flight([3.4, 1.5, 30], [6.4, 1.6, 29], [4.6, 1.35, 24], [4.6, 1.35, 24], 42, 38),
    cast: [guy("boss", 3.2, 24, "laugh", 1.12), guy("eng", 5.9, 24, "neutral", 1.12)],
    dof: { focus: [4.6, 1.4, 24], cInf: 6 } },
  // 16 — The sun heats the rival's continuous rail; the metal begins to move.
  { id: 16, a: 1264, b: 1419, light: "golden", place: "OUTDOOR",
    cam: flight([-3.5, 0.55, 12], [-3.9, 0.75, -4], [-4.6, 0.35, -6], [-4.6, 0.35, -22], 40, 36),
    cast: [], dof: { focus: [-4.6, 0.8, -12], cInf: 5 } },
  // 17 — The rail buckles: a low tracking shot shows the deformation.
  { id: 17, a: 1419, b: 1474, light: "golden", place: "OUTDOOR",
    cam: flight([-1.0, 3.5, 26], [-6.5, 2.0, 14], [-4.0, 0.5, -20], [-4.5, 0.3, -26], 50, 48, 0.035),
    cast: [], dof: { focus: [-4.5, 1.0, -20], cInf: 6 } },
  // 18 — Insert: the safe expansion joint closes without buckling.
  { id: 18, a: 1474, b: 1549, light: "golden", place: "OUTDOOR",
    cam: flight([6.4, 0.6, 34.0], [5.9, 0.5, 32.9], [5.22, 0.42, 32], [5.22, 0.42, 32], 30, 24),
    cast: [], dof: { focus: [5.22, 0.95, 32], cInf: 12 } },
  // 19 — Payoff: the continuous rail kinks; the train jolts and dust fills the canyon.
  { id: 19, a: 1549, b: TOTAL, light: "golden", place: "OUTDOOR",
    cam: flight([-9, 11, 16], [-8, 9, -8], [-4.5, 0, -6], [-4.5, 0, -27], 48, 42),
    cast: [guy("tourist", -5.7, -12, "shock", 0.9)] },
];

export const shotAt = (f: number): RShot =>
  SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

const ramp = (a: number, b: number, f: number) => smooth((f - a) / (b - a));
export type RailwayState = {
  gapL: number; gapR: number; heatL: number; heatR: number; buckle: number;
  trainL: number | null; trainR: number | null;
};
export const stateAt = (f: number): RailwayState => {
  const id = shotAt(f).id;
  const s = {
    gapL: 0, gapR: 0.2, heatL: 0, heatR: 0, buckle: 0,
    trainL: null as number | null, trainR: null as number | null,
  };
  if (id === 1) s.gapR = 0.2 * ramp(28, 84, f);
  if (id === 12) s.gapR = 0.2 + (0.1 - 0.2) * ramp(1024, 1076, f);
  if (id === 13) { s.gapR = 0.1 + (0.07 - 0.1) * ramp(1077, 1138, f); }
  if (id === 14) s.gapR = 0.07 + (0.02 - 0.07) * ramp(1139, 1170, f);
  if (id >= 15 && id <= 17) s.gapR = 0.02;
  if (id === 18) s.gapR = 0.012 * (1 - ramp(1474, 1530, f));
  if (id === 19) s.gapR = 0;

  if (id === 16 || id === 17) s.gapL = 0.02;
  if (id === 18 || id === 19) s.gapL = 0;

  s.heatR = f < 1024 ? 0 : f < 1264 ? 0.12 * ramp(1024, 1264, f) : 0.12 + 0.26 * ramp(1264, 1548, f);
  s.heatL = f < 1264 ? 0 : f < 1419 ? 0.18 + 0.54 * ramp(1264, 1418, f) : 0.72 + 0.28 * ramp(1419, 1700, f);
  s.buckle = f < 1300 ? 0 : f < 1549 ? 0.1 * ramp(1300, 1548, f) : ramp(1549, 1660, f);

  if (id === 2) s.trainR = 30 - (f - 90) * 0.55;
  if (id === 9) {
    if (f >= 692) s.trainL = 40 - (f - 692) * 0.66;
    if (f >= 770) s.trainR = 52 - (f - 770) * 0.52;
  }
  if (id === 19) s.trainL = 36 - (f - 1549) * 0.42;
  return s;
};
