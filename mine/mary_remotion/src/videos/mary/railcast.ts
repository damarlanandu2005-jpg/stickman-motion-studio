// Who stands where in each shot. OWNER: char agent. All positions are LOCAL to the place origin (bstory.ts ORIGIN); the ship's
// deck is at y = DECK_Y. Cards always face the camera. Mary Celeste people: captain, wife, small daughter, 7 crew (blue / red / green shirts).
// Dei Gratia people: olive jackets, straw caps. Left/right sides: Dei Gratia always LEFT of the Mary Celeste.
import * as THREE from "three";
import { shotAt, ORIGIN, smoother } from "./bstory";
import { person, lidAt, CamInfo, Place, Who as CWho } from "./cast";
import { Outfit } from "./toon";
import { DECK_Y, QUAY_Y } from "./maryset";
export type Who = string;
export type Guy = { who: Who; x: number; y?: number; z: number; expr: string; pose?: string; facing?: -1 | 0 | 1; look?: number; scale?: number; tilt?: number; ht?: number; mode?: "stand" | "march" | "stroll"; phase?: number };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
void clamp01; void smoother;
export const OUTFITS: Record<string, Outfit> = {
  captain: { jacket: "#26304a", pants: "#2c2f3a", boots: "#1d1a1a", hat: "cap", cap: "#1c2236", hair: "#4a3020", beard: "#4a3020", moustache: "#4a3020", skin: "#fbf5ea", buttons: "#d8b84a", shirt: "#f4f1ea", tie: "#8a2a2a" },
  wife: { jacket: "#7a4a6a", pants: "#7a4a6a", boots: "#2b211c", hat: "bonnet", dress: "#7a4a6a", hair: "#3a2a20", skin: "#fbf5ea", buttons: "#e8dcc8" } as Outfit,
  girl: { jacket: "#d9c3e6", pants: "#d9c3e6", boots: "#2b211c", hat: "hair", hair: "#c89a50", skin: "#fbf5ea", build: "kid" } as Outfit,
  crewA: { jacket: "#3a5a86", pants: "#e4dcc8", boots: "#2b211c", hat: "cap", cap: "#2a2a2a", hair: "#5a3a22", moustache: "#5a3a22", skin: "#fbf5ea" },
  crewB: { jacket: "#9a4a3a", pants: "#d8d0bc", boots: "#2b211c", hat: "cap", cap: "#3a2a22", hair: "#2a1c14", beard: "#2a1c14", skin: "#fbf5ea" },
  crewC: { jacket: "#5f7a58", pants: "#e0d8c2", boots: "#2b211c", hat: "cap", cap: "#1c2236", hair: "#8a6a3a", skin: "#fbf5ea" },
  dg1: { jacket: "#c9b27a", pants: "#4a4036", boots: "#2b211c", hat: "cap", cap: "#7a2a2a", hair: "#4a3020", moustache: "#4a3020", skin: "#fbf5ea" },
  dg2: { jacket: "#e8e4d8", pants: "#2a2a30", boots: "#2b211c", hat: "cap", cap: "#2a2a30", hair: "#7a4a2a", beard: "#7a4a2a", skin: "#fbf5ea" },
  dg3: { jacket: "#4a4a4a", pants: "#8a7a5a", boots: "#2b211c", hat: "cap", cap: "#c9b27a", hair: "#2a1c14", skin: "#fbf5ea" },
};
const IDX: Record<string, number> = { captain: 1, wife: 2, girl: 3, crewA: 4, crewB: 5, crewC: 6, dg1: 7, dg2: 8, dg3: 9 };
const G = (who: string, x: number, z: number, expr: string, o: Partial<Guy> = {}): Guy => ({ who, x, z, expr, ...o });
export const castAt = (f: number): Guy[] => {
  const id = shotAt(f).id, out: Guy[] = [];
  const dk = DECK_Y;
  switch (id) {
    case "c2b": {   // the ten: back row of five, front row of five (captain, wife, small daughter in the middle of the front row)
      const back = ["crewA", "crewB", "crewC", "crewA", "crewB"], front = ["crewC", "captain", "wife", "girl", "crewA"];
      front.forEach((w, i) => out.push(G(w, -2.1 + i * 1.05 + 0.5, -6.3, w === "girl" ? "grin" : w === "wife" ? "smile_closed" : "neutral", { y: QUAY_Y, scale: w === "girl" ? 0.55 : 1, pose: w === "captain" ? "hip" : undefined })));
      back.forEach((w, i) => out.push(G(w, -2.1 + i * 1.05, -8.1, i % 2 ? "grin" : "neutral", { y: QUAY_Y })));
      break;
    }
    case "c2c":
      out.push(G("captain", -1.0, 1.5, "determined", { y: dk, pose: "hip" }), G("wife", 0, 1.5, "smile_closed", { y: dk }), G("girl", 0.7, 2.2, "grin", { y: dk, scale: 0.7 }));
      break;
    case "c3b":
      out.push(G("dg1", -23.4, -30, "stern", { y: DECK_Y * 0.85, pose: "point", facing: 1, scale: 1 }), G("dg2", -21.9, -30.4, "nervous", { y: DECK_Y * 0.85, facing: 1 }));
      break;
    case "c3c":
      out.push(G("dg1", -3.1, 6.2, "neutral", { y: 0.3 }), G("dg2", -2.0, 6.4, "stern", { y: 0.3 }), G("dg3", -0.9, 6.2, "neutral", { y: 0.3 }));
      break;
    case "c4a":
      out.push(G("dg1", -0.7, 1.9, "neutral", { y: dk, facing: -1, look: -0.4 }), G("dg3", 0.75, 2.1, "nervous", { y: dk, facing: 1, look: 0.4 }));
      break;
    case "c4b":
      out.push(G("dg2", -12.0, 0.8, "neutral", { y: dk, pose: "reach", facing: -1, look: -0.3 }));
      break;
  }
  return out;
};
const stateOfPlace = (): THREE.Vector3 => new THREE.Vector3();
void stateOfPlace;
/** world position of a cast member (local + the shot's place origin; Dei Gratia / boat positions are sea-local) */
export const worldOf = (f: number, g: Guy): [number, number, number] => { const o = ORIGIN[shotAt(f).place]; return [g.x + o[0], (g.y ?? 0) + o[1], g.z + o[2]]; };
export const drawGuy = (g: Guy, cam: CamInfo, f = 0) => {
  const key = g.who, ix = IDX[key] ?? 1;
  const who: CWho = { i: ix, o: OUTFITS[key], okey: key };
  const t = f / 30;
  const idleTilt = Math.round(1.4 * Math.sin(t * 0.7 + ix * 2.1) * 2) / 2, idleHead = Math.round(3 * Math.sin(t * 0.45 + ix));
  const fo = { tilt: (g.tilt ?? 0) + idleTilt, headTilt: (g.ht ?? 0) + idleHead, expr: (g.expr as never) ?? "neutral", mode: (g.mode ?? "stand") as never, phase: g.phase ?? 0, look: g.look ?? 0, blink: lidAt(f / 30, ix * 7), facing: g.facing ?? 0, pose: g.pose, lift: 60 };
  const [wx, wy, wz] = worldOf(f, g);
  return person(cam, who, wx, wy, wz, { side: false, mirror: false }, fo, {} as never, g.scale ?? 1);
};
void ((): Place | undefined => undefined);
