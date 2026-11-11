// Who stands where in each shot. OWNER: char agent. Two characters, ONE outfit each, same side in every shot:
// Bell on the LEFT (x < 0, in front of the bench), Watson on the RIGHT (x > 4, in the dark beyond the doorway).
// `pose` = hip / hang / point / cross / temple / reach; `expr` uses the engine's expressions; `facing` -1 = looks left, 1 = looks right.
import * as THREE from "three";
import { shotAt, STATE, smoother, KNOCK, V3 } from "./bstory";
import { person, lidAt, CamInfo, Place, Who as CWho } from "./cast";
import { Outfit } from "./toon";
import { BELL_X, BELL_Z, WATSON_X, WATSON_Z } from "./bellset";
export type Who = "bell" | "watson";
export type Guy = { who: Who; x: number; y?: number; z: number; expr: string; pose?: string; facing?: -1 | 0 | 1; look?: number; scale?: number; tilt?: number; ht?: number; mode?: "stand" | "march" | "stroll"; phase?: number };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ss = (a: number, b: number, f: number) => { const t = clamp01((f - a) / (b - a)); return t * t * (3 - 2 * t); };
export const castAt = (f: number): Guy[] => {
  const id = shotAt(f).id, out: Guy[] = [];
  if (id === "c1") out.push({ who: "bell", x: BELL_X, z: BELL_Z, expr: "determined", pose: "hip", facing: 1, look: 0.4 });
  if (id === "c3") out.push({ who: "watson", x: WATSON_X, z: WATSON_Z, expr: "neutral", pose: "temple", facing: -1, look: -0.2 });
  if (id === "c4a") {
    const lean = ss(500, 520, f) * (1 - ss(572, 600, f));                       // leans in at "leans over", straightens after the spill
    out.push({ who: "bell", x: BELL_X, z: BELL_Z, expr: f < KNOCK ? "determined" : "shock", pose: "reach", facing: 1, look: 0.5, tilt: 20 * lean });
  }
  if (id === "c4b") out.push({ who: "bell", x: BELL_X, z: BELL_Z, expr: "pained", pose: "hang", facing: 1, look: 0.2, tilt: 4 });
  if (id === "c5") out.push({ who: "bell", x: BELL_X, z: BELL_Z, expr: "shock", pose: "reach", facing: 1, look: 0.5, tilt: 14 });
  if (id === "c6a") out.push({ who: "watson", x: WATSON_X, z: WATSON_Z, expr: "shock", pose: "temple", facing: -1, look: -0.3 });
  if (id === "c6b") {
    const u = smoother((f - 983) / 44), moving = f >= 983;
    out.push({ who: "watson", x: lerp(WATSON_X, 3.3, u), z: WATSON_Z, expr: "relief_open", pose: "reach", facing: -1, look: -0.5, tilt: moving ? -9 : 0, mode: moving ? "march" : "stand", phase: moving ? ((f - 983) / 30 * 2.4) % 1 : 0 });
  }
  return out;
};
export const OUTFITS: Record<Who, Outfit> = {
  // Bell: dark frock coat, full dark beard, white shirt, dark red tie
  bell: { jacket: "#2d3342", pants: "#3a3b46", boots: "#1d1a1a", hat: null, hair: "#2a1c14", beard: "#2a1c14", moustache: "#2a1c14", skin: "#fbf5ea", buttons: "#c8b060", shirt: "#f4f1ea", tie: "#8a2a2a" },
  // Watson: younger, brown jacket, lighter hair, small moustache, blue tie
  watson: { jacket: "#8a6a44", pants: "#4a4036", boots: "#2b211c", hat: null, hair: "#7a4a2a", moustache: "#7a4a2a", skin: "#fbf5ea", buttons: "#e8c45a", shirt: "#f4f1ea", tie: "#2a4a7a" },
};
const IDX: Record<Who, number> = { bell: 1, watson: 2 };
export const drawGuy = (g: Guy, cam: CamInfo, f = 0): Place => {
  const who: CWho = { i: IDX[g.who], o: OUTFITS[g.who], okey: g.who };
  const t = f / 30, ix = IDX[g.who];
  const idleTilt = g.mode === "march" ? 0 : Math.round(1.4 * Math.sin(t * 0.7 + ix * 2.1) * 2) / 2, idleHead = Math.round(3 * Math.sin(t * 0.45 + ix));
  const fo = { tilt: (g.tilt ?? 0) + idleTilt, headTilt: (g.ht ?? 0) + idleHead, expr: (g.expr as never) ?? "neutral", mode: (g.mode ?? "stand") as never, phase: g.phase ?? 0, look: g.look ?? 0, blink: lidAt(f / 30, ix * 7), facing: g.facing ?? 0, pose: g.pose, lift: 60 };
  return person(cam, who, g.x, g.y ?? 0, g.z, { side: false, mirror: false }, fo, {} as never, g.scale ?? 1);
};
/** where Watson's receiver is (at his ear) in the shots he is in; null = not on screen, the prop is hidden */
export const receiverAt = (f: number, right: THREE.Vector3): V3 | null => {
  const g = castAt(f).find((x) => x.who === "watson"); if (!g) return null;
  const sd = g.facing || 1, off = sd * 0.27;
  return [g.x + right.x * off, 1.62 + (g.y ?? 0), g.z + right.z * off];
};
/** wire end on the floor, in the dark beyond the doorway; follows Watson when he moves */
export const wireEndAt = (f: number): V3 => { const g = castAt(f).find((x) => x.who === "watson"); return g ? [g.x - 0.15, 0.03, g.z + 0.05] : [WATSON_X - 0.15, 0.03, WATSON_Z + 0.05]; };

import type { FxPlace } from "./cast";
/** the wet acid stain on Bell's sleeve (a card in front of his card). Visible in every shot after "it spills on his clothes". */
const stain = (p: import("./toon").Pen) => {
  const C = "#b8d020", H = "#f0f580";
  for (const [x, y, rx, ry] of [[150, 150, 72, 52], [104, 128, 34, 28], [196, 176, 38, 30], [150, 208, 26, 34], [192, 108, 22, 18], [96, 180, 20, 16]] as number[][]) p.ell(x, y, rx, ry, C, 0);
  p.ell(132, 138, 18, 10, H, 0);
};
export const fxAt = (f: number, camPos: THREE.Vector3): FxPlace[] => {
  const out: FxPlace[] = [], id = shotAt(f).id, s = STATE(f);
  if (s.stain > 0 && (id === "c4b" || id === "c5")) {
    const g = castAt(f).find((x) => x.who === "bell"); if (!g) return out;
    const dx = camPos.x - g.x, dz = camPos.z - g.z, n = Math.hypot(dx, dz) || 1, rx = dz / n, rz = -dx / n; // camera right in the xz plane
    const sz = 0.5 * (0.35 + 0.65 * s.stain);
    out.push({ key: "stain", cw: 300, ch: 300, draw: stain, x: g.x + rx * 0.3 + (dx / n) * 0.07, y: 1.02, z: g.z + rz * 0.3 + (dz / n) * 0.07, w: sz, h: sz, soft: false });
  }
  return out;
};
