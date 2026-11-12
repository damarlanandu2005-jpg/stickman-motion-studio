// The Mary Celeste world: one sea with the ship (and the Dei Gratia + a rowboat), a New York wharf, a ship's cabin, a map table.
// Every place lives at its own origin (see bstory.ts ORIGIN) and is switched on per shot. All built in code (Batch + tm), no Kenney models.
// OWNER: mat agent. Units are metres. The ship's long axis is x (stern -x, bow +x), starboard side (+z) faces the camera.
import * as THREE from "three";
import { Batch, V, house } from "./build";
import { ctex } from "./paint";
import { tm, sbox } from "./railprops";
import { NOINK } from "./ink";

export type V3 = [number, number, number];
export const DECK_Y = 1.6;                                   // deck height above the water, ship local
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const MX = (x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rz = 0, rx = 0) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));
const bx = (B: Batch, mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => B.add(UNIT, mat, MX(x, y, z, ry, w, h, d, rz, rx));
const cyl = (B: Batch, mat: THREE.Material, rt: number, rb: number, h: number, x: number, y: number, z: number, rx = 0, rz = 0, seg = 12) =>
  B.add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, MX(x, y, z, 0, 1, 1, 1, rz, rx));
/** a rod from a to b */
const rod = (B: Batch, mat: THREE.Material, a: V3, b: V3, r: number) => {
  const A = V(...a), Bv = V(...b), d = Bv.clone().sub(A), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
  B.add(new THREE.CylinderGeometry(r, r, len, 8), mat, new THREE.Matrix4().compose(A.clone().add(Bv).multiplyScalar(0.5), q, V(1, 1, 1)));
};

// ---------------- textures ----------------
const seaTex = () => {
  const t = ctex("marySea", 256, 256, (g, r) => {
    g.fillStyle = "#6a8c9c"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 46; i++) {
      const y = r() * 256, x = r() * 256, w = 24 + r() * 60;
      g.strokeStyle = r() < 0.5 ? "rgba(235,245,250,0.20)" : "rgba(30,60,80,0.20)"; g.lineWidth = 1.5 + r() * 2.5;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 3 - r() * 4, x + w, y); g.stroke();
      if (x + w > 256) { g.beginPath(); g.moveTo(x - 256, y); g.quadraticCurveTo(x - 256 + w / 2, y - 4, x - 256 + w, y); g.stroke(); }
    }
  });
  return t;
};
const deckTex = () => ctex("maryDeck", 256, 256, (g, r) => {
  g.fillStyle = "#a98458"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) { g.fillStyle = r() < 0.5 ? "#b08a5c" : "#9c7a50"; g.fillRect(0, i * 32, 256, 32); g.fillStyle = "#4a2e18"; g.fillRect(0, i * 32, 256, 2); g.fillRect(r() * 256, i * 32 + 3, 2, 28); }
});
const plankTex = (key: string, base: string, a: string, b: string) => ctex(key, 256, 256, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(i * 25.6, 0, 25.6, 256); g.fillStyle = "rgba(30,15,6,0.5)"; g.fillRect(i * 25.6, 0, 2, 256); }
  for (let k = 0; k < 30; k++) { g.fillStyle = "rgba(30,15,6,0.18)"; g.fillRect(r() * 256, r() * 256, 2, 14 + r() * 40); }
});
const mapTex = () => ctex("maryMap", 512, 384, (g, r) => {
  g.fillStyle = "#e6d3a2"; g.fillRect(0, 0, 512, 384);                                  // parchment
  g.fillStyle = "#9ec3cf"; g.beginPath(); g.moveTo(0, 0); g.lineTo(512, 0); g.lineTo(512, 384); g.lineTo(0, 384); g.closePath(); g.fill();   // the Atlantic
  g.fillStyle = "#c7b178";                                                                // America (left) and Europe/Africa (right)
  g.beginPath(); g.moveTo(0, 0); g.lineTo(120, 0); g.bezierCurveTo(110, 80, 70, 120, 90, 190); g.bezierCurveTo(60, 260, 40, 300, 60, 384); g.lineTo(0, 384); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(512, 40); g.lineTo(440, 60); g.bezierCurveTo(420, 120, 450, 170, 430, 230); g.bezierCurveTo(440, 300, 470, 340, 512, 384); g.closePath(); g.fill();
  g.strokeStyle = "#7a2a24"; g.lineWidth = 4; g.setLineDash([10, 9]); g.beginPath(); g.moveTo(112, 120); g.bezierCurveTo(200, 90, 290, 130, 420, 100); g.stroke(); g.setLineDash([]);   // the route
  g.fillStyle = "#7a2a24"; g.beginPath(); g.arc(112, 120, 7, 0, 7); g.fill(); g.beginPath(); g.arc(420, 100, 7, 0, 7); g.fill();
  for (const [x, y, k] of [[210, 250, 1], [300, 300, 0.8], [330, 170, 0.9]] as number[][]) {   // small ship sketches on the chart
    g.strokeStyle = "#3a2a1a"; g.fillStyle = "#f4ecd6"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x - 26 * k, y); g.lineTo(x + 26 * k, y); g.lineTo(x + 16 * k, y + 12 * k); g.lineTo(x - 18 * k, y + 12 * k); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - 4 * k, y); g.lineTo(x - 4 * k, y - 38 * k); g.lineTo(x + 20 * k, y - 6 * k); g.closePath(); g.fill(); g.stroke();
  }
  g.strokeStyle = "rgba(60,40,20,0.35)"; g.lineWidth = 2; g.strokeRect(6, 6, 500, 372);
});

// ---------------- the brigantine ----------------
export type ShipOpts = { sail: string; hull: string; sails?: boolean; stripe?: string };
/** Mary Celeste (long axis x). Origin at the water line amidships. The `ship` group holds static parts only. */
export const makeShip = (o: ShipOpts) => {
  const g = new THREE.Group();
  const B = new Batch();
  const wood = tm({ map: deckTex() }), hull = tm({ color: o.hull }), trim = tm({ color: o.stripe ?? "#e8dcc0" }), dk = tm({ color: "#3a2616" }), mast = tm({ color: "#c9a878" });
  const sail = tm({ color: o.sail, side: THREE.DoubleSide }), rope = tm({ color: "#2b2018" }), brass = tm({ color: "#d0a23a" }), black = tm({ color: "#15110e" });
  // hull: pointed plan outline extruded upward (caps = deck planks, sides = painted hull)
  const sh = new THREE.Shape(); sh.moveTo(-15, -3.0); sh.lineTo(6, -3.55); sh.quadraticCurveTo(12, -3.2, 15.5, 0); sh.quadraticCurveTo(12, 3.2, 6, 3.55); sh.lineTo(-15, 3.0); sh.closePath();
  const hg = new THREE.ExtrudeGeometry(sh, { depth: 2.8, bevelEnabled: false, curveSegments: 10 }); hg.rotateX(-Math.PI / 2); hg.translate(0, -1.2, 0);
  const hm = new THREE.Mesh(hg, [wood, hull]); hm.castShadow = true; hm.receiveShadow = true; g.add(hm);
  bx(B, trim, 30, 0.14, 0.05, 0, 1.15, 3.57);  bx(B, trim, 30, 0.14, 0.05, 0, 1.15, -3.57);                      // white stripe along the hull
  // bulwarks (rail) along both sides, across the stern
  bx(B, hull, 24.5, 0.9, 0.14, -2.5, DECK_Y + 0.45, -3.2); bx(B, trim, 24.5, 0.07, 0.2, -2.5, DECK_Y + 0.93, -3.2);   // far rail, full height
  bx(B, hull, 24.5, 0.3, 0.14, -2.5, DECK_Y + 0.15, 3.2); bx(B, trim, 24.5, 0.06, 0.2, -2.5, DECK_Y + 0.32, 3.2);   // camera-side rail kept low so the deck stays visible
  bx(B, hull, 0.14, 0.9, 6.5, -14.7, DECK_Y + 0.45, 0); bx(B, trim, 0.2, 0.07, 6.7, -14.7, DECK_Y + 0.93, 0);
  rod(B, mast, [15, 2.0, 0], [21.5, 3.7, 0], 0.13);                                                                // bowsprit
  // masts, yards, boom
  const FORE = 7.5, MAIN = -3.5;
  cyl(B, mast, 0.2, 0.28, 15.5, FORE, DECK_Y + 7.7, 0, 0, 0, 10); cyl(B, mast, 0.22, 0.3, 16.5, MAIN, DECK_Y + 8.2, 0, 0, 0, 10);
  cyl(B, mast, 0.09, 0.09, 9.4, FORE, DECK_Y + 5.6, 0, Math.PI / 2, 0, 8); cyl(B, mast, 0.09, 0.09, 8.2, FORE, DECK_Y + 11.2, 0, Math.PI / 2, 0, 8);   // yards (along z)
  cyl(B, mast, 0.1, 0.1, 10.5, MAIN - 5.0, DECK_Y + 2.6, 0, 0, Math.PI / 2, 8);                                                                         // boom (along x)
  rod(B, mast, [MAIN, DECK_Y + 12.5, 0], [MAIN - 8, DECK_Y + 6.2, 0], 0.08);                                                                              // gaff
  // standing rigging: stays and shrouds (thin dark rods)
  for (const z of [3.1, -3.1]) { rod(B, rope, [FORE, DECK_Y + 7, 0], [FORE - 1.0, DECK_Y + 0.9, z], 0.025); rod(B, rope, [MAIN, DECK_Y + 7.5, 0], [MAIN + 1.0, DECK_Y + 0.9, z], 0.025); }
  rod(B, rope, [FORE, DECK_Y + 14.5, 0], [21, 3.6, 0], 0.03); rod(B, rope, [MAIN, DECK_Y + 15, 0], [FORE, DECK_Y + 12, 0], 0.03);
  if (o.sails !== false) {
    bx(B, sail, 0.06, 4.6, 8.8, FORE + 0.35, DECK_Y + 8.1, 0);  bx(B, sail, 0.06, 3.6, 7.4, FORE + 0.35, DECK_Y + 13.0, 0);          // two square sails on the foremast
    bx(B, sail, 8.0, 7.0, 0.06, MAIN - 4.2, DECK_Y + 7.6, 0, 0, 0, 0.16);                                                          // gaff mainsail
    const jib = new THREE.Shape(); jib.moveTo(0, 0); jib.lineTo(7.2, 0.8); jib.lineTo(0.9, 9.4); jib.closePath();
    B.add(new THREE.ShapeGeometry(jib), sail, MX(FORE + 1.6, DECK_Y + 1.2, 0.02, 0, 1));                                              // jib toward the bowsprit
  }
  // deckhouse aft with a door and two windows (on the camera side, +z)
  bx(B, dk, 5, 2.3, 4.2, -9, DECK_Y + 1.15, 0); bx(B, trim, 5.4, 0.12, 4.6, -9, DECK_Y + 2.36, 0);
  bx(B, black, 1.0, 1.7, 0.06, -9.9, DECK_Y + 0.9, 2.12); bx(B, black, 0.8, 0.7, 0.06, -8.4, DECK_Y + 1.35, 2.12); bx(B, black, 0.8, 0.7, 0.06, -7.2, DECK_Y + 1.35, 2.12);
  // ship's wheel and post on the quarterdeck
  cyl(B, dk, 0.1, 0.12, 1.1, -12.8, DECK_Y + 0.55, 0, 0, 0, 8);
  B.add(new THREE.TorusGeometry(0.55, 0.05, 8, 22).rotateY(Math.PI / 2), brass, MX(-12.8, DECK_Y + 1.35, 0));
  for (let k = 0; k < 4; k++) B.add(UNIT, brass, MX(-12.8, DECK_Y + 1.35, 0, 0, 0.05, 1.3, 0.05, 0, (k * Math.PI) / 4 + Math.PI / 8));
  // main hatch: coaming with 3 x 4 barrels showing as rows below the deck line (cargo seen through the open hatch)
  const cm = tm({ color: "#8a6540" }); bx(B, cm, 3.4, 0.55, 0.2, 2.8, DECK_Y + 0.27, 1.45); bx(B, cm, 3.4, 0.55, 0.2, 2.8, DECK_Y + 0.27, -1.45); bx(B, cm, 0.2, 0.55, 3.1, 1.1, DECK_Y + 0.27, 0); bx(B, cm, 0.2, 0.55, 3.1, 4.5, DECK_Y + 0.27, 0);
  bx(B, black, 3.0, 0.03, 2.7, 2.8, DECK_Y + 0.02, 0);
  const bar = tm({ color: "#8a5a30" }), hoop = tm({ color: "#2c1e12" });
  const barrel = (x: number, y: number, z: number) => { cyl(B, bar, 0.3, 0.3, 0.9, x, y, z, 0, 0, 14); cyl(B, hoop, 0.315, 0.315, 0.05, x, y + 0.26, z, 0, 0, 14); cyl(B, hoop, 0.315, 0.315, 0.05, x, y - 0.26, z, 0, 0, 14); };
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) barrel(1.6 + i * 0.75, DECK_Y + 0.2, -0.85 + k * 0.85);
  // empty boat cradle on the deck amidships (the lifeboat sat here): two chocks, and two davits on the starboard rail
  bx(B, dk, 0.3, 0.28, 2.4, -3.0, DECK_Y + 0.14, 0); bx(B, dk, 0.3, 0.28, 2.4, -0.2, DECK_Y + 0.14, 0);
  for (const x of [-3.1, 0.3]) { rod(B, dk, [x, DECK_Y, 3.1], [x, DECK_Y + 2.4, 3.1], 0.13); rod(B, dk, [x, DECK_Y + 2.4, 3.1], [x, DECK_Y + 2.45, 3.9], 0.1); rod(B, rope, [x, DECK_Y + 2.45, 3.9], [x + 0.25, DECK_Y - 0.3, 4.0], 0.03); }  // davit + loose rope
  bx(B, tm({ color: "#c9a874" }), 3.8, 0.02, 2.9, -1.4, DECK_Y + 0.012, 0);                                      // pale patch where the lifeboat sat
  bx(B, trim, 30, 0.1, 0.05, 0, 0.35, 3.57); bx(B, trim, 30, 0.1, 0.05, 0, 0.35, -3.57);                           // second, lower stripe
  // barrels lashed on deck forward (c1 close-up): 3 x 3 with two ropes over them
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) barrel(9.6 + i * 0.7, DECK_Y + 0.45, -0.7 + k * 0.7);
  bx(B, rope, 2.3, 0.04, 0.05, 10.3, DECK_Y + 0.93, -0.35); bx(B, rope, 2.3, 0.04, 0.05, 10.3, DECK_Y + 0.93, 0.35);
  // a small table with bread, a tin mug and a water cask (c1 close-up), between the masts on the starboard side
  const tbl = tm({ color: "#7a5230" });
  const TX = 6.0; bx(B, tbl, 1.3, 0.07, 0.8, TX, DECK_Y + 0.85, 2.2);
  for (const [dx, dz] of [[-0.55, -0.32], [0.55, -0.32], [-0.55, 0.32], [0.55, 0.32]]) bx(B, tbl, 0.07, 0.85, 0.07, TX + dx, DECK_Y + 0.42, 2.2 + dz);
  B.add(new THREE.CapsuleGeometry(0.11, 0.3, 4, 10), tm({ color: "#c98a4a" }), MX(TX - 0.3, DECK_Y + 1.0, 2.2, 0.4, 1, 1, 1, Math.PI / 2));    // bread loaf
  cyl(B, tm({ color: "#b9bcc0" }), 0.07, 0.06, 0.12, TX + 0.2, DECK_Y + 0.95, 2.35, 0, 0, 12);                                                    // tin mug
  cyl(B, bar, 0.36, 0.36, 0.7, TX + 0.9, DECK_Y + 0.35, 2.2, 0, 0, 14); cyl(B, hoop, 0.375, 0.375, 0.05, TX + 0.9, DECK_Y + 0.5, 2.2, 0, 0, 14);          // water cask
  B.build(g, true);
  return g;
};
export const makeBoat = () => {
  const g = new THREE.Group(); const B = new Batch();
  const sh = new THREE.Shape(); sh.moveTo(-2.2, 0); sh.lineTo(-1.2, 0.85); sh.lineTo(1.3, 0.85); sh.lineTo(2.3, 0); sh.lineTo(1.3, -0.85); sh.lineTo(-1.2, -0.85); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: false }); geo.rotateX(-Math.PI / 2); geo.translate(0, -0.25, 0);
  const side = tm({ color: "#4a3426" });
  const m = new THREE.Mesh(geo, [tm({ color: "#7a5a3a" }), side]); m.castShadow = true; g.add(m);                       // floor level at y = 0.35
  const rim = tm({ color: "#6a4a30" });
  for (const z of [0.85, -0.85]) bx(B, rim, 2.5, 0.3, 0.07, 0.05, 0.5, z);                                              // gunwales
  bx(B, rim, 0.07, 0.3, 1.7, -1.7, 0.5, 0, 0, 0.0); bx(B, rim, 0.07, 0.3, 1.7, 1.75, 0.5, 0);
  for (const x of [-0.7, 0.7]) bx(B, rim, 0.2, 0.06, 1.7, x, 0.42, 0);                                                    // thwarts
  rod(B, tm({ color: "#c9a878" }), [-0.4, 0.75, 0.9], [-0.1, 0.1, 2.5], 0.04); rod(B, tm({ color: "#c9a878" }), [0.4, 0.75, -0.9], [0.1, 0.1, -2.5], 0.04);   // two oars
  B.build(g, true); return g;
};

// ---------------- the sea ----------------
export const buildSea = (R: THREE.Object3D) => {
  const g = new THREE.Group(); R.add(g); const B = new Batch();
  const t = seaTex(); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  sbox(B, tm({ map: t }), -2500, 2500, -2, 0, -2500, 2500, 14);
  B.build(g, false);
  return g;
};

// ---------------- New York wharf (origin: amidships of the moored ship; quay front at z = -4.3) ----------------
export const QUAY_Y = 1.2;
export const buildHarbor = (R: THREE.Object3D) => {
  const g = new THREE.Group(); R.add(g); const B = new Batch();
  const stone = tm({ color: "#8d8a82" }), dkw = tm({ color: "#4a3224" }), crate = tm({ color: "#a8814e" }), bar = tm({ color: "#8a5a30" }), hoop = tm({ color: "#2c1e12" }), rope = tm({ color: "#2b2018" });
  sbox(B, stone, -90, 90, -1.5, QUAY_Y, -60, -4.3, 8);                                       // quay slab
  bx(B, tm({ color: "#6b6860" }), 180, 0.25, 0.4, 0, QUAY_Y + 0.12, -4.5);                    // stone coping
  for (let k = 0; k < 8; k++) { cyl(B, tm({ color: "#2a2724" }), 0.2, 0.26, 0.55, -21 + k * 6, QUAY_Y + 0.27, -5.2, 0, 0, 10); }   // bollards
  const wh: [number, number, number, number, number][] = [[-30, -32, 12, 9, 8], [-12, -34, 10, 9, 9], [8, -33, 11, 9, 8.4], [27, -32, 12, 9, 7.6]];
  wh.forEach(([x, z, w, d, h], i) => house(B, x, z, 0, w, d, h, i + 2, QUAY_Y));
  const barrel = (x: number, y: number, z: number) => { cyl(B, bar, 0.3, 0.3, 0.9, x, y, z, 0, 0, 14); cyl(B, hoop, 0.315, 0.315, 0.05, x, y + 0.26, z, 0, 0, 14); cyl(B, hoop, 0.315, 0.315, 0.05, x, y - 0.26, z, 0, 0, 14); };
  for (let i = 0; i < 5; i++) for (let k = 0; k < 2; k++) barrel(5.5 + i * 0.68, QUAY_Y + 0.45, -9.5 - k * 0.68);                 // piled barrels on the quay
  for (let i = 0; i < 4; i++) barrel(5.9 + i * 0.68, QUAY_Y + 1.35, -9.8);
  for (const [x, z] of [[-6, -9], [-8.2, -10.5], [-3.5, -11]]) bx(B, crate, 1.3, 1.0, 1.1, x, QUAY_Y + 0.5, z, 0, 0.3);       // crates
  bx(B, dkw, 1.2, 0.08, 7, 0, QUAY_Y + 0.9, -2.6, -0.06);                                    // gangway plank to the ship
  rod(B, rope, [-12, DECK_Y + 0.9, -3.3], [-12.4, QUAY_Y + 0.4, -5.2], 0.04); rod(B, rope, [12, DECK_Y + 0.9, -3.3], [12.4, QUAY_Y + 0.4, -5.2], 0.04); // mooring lines
  B.build(g, true);
  return g;
};
const DECK_Y2 = DECK_Y;
void DECK_Y2;

// ---------------- the captain's cabin (origin: centre of the floor) ----------------
export const buildCabin = (R: THREE.Object3D) => {
  const g = new THREE.Group(); R.add(g); const B = new Batch(), B2 = new Batch();
  const wall = tm({ map: plankTex("maryWall", "#a07850", "#a98458", "#94704a") }), floor = tm({ map: plankTex("maryCabFloor", "#6a482c", "#74502f", "#60402a") }), dk = tm({ color: "#4a3020" });
  const cloth = tm({ color: "#d8cfc0" }), blanket = tm({ color: "#7a8fb0" }), plate = tm({ color: "#e8e4dc" }), coat = tm({ color: "#2f3a52" }), brass = tm({ color: "#d0a23a" });
  const X = 2.2, Z = 1.9, H = 2.4;
  sbox(B, floor, -X, X, -0.3, 0, -Z - 0.3, Z + 3, 2);
  sbox(B2, wall, -X, X, 0, H, -Z - 0.3, -Z, 2);                       // back wall
  sbox(B2, wall, -X - 0.3, -X, 0, H, -Z - 0.3, Z + 3, 2);             // left wall
  sbox(B2, wall, X, X + 0.3, 0, H, -Z - 0.3, Z + 3, 2);               // right wall
  sbox(B2, dk, -X, X, H, H + 0.3, -Z - 0.3, Z + 3, 1, 0, 0, true);    // ceiling
  for (const z of [-1.0, 0.6]) sbox(B2, dk, -X, X, H - 0.18, H, z, z + 0.16, 1);   // beams
  // porthole window on the back wall with a grey sea behind it
  const view = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), new THREE.MeshBasicMaterial({ map: ctex("maryView", 128, 96, (c) => { const s = c.createLinearGradient(0, 0, 0, 96); s.addColorStop(0, "#b9c2c8"); s.addColorStop(0.5, "#aab6be"); s.addColorStop(0.5, "#6f8896"); s.addColorStop(1, "#5a7684"); c.fillStyle = s; c.fillRect(0, 0, 128, 96); }), fog: false }));
  view.position.set(0.3, 1.45, -Z + 0.012); g.add(view);
  bx(B, dk, 1.14, 0.07, 0.1, 0.3, 1.82, -Z + 0.05); bx(B, dk, 1.14, 0.07, 0.1, 0.3, 1.08, -Z + 0.05); bx(B, dk, 0.07, 0.8, 0.1, -0.27, 1.45, -Z + 0.05); bx(B, dk, 0.07, 0.8, 0.1, 0.87, 1.45, -Z + 0.05);
  // bunk against the left wall with a blanket and a rag doll (a child's toy: the two-year-old)
  bx(B, dk, 1.1, 0.4, 2.0, -X + 0.55, 0.2, -0.8); bx(B, cloth, 1.0, 0.14, 1.9, -X + 0.55, 0.47, -0.8); bx(B, blanket, 1.0, 0.1, 1.1, -X + 0.55, 0.58, -0.35);
  const doll = (x: number, y: number, z: number) => {   // rag doll, about 40 cm: red dress, round head, two arms, yarn hair
    B.add(new THREE.CylinderGeometry(0.07, 0.17, 0.34, 12), tm({ color: "#c0453a" }), MX(x, y + 0.17, z));
    B.add(new THREE.SphereGeometry(0.13, 14, 12), tm({ color: "#f1d8b8" }), MX(x, y + 0.47, z));
    B.add(new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), tm({ color: "#d8a040" }), MX(x, y + 0.5, z));
    bx(B, tm({ color: "#f1d8b8" }), 0.3, 0.06, 0.06, x, y + 0.3, z);
  };
  doll(-X + 0.6, 0.64, -1.2);
  // table with two plates and a cup, a chair pushed back from it
  bx(B, dk, 1.2, 0.07, 0.8, 0.7, 0.82, -0.5); for (const [dx, dz] of [[-0.52, -0.32], [0.52, -0.32], [-0.52, 0.32], [0.52, 0.32]]) bx(B, dk, 0.07, 0.82, 0.07, 0.7 + dx, 0.41, -0.5 + dz);
  cyl(B, plate, 0.17, 0.15, 0.03, 0.45, 0.88, -0.5, 0, 0, 16); cyl(B, plate, 0.17, 0.15, 0.03, 0.95, 0.88, -0.5, 0, 0, 16); cyl(B, tm({ color: "#b9bcc0" }), 0.06, 0.05, 0.1, 0.7, 0.92, -0.65, 0, 0, 12);
  bx(B, dk, 0.5, 0.06, 0.5, 0.5, 0.48, 0.75, 0, 0.5); bx(B, dk, 0.5, 0.55, 0.06, 0.38, 0.8, 0.98, 0, 0.5);
  // coat on a hook on the right wall
  bx(B, brass, 0.06, 0.06, 0.12, X - 0.05, 1.8, -0.9); bx(B, coat, 0.1, 0.8, 0.46, X - 0.12, 1.4, -0.9);
  B.build(g, true); B2.build(g, false);
  return g;
};

// ---------------- the investigators' table (origin: floor under the table; top at y = 1.0) ----------------
export const buildTable = (R: THREE.Object3D) => {
  const g = new THREE.Group(); R.add(g); const B = new Batch();
  const dk = tm({ color: "#5a3a24" }), wood = tm({ color: "#7a5230" }), paper = tm({ color: "#efe4c8" }), brass = tm({ color: "#d0a23a" });
  sbox(B, tm({ map: plankTex("maryTblFloor", "#4a3020", "#52362a", "#432c1e") }), -6, 6, -0.3, 0, -6, 6, 2);
  sbox(B, wood, -1.8, 1.8, 0.94, 1.0, -1.2, 1.2, 1); for (const [x, z] of [[-1.6, -1.0], [1.6, -1.0], [-1.6, 1.0], [1.6, 1.0]]) sbox(B, dk, x - 0.07, x + 0.07, 0, 0.94, z - 0.07, z + 0.07, 1);
  B.build(g, true);
  const map = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: mapTex() })); map.position.set(0.2, 1.012, 0); map.layers.set(NOINK); g.add(map);
  const sk = (x: number, z: number, ry: number, c: string) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, 1.016, z); m.rotation.y = ry; m.layers.set(NOINK); g.add(m); };
  sk(-1.0, -0.55, 0.3, "#f3ead2"); sk(-1.05, 0.15, -0.2, "#ece0c0"); sk(1.45, 0.6, 0.15, "#f3ead2");
  const B2 = new Batch();
  cyl(B2, brass, 0.12, 0.16, 0.06, -1.55, 1.03, 0.8, 0, 0, 16); cyl(B2, brass, 0.025, 0.025, 0.34, -1.55, 1.2, 0.8, 0, 0, 8);                 // lamp base and stem
  cyl(B2, tm({ color: "#2a2622" }), 0.02, 0.02, 0.4, 1.0, 1.02, -0.85, Math.PI / 2, 0.5, 8);                                               // pen
  B2.build(g, true);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 0.8) })); glass.position.set(-1.55, 1.42, 0.8); g.add(glass);
  void paper;
  return g;
};
