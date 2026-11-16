// Set kits: a handful of flexible stages that, dressed with library pieces, cover most places a script asks for.
// room (any interior), ground (any open place, with a choice of surface and backdrop), woods (pine or jungle),
// water_edge (river or lake bank), sky (in the air). The airliner cabin stays in cooper/Cabin.tsx for now.
// Each kit lists the slots where people can stand, so staging never has to invent coordinates.
import React from "react";
import { boxG, coreMat, M, sphG } from "../inkbeat/core/kit";
import type { TexKind } from "../inkbeat/mat/materials";
import type { V3 } from "../inkbeat/types";
import { Piece } from "./pieces";

const hash = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
export type Slots = Record<string, { p: V3; yaw: number }>;

// ---------------- room: floor, back wall, two side walls, ceiling; open toward the camera (+z) ----------------
export type RoomOpts = { w?: number; d?: number; h?: number; wall?: string; floor?: string; floorTex?: TexKind; windows?: number; windowsLit?: boolean; ceilingLight?: boolean };
export const roomSlots = ({ w = 7, d = 6 }: RoomOpts = {}): Slots => ({
  front_left: { p: [-w * 0.16, 0, -d * 0.32], yaw: 0.6 }, front_right: { p: [w * 0.16, 0, -d * 0.32], yaw: -0.6 }, centre: { p: [0, 0, -d * 0.45], yaw: 0 },
  back_left: { p: [-w * 0.28, 0, -d * 0.7], yaw: 0.4 }, back_right: { p: [w * 0.28, 0, -d * 0.7], yaw: -0.4 }, at_wall: { p: [0, 0, -d * 0.82], yaw: 0 },
});
export const Room: React.FC<RoomOpts> = ({ w = 7, d = 6, h = 3.2, wall = "#cfc3ae", floor = "#7b6a58", floorTex = "planks", windows = 0, windowsLit = false, ceilingLight = true }) => (
  <group>
    <M g={boxG(w, 0.1, d + 3)} c={floor} tex={floorTex} ts={3} p={[0, -0.05, -d / 2 + 1.5]} />
    <M g={boxG(w, h, 0.2)} c={wall} p={[0, h / 2, -d]} />
    {[-1, 1].map((s) => <M key={s} g={boxG(0.2, h, d + 3)} c={wall} p={[s * w / 2, h / 2, -d / 2 + 1.5]} />)}
    <M g={boxG(w, 0.2, d + 3)} c="#e3dccb" p={[0, h + 0.1, -d / 2 + 1.5]} />
    <M g={boxG(w, 0.16, 0.06)} c="#8a7a66" p={[0, 0.08, -d + 0.13]} />
    {Array.from({ length: windows }, (_, i) => <Piece key={i} kind="window" p={[(i - (windows - 1) / 2) * (w / (windows + 0.5)), 0, -d + 0.12]} lit={windowsLit} />)}
    {ceilingLight ? <mesh geometry={boxG(1.2, 0.05, 0.5)} material={coreMat("#fff1cf", 1.5)} position={[0, h - 0.03, -d * 0.45]} /> : null}
  </group>
);

// ---------------- ground: an open place with a surface and an optional backdrop ring ----------------
export type GroundOpts = { surface?: "grass" | "sand" | "stone" | "tarmac" | "mud" | "lawn"; backdrop?: "none" | "pines" | "jungle" | "hills" | "houses"; seed?: number; clear?: number };
const SURF: Record<string, [string, TexKind]> = { grass: ["#4d7a48", "grass"], lawn: ["#5a9a52", "grass"], sand: ["#c9b27c", "sand"], stone: ["#8a8a90", "stone"], tarmac: ["#474c59", "none"], mud: ["#6a5a44", "sand"] };
export const groundSlots = (): Slots => ({
  front_left: { p: [-0.9, 0, -2.8], yaw: 0.5 }, front_right: { p: [0.9, 0, -2.8], yaw: -0.5 }, centre: { p: [0, 0, -3.6], yaw: 0 },
  mid_left: { p: [-1.8, 0, -5], yaw: 0.4 }, mid_right: { p: [1.8, 0, -5], yaw: -0.4 }, far: { p: [0, 0, -8], yaw: 0 },
});
export const Ground: React.FC<GroundOpts> = ({ surface = "grass", backdrop = "none", seed = 1, clear = 3 }) => {
  const [c, tex] = SURF[surface];
  const ring: React.ReactElement[] = [];
  if (backdrop === "pines" || backdrop === "jungle") {
    const kind = backdrop === "pines" ? "pine" : "jungle_tree";
    for (let i = 0; i < 46; i++) {
      const x = (hash(i, seed) - 0.5) * 44, z = -6 - hash(i, seed + 5) * 30;
      if (Math.abs(x) < clear && z > -12) continue;
      ring.push(<Piece key={i} kind={kind} p={[x, 0, z]} s={(backdrop === "pines" ? 1.3 : 1) * (0.8 + hash(i, seed + 2) * 0.6)} />);
    }
    if (backdrop === "jungle") for (let i = 0; i < 26; i++) { const x = (hash(i, seed + 20) - 0.5) * 22, z = -3 - hash(i, seed + 21) * 12; if (Math.abs(x) > clear * 0.5) ring.push(<Piece key={"f" + i} kind={i % 3 ? "fern" : "bush"} p={[x, 0, z]} s={0.9 + hash(i, 4) * 0.8} />); }
  } else if (backdrop === "hills") {
    for (let i = 0; i < 7; i++) ring.push(<M key={i} g={sphG(1, 18)} c={["#6f8fb0", "#7f9dbb", "#5f7fa3"][i % 3]} p={[(i - 3) * 16 + hash(i, seed) * 6, -2, -75 - hash(i, 3) * 20]} s={[22, 10 + hash(i, seed + 1) * 10, 8]} cast={false} />);
    for (let i = 0; i < 16; i++) { const x = (hash(i, seed + 7) - 0.5) * 50, z = -14 - hash(i, seed + 8) * 26; if (Math.abs(x) > clear) ring.push(<Piece key={"t" + i} kind={i % 2 ? "oak" : "pine"} p={[x, 0, z]} s={1 + hash(i, 9) * 0.5} />); }
  } else if (backdrop === "houses") {
    for (let i = 0; i < 5; i++) ring.push(<Piece key={i} kind="house" p={[(i - 2) * 9, 0, -16 - (i % 2) * 3]} c={["#f2ead8", "#d9c9a0", "#c9d6cf"][i % 3]} c2={["#7a3a30", "#3f5a6a", "#5a4030"][i % 3]} />);
    for (let i = 0; i < 8; i++) ring.push(<Piece key={"t" + i} kind="oak" p={[(hash(i, seed) - 0.5) * 44, 0, -22 - hash(i, 2) * 8]} />);
  }
  return <group><M g={boxG(260, 0.2, 260)} c={c} tex={tex} ts={8} p={[0, -0.1, -40]} />{ring}</group>;
};

// ---------------- water edge: bank in front, water across the middle, far bank ----------------
export type WaterOpts = { bank?: "sand" | "mud" | "grass"; far?: "pines" | "jungle"; seed?: number };
export const waterSlots = (): Slots => ({ bank_left: { p: [-0.9, 0, -2.6], yaw: 0.5 }, bank_right: { p: [0.9, 0, -2.6], yaw: -0.5 }, bank_centre: { p: [0, 0, -3.2], yaw: 0 }, waterline: { p: [0.4, 0, -5.2], yaw: 0.2 }, in_water: { p: [0, -0.25, -7.5], yaw: 0 } });
export const WaterEdge: React.FC<WaterOpts> = ({ bank = "sand", far = "pines", seed = 3 }) => {
  const [c, tex] = SURF[bank];
  return (
    <group>
      <M g={boxG(260, 0.3, 36)} c={c} tex={tex} ts={6} p={[0, -0.15, 12.2]} />
      <M g={boxG(260, 0.06, 12)} c="#3f86c9" e="#2a6aa8" ei={0.5} p={[0, -0.12, -11.8]} cast={false} />
      <M g={boxG(260, 0.3, 60)} c={far === "jungle" ? "#3a6a3a" : "#4d7a48"} tex="grass" ts={8} p={[0, -0.15, -47.8]} />
      {Array.from({ length: 34 }, (_, i) => <Piece key={i} kind={far === "jungle" ? "jungle_tree" : "pine"} p={[(hash(i, seed) - 0.5) * 60, 0, -19 - hash(i, seed + 4) * 18]} s={(far === "jungle" ? 1 : 1.4) * (0.8 + hash(i, 6) * 0.6)} />)}
    </group>
  );
};

// ---------------- sky: nothing underfoot; forest far below so falls and flights read ----------------
export type SkyOpts = { below?: "pines" | "jungle" | "none"; clouds?: number; seed?: number; cloudColor?: string };
export const skySlots = (): Slots => ({ air_near: { p: [0, 3, -4], yaw: 0.3 }, air_mid: { p: [0, 5, -10], yaw: 0 }, air_far: { p: [0, 11, -30], yaw: 0 } });
export const SkyStage: React.FC<SkyOpts> = ({ below = "pines", clouds = 5, seed = 4, cloudColor }) => (
  <group>
    {below !== "none" ? <M g={boxG(260, 0.2, 260)} c={below === "jungle" ? "#2c5a36" : "#1c2a24"} tex="grass" ts={8} p={[0, below === "jungle" ? -24.1 : -14.1, -40]} /> : null}
    {below !== "none" ? Array.from({ length: 70 }, (_, i) => <Piece key={i} kind={below === "jungle" ? "jungle_tree" : "pine"} p={[(hash(i, seed) - 0.5) * 80, below === "jungle" ? -24 : -14, -6 - hash(i, seed + 9) * 54]} s={(below === "jungle" ? 1.5 : 2.2) * (0.8 + hash(i, 3) * 0.7)} c={below === "pines" ? "#24463a" : undefined} />) : null}
    {Array.from({ length: clouds }, (_, i) => <Piece key={"c" + i} kind="cloud" p={[(hash(i, seed + 1) - 0.5) * 40, 6 + hash(i, seed + 2) * 12, -22 - hash(i, seed + 3) * 20]} s={1.5 + hash(i, 5) * 1.5} c={cloudColor} />)}
  </group>
);
