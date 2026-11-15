// A suggestive Eiffel tower built from the kit (metal lattice). Parametric: 4 tapering legs, cross-braces, two
// platforms, base arches, a spire. Pure function of its props (deterministic). h = total height in world units.
import React from "react";
import * as THREE from "three";
import { boxG, M } from "../inkbeat/core/kit";
import type { V3 } from "../inkbeat/types";

const IRON = "#6a5560";

// half-width of the square section at height y (0..h)
const halfAt = (y: number, h: number) => (0.21 * h) * Math.exp(-3.0 * y / h) * (1 - 0.6 * y / h) + 0.01 * h;

const Strut: React.FC<{ a: V3; b: V3; r: number }> = ({ a, b, r }) => {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const d = new THREE.Vector3().subVectors(vb, va), len = d.length();
  const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  return <M g={boxG(r, len, r)} c={IRON} tex="metal" p={mid} r={[e.x, e.y, e.z]} />;
};

export const Eiffel: React.FC<{ p?: V3; h?: number }> = ({ p = [0, 0, 0], h = 14 }) => {
  const N = 11, top = h * 0.9;
  const ys = Array.from({ length: N + 1 }, (_, i) => top * Math.pow(i / N, 1.18));
  const cs: [number, number][] = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
  const corner = (i: number, sx: number, sz: number): V3 => [sx * halfAt(ys[i], h), ys[i], sz * halfAt(ys[i], h)];
  const th = (i: number) => Math.max(0.04, h * 0.012 * (1.4 - i / N));
  const struts: React.ReactElement[] = [];
  let k = 0;
  for (let i = 0; i < N; i++) {
    for (const [sx, sz] of cs) struts.push(<Strut key={k++} a={corner(i, sx, sz)} b={corner(i + 1, sx, sz)} r={th(i)} />);
    for (let c = 0; c < 4; c++) {
      const [ax, az] = cs[c], [bx, bz] = cs[(c + 1) % 4];
      struts.push(<Strut key={k++} a={corner(i + 1, ax, az)} b={corner(i + 1, bx, bz)} r={th(i) * 0.7} />);
      struts.push(<Strut key={k++} a={corner(i, ax, az)} b={corner(i + 1, bx, bz)} r={th(i) * 0.5} />);
      struts.push(<Strut key={k++} a={corner(i, bx, bz)} b={corner(i + 1, ax, az)} r={th(i) * 0.5} />);
    }
  }
  // two platforms and a spire
  const plat = (yy: number, s: number) => <M key={k++} g={boxG(halfAt(yy, h) * 2 * s, h * 0.02, halfAt(yy, h) * 2 * s)} c={IRON} tex="metal" p={[0, yy, 0]} />;
  struts.push(plat(h * 0.27, 1.3));
  struts.push(plat(h * 0.55, 0.95));
  struts.push(<Strut key={k++} a={[0, top, 0]} b={[0, h, 0]} r={th(N) * 0.7} />);
  // four base arches
  for (let c = 0; c < 4; c++) {
    const [ax, az] = cs[c], [bx, bz] = cs[(c + 1) % 4], hw = halfAt(0, h);
    let prev: V3 | null = null;
    for (let s = 0; s <= 8; s++) {
      const u = s / 8, e = Math.sin(u * Math.PI);
      const x = ax * hw + (bx - ax) * hw * u, z = az * hw + (bz - az) * hw * u, yy = e * h * 0.13 + 0.02;
      const cur: V3 = [x - (ax + bx) * hw * 0.05 * e, yy, z - (az + bz) * hw * 0.05 * e];
      if (prev) struts.push(<Strut key={k++} a={prev} b={cur} r={th(0) * 1.1} />);
      prev = cur;
    }
  }
  return <group position={p}>{struts}</group>;
};
