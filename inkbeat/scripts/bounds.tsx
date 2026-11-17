// Measures every library piece and the character, so the pre-render gate (scene/gate.py) can reason about
// what blocks the camera. Run: node scripts/run_bounds.cjs  -> writes ../scene/bounds.json
import * as THREE from "three";
import React from "react";
import { PIECES } from "../src/lib/pieces";
import { headOf, legDrop } from "../src/inkbeat/char/Character3D";

const box = new THREE.Box3();
const walk = (el: unknown, m: THREE.Matrix4) => {
  if (Array.isArray(el)) { el.forEach((e) => walk(e, m)); return; }
  if (!React.isValidElement(el)) return;
  const p = el.props as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const T = (pos?: number[], rot?: number[], sc?: number | number[]) => {
    const s = typeof sc === "number" ? [sc, sc, sc] : sc ?? [1, 1, 1];
    return m.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...(pos ?? [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...((rot ?? [0, 0, 0]) as [number, number, number]))), new THREE.Vector3(...s)));
  };
  const geo = (g: THREE.BufferGeometry, mm: THREE.Matrix4) => { g.computeBoundingBox(); box.union(g.boundingBox!.clone().applyMatrix4(mm)); };
  if (el.type === React.Fragment) walk(p.children, m);
  else if (el.type === "group") walk(p.children, T(p.position, p.rotation, p.scale));
  else if (el.type === "mesh") geo(p.geometry, T(p.position, p.rotation, p.scale));
  else if (p.g) geo(p.g, T(p.p, p.r, p.s));                                   // <M>
  else if (p.text !== undefined) geo(new THREE.BoxGeometry(p.w, p.h, 0.02), T(p.p, p.r)); // <Label>
  else if (typeof el.type === "function") walk((el.type as (q: unknown) => unknown)(p), m);
};
const pieces: Record<string, number[]> = {};
for (const [k, make] of Object.entries(PIECES)) {
  box.makeEmpty(); walk(make({}), new THREE.Matrix4());
  pieces[k] = [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].map((v) => Math.round(v * 1000) / 1000);
}
const B = { torso: "block" as const, torsoWidth: 1.05 };
const out = { pieces, character: { head_y_per_height: headOf([0, 0, 0], 1, B)[1], head_z_per_height: headOf([0, 0, 0], 1, B)[2],
  drop_per_height: { stand: 0, sit: legDrop("sit", 1, B), kneel: legDrop("kneel", 1, B), crouch: legDrop("crouch", 1, B) } } };
process.stdout.write(JSON.stringify(out, null, 1));
