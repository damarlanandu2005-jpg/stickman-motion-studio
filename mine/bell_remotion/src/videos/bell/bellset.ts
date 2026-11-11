// Bell's workshop (ONE room; a doorway in the right wall opens on the dark, that is "the next room"), the town street for
// "thousands of homes had a phone", and the few props the story needs: transmitter + horn, the acid jar, the wire, the receiver.
// OWNER: mat agent. Everything goes through Batch + twoTone like the rest of the engine.
import * as THREE from "three";
import { Batch, V, house } from "./build";
import { ctex } from "./paint";
import { tm, sbox, woodTex } from "./railprops";
import { NOINK } from "./ink";

export type V3 = [number, number, number];
// ---- fixed layout (metres). Camera looks toward -z; Bell stands on the LEFT (x < 0), Watson on the RIGHT (x > 4) in every shot ----
export const ROOM = { x0: -4.5, x1: 4.5, z0: -6.5, z1: 3.5, h: 4.4 };
export const DOOR = { z0: -4.9, z1: -3.3, h: 2.5 };      // doorway in the right wall (x = 4.5), opens on the dark
export const BENCH_Y = 1.12;                             // top of the bench
export const MACH = { x: -0.55, z: -3.95 };              // transmitter on the bench
export const JAR0 = { x: -0.05, z: -3.72 };               // the acid jar (upright before it is knocked over)
export const BELL_X = -1.0, BELL_Z = -2.95;              // where Bell stands (in front of the bench, left of the machine)
export const WATSON_X = 5.7, WATSON_Z = -4.1;            // Watson in the dark beyond the doorway
export const WIRE_START: V3 = [-0.2, 1.3, -3.9];

const MX = (x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rz = 0, rx = 0) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const bx = (B: Batch, mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => B.add(UNIT, mat, MX(x, y, z, ry, w, h, d, rz, rx));
const cyl = (B: Batch, mat: THREE.Material, rt: number, rb: number, h: number, x: number, y: number, z: number, rx = 0, rz = 0, seg = 14) =>
  B.add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, MX(x, y, z, 0, 1, 1, 1, rz, rx));

const wallTex = () => ctex("bellWall", 256, 256, (g) => {
  g.fillStyle = "#cfa97f"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? "rgba(120,80,50,0.07)" : "rgba(255,235,200,0.06)"; g.fillRect(i * 26, 0, 26, 256); }
  g.fillStyle = "rgba(90,60,40,0.12)"; g.fillRect(0, 0, 256, 6);
});
const floorTex = () => ctex("bellFloor", 512, 512, (g, r) => {
  g.fillStyle = "#7a5236"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = r() < 0.5 ? "#85583a" : "#6c4830"; g.fillRect(0, i * 64, 512, 64);
    g.fillStyle = "#2a160c"; g.fillRect(0, i * 64, 512, 3);
    for (let k = 0; k < 6; k++) g.fillRect(r() * 512, i * 64 + 4, 2, 58);
  }
});
/** what you see through the workshop window: a Boston morning, roofs and chimneys */
const viewTex = () => ctex("bellView", 256, 256, (g) => {
  const sk = g.createLinearGradient(0, 0, 0, 256); sk.addColorStop(0, "#7ab0e6"); sk.addColorStop(0.6, "#cfe0f2"); sk.addColorStop(1, "#f6e6cc"); g.fillStyle = sk; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#f2f2f6"; g.beginPath(); g.arc(60, 56, 22, 0, 7); g.arc(88, 48, 28, 0, 7); g.arc(122, 58, 20, 0, 7); g.fill();
  const roofs: [number, number, number, string][] = [[0, 160, 70, "#8a5a4a"], [60, 140, 60, "#6a5a7a"], [118, 170, 80, "#9a6a50"], [190, 150, 70, "#7a6070"]];
  for (const [x, y, w, c] of roofs) { g.fillStyle = c; g.fillRect(x, y, w, 256 - y); g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + w / 2, y - 26); g.lineTo(x + w + 4, y); g.fill(); g.fillStyle = "#5a3a30"; g.fillRect(x + w * 0.7, y - 36, 9, 26); }
});

/** the workshop (static parts). Walls / ceiling do not cast shadows, furniture does. */
export const buildWorkshop = (R: THREE.Object3D) => {
  const g = new THREE.Group(); R.add(g);
  const B = new Batch(), B2 = new Batch();
  const wall = tm({ map: wallTex() }), floor = tm({ map: floorTex() }), wood = tm({ map: woodTex(), color: "#b88a60" }), dkw = tm({ color: "#5a3a26" });
  const brass = tm({ color: "#d0a23a" }), zinc = tm({ color: "#6a6e76" }), glass = tm({ color: "#9fd3b6" });
  const { x0, x1, z0, z1, h } = ROOM;
  sbox(B, floor, x0, x1, -0.4, 0, z0 - 0.3, z1, 3);                                              // floor
  sbox(B2, wall, x0, x1, 0, h, z0 - 0.3, z0, 3);                                                  // back wall
  sbox(B, dkw, x0, x1, 0, 1.1, z0 - 0.05, z0 + 0.02, 3);                                          // wainscot
  sbox(B2, wall, x0 - 0.3, x0, 0, h, z0 - 0.3, z1, 3);                                            // left wall
  sbox(B2, wall, x1, x1 + 0.3, 0, h, z0 - 0.3, DOOR.z0, 3);                                       // right wall, in front of the doorway...
  sbox(B2, wall, x1, x1 + 0.3, 0, h, DOOR.z1, z1, 3);                                             // ...and behind it
  sbox(B2, wall, x1, x1 + 0.3, DOOR.h, h, DOOR.z0, DOOR.z1, 3);                                   // header above the opening
  sbox(B2, dkw, x0, x1, h, h + 0.3, z0 - 0.3, z1, 1, 0, 0, true);                                 // ceiling
  for (let z = z0 + 1; z < z1; z += 2.5) sbox(B2, dkw, x0, x1, h - 0.4, h, z, z + 0.3, 1);        // beams
  // doorframe (dark wood) on the inside of the right wall
  sbox(B, dkw, x1 - 0.12, x1, 0, DOOR.h + 0.12, DOOR.z0 - 0.12, DOOR.z0, 1); sbox(B, dkw, x1 - 0.12, x1, 0, DOOR.h + 0.12, DOOR.z1, DOOR.z1 + 0.12, 1);
  sbox(B, dkw, x1 - 0.12, x1, DOOR.h, DOOR.h + 0.12, DOOR.z0 - 0.12, DOOR.z1 + 0.12, 1);
  // window on the back wall
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.1), new THREE.MeshBasicMaterial({ map: viewTex(), fog: false })); win.position.set(0.2, 2.75, z0 + 0.012); g.add(win);
  sbox(B, dkw, -1.2, 1.6, 1.64, 1.76, z0 + 0.01, z0 + 0.12, 1); sbox(B, dkw, -1.2, 1.6, 3.74, 3.86, z0 + 0.01, z0 + 0.12, 1);
  sbox(B, dkw, -1.2, -1.08, 1.64, 3.86, z0 + 0.01, z0 + 0.12, 1); sbox(B, dkw, 1.48, 1.6, 1.64, 3.86, z0 + 0.01, z0 + 0.12, 1); sbox(B, dkw, 0.14, 0.26, 1.64, 3.86, z0 + 0.01, z0 + 0.12, 1);
  // workbench: top, legs, lower shelf
  sbox(B, wood, -3.1, 0.8, BENCH_Y - 0.1, BENCH_Y, -4.7, -3.3, 1);
  for (const [x, z] of [[-3.0, -4.6], [0.7, -4.6], [-3.0, -3.4], [0.7, -3.4]]) sbox(B, dkw, x - 0.06, x + 0.06, 0, BENCH_Y - 0.1, z - 0.06, z + 0.06, 1);
  sbox(B, dkw, -3.0, 0.7, 0.3, 0.38, -4.6, -3.4, 1);
  // the transmitter: wooden base, post, brass horn pointing at the speaker (+z, tilted up), two binding posts
  sbox(B, tm({ color: "#6a4a30" }), MACH.x - 0.4, MACH.x + 0.4, BENCH_Y, BENCH_Y + 0.1, MACH.z - 0.3, MACH.z + 0.3, 1);
  cyl(B, brass, 0.045, 0.045, 0.5, MACH.x, BENCH_Y + 0.35, MACH.z);
  B.add(new THREE.CylinderGeometry(0.3, 0.08, 0.55, 20, 1, true), tm({ color: "#d0a23a", side: THREE.DoubleSide }), MX(MACH.x, BENCH_Y + 0.74, MACH.z + 0.25, 0, 1, 1, 1, 0, Math.PI / 3));
  cyl(B, brass, 0.035, 0.035, 0.12, MACH.x - 0.3, BENCH_Y + 0.16, MACH.z + 0.05); cyl(B, brass, 0.035, 0.035, 0.12, MACH.x + 0.33, BENCH_Y + 0.16, MACH.z - 0.1);
  // two battery jars at the left end of the bench (they stay upright)
  for (const x of [-2.55, -2.2]) { cyl(B, glass, 0.17, 0.17, 0.42, x, BENCH_Y + 0.21, -4.0, 0, 0, 16); cyl(B, zinc, 0.03, 0.03, 0.34, x, BENCH_Y + 0.52, -4.0); }
  B.build(g, true); B2.build(g, false);
  return g;
};

/** the acid jar: pale green glass, acid surface, zinc rod. Origin at the foot of the jar. */
export const makeJar = () => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.42, 18).translate(0, 0.21, 0), tm({ color: "#9fd3b6" }));
  const acid = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 18).translate(0, 0.35, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.9, 0.25) }));
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8).translate(0.06, 0.52, 0), tm({ color: "#6a6e76" }));
  g.add(body, acid, rod); g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  return g;
};
/** flat acid puddle (unit radius, scaled by the story) */
export const makePuddle = () => {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 1.1, 0.2) }));
  m.layers.set(NOINK); return m;
};
/** the telephone receiver Watson holds at his ear: black cup + brass rim */
export const makeReceiver = () => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.07, 18).rotateZ(Math.PI / 2), tm({ color: "#2a2622" })));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 8, 20).rotateY(Math.PI / 2), tm({ color: "#d0a23a" })); rim.position.x = -0.034; g.add(rim);
  return g;
};
/** the wire: a thin tube through the points, rebuilt when a point moves (NOINK so it stays a thin dark line) */
export const makeWire = () => {
  const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: "#1c1612" })); m.layers.set(NOINK); m.frustumCulled = false; return m;
};
export const setWire = (m: THREE.Mesh, pts: V3[]) => {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => V(p[0], p[1], p[2])), false, "centripetal");
  m.geometry.dispose(); m.geometry = new THREE.TubeGeometry(curve, 90, 0.022, 6, false);
};

// ---------------- the town street (one shot): fronts face a dirt street, a pole line carries a wire to every house ----------------
export const buildTown = (R: THREE.Object3D) => {
  const g = new THREE.Group(); R.add(g);
  const B = new Batch();
  sbox(B, tm({ color: "#a8b87a" }), -600, 600, -0.5, 0, -700, 60, 40);
  sbox(B, tm({ color: "#bd9a70" }), -3.4, 3.4, 0, 0.03, -700, 60, 40);
  const dkw = tm({ color: "#4a3224" }), wire = tm({ color: "#15110e" });
  const seg = (a: V3, b: V3, t: number) => {
    const A = V(...a), Bv = V(...b), d = Bv.clone().sub(A), len = d.length(), q = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), d.clone().normalize());
    B.add(UNIT, wire, new THREE.Matrix4().compose(A.clone().add(Bv).multiplyScalar(0.5), q, V(len, t, t)));
  };
  const PX = 3.9, PITCH = 8.6, N = 9;
  for (let k = 0; k < N; k++) {
    const z = 4 - k * PITCH;
    for (const side of [-1, 1]) house(B, side * 9, z - 4, side < 0 ? Math.PI / 2 : -Math.PI / 2, 5.6, 5.2, 5.6, (k + (side > 0 ? 3 : 0)) % 8, 0);
    cyl(B, dkw, 0.09, 0.13, 6.4, PX, 3.2, z - 4); bx(B, dkw, 1.4, 0.1, 0.1, PX, 6.0, z - 4);
    // drops: across the street to a house on each side
    seg([PX, 5.95, z - 4], [6.5, 4.6, z - 4], 0.035); seg([PX, 5.95, z - 4], [-6.4, 4.6, z - 4], 0.035);
    if (k < N - 1) { const z2 = z - PITCH; seg([PX, 6.0, z - 4], [PX, 5.78, (z + z2) / 2 - 4], 0.035); seg([PX, 5.78, (z + z2) / 2 - 4], [PX, 6.0, z2 - 4], 0.035); }
  }
  B.build(g, true);
  return g;
};
