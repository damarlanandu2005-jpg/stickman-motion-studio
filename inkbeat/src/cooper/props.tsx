// Code-built props for the db_cooper film: airliner (with optional rear airstair), pine tree, rain,
// parachute, money bag, bomb briefcase. All pure functions of their props.
import React from "react";
import { boxG, coneG, coreMat, cylG, M, sphG } from "../inkbeat/core/kit";
import type { V3 } from "../inkbeat/types";

const H = Math.PI / 2;
const hash = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

/** airliner, nose toward +x, fuselage centre at the group origin */
export const Plane: React.FC<{ p: V3; yaw?: number; gear?: boolean; stairs?: boolean; lit?: boolean }> = ({ p, yaw = 0, gear = false, stairs = false, lit = true }) => {
  const parts: React.ReactElement[] = [];
  let k = 0;
  parts.push(<M key={k++} g={cylG(1.1, 1.1, 14, 28)} c="#eef0f2" r={[0, 0, H]} />);
  parts.push(<M key={k++} g={sphG(1.1, 24)} c="#eef0f2" p={[7, 0, 0]} s={[1.9, 1, 1]} />);
  parts.push(<M key={k++} g={coneG(1.1, 4.2, 24)} c="#eef0f2" p={[-9.1, 0, 0]} r={[0, 0, H]} />);
  parts.push(<M key={k++} g={boxG(14.2, 0.2, 2.24)} c="#b4343c" p={[0, -0.25, 0]} />);
  parts.push(<M key={k++} g={boxG(2.6, 3.0, 0.16)} c="#b4343c" p={[-8.6, 2.0, 0]} r={[0, 0, 0.42]} />);
  parts.push(<M key={k++} g={boxG(1.5, 0.12, 4.6)} c="#dfe3e8" p={[-9.4, 3.2, 0]} />);
  parts.push(<M key={k++} g={boxG(3.2, 0.16, 15)} c="#dfe3e8" p={[0.4, -0.5, 0]} />);
  for (const s of [-1, 1]) parts.push(<M key={k++} g={cylG(0.42, 0.42, 2.2, 18)} c="#c9ced6" p={[-6.2, 0.5, s * 1.45]} r={[0, 0, H]} />);
  for (let x = -5; x <= 5.6; x += 0.9) for (const s of [-1, 1])
    parts.push(<mesh key={k++} geometry={boxG(0.34, 0.3, 0.04)} material={coreMat(lit ? "#ffe9b8" : "#2a3140", lit ? 1.25 : 0.6)} position={[x, 0.32, s * 1.085]} />);
  if (gear) for (const [x, z] of [[4.6, 0], [-1.2, 1.6], [-1.2, -1.6]] as [number, number][]) {
    parts.push(<M key={k++} g={boxG(0.14, 1.3, 0.14)} c="#5b6068" p={[x, -1.65, z]} />);
    parts.push(<M key={k++} g={cylG(0.3, 0.3, 0.26, 16)} c="#22242a" p={[x, -2.2, z]} r={[H, 0, 0]} />);
  }
  if (stairs) for (let i = 0; i < 8; i++) parts.push(<M key={k++} g={boxG(0.44, 0.08, 0.95)} c="#c9ced6" p={[-5.2 - i * 0.42, -1.15 - i * 0.3, 0]} />);
  if (stairs) for (const s of [-1, 1]) parts.push(<M key={k++} g={boxG(3.9, 0.06, 0.05)} c="#8d939c" p={[-6.7, -1.35, s * 0.5]} r={[0, 0, 0.62]} />);
  return <group position={p} rotation={[0, yaw, 0]}>{parts}</group>;
};

export const Pine: React.FC<{ p: V3; s?: number; dark?: boolean }> = ({ p, s = 1, dark = false }) => (
  <group position={p} scale={s}>
    <M g={cylG(0.16, 0.24, 1.5, 10)} c="#5a4030" p={[0, 0.75, 0]} tex="wood" />
    {[0, 1, 2].map((i) => <M key={i} g={coneG(1.25 - i * 0.3, 1.7, 12)} c={dark ? ["#1d3a2c", "#24463a", "#2c5444"][i] : ["#2f6b3f", "#3a7d49", "#49905a"][i]} p={[0, 1.9 + i * 0.95, 0]} />)}
  </group>
);

/** a stand of pines scattered over a rectangle (deterministic) */
export const Forest: React.FC<{ n: number; x: [number, number]; z: [number, number]; y?: number; seed?: number; s?: number; dark?: boolean; gap?: number }> = ({ n, x, z, y = 0, seed = 1, s = 1, dark, gap = 0 }) => (
  <group>
    {Array.from({ length: n }, (_, i) => {
      const px = x[0] + hash(i, seed) * (x[1] - x[0]), pz = z[0] + hash(i, seed + 9) * (z[1] - z[0]);
      if (Math.abs(px) < gap && pz > -9) return null; // keep the acting area clear
      return <Pine key={i} p={[px, y, pz]} s={s * (0.8 + hash(i, seed + 3) * 0.7)} dark={dark} />;
    })}
  </group>
);

export const Rain: React.FC<{ t: number; c: V3; n?: number }> = ({ t, c, n = 170 }) => (
  <group>
    {Array.from({ length: n }, (_, i) => {
      const y = 12 - ((hash(i, 2) * 14 + t * (15 + hash(i, 5) * 6)) % 14);
      return <mesh key={i} geometry={boxG(0.015, 0.55, 0.015)} material={coreMat("#bcd0ff", 0.9, 0.55)} position={[c[0] + (hash(i, 1) - 0.5) * 16, c[1] - 6 + y, c[2] + (hash(i, 3) - 0.5) * 12]} rotation={[0, 0, 0.14]} />;
    })}
  </group>
);

/** canopy + lines; origin = the jumper's soles */
export const Parachute: React.FC<{ p: V3 }> = ({ p }) => (
  <group position={p}>
    <M g={sphG(1.7, 24)} c="#f1ead8" p={[0, 4.6, 0]} s={[1, 0.55, 1]} />
    <M g={sphG(1.72, 24)} c="#b4343c" p={[0, 4.6, 0]} s={[0.34, 0.56, 1.0]} />
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => <M key={i} g={cylG(0.012, 0.012, 3.1, 6)} c="#d8d2c2" p={[a * 0.62, 2.95, b * 0.5]} r={[b * -0.2, 0, a * 0.3]} />)}
  </group>
);

export const MoneyBag: React.FC<{ p: V3; s?: number }> = ({ p, s = 1 }) => (
  <group position={p} scale={s}>
    <M g={sphG(0.3, 18)} c="#c9a56a" p={[0, 0.26, 0]} s={[1, 0.9, 0.85]} tex="fabric" />
    <M g={cylG(0.07, 0.13, 0.16, 12)} c="#b8935a" p={[0, 0.56, 0]} tex="fabric" />
    <M g={boxG(0.2, 0.2, 0.02)} c="#2f6b3f" p={[0, 0.27, 0.26]} />
  </group>
);

/** open briefcase with dynamite sticks and wires */
export const BombCase: React.FC<{ p: V3 }> = ({ p }) => (
  <group position={p}>
    <M g={boxG(0.62, 0.42, 0.1)} c="#2b2224" />
    <M g={boxG(0.62, 0.06, 0.34)} c="#2b2224" p={[0, -0.2, 0.2]} />
    {[-0.2, -0.07, 0.06, 0.19].map((x, i) => <M key={i} g={cylG(0.045, 0.045, 0.3, 12)} c="#c2343a" p={[x, 0, 0.09]} />)}
    <M g={boxG(0.5, 0.02, 0.02)} c="#f0c838" p={[0, 0.17, 0.1]} />
    <M g={boxG(0.5, 0.02, 0.02)} c="#3a7bd0" p={[0, -0.12, 0.1]} r={[0, 0, 0.12]} />
  </group>
);
