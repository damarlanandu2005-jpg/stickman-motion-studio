// A 1971 airliner cabin interior, built from the kit: floor, side walls, a chamfered roof, overhead bins,
// a long row of softly glowing windows down each side, seat rows receding down the aisle with a scatter of
// seated passengers, and a far bulkhead that closes the tube. Pure function of its props (deterministic).
// Designed to be shot from the aisle looking toward -z (the far end), lit by an interior mood with sky off.
import React from "react";
import { boxG, coreMat, M, sphG } from "../inkbeat/core/kit";
import type { V3 } from "../inkbeat/types";

const WALL = "#c7ccd4"; // painted panel
const TRIM = "#aeb4bd";
const CARPET = "#3a3550";
const SEAT = "#2f4f6e"; // period blue-grey seats
const SEATTOP = "#3c5f82";

// a deterministic little RNG so the passenger scatter is stable frame-to-frame
const rng = (s: number) => () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

const Window: React.FC<{ p: V3 }> = ({ p }) => (
  // a warm reading-light glow panel set just inside the wall; blooms a touch
  <mesh geometry={boxG(0.07, 0.34, 0.5)} material={coreMat("#ffe6b4", 1.3)} position={p} />
);

const Passenger: React.FC<{ p: V3; skin: string; top: string; hair: string }> = ({ p, skin, top, hair }) => (
  <group position={p}>
    <M g={boxG(0.52, 0.56, 0.42)} c={top} p={[0, 0.28, 0]} tex="fabric" />
    <M g={sphG(0.18, 18)} c={skin} p={[0, 0.74, 0.02]} />
    <M g={sphG(0.19, 16)} c={hair} p={[0, 0.82, -0.03]} s={[1, 0.7, 1]} />
  </group>
);

export const Cabin: React.FC<{ p?: V3; len?: number }> = ({ p = [0, 0, 0], len = 18 }) => {
  const zc = -len / 2 + 1; // center of the tube in z
  const W = 1.72; // half-width (wall x)
  const parts: React.ReactElement[] = [];
  let k = 0;

  // floor (carpet) + far bulkhead
  parts.push(<M key={k++} g={boxG(W * 2, 0.1, len)} c={CARPET} p={[0, -0.05, zc]} tex="fabric" />);
  parts.push(<M key={k++} g={boxG(W * 2, 2.3, 0.2)} c={WALL} p={[0, 1.0, zc - len / 2]} tex="none" />);

  // two side walls
  for (const sx of [-1, 1]) parts.push(<M key={k++} g={boxG(0.12, 2.05, len)} c={WALL} p={[sx * W, 1.0, zc]} tex="none" />);

  // chamfered roof: two slanted shoulder panels + a flat crown
  for (const sx of [-1, 1]) parts.push(<M key={k++} g={boxG(0.9, 0.1, len)} c={TRIM} p={[sx * 1.2, 2.12, zc]} r={[0, 0, sx * 0.62]} tex="none" />);
  parts.push(<M key={k++} g={boxG(1.9, 0.12, len)} c={WALL} p={[0, 2.42, zc]} tex="none" />);

  // ceiling light panels down the crown
  for (let z = zc + len / 2 - 1.2; z > zc - len / 2 + 1; z -= 2.2) parts.push(<mesh key={k++} geometry={boxG(0.5, 0.04, 1.3)} material={coreMat("#fff1cf", 1.5)} position={[0, 2.34, z]} />);

  // overhead bins (a long angled box each side)
  for (const sx of [-1, 1]) parts.push(<M key={k++} g={boxG(0.46, 0.4, len)} c={TRIM} p={[sx * 1.33, 1.72, zc]} r={[0, 0, sx * 0.18]} tex="none" />);

  // windows: a run down each wall
  for (let z = zc + len / 2 - 1.4; z > zc - len / 2 + 1; z -= 1.5) for (const sx of [-1, 1]) parts.push(<Window key={k++} p={[sx * (W - 0.09), 1.18, z]} />);

  // seat rows + a scatter of passengers, both sides of the aisle
  const r = rng(7);
  const skins = ["#f1d6bd", "#e7b48e", "#d49a6a", "#c98a5e"];
  const tops = ["#6a3b3b", "#394a63", "#4a5240", "#6a5a3a", "#45384f"];
  const hairs = ["#2a211c", "#3a2a22", "#141216", "#5a4535"];
  for (let i = 0; i < 7; i++) {
    const z = zc + len / 2 - 2.6 - i * 1.55;
    for (const sx of [-1, 1]) {
      const x = sx * 1.02;
      parts.push(<M key={k++} g={boxG(0.92, 0.46, 0.9)} c={SEAT} p={[x, 0.34, z]} tex="fabric" />);
      parts.push(<M key={k++} g={boxG(0.92, 0.86, 0.16)} c={SEATTOP} p={[x, 0.8, z - 0.38]} tex="fabric" />);
      // occupy most seats past the first row
      if (i >= 1 && r() < 0.8) {
        const s = Math.floor(r() * skins.length), tp = Math.floor(r() * tops.length), h = Math.floor(r() * hairs.length);
        parts.push(<Passenger key={k++} p={[x, 0.5, z + 0.02]} skin={skins[s]} top={tops[tp]} hair={hairs[h]} />);
      }
    }
  }

  return <group position={p}>{parts}</group>;
};
