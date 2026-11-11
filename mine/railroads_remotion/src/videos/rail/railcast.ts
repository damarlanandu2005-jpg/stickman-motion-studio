// Who stands where in each scene (ported from a1 story.js actorsAt/fxAt). OWNER: char agent.
// `pose` = arm poses the drawing must support (hip/hang/point/cross/temple/reach); `expr` uses his 14 expressions.
import { RX, LX, shotAt, STATE, V3 } from "./rstory";
import { person, lidAt, CamInfo, Place, Who as CWho } from "./cast";
import { Outfit } from "./toon";
export type Who = "eng" | "boss" | "rival";
export type Guy = { who: Who; x: number; y?: number; z: number; expr: string; pose?: string; facing?: -1 | 0 | 1; look?: number; purple?: number; scale?: number };
const ss = (a: number, b: number, f: number) => { const t = Math.max(0, Math.min(1, (f - a) / (b - a))); return t * t * (3 - 2 * t); };
export const castAt = (f: number): Guy[] => {
  const id = shotAt(f).id, out: Guy[] = [];
  if (id === "c1") out.push({ who: "eng", x: 6.9, z: 29.4, expr: "determined", pose: "hip", look: 0.3 });
  if (id === "c3") out.push({ who: "boss", x: 0, z: -1, expr: "proud", pose: "point", facing: 1 });
  if (id === "c4") out.push({ who: "eng", x: RX, z: 22, expr: "proud", pose: "hip" });
  if (id === "c5") out.push({ who: "boss", x: 3.3, z: 20.8, expr: f < 430 ? "shock" : "angry", pose: "point", look: 0.4, purple: ss(430, 484, f) });
  if (id === "c6") { out.push({ who: "boss", x: 3.9, z: 19.5, expr: "angry", pose: "point", facing: 1, purple: 1 }); out.push({ who: "eng", x: 5.1, z: 19.5, expr: "neutral", pose: "hang", facing: -1 }); }
  if (id === "c7") out.push({ who: "eng", x: 5.9, z: 19.5, expr: "stubborn", pose: "cross" });
  if (id === "c8") out.push({ who: "rival", x: -3.4, z: 17, expr: "proud", pose: "point", look: 0.3 });
  if (id === "c10") out.push({ who: "boss", x: 0, z: -4.4, expr: "sad_sweat", pose: "temple" });
  if (id === "c11") out.push({ who: "eng", x: RX + 0.4, z: 23.5, expr: "neutral", pose: "point" });
  if (id === "c13") out.push({ who: "eng", x: 6.8, z: 29.5, expr: "neutral", pose: "reach", look: 0.4 });
  if (id === "c14") out.push({ who: "boss", x: 3.3, z: 29.8, expr: "grin", pose: "reach", look: 0.4 });
  if (id === "c15") { out.push({ who: "boss", x: 3.2, z: 24, expr: "laugh", pose: "hip", facing: 1 }); out.push({ who: "eng", x: 5.9, z: 24, expr: "neutral", pose: "cross", facing: -1 }); }
  return out;
};
const S = "#f6efe4";
export const OUTFITS: Record<Who, Outfit> = {
  eng: { jacket: "#2a9a8a", pants: "#3b3f52", boots: "#2b211c", hat: "cap", cap: "#3a4f7a", stripe: "#f4f1ea", skin: "#fbf5ea", belt: null, buttons: "#e8c45a", shirt: "#f4f1ea", tie: "#c8323c" },
  boss: { jacket: "#d2a82a", pants: "#4a3a2a", boots: "#2b211c", hat: "bowler", skin: "#fbf5ea", moustache: "#3a2a20", buttons: "#fff2b0", shirt: "#f4f1ea", chain: "#f0c93a" },
  rival: { jacket: "#2c6a4a", pants: "#2a3350", boots: "#1d1a1a", hat: "tophat", skin: "#8c5a35", beard: "#141014", moustache: "#141014", buttons: "#e8c45a" },
};
const IDX: Record<Who, number> = { eng: 1, boss: 2, rival: 3 };
/** Draw one cast member as a card Place (pose, expression, purple face, blinks). railworld.ts update() calls this in place of person(...):
 *  `const p = drawGuy(g, info, f);` then `st.places.push(p); blob(st, g.x, g.y ?? 0, g.z, g.scale ?? 1);` */
export const drawGuy = (g: Guy, cam: CamInfo, f = 0): Place => {
  const who: CWho = { i: IDX[g.who], o: OUTFITS[g.who], okey: g.who };
  const fo = { expr: (g.expr as never) ?? "neutral", mode: "stand" as const, look: g.look ?? 0, blink: lidAt(f / 30, IDX[g.who] * 7), facing: g.facing ?? 0, pose: g.pose, purple: g.purple ?? 0 };
  return person(cam, who, g.x, g.y ?? 0, g.z, { side: false, mirror: false }, fo, {} as never, g.scale ?? 1);
};
export const trainsAt = (f: number) => { const id = shotAt(f).id, s = STATE(f, id); return { R: s.trainR, L: s.trainL }; };
export type { V3 };
