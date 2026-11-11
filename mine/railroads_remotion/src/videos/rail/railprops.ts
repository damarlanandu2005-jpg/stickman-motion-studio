// Railroad world pieces: painted textures, canyon strata, steel truss bridges, Kenney Train Kit track (gap / heat / buckle),
// steam trains, set dressing and the office interior. All geometry goes through his Batch + twoTone path.
// Kenney Nature + Train kits are CC0 (kenney.nl): kept as public/rail/*.
import * as THREE from "three";
import { Batch, V, boxGeo, quad } from "./build";
import { ctex, rng } from "./paint";
import { twoTone } from "./shade";

export type Kit = Record<string, THREE.Object3D>;
export const RX = 4.5, LX = -4.5, G = 0.72, JZ = 32, TOPY = 0.24, TS = 2.4, TL = 4 * TS; // Kenney tile scaled 2.4: rail gauge half = 0.72
const TAU = Math.PI * 2;

export const tm = (o: THREE.MeshLambertMaterialParameters) => twoTone(new THREE.MeshLambertMaterial(o));
const U = (r: () => number, a: number, b: number) => a + (b - a) * r();

// ---------------- painted textures ----------------
const STRATA_COLS = ["#c8402c", "#e2653a", "#f08a46", "#f4aa62", "#b0302f", "#d4503c", "#f2b27a", "#9a2c33", "#e0724a", "#c2523a", "#f6c486", "#ea7a50"];
export const strataTex = () => ctex("strataW", 1024, 1024, (g, r) => {
  let y = -10;
  while (y < 1040) {
    const h = 10 + r() * (r() < 0.25 ? 70 : 34), c = STRATA_COLS[Math.floor(r() * STRATA_COLS.length)];
    const a = 2 + r() * 9, p = r() * 6, f = 1 + Math.floor(r() * 3), a2 = a * 0.4, p2 = r() * 6;
    const yy = (x: number) => y + a * Math.sin((x / 1024) * TAU * f + p) + a2 * Math.sin((x / 1024) * TAU * f * 3 + p2);
    g.fillStyle = c; g.beginPath(); g.moveTo(0, yy(0));
    for (let x = 0; x <= 1024; x += 16) g.lineTo(x, yy(x));
    g.lineTo(1024, 1100); g.lineTo(0, 1100); g.closePath(); g.fill();
    g.strokeStyle = "rgba(80,18,24,0.5)"; g.lineWidth = 1.5 + r() * 2.5; g.beginPath();
    for (let x = 0; x <= 1024; x += 16) { const v = yy(x); x ? g.lineTo(x, v) : g.moveTo(x, v); }
    g.stroke();
    g.strokeStyle = "rgba(255,226,170,0.32)"; g.lineWidth = 1.5; g.beginPath();
    for (let x = 0; x <= 1024; x += 16) { const v = yy(x) + 4; x ? g.lineTo(x, v) : g.moveTo(x, v); }
    g.stroke();
    y += h;
  }
  for (let i = 0; i < 520; i++) { // fine streaks
    g.strokeStyle = r() < 0.5 ? "rgba(255,230,180,0.16)" : "rgba(70,16,20,0.2)"; g.lineWidth = 1 + r() * 1.5;
    const x = r() * 1024, yy2 = r() * 1024, l = 40 + r() * 220; g.beginPath(); g.moveTo(x, yy2); g.lineTo(x + l, yy2 + (r() - 0.5) * 6); g.stroke();
  }
  for (let i = 0; i < 60; i++) { g.fillStyle = "rgba(60,14,18,0.18)"; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 8 + r() * 30, 3 + r() * 5, 0, 0, TAU); g.fill(); }
});
export const sandTex = () => ctex("sandW", 512, 512, (g, r) => {
  g.fillStyle = "#e08c4c"; g.fillRect(0, 0, 512, 512);
  const cols = ["#eda262", "#d27a3c", "#f0b074", "#c46c36", "#e69456"];
  for (let i = 0; i < 1500; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.beginPath(); g.ellipse(r() * 512, r() * 512, 4 + r() * 16, 2 + r() * 6, r() * 3, 0, TAU); g.fill(); }
  const pc = ["#c98a74", "#a8685a", "#e0b496", "#8c5a50", "#d9a083"];
  for (let i = 0; i < 160; i++) { g.fillStyle = pc[Math.floor(r() * pc.length)]; g.beginPath(); const rr = 3 + r() * 6; g.ellipse(r() * 512, r() * 512, rr, rr * 0.7, r() * 3, 0, TAU); g.fill(); g.strokeStyle = "rgba(60,26,26,0.55)"; g.lineWidth = 1.2; g.stroke(); }
});
export const gravelTex = () => ctex("gravelW", 512, 512, (g, r) => {
  g.fillStyle = "#6e5457"; g.fillRect(0, 0, 512, 512);
  const cols = ["#c9a393", "#b08878", "#d8c0a8", "#8f7a78", "#c98f7c", "#e0cdb8", "#7a6466", "#a68f90", "#d6a58a"];
  for (let i = 0; i < 1100; i++) {
    const rr = 6 + r() * 9; g.fillStyle = cols[Math.floor(r() * cols.length)]; g.beginPath();
    g.ellipse(r() * 512, r() * 512, rr, rr * (0.55 + r() * 0.4), r() * 3, 0, TAU); g.fill();
    g.strokeStyle = "rgba(44,26,34,0.65)"; g.lineWidth = 1.4; g.stroke();
  }
});
export const deckTex = () => ctex("deckW", 512, 512, (g, r) => {
  g.fillStyle = "#6a4630"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = r() < 0.5 ? "#775036" : "#5c3c2a"; g.fillRect(i * 64, 0, 64, 512);
    g.fillStyle = "#1e1210"; g.fillRect(i * 64, 0, 3, 512);
    for (let k = 0; k < 14; k++) { g.strokeStyle = "rgba(30,16,12,0.4)"; g.lineWidth = 1.5; const x = i * 64 + 6 + r() * 52, y0 = r() * 512; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (r() - 0.5) * 3, y0 + 20 + r() * 80); g.stroke(); }
  }
});
export const woodTex = () => ctex("woodW", 256, 256, (g, r) => {
  g.fillStyle = "#8a5a38"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) { g.strokeStyle = r() < 0.5 ? "rgba(40,20,10,0.4)" : "rgba(190,140,90,0.3)"; g.lineWidth = 1 + r() * 2; const y = r() * 256; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + r() * 8 - 4, 170, y + r() * 8 - 4, 256, y + r() * 6 - 3); g.stroke(); }
});
const signTex = () => ctex("signW", 256, 128, (g) => {
  g.fillStyle = "#eadcb8"; g.fillRect(0, 0, 256, 128); g.strokeStyle = "#6a2418"; g.lineWidth = 6; g.strokeRect(6, 6, 244, 116);
  g.fillStyle = "#7a2a20"; g.font = "bold 36px Arial, sans-serif"; g.textAlign = "center"; g.fillText("CANYON", 128, 58); g.fillText("RAIL CO.", 128, 100);
});
const crateTex = (k: number) => ctex("crateW" + k, 128, 128, (g, r) => {
  g.fillStyle = ["#6f9a5a", "#8a6a44", "#b0482c"][k]; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "rgba(30,20,16,0.7)"; g.lineWidth = 5; g.strokeRect(3, 3, 122, 122);
  g.beginPath(); g.moveTo(0, 42); g.lineTo(128, 42); g.moveTo(0, 86); g.lineTo(128, 86); g.stroke();
  g.fillStyle = "#f0e6cc"; g.fillRect(34, 48, 60, 32); g.fillStyle = "#a03020"; g.fillRect(40, 56, 48, 5); g.fillRect(40, 66, 30, 5);
});
const officeWall = () => ctex("officeWall", 256, 256, (g, r) => {
  g.fillStyle = "#dcae74"; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) { g.fillStyle = "rgba(150,50,30,0.3)"; g.fillRect(x, 0, 14, 256); }
  for (let i = 0; i < 120; i++) { g.fillStyle = "rgba(120,70,40,0.08)"; g.beginPath(); g.arc(r() * 256, r() * 256, 4 + r() * 12, 0, TAU); g.fill(); }
});
const officePlank = () => ctex("officePlank", 512, 512, (g, r) => {
  g.fillStyle = "#8a5430"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8; i++) { g.fillStyle = r() < 0.5 ? "#9a6038" : "#7c4a2a"; g.fillRect(0, i * 64, 512, 64); g.fillStyle = "#2a160e"; g.fillRect(0, i * 64, 512, 3); }
});

// ---------------- Kenney kit materials (warm, no teal) ----------------
const KCOL: Record<string, string> = { dirt: "#c4673c", grass: "#d99a52", stone: "#c9866a", _defaultMat: "#c4673c", leafsGreen: "#6a9a48", leafsDark: "#4a8a42",
  woodBark: "#8a5a3c", woodInner: "#e8cfa4", wood: "#a8724a", woodDark: "#7a4f33" };
const kc = new Map<string, THREE.Material>();
const kmat = (m: THREE.Material) => {
  const s = m as THREE.MeshStandardMaterial, key = m.name + (s.map ? "_m" : "");
  let x = kc.get(key);
  if (!x) { x = tm({ color: s.map ? new THREE.Color("#ffffff") : new THREE.Color(KCOL[m.name] ?? "#c9866a"), map: s.map ?? null }); kc.set(key, x); }
  return x;
};
export const addKit = (B: Batch, o: THREE.Object3D, m: THREE.Matrix4) => {
  o.updateMatrixWorld(true);
  o.traverse((c) => { const me = c as THREE.Mesh; if (me.isMesh) B.add(me.geometry, kmat(Array.isArray(me.material) ? me.material[0] : me.material), new THREE.Matrix4().multiplyMatrices(m, me.matrixWorld)); });
};
const MX = (x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx, rz = 0, rx = 0) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));
/** kit object placed on the ground at (x,y,z), uniformly scaled by s (base on y via its own bbox) */
const bboxes = new Map<THREE.Object3D, THREE.Box3>();
export const place = (B: Batch, kit: Kit, name: string, x: number, y: number, z: number, s: number, ry = 0, sy = s) => {
  const o = kit[name]; if (!o) return;
  let b = bboxes.get(o); if (!b) { b = new THREE.Box3().setFromObject(o); bboxes.set(o, b); }
  addKit(B, o, MX(x, y - b.min.y * sy, z, ry, s, sy, s));
};

// ---------------- box helpers ----------------
export const sbox = (B: Batch, mat: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, tile = 4, ou = 0, ov = 0, bottom = false) => {
  const g = boxGeo(V(x0, y0, z0), V(x1, y1, z1), tile, bottom), uv = g.attributes.uv as THREE.BufferAttribute;
  if (ou || ov) for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + ou, uv.getY(i) + ov);
  B.add(g, mat);
};
const unit = new THREE.BoxGeometry(1, 1, 1);
/** rotated box centred at (x,y,z): size w,h,d */
const bx = (B: Batch, mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) =>
  B.add(unit, mat, new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(w, h, d)));
const cyl = (B: Batch, mat: THREE.Material, rt: number, rb: number, h: number, x: number, y: number, z: number, rx = 0, rz = 0, seg = 12) =>
  B.add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), V(1, 1, 1)));

export type Mats = ReturnType<typeof makeMats>;
export const makeMats = () => {
  const strata = strataTex();
  const depthTints = ["#ffffff", "#ffe0cc", "#f8c8bc", "#e0b0b8", "#c8a0c0"]; // warm at the rim, cooler and bluer deep in the canyon
  const wall = depthTints.map((c) => tm({ map: strata, color: c }));
  return {
    wall, sand: tm({ map: sandTex() }), gravel: tm({ map: gravelTex() }), deck: tm({ map: deckTex() }), wood: tm({ map: woodTex() }),
    floor: tm({ map: strata, color: "#7a62b0" }), rustS: tm({ color: "#a2542c" }), blueS: tm({ color: "#7490aa" }), dark: tm({ color: "#2c2430" }),
    brass: tm({ color: "#d8a640" }), cactus: tm({ color: "#6a9a48" }),
  };
};
const wallMat = (M: Mats, y: number) => M.wall[y > -12 ? 0 : y > -30 ? 1 : y > -52 ? 2 : y > -72 ? 3 : 4];

// ---------------- canyon: near cliff top z>8, far cliff top z<-64, strata walls, hoodoos, mesas, floor in haze ----------------
export const buildCanyon = (R: THREE.Object3D, kit: Kit, M: Mats) => {
  const B = new Batch(), rr = rng(5);
  const XL = -700, XR = 700;
  sbox(B, M.sand, XL, XR, -4, 0, 8, 260, 5);                // near ground
  sbox(B, M.sand, XL, XR, -4, 0, -900, -64, 5);              // far ground (and the desert behind it)
  sbox(B, M.wall[0], XL, XR, -92, -4, 8, 20, 14);            // solid body behind the near wall
  sbox(B, M.wall[0], XL, XR, -92, -4, -76, -64, 14);
  sbox(B, M.floor, XL, XR, -96, -88, -76, 20, 16);           // canyon floor, far down in the haze
  const wallFace = (zf: number, dir: number) => {
    let y = -3.5, tier = 0;
    while (y > -90) {
      const h = 2.4 + rr() * 4.6; let x = XL / 2;
      while (x < XR / 2) {
        const w = 7 + rr() * 26, d = 0.35 + rr() * (tier % 3 === 0 ? 4.6 : 1.8), ou = rr() * 4, ov = rr() * 4;
        const z0 = zf + dir * d, z1 = zf - dir * 1.5;
        sbox(B, wallMat(M, y - h / 2), x, x + w, y - h, y, Math.min(z0, z1), Math.max(z0, z1), 14, ou, ov);
        x += w * (0.75 + rr() * 0.25);
      }
      y -= h * 0.86; tier++;
    }
    for (let k = 0; k < 18; k++) {       // buttresses: towers hugging the wall, they make the silhouette
      const w = 8 + rr() * 14, h = 20 + rr() * 44, d = 6 + rr() * 10, side = rr() < 0.5 ? -1 : 1, x = side * (14 + w / 2 + rr() * 90), top = -4 - rr() * 4;
      sbox(B, wallMat(M, top - h / 2), x - w / 2, x + w / 2, top - h, top, zf + dir * d, zf - dir * 1.5, 26, rr() * 4, rr() * 4);
      sbox(B, wallMat(M, top - h), x - w * 0.37, x + w * 0.37, top - h - 0.1, top - h + 3, zf + dir * d * 0.9, zf - dir * 1.2, 10); // cap stones, a little darker tier above
    }
    for (let k = 0; k < 16; k++) {       // crevices: dark vertical slots in the face
      const x = (rr() - 0.5) * 200, h = 18 + rr() * 50, y1 = -5 - rr() * 10;
      if (Math.abs(x) < 8) continue;
      sbox(B, M.dark, x, x + 0.5 + rr() * 0.8, y1 - h, y1, Math.min(zf + dir * 0.45, zf - dir * 0.4), Math.max(zf + dir * 0.45, zf - dir * 0.4), 2);
    }
  };
  wallFace(8, -1); wallFace(-64, 1);
  // hoodoos / pillars standing on the canyon floor, with cap stones
  for (let k = 0; k < 30; k++) {
    const x = (rr() - 0.5) * 300, z = -8 - rr() * 46, h = 24 + rr() * 52, w = 2.5 + rr() * 4;
    if (Math.abs(x) < 12) continue;
    sbox(B, M.wall[4], x - w / 2, x + w / 2, -88, -88 + h, z - w * 0.45, z + w * 0.45, 20, rr() * 3, rr() * 3);
    sbox(B, M.wall[3], x - w * 0.78, x + w * 0.78, -88 + h, -88 + h + 2.2, z - w * 0.65, z + w * 0.65, 3);
  }
  // far desert: stepped strata mesas on the horizon, hazed by fog
  for (let k = 0; k < 40; k++) {
    const w = 60 + rr() * 140, x = -520 + rr() * 1040, z = -170 - rr() * 380, h = 6 + rr() * 22, mm = M.wall[k % 3];
    sbox(B, mm, x - w / 2, x + w / 2, 0, h, z - 24, z + 24, 22, rr() * 3, 0);
    sbox(B, mm, x - w * 0.35, x + w * 0.35, h, h * 1.6, z - 16, z + 16, 22, rr() * 3, 0);
    sbox(B, mm, x - w * 0.15, x + w * 0.15, h * 1.6, h * 2.0, z - 10, z + 10, 22, rr() * 3, 0);
  }
  // near-side side mesas on both horizons behind the near cliff (visible from the bridges looking sideways)
  // desert rocks and cactus near the tracks (Kenney Nature kit, warm)
  const rocks = ["rock_largeA", "rock_largeB", "rock_smallA", "rock_smallB", "rock_tallA", "rock_tallB", "stone_largeA", "stone_smallA"];
  for (let k = 0; k < 110; k++) {
    const x = (rr() - 0.5) * 90, z = 12 + rr() * 85;
    if (Math.abs(x - RX) < 3 || Math.abs(x - LX) < 3) continue;
    place(B, kit, rocks[Math.floor(rr() * rocks.length)], x, 0, z, 0.45 + rr() * 1.4, rr() * 6.3);
  }
  for (let k = 0; k < 14; k++) {
    const x = (rr() - 0.5) * 60, z = 14 + rr() * 70;
    if (Math.abs(x - RX) < 3.6 || Math.abs(x - LX) < 3.6 || Math.abs(x - 6.9) < 1.2) continue;
    place(B, kit, rr() > 0.5 ? "cactus_tall" : "cactus_short", x, 0, z, 1.3 + rr() * 0.9, rr() * 6);
  }
  for (let k = 0; k < 40; k++) { // beyond the far cliff, lone rocks
    const x = (rr() - 0.5) * 90, z = -70 - rr() * 100;
    if (Math.abs(x - RX) < 3 || Math.abs(x - LX) < 3) continue;
    place(B, kit, rocks[Math.floor(rr() * rocks.length)], x, 0, z, 0.6 + rr() * 1.6, rr() * 6.3);
  }
  B.build(R, true);
};

// ---------------- the two steel truss bridges ----------------
export const buildBridges = (R: THREE.Object3D, M: Mats) => {
  for (const [x, steel] of [[RX, M.rustS], [LX, M.blueS]] as [number, THREE.Material][]) {
    const B = new Batch(), z0 = 8.5, z1 = -64.5, zc = (z0 + z1) / 2, len = z0 - z1;
    sbox(B, M.deck, x - 1.8, x + 1.8, -0.5, -0.02, z1, z0, 3.6);                    // plank deck, top flush with y = 0
    for (const sx of [-1.75, 1.75]) {
      bx(B, steel, 0.22, 0.22, len, x + sx, 3.4, zc, 0, 0, 0); bx(B, steel, 0.24, 0.34, len, x + sx, 0.0, zc, 0, 0, 0);
      let i = 0;
      for (let z = 7; z >= -63; z -= 3.5, i++) {
        bx(B, steel, 0.16, 3.3, 0.16, x + sx, 1.7, z, 0, 0, 0);
        bx(B, steel, 0.11, 4.4, 0.11, x + sx, 1.7, z - 1.75, (i % 2 ? 1 : -1) * 0.66, 0, 0);
      }
    }
    for (let z = 7; z >= -63; z -= 7) { bx(B, steel, 3.6, 0.18, 0.18, x, 3.4, z, 0, 0, 0); bx(B, steel, 3.6, 0.2, 0.2, x, -0.3, z, 0, 0, 0); }
    // arch beneath the deck (springs from both walls), with spandrel posts: gives the bridge its silhouette from above/the side
    const arch = (z: number) => -26 + 25 * (1 - ((z - zc) / (len / 2)) ** 2);
    for (const sx of [-1.75, 1.75]) {
      const N = 28;
      for (let n = 0; n < N; n++) {
        const za = z0 - (n / N) * len, zb = z0 - ((n + 1) / N) * len, ya = arch(za), yb = arch(zb), l = Math.hypot(za - zb, ya - yb);
        bx(B, steel, 0.45, 0.45, l + 0.05, x + sx, (ya + yb) / 2, (za + zb) / 2, Math.atan2(yb - ya, za - zb) * -1 + 0, 0, 0);
      }
      for (let z = 7; z >= -63; z -= 3.5) { const ya = arch(z); if (ya < -0.8) bx(B, steel, 0.14, -0.3 - ya, 0.14, x + sx, (ya - 0.3) / 2, z, 0, 0, 0); }
    }
    for (let z = 4; z >= -60; z -= 6) { const ya = arch(z); bx(B, steel, 3.5, 0.2, 0.2, x, ya, z, 0, 0, 0); }
    // lattice pier towers down into the haze
    for (const pz of [-18, -46]) {
      for (const sx of [-1.4, 1.4]) bx(B, steel, 0.55, 86, 0.55, x + sx, -43, pz, 0, 0, 0);
      for (let y = -6; y > -84; y -= 11) {
        bx(B, steel, 2.8, 0.22, 0.22, x, y, pz, 0, 0, 0); bx(B, steel, 0.22, 0.22, 2.0, x - 1.4, y - 5.5, pz, 0, 0, 0);
        bx(B, steel, 0.16, 0.16, 2.4, x, y - 5.5, pz, 0, 0, 0);
        bx(B, steel, 3.2, 0.16, 0.16, x, y - 5.5, pz, 0, 0, 0.0);
        bx(B, steel, 3.2, 0.16, 0.16, x, y - 5.5, pz, 0, 0, 0.86); bx(B, steel, 3.2, 0.16, 0.16, x, y - 5.5, pz, 0, 0, -0.86);
      }
    }
    B.build(R, true);
  }
};

// ---------------- set dressing (a1 layout, improved) ----------------
export const buildDressing = (R: THREE.Object3D, M: Mats, kit: Kit) => {
  const B = new Batch(), LB = new THREE.Group(); R.add(LB);
  const dark = M.dark, wood = M.wood, rope = tm({ color: "#d8c8a8" });
  // fence along the cliff edge (z 9.2), x -14..14 but leaving the two track gaps
  for (let x = -14; x <= 14; x += 2) { if (Math.abs(x - RX) < 1.7 || Math.abs(x - LX) < 1.7) continue; bx(B, wood, 0.12, 1.1, 0.12, x, 0.55, 9.2); }
  for (const yy of [0.5, 0.95]) for (const [xa, xb] of [[-14, LX - 1.6], [LX + 1.6, RX - 1.6], [RX + 1.6, 14]]) bx(B, rope, xb - xa, 0.07, 0.07, (xa + xb) / 2, yy, 9.2);
  // lamp post + bunting to a signal pole across the right track
  const lampX = 1.2, lampZ = 15;
  cyl(B, dark, 0.07, 0.1, 4.2, lampX, 2.1, lampZ, 0, 0, 8); bx(B, dark, 0.5, 0.06, 0.5, lampX, 4.2, lampZ);
  cyl(B, dark, 0.06, 0.06, 4.0, 9.2, 2.0, lampZ, 0, 0, 8);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 0.8), fog: true }));
  lamp.position.set(lampX, 4.5, lampZ); LB.add(lamp);
  B.add(new THREE.ConeGeometry(0.42, 0.35, 4).rotateY(Math.PI / 4), dark, MX(lampX, 4.9, lampZ));
  bx(B, dark, 8, 0.03, 0.03, (lampX + 9.2) / 2, 3.95, lampZ);
  const cols = ["#d8402a", "#f0c030", "#2a8ad8", "#3aa860"]; let fi = 0;
  for (let t = 0.06; t < 0.97; t += 0.11) {
    const fx = lampX + (9.2 - lampX) * t, fy = 3.9 - 0.45 * Math.sin(t * Math.PI), tg = new THREE.ConeGeometry(0.22, 0.45, 3); tg.rotateZ(Math.PI);
    B.add(tg, tm({ color: cols[fi++ % 4] }), MX(fx, fy - 0.2, lampZ));
  }
  // barrels, crates, sleeper stack, company sign, signal flag
  for (let k = 0; k < 3; k++) { cyl(B, wood, 0.4, 0.4, 0.8, 8.2 + k * 0.85, 0.4, 24.4, 0, 0, 14); cyl(B, dark, 0.415, 0.415, 0.06, 8.2 + k * 0.85, 0.22, 24.4, 0, 0, 14); cyl(B, dark, 0.415, 0.415, 0.06, 8.2 + k * 0.85, 0.6, 24.4, 0, 0, 14); }
  for (let k = 0; k < 4; k++) sbox(B, tm({ map: crateTex(k % 3) }), 7.4 + (k % 2) * 0.95 - 0.45, 7.4 + (k % 2) * 0.95 + 0.45, Math.floor(k / 2) * 0.9, Math.floor(k / 2) * 0.9 + 0.9, 26.8 - (k % 3) * 0.2 - 0.45, 26.8 - (k % 3) * 0.2 + 0.45, 0.9);
  for (let k = 0; k < 6; k++) bx(B, wood, 2.6, 0.14, 0.24, 7.9, 0.07 + k * 0.15, 19.5);
  bx(B, wood, 0.12, 2.1, 0.12, 8.6, 1.05, 30);
  const sg = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 0.08), [wood, wood, wood, wood, new THREE.MeshBasicMaterial({ map: signTex() }), new THREE.MeshBasicMaterial({ map: signTex() })] as never);
  sg.position.set(8.6, 1.9, 29.93); LB.add(sg);
  bx(B, wood, 0.1, 2.6, 0.1, 2.2, 1.3, 27); bx(B, tm({ color: "#c8281e" }), 0.9, 0.55, 0.04, 2.62, 2.35, 27);
  // the work beam jutting over the canyon with a brace down to the wall
  bx(B, wood, 0.55, 0.45, 14, 0.4, -0.3, 2); bx(B, wood, 0.4, 0.4, 7, 0.4, -3.6, 5.2, 0.62, 0, 0); bx(B, wood, 0.12, 1.0, 0.12, 0.0, 0.3, -4.6); bx(B, tm({ color: "#6a4a2e" }), 0.8, 0.5, 0.5, 1.0, -0.05, 6.2);
  B.build(R, true);
};

// ---------------- Kenney track: ties + rails per tile; the right track gaps, the left one buckles ----------------
const HEAT = ["#8d9199", "#7a46c8", "#e0589a", "#ff9b3d", "#ffe27a"].map((c) => new THREE.Color(c));
const tmp = new THREE.Color();
export const heatSet = (m: THREE.MeshLambertMaterial, h: number, base: THREE.Color) => {
  const k = Math.max(0, Math.min(0.9999, h)) * (HEAT.length - 1), i = Math.floor(k);
  tmp.copy(HEAT[i]).lerp(HEAT[i + 1], k - i);
  m.color.copy(base).lerp(tmp, Math.min(1, h * 1.6));
  m.emissive.copy(tmp).multiplyScalar(h > 0.02 ? (0.35 + 1.3 * Math.min(1, h * 1.2)) * Math.min(1, h * 2) : 0);
};
type Tile = { rail: THREE.Mesh; tie: THREE.Mesh; zc: number; rb: Float32Array; tb: Float32Array };
const splitTile = (kit: Kit) => {
  let mesh: THREE.Mesh | null = null;
  kit["railroad-straight"]?.traverse((c) => { if ((c as THREE.Mesh).isMesh && !mesh) mesh = c as THREE.Mesh; });
  if (!mesh) return null;
  const g = (mesh as THREE.Mesh).geometry.toNonIndexed(), p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
  const rp: number[] = [], rn: number[] = [], ru: number[] = [], tp: number[] = [], tn: number[] = [], tu: number[] = [];
  for (let i = 0; i < p.count; i += 3) {
    let rail = true;
    for (let k = 0; k < 3; k++) { const ax = Math.abs(p.getX(i + k)); if (ax < 0.249 || ax > 0.351) rail = false; }
    for (let k = 0; k < 3; k++) {
      const P = rail ? rp : tp, N = rail ? rn : tn, UU = rail ? ru : tu;
      const px = p.getX(i + k), cx = Math.sign(px) * 0.3; P.push((rail ? cx + (px - cx) * 0.55 : px) * TS, p.getY(i + k) * TS, p.getZ(i + k) * TS); N.push(n.getX(i + k), n.getY(i + k), n.getZ(i + k)); UU.push(u.getX(i + k), u.getY(i + k));
    }
  }
  const mk = (a: number[], b: number[], c: number[]) => { const x = new THREE.BufferGeometry(); x.setAttribute("position", new THREE.Float32BufferAttribute(a, 3)); x.setAttribute("normal", new THREE.Float32BufferAttribute(b, 3)); x.setAttribute("uv", new THREE.Float32BufferAttribute(c, 2)); return x; };
  const map = ((Array.isArray((mesh as THREE.Mesh).material) ? (mesh as THREE.Mesh).material[0] : (mesh as THREE.Mesh).material) as THREE.MeshStandardMaterial).map ?? null;
  return { rail: mk(rp, rn, ru), tie: mk(tp, tn, tu), map };
};
export const buckleDx = (z: number, A: number) => { const u = (z + 40) / 28; return u > 0 && u < 1 ? A * Math.sin(TAU * u) * Math.sin(Math.PI * u) : 0; };
export class Track {
  group = new THREE.Group(); tiles: Tile[] = []; railMat: THREE.MeshLambertMaterial; base = new THREE.Color("#c9ced6"); private last = NaN;
  constructor(kit: Kit, public x: number, private gaps: boolean, private buckles: boolean) {
    const s = splitTile(kit)!;
    this.railMat = tm({ map: s.map, color: "#c9ced6" });
    const tieMat = tm({ map: s.map, color: "#ffffff" });
    for (let zs = JZ - TL * 15; zs < JZ + TL * 6; zs += TL) {
      const mk = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
        const gg = geo.clone(), p = gg.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + zs);
        const m = new THREE.Mesh(gg, mat); m.position.x = x; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.group.add(m); return m;
      };
      const rail = mk(s.rail, this.railMat), tie = mk(s.tie, tieMat);
      this.tiles.push({ rail, tie, zc: zs + TL / 2, rb: Float32Array.from((rail.geometry.attributes.position as THREE.BufferAttribute).array), tb: Float32Array.from((tie.geometry.attributes.position as THREE.BufferAttribute).array) });
    }
  }
  /** gap: every rail joint opens by this much (m); heat 0..1; buckle 0..1 (S-bend of the whole track) */
  set(gap: number, heat: number, buckle: number) {
    heatSet(this.railMat, heat, this.base);
    const key = gap * 1000 + buckle * 7919;
    if (key === this.last) return; this.last = key;
    for (const t of this.tiles) {
      if (this.gaps) { const s = (TL - gap) / TL; t.rail.scale.z = s; t.rail.position.z = t.zc * (1 - s); }
      if (this.buckles) {
        const A = 1.5 * buckle, near = t.zc < 0 && t.zc > -70;
        if (!near && t.rail.userData.bent === undefined) continue;
        for (const [m, b] of [[t.rail, t.rb], [t.tie, t.tb]] as [THREE.Mesh, Float32Array][]) {
          const p = m.geometry.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < p.count; i++) {
            const lx = b[i * 3], z = b[i * 3 + 2], dx = buckleDx(z, A), sl = (buckleDx(z - 0.25, A) - buckleDx(z + 0.25, A)) / 0.5, th = Math.atan(sl), c = Math.cos(th), s2 = Math.sin(th);
            p.setX(i, dx + lx * c); p.setZ(i, z - lx * s2);
          }
          p.needsUpdate = true;
        }
        t.rail.userData.bent = true;
      }
    }
  }
}
export const gravelBeds = (R: THREE.Object3D, M: Mats) => {
  const B = new Batch();
  for (const x of [RX, LX]) for (const [za, zb] of [[120, 8], [-64, -150]]) {
    const hw0 = 2.2, hw1 = 1.6, h = 0.09, a = V, zH = za, zL = zb;
    B.add(quad(a(x - hw1, h, zH), a(x + hw1, h, zH), a(x + hw1, h, zL), a(x - hw1, h, zL), (hw1 * 2) / 1.6, Math.abs(zH - zL) / 1.6), M.gravel);
    B.add(quad(a(x + hw1, h, zH), a(x + hw0, 0, zH), a(x + hw0, 0, zL), a(x + hw1, h, zL), 0.5, Math.abs(zH - zL) / 1.6), M.gravel);
    B.add(quad(a(x - hw0, 0, zH), a(x - hw1, h, zH), a(x - hw1, h, zL), a(x - hw0, 0, zL), 0.5, Math.abs(zH - zL) / 1.6), M.gravel);
  }
  B.build(R, false);
};

// ---------------- trains ----------------
const SX = 1.5, SY = 2.1;
export type Consist = { name: string; len: number }[];
export const buildTrain = (kit: Kit, M: Mats, cars: string[]) => {
  const g = new THREE.Group(), B = new Batch();
  const Lq = 2.75 * SY, add = (nm: string, z: number) => { const o = kit[nm]; if (o) addKit(B, o, MX(0, TOPY + 0.36 * SY, z, Math.PI, SX, SY, SY)); };
  add("train-locomotive-a", 0);
  // steam detail on the Kenney engine: flared stack, brass dome + bell, boiler bands, headlamp, cowcatcher, side rods
  const black = tm({ color: "#26242a" }), brass = M.brass, red = tm({ color: "#b8282b" });
  const y0 = TOPY + 0.36 * SY;
  B.add(new THREE.CylinderGeometry(0.62, 0.34, 0.95, 14), black, MX(0, y0 + 1.66 * SY + 0.25, -1.75));
  B.add(new THREE.SphereGeometry(0.42, 10, 8), brass, MX(0, y0 + 1.55 * SY, -0.55));
  B.add(new THREE.CylinderGeometry(0.2, 0.26, 0.3, 10), brass, MX(0, y0 + 1.55 * SY + 0.35, -0.55));
  for (const z of [-0.9, 0.2]) B.add(new THREE.CylinderGeometry(0.84, 0.84, 0.1, 14).rotateX(Math.PI / 2), brass, MX(0, y0 + 0.96 * SY, z));
  B.add(new THREE.ConeGeometry(0.95, 1.5, 4).rotateX(-Math.PI / 2), black, MX(0, TOPY + 0.55, -3.35, Math.PI / 4));
  for (const sx of [-1, 1]) { B.add(new THREE.BoxGeometry(0.06, 0.1, 3.1), red, MX(sx * 0.86, TOPY + 0.78, -0.6)); }
  cars.forEach((c, i) => add(c, Lq + 0.45 + i * (Lq + 0.45)));
  B.build(g, true);
  const lampM = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 14).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.5, 1.3), fog: true }));
  lampM.position.set(0, y0 + 1.05 * SY, -2.85); g.add(lampM);
  return g;
};

// ---------------- office interior (a1 ASSETS.OFFICE, warmer and richer) ----------------
export const buildOffice = (R: THREE.Object3D, M: Mats) => {
  const g = new THREE.Group(); R.add(g);
  const B = new Batch(), B2 = new Batch();
  const wall = tm({ map: officeWall() }), floor = tm({ map: officePlank() }), wood = tm({ map: woodTex(), color: "#b88a60" }), dkw = tm({ color: "#5a3a26" });
  const red = tm({ color: "#8e2a2a" }), gold = M.brass;
  sbox(B, floor, -6, 6, -0.4, 0, -7, 4, 3);                                  // floor
  sbox(B, red, -3, 3, 0, 0.05, -5, -0.4, 2);                                  // rug
  sbox(B2, wall, -6, 6, 0, 6.5, -7.3, -7, 3);                                 // back wall
  sbox(B, dkw, -6, 6, 0, 1.2, -7, -6.88, 3);                                  // wainscot
  sbox(B2, wall, -6.3, -6, 0, 6.5, -7.3, 4, 3); sbox(B2, wall, 6, 6.3, 0, 6.5, -7.3, 4, 3);    // side walls
  sbox(B2, dkw, -6, 6, 6.2, 6.5, -7, 4, 3, 0, 0, true);                       // ceiling planks
  for (let z = -6; z < 4; z += 2.5) sbox(B2, dkw, -6, 6, 5.7, 6.2, z, z + 0.4, 1);  // ceiling beams
  // desk
  sbox(B, wood, -1.5, 1.5, 1.15, 1.25, -3.75, -2.25, 1); sbox(B, wood, -1.5, -1.4, 0, 1.15, -3.7, -2.3, 1); sbox(B, wood, 1.4, 1.5, 0, 1.15, -3.7, -2.3, 1); sbox(B, dkw, -1.4, 1.4, 0.15, 1.15, -3.72, -3.62, 1);
  // bookshelf, cabinet, plant, door, painting, certificate, map, calendar
  sbox(B, wood, -5, -3, 0, 4, -7, -6.2, 1);
  [0.5, 1.3, 2.1, 2.9, 3.7].forEach((y, i) => { sbox(B, dkw, -4.95, -3.05, y, y + 0.05, -6.95, -6.25, 1); for (let k = 0; k < 5; k++) sbox(B, tm({ color: ["#2a4a6a", "#8a2a2a", "#3a6a4a", "#c9a02a", "#5a3a6a"][(i + k) % 5] }), -4.8 + k * 0.35, -4.58 + k * 0.35, y + 0.05, y + 0.7 - (k % 2) * 0.1, -6.9, -6.4, 0.5); });
  sbox(B, tm({ color: "#4a6a8a" }), 3.5, 4.5, 0, 2, -7, -6.1, 1); for (const y of [0.3, 0.9, 1.5]) sbox(B, tm({ color: "#2a4a6a" }), 3.6, 4.4, y, y + 0.35, -6.12, -6.05, 0.5);
  sbox(B, tm({ color: "#8a5a3a" }), -4.3, -3.7, 0, 0.45, -2.3, -1.7, 1); B.add(new THREE.DodecahedronGeometry(0.6, 1), tm({ color: "#4a8a3a" }), MX(-4, 1.0, -2));
  sbox(B, dkw, -3.75, -2.25, 0, 3, -7, -6.88, 1); sbox(B, tm({ color: "#e8d8b0" }), -3.5, -2.5, 0, 2.8, -6.88, -6.84, 1);
  sbox(B, dkw, 2.4, 3.6, 2.4, 3.6, -7, -6.9, 1); sbox(B, tm({ color: "#4f7a58" }), 2.5, 3.5, 2.5, 3.5, -6.9, -6.86, 1);
  sbox(B, dkw, -2.0, -1.0, 4.1, 4.9, -7, -6.9, 1); sbox(B, tm({ color: "#f2e8cc" }), -1.92, -1.08, 4.18, 4.82, -6.9, -6.86, 1);
  // armchair + side table (reads as the boss's office)
  sbox(B, red, 2.0, 3.6, 0, 0.7, -5.9, -4.6, 1); sbox(B, red, 2.0, 3.6, 0.7, 2.4, -5.9, -5.6, 1); sbox(B, red, 2.0, 2.25, 0.7, 1.5, -5.9, -4.6, 1); sbox(B, red, 3.35, 3.6, 0.7, 1.5, -5.9, -4.6, 1);
  const mapM = new THREE.MeshBasicMaterial({ map: ctex("officeMap", 256, 256, (c) => { c.fillStyle = "#e6d4aa"; c.fillRect(0, 0, 256, 256); c.strokeStyle = "#503020"; c.lineWidth = 5; c.beginPath(); c.moveTo(20, 40); c.lineTo(110, 120); c.lineTo(160, 130); c.lineTo(236, 220); c.stroke(); c.fillStyle = "#a83030"; for (const [x, y] of [[20, 40], [110, 120], [236, 220]]) { c.beginPath(); c.arc(x, y, 10, 0, 7); c.fill(); } }) });
  const map = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2, 3), mapM); map.position.set(-5.95, 3, -3); g.add(map);
  // window on the right wall: warm sky colour, frame, mullions
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 3.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.5, 0.9), fog: false })); win.position.set(5.9, 3.1, -2); g.add(win);
  sbox(B, dkw, 5.8, 5.95, 1.7, 1.85, -3.7, -0.3, 1); sbox(B, dkw, 5.8, 5.95, 4.35, 4.5, -3.7, -0.3, 1); sbox(B, dkw, 5.8, 5.95, 1.7, 4.5, -2.08, -1.92, 1); sbox(B, dkw, 5.8, 5.95, 1.7, 4.5, -3.7, -3.55, 1); sbox(B, dkw, 5.8, 5.95, 1.7, 4.5, -0.45, -0.3, 1);
  // desk lamp (green shade, glowing), brass hanging lamps
  B.add(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12), dkw, MX(1, 1.28, -3.2)); B.add(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8), dkw, MX(0.9, 1.5, -3.2, 0, 1, 1, 1, 0.3));
  B.add(new THREE.CylinderGeometry(0.15, 0.3, 0.25, 12, 1, true), tm({ color: "#2a6a4a", side: THREE.DoubleSide }), MX(0.8, 1.85, -3.2, 0, 1, 1, 1, -0.4));
  for (const x of [-2.6, 2.6]) { cyl(B, gold, 0.02, 0.02, 1.2, x, 5.5, -2.5, 0, 0, 6); const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.0, 1.0), fog: false })); l.position.set(x, 4.75, -2.5); g.add(l); }
  B.build(g, true); B2.build(g, false);
  return g;
};

export const handsaw = () => {
  const g = new THREE.Group(), m = tm({ color: "#d4d8de" }), h = tm({ color: "#8a5a38" });
  const a = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 0.025), m), c = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.06), h); c.position.x = 0.3; g.add(a, c);
  for (let i = 0; i < 14; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.03, 0.03), m); t.position.set(-0.23 + i * 0.035, -0.075, 0); g.add(t); }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; }); return g;
};
export const coin = () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 20).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.35, 0.3) }))); return g; };
export const paper = () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.012), new THREE.MeshBasicMaterial({ color: "#fff6e8" }))); return g; };
export const newspaper = () => {
  const tx = ctex("newsW", 256, 360, (c) => {
    c.fillStyle = "#efe4c8"; c.fillRect(0, 0, 256, 360); c.fillStyle = "#1e1a16"; c.font = "bold 24px serif"; c.textAlign = "center";
    c.fillText("THE CLICKETY", 128, 40); c.fillText("CLACK LINE!", 128, 68); c.fillRect(14, 78, 228, 3); c.strokeStyle = "#1e1a16"; c.lineWidth = 3; c.strokeRect(34, 96, 188, 100);
    c.fillRect(54, 150, 110, 26); c.fillRect(120, 124, 30, 28);
    for (let y = 214; y < 340; y += 14) { c.fillRect(18, y, 100, 6); c.fillRect(138, y, 100, 6); }
  });
  return new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 0.03), new THREE.MeshBasicMaterial({ map: tx }));
};
