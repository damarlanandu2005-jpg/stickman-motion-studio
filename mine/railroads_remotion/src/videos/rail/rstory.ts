// Railroad short: shot list, cameras, lights, DOF. Our own story (original), told in his grammar:
// slow push-ins, cuts between framings, no handheld float.
import { V3 } from "./story";
export const FPS = 30;
export type RCam = { pos: V3; look: V3; fov: number; roll: number };
export type Who = "eng" | "boss" | "cond" | "tourist";
export type Guy = { who: Who; x: number; z: number; y?: number; expr?: string; look?: number; scale?: number; mode?: "stand" | "sit" | "stroll"; yaw?: number };
export type RShot = { id: number; a: number; b: number; light: "day" | "golden"; cam: (u: number) => RCam; cast: Guy[]; dof?: { focus: V3; cInf: number }; train?: number; smoke?: boolean };
const L = (a: V3, b: V3, u: number): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
const push = (p0: V3, p1: V3, look: V3, fov = 40, look1?: V3) => (u: number): RCam => ({ pos: L(p0, p1, u), look: L(look, look1 ?? look, u), fov, roll: 0 });
export const SHOTS: RShot[] = [
  // 1 "railroad": low beside the rail, engineer foreground-left, locomotive far down the track, wall behind
  { id: 1, a: 0, b: 90, light: "day", cam: push([1.9, 1.1, 5.2], [1.7, 1.15, 4.4], [-0.6, 1.45, 10], 56), train: 36,
    cast: [{ who: "eng", x: -0.9, z: 10, expr: "smile_closed" }], dof: { focus: [-0.9, 1.4, 10], cInf: 2.5 } },
  // 2 two-shot on the track: boss and engineer shake hands
  { id: 2, a: 90, b: 180, light: "day", cam: push([0.3, 1.3, 2.6], [0.3, 1.3, 2.0], [0.0, 1.5, 8], 54),
    cast: [{ who: "eng", x: -0.75, z: 8, expr: "smile" }, { who: "boss", x: 0.8, z: 8, expr: "stern" }], dof: { focus: [0, 1.45, 8], cInf: 2.5 } },
  // 3 straight down the track
  { id: 3, a: 180, b: 270, light: "day", cam: push([0, 1.2, -4], [0, 1.25, -1.5], [0, 1.9, 40], 58), cast: [] },
  // 4 engineer close, wall behind
  { id: 4, a: 270, b: 360, light: "day", cam: push([1.4, 1.35, 4.8], [1.25, 1.35, 4.2], [-1.0, 1.5, 9], 50), cast: [{ who: "eng", x: -1.1, z: 9, expr: "shock" }], dof: { focus: [-1.1, 1.45, 9], cInf: 3 } },
];
export const TOTAL = 360;
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
