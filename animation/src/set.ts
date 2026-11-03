// Set dressing made by code (no AI, no files): sky bodies, stars, rooms and the small props inside them.
// Everything is a pure function of time, like the rest of the engine, so any frame can be rendered alone.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { twoTone } from "../reference/shade";
import { NOINK } from "../reference/ink";
import type { Body, Room, Prop } from "./scene";

const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const canvas = (w: number, h = w) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const INK = "#241726";

/** a flat picture that always faces the camera (planets, sun) */
export type SkyBody = { mesh: THREE.Mesh; dir: THREE.Vector3; dist: number };

function drawEarth(g: CanvasRenderingContext2D, S: number, seed: number) {
  const r = S * 0.46, c = S / 2, rand = rng(seed);
  g.fillStyle = "#2a62c9"; g.beginPath(); g.arc(c, c, r, 0, 7); g.fill();
  g.save(); g.beginPath(); g.arc(c, c, r, 0, 7); g.clip();
  g.fillStyle = "#4aa356";
  for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(c + (rand() - 0.5) * r * 1.2, c + (rand() - 0.5) * r * 1.2, r * (0.12 + rand() * 0.25), r * (0.08 + rand() * 0.18), rand() * 3, 0, 7); g.fill(); }
  g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = r * 0.07; g.lineCap = "round";
  for (let i = 0; i < 6; i++) { g.beginPath(); const x = c + (rand() - 0.5) * r * 1.4, y = c + (rand() - 0.5) * r * 1.4; g.moveTo(x, y); g.quadraticCurveTo(x + r * 0.25, y - r * 0.1, x + r * 0.5, y + r * 0.05); g.stroke(); }
  const sh = g.createRadialGradient(c - r * 0.35, c - r * 0.35, r * 0.2, c, c, r); sh.addColorStop(0, "rgba(255,255,255,0.18)"); sh.addColorStop(0.7, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(5,10,40,0.55)");
  g.fillStyle = sh; g.fillRect(0, 0, S, S); g.restore();
  g.strokeStyle = "rgba(140,200,255,0.9)"; g.lineWidth = S * 0.018; g.beginPath(); g.arc(c, c, r + S * 0.01, 0, 7); g.stroke();
  g.strokeStyle = INK; g.lineWidth = S * 0.012; g.beginPath(); g.arc(c, c, r, 0, 7); g.stroke();
}
function drawSun(g: CanvasRenderingContext2D, S: number) {
  const c = S / 2, gr = g.createRadialGradient(c, c, S * 0.05, c, c, S * 0.5);
  gr.addColorStop(0, "rgba(255,255,230,1)"); gr.addColorStop(0.25, "rgba(255,236,120,1)"); gr.addColorStop(0.32, "rgba(255,200,60,0.45)"); gr.addColorStop(1, "rgba(255,180,40,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g.strokeStyle = "rgba(255,240,170,0.8)"; g.lineWidth = S * 0.012;
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; g.beginPath(); g.moveTo(c + Math.cos(a) * S * 0.2, c + Math.sin(a) * S * 0.2); g.lineTo(c + Math.cos(a) * S * 0.42, c + Math.sin(a) * S * 0.42); g.stroke(); }
}
function drawPlanet(g: CanvasRenderingContext2D, S: number, color: string, color2: string, ringed: boolean, moon: boolean, seed: number) {
  const r = S * (ringed ? 0.27 : 0.45), c = S / 2, rand = rng(seed);
  const ring = (front: boolean) => { g.save(); g.translate(c, c); g.rotate(-0.28); g.strokeStyle = color2; g.globalAlpha = 0.85;
    g.lineWidth = S * 0.05; g.beginPath(); g.ellipse(0, 0, S * 0.46, S * 0.11, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); g.stroke();
    g.lineWidth = S * 0.02; g.strokeStyle = INK; g.beginPath(); g.ellipse(0, 0, S * 0.485, S * 0.125, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); g.stroke(); g.restore(); };
  if (ringed) ring(false);
  g.fillStyle = color; g.beginPath(); g.arc(c, c, r, 0, 7); g.fill();
  g.save(); g.beginPath(); g.arc(c, c, r, 0, 7); g.clip();
  if (moon) { g.fillStyle = "rgba(0,0,0,0.13)"; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(c + (rand() - 0.5) * r * 1.5, c + (rand() - 0.5) * r * 1.5, r * (0.07 + rand() * 0.14), 0, 7); g.fill(); } }
  else { g.fillStyle = color2; g.globalAlpha = 0.5; for (let i = 0; i < 4; i++) g.fillRect(c - r, c - r * 0.7 + i * r * 0.42, r * 2, r * 0.17); g.globalAlpha = 1; }
  const sh = g.createRadialGradient(c - r * 0.4, c - r * 0.4, r * 0.15, c, c, r); sh.addColorStop(0, "rgba(255,255,255,0.2)"); sh.addColorStop(0.65, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(10,0,30,0.5)");
  g.fillStyle = sh; g.fillRect(0, 0, S, S); g.restore();
  g.strokeStyle = INK; g.lineWidth = S * 0.014; g.beginPath(); g.arc(c, c, r, 0, 7); g.stroke();
  if (ringed) ring(true);
}

export function makeBody(b: Body, seed: number): SkyBody {
  const S = 512, cv = canvas(S), g = cv.getContext("2d")!;
  if (b.kind === "earth") drawEarth(g, S, seed);
  else if (b.kind === "sun") drawSun(g, S);
  else drawPlanet(g, S, b.color ?? "#c58ad8", b.color2 ?? "#f1d6ff", b.kind === "ringed", b.kind === "moon", seed);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const dist = b.dist_m ?? 600, size = (b.kind === "sun" ? 2.2 : 1) * b.radius_m * 2 / (b.kind === "ringed" ? 0.54 : 0.92);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  mesh.layers.set(NOINK); mesh.renderOrder = -10; mesh.frustumCulled = false;
  return { mesh, dir: new THREE.Vector3(...b.dir).normalize(), dist };
}

export function makeStars(n: number, seed = 7): THREE.Points {
  const rand = rng(seed), pos: number[] = [], col: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = 800;
    pos.push(Math.cos(a) * s * r, u * r, Math.sin(a) * s * r);
    const w = 0.7 + rand() * 0.3, tint = rand();
    col.push(w, w, tint < 0.2 ? 1 : w);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.4, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, toneMapped: false }));
  pts.layers.set(NOINK); pts.renderOrder = -9; pts.frustumCulled = false;
  return pts;
}

const lam = (color: string, opacity?: number) => twoTone(new THREE.MeshLambertMaterial({ color, transparent: opacity !== undefined, opacity: opacity ?? 1, side: THREE.FrontSide }));

/** a closed room: floor, four walls and a ceiling, seen from inside */
export function buildRoom(r: Room): THREE.Group {
  const [w, h, d] = r.size, grp = new THREE.Group();
  const face = (color: string, geo: THREE.BufferGeometry, at: [number, number, number], rot: [number, number, number]) => {
    const m = new THREE.Mesh(geo, twoTone(new THREE.MeshLambertMaterial({ color, side: THREE.FrontSide })));
    m.position.set(...at); m.rotation.set(...rot); m.receiveShadow = true; grp.add(m); return m;
  };
  face(r.floor ?? "#59606e", new THREE.PlaneGeometry(w, d), [0, 0, 0], [-Math.PI / 2, 0, 0]);
  face(r.ceiling ?? "#aab0bd", new THREE.PlaneGeometry(w, d), [0, h, 0], [Math.PI / 2, 0, 0]);
  face(r.wall ?? "#d9dde6", new THREE.PlaneGeometry(w, h), [0, h / 2, -d / 2], [0, 0, 0]);
  face(r.wall ?? "#d9dde6", new THREE.PlaneGeometry(w, h), [0, h / 2, d / 2], [0, Math.PI, 0]);
  face(r.wall ?? "#d9dde6", new THREE.PlaneGeometry(d, h), [-w / 2, h / 2, 0], [0, Math.PI / 2, 0]);
  face(r.wall ?? "#d9dde6", new THREE.PlaneGeometry(d, h), [w / 2, h / 2, 0], [0, -Math.PI / 2, 0]);
  // a trim stripe along the walls
  const trim = r.trim ?? "#2f6fd6";
  for (const [gw, at, rot] of [[w, [0, 0.35, -d / 2 + 0.01], [0, 0, 0]], [w, [0, 0.35, d / 2 - 0.01], [0, Math.PI, 0]], [d, [-w / 2 + 0.01, 0.35, 0], [0, Math.PI / 2, 0]], [d, [w / 2 - 0.01, 0.35, 0], [0, -Math.PI / 2, 0]]] as [number, number[], number[]][])
    face(trim, new THREE.PlaneGeometry(gw, 0.14), at as [number, number, number], rot as [number, number, number]);
  return grp;
}

export type MadeProp = { root: THREE.Group; height: number; radius: number; update: (time: number) => void };

function viewPicture(g: CanvasRenderingContext2D, W: number, H: number, view: string, time: number) {
  const rand = rng(11);
  if (view === "space") {
    g.fillStyle = "#070a1c"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#fff"; for (let i = 0; i < 90; i++) { const s = 1 + rand() * 2.2; g.fillRect(rand() * W, rand() * H, s, s); }
  } else if (view === "planet") {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#5a3fa0"); gr.addColorStop(1, "#e9a0c8"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = "#f6e8ff"; g.beginPath(); g.arc(W * 0.7, H * 0.32, H * 0.2, 0, 7); g.fill();
    g.strokeStyle = "#ffd9f4"; g.lineWidth = H * 0.025; g.beginPath(); g.ellipse(W * 0.7, H * 0.32, H * 0.36, H * 0.07, -0.3, 0, 7); g.stroke();
    g.fillStyle = "#3b2a66"; g.beginPath(); g.moveTo(0, H); g.lineTo(W * 0.2, H * 0.7); g.lineTo(W * 0.38, H * 0.9); g.lineTo(W * 0.6, H * 0.65); g.lineTo(W, H); g.fill();
  } else if (view === "clouds") {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#5aa8ee"); gr.addColorStop(1, "#cfe8ff"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,255,255,0.95)"; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(((rand() * W) + time * 120) % W, rand() * H, H * (0.1 + rand() * 0.14), 0, 7); g.fill(); }
  } else {  // "sky" or "pad": a day sky with a green strip, and for "pad" the rocket on its tower far away
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#4f9ae6"); gr.addColorStop(1, "#d5ebff"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = "#6bb34f"; g.fillRect(0, H * 0.82, W, H * 0.18);
    if (view === "pad") { g.fillStyle = "#e8ecf2"; g.fillRect(W * 0.62, H * 0.3, W * 0.05, H * 0.52); g.beginPath(); g.moveTo(W * 0.62, H * 0.3); g.lineTo(W * 0.645, H * 0.18); g.lineTo(W * 0.67, H * 0.3); g.fill();
      g.fillStyle = "#e07a2d"; g.beginPath(); g.moveTo(W * 0.62, H * 0.3); g.lineTo(W * 0.645, H * 0.18); g.lineTo(W * 0.67, H * 0.3); g.fill(); g.strokeStyle = "#8a909c"; g.lineWidth = 3; g.strokeRect(W * 0.7, H * 0.28, W * 0.03, H * 0.54); }
  }
}

function screenDraw(g: CanvasRenderingContext2D, W: number, H: number, kind: string, time: number, p: Prop) {
  g.fillStyle = "#0a1b14"; g.fillRect(0, 0, W, H);
  if (kind === "radar") {
    const c = [W / 2, H / 2], R = Math.min(W, H) * 0.44;
    g.strokeStyle = "#39e08a"; g.lineWidth = 3; for (const k of [0.33, 0.66, 1]) { g.beginPath(); g.arc(c[0], c[1], R * k, 0, 7); g.stroke(); }
    g.beginPath(); g.moveTo(c[0] - R, c[1]); g.lineTo(c[0] + R, c[1]); g.moveTo(c[0], c[1] - R); g.lineTo(c[0], c[1] + R); g.stroke();
    const a = time * 2.6; g.strokeStyle = "rgba(120,255,170,0.9)"; g.lineWidth = 6; g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R); g.stroke();
    if (p.blip_at_s !== undefined && time >= p.blip_at_s) {
      const pulse = 0.6 + 0.4 * Math.sin((time - p.blip_at_s) * 9);
      g.fillStyle = `rgba(255,200,80,${pulse})`; g.beginPath(); g.arc(c[0] + R * 0.45, c[1] - R * 0.3, R * 0.11, 0, 7); g.fill();
      g.strokeStyle = "#ffd36a"; g.lineWidth = 4; g.beginPath(); g.ellipse(c[0] + R * 0.45, c[1] - R * 0.3, R * 0.2, R * 0.05, -0.3, 0, 7); g.stroke();
    }
  } else if (kind === "countdown") {
    const t = [...(p.text_at ?? [])].filter((e) => time >= e.at_s).pop();
    g.fillStyle = "#ff5a3c"; g.font = `bold ${Math.round(H * 0.5)}px monospace`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(t ? t.text : "T-00", W / 2, H / 2);
  } else if (kind === "warning") {
    const on = Math.floor(time * 4) % 2 === 0; g.fillStyle = on ? "#ff3b30" : "#5a1410"; g.fillRect(W * 0.1, H * 0.15, W * 0.8, H * 0.7);
    g.fillStyle = "#fff"; g.font = `bold ${Math.round(H * 0.4)}px monospace`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("!", W / 2, H / 2);
  } else {  // "panel": small bars that move
    for (let i = 0; i < 6; i++) { const v = 0.35 + 0.35 * Math.sin(time * (1.1 + i * 0.37) + i); g.fillStyle = i % 2 ? "#39e08a" : "#4aa8ff"; g.fillRect(W * 0.08 + i * W * 0.15, H * (0.9 - v * 0.8), W * 0.1, H * v * 0.8); }
  }
}

export function makeProp(p: Prop): MadeProp {
  const root = new THREE.Group(), s = p.size ?? [1, 1, 1];
  const box = (w: number, h: number, d: number, color: string, at: [number, number, number], rot?: [number, number, number], round = 0.03) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(round, w / 3, h / 3, d / 3)), lam(color)); m.position.set(...at);
    if (rot) m.rotation.set(...rot); m.castShadow = true; m.receiveShadow = true; root.add(m); return m;
  };
  let update = (_t: number) => {}, height = s[1], radius = Math.max(s[0], s[2]) / 2;

  const screenMesh = (w: number, h: number, at: [number, number, number], rot: [number, number, number], draw: (g: CanvasRenderingContext2D, W: number, H: number, t: number) => void) => {
    const cv = canvas(256, Math.round(256 * h / w)), g = cv.getContext("2d")!, tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false }));
    m.position.set(...at); m.rotation.set(...rot); m.layers.set(NOINK); root.add(m);
    const prev = update; update = (t) => { prev(t); draw(g, cv.width, cv.height, t); tex.needsUpdate = true; };
  };

  if (p.kind === "console") {
    const [w, h, d] = [s[0] || 1.3, s[1] || 0.95, s[2] || 0.7];
    box(w, h * 0.7, d, p.color ?? "#3a4252", [0, h * 0.35, 0]);
    box(w, 0.1, d * 0.8, "#4a5266", [0, h * 0.7 + 0.04, d * 0.05], [-0.45, 0, 0]);
    screenMesh(w * 0.8, d * 0.6, [0, h * 0.7 + 0.1, d * 0.05], [-0.45 - Math.PI / 2, 0, 0], (g, W, H, t) => screenDraw(g, W, H, p.screen ?? "panel", t, p));
    for (let i = 0; i < 4; i++) box(0.07, 0.03, 0.07, i % 2 ? "#d9342b" : "#f2a81d", [-w * 0.3 + i * 0.16, h * 0.7 + 0.08, d * 0.34], [-0.45, 0, 0], 0.01);
    height = h; radius = Math.max(w, d) / 2;
  } else if (p.kind === "seat") {
    box(0.55, 0.12, 0.55, "#4a4f5e", [0, 0.45, 0]);
    box(0.55, 0.78, 0.12, "#4a4f5e", [0, 0.85, -0.3], [-0.12, 0, 0]);
    box(0.3, 0.2, 0.1, "#f2a81d", [0, 1.28, -0.32], [-0.12, 0, 0]);
    box(0.08, 0.28, 0.4, "#3a3e4b", [0.32, 0.62, 0]); box(0.08, 0.28, 0.4, "#3a3e4b", [-0.32, 0.62, 0]);
    box(0.12, 0.42, 0.12, "#6c707b", [0, 0.21, 0]);
    height = 1.4; radius = 0.4;
  } else if (p.kind === "window") {
    const [w, h] = [s[0] || 1.6, s[1] || 1.0];
    screenMesh(w, h, [0, h / 2, 0.012], [0, 0, 0], (g, W, H, t) => viewPicture(g, W, H, p.view ?? "sky", t));
    box(w + 0.16, 0.08, 0.08, "#9aa0ad", [0, h + 0.04, 0.03]); box(w + 0.16, 0.08, 0.08, "#9aa0ad", [0, -0.04, 0.03]);
    box(0.08, h + 0.16, 0.08, "#9aa0ad", [-w / 2 - 0.04, h / 2, 0.03]); box(0.08, h + 0.16, 0.08, "#9aa0ad", [w / 2 + 0.04, h / 2, 0.03]);
    height = h; radius = w / 2;
  } else if (p.kind === "locker") {
    box(s[0] || 0.6, s[1] || 2.0, s[2] || 0.5, p.color ?? "#7d8798", [0, (s[1] || 2.0) / 2, 0]);
    box(0.04, 0.3, 0.03, "#2b2f3a", [0.18, 1.0, (s[2] || 0.5) / 2 + 0.01], undefined, 0.01);
    height = s[1] || 2.0; radius = 0.35;
  } else if (p.kind === "helmet") {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 16), lam("#bfe3ff", 0.45)); m.position.y = 0.27; root.add(m);
    box(0.4, 0.06, 0.4, "#9a9ea8", [0, 0.03, 0], undefined, 0.03);
    height = 0.55; radius = 0.3;
  } else if (p.kind === "cloud") {
    const rand = rng(31), sc = s[0] || 3;
    for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(sc * (0.32 + rand() * 0.28), 14, 10), lam("#fbfdff")); m.position.set((rand() - 0.5) * sc * 1.8, (rand() - 0.3) * sc * 0.5, (rand() - 0.5) * sc * 0.9); m.castShadow = false; root.add(m); }
    height = sc; radius = sc;
  } else {  // "panel": a flat wall panel with moving bars
    box(s[0] || 1.2, s[1] || 0.7, 0.06, "#2d3340", [0, (s[1] || 0.7) / 2, 0]);
    screenMesh((s[0] || 1.2) * 0.86, (s[1] || 0.7) * 0.8, [0, (s[1] || 0.7) / 2, 0.035], [0, 0, 0], (g, W, H, t) => screenDraw(g, W, H, p.screen ?? "panel", t, p));
    height = s[1] || 0.7; radius = (s[0] || 1.2) / 2;
  }
  return { root, height, radius, update };
}

// ---------------------------------------------------------------- landscape (made by code, any topic can use it)
/** a ring of distant low-poly mountains, two-tone shaded, so a flat plain has a horizon */
export function makeSkyline(o: { color: string; color2?: string; dist_m: number; count: number; min_m: number; max_m: number; seed?: number }): THREE.Group {
  const g = new THREE.Group(), rand = rng(o.seed ?? 3);
  for (let i = 0; i < o.count; i++) {
    const a = (i / o.count) * Math.PI * 2 + (rand() - 0.5) * 0.12, h = o.min_m + rand() * (o.max_m - o.min_m), w = h * (1.2 + rand() * 1.4);
    const geo = new THREE.ConeGeometry(w / 2, h, 5 + Math.floor(rand() * 3), 1); geo.translate(0, h / 2 - 0.5, 0);
    const col = new THREE.Color(o.color).lerp(new THREE.Color(o.color2 ?? o.color), rand());
    const m = new THREE.Mesh(geo, twoTone(new THREE.MeshLambertMaterial({ color: col })));
    const d = o.dist_m * (0.9 + rand() * 0.25); m.position.set(Math.sin(a) * d, 0, Math.cos(a) * d); m.rotation.y = rand() * 6; m.receiveShadow = false; g.add(m);
  }
  return g;
}

/** a glowing river: a ribbon laid on the ground along a path (XZ points) */
export function makeRiver(points: [number, number][], width: number, color: string): THREE.Mesh {
  const pos: number[] = [], idx: number[] = [];
  const P = points.map((p) => new THREE.Vector2(p[0], p[1])), N = 12 * (P.length - 1);
  const curve = new THREE.SplineCurve(P), pts = curve.getPoints(N);
  pts.forEach((p, i) => {
    const q = pts[Math.min(i + 1, pts.length - 1)], r = pts[Math.max(i - 1, 0)], t = new THREE.Vector2(q.x - r.x, q.y - r.y).normalize(), n = new THREE.Vector2(-t.y, t.x);
    const w = width * (0.85 + 0.25 * Math.sin(i * 0.7)) / 2;
    pos.push(p.x + n.x * w, 0.02, p.y + n.y * w, p.x - n.x * w, 0.02, p.y - n.y * w);
    if (i < pts.length - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, toneMapped: false, side: THREE.DoubleSide, fog: true }));
  m.layers.set(NOINK); m.renderOrder = 1; return m;
}

// ---------------------------------------------------------------- rocket parts (rules of the "rocket" type)
export type Hatch = { group: THREE.Group; door: THREE.Group };
/** a hatch in the side of a rocket: dark opening with an orange rim, and a white door that swings open about its hinge */
export function makeHatch(radius: number, height_m: number, azimuth_deg: number): Hatch {
  const group = new THREE.Group(), az = (azimuth_deg * Math.PI) / 180;
  group.position.set(Math.sin(az) * radius, height_m, Math.cos(az) * radius); group.rotation.y = az;
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 20).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#14131c", toneMapped: false }));
  hole.scale.set(0.75, 1.25, 1); hole.position.z = 0.02; hole.layers.set(NOINK); group.add(hole);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.045, 8, 24), lam("#e07a2d")); rim.scale.set(0.78, 1.28, 1); rim.position.z = 0.04; group.add(rim);
  const door = new THREE.Group(); door.position.set(-0.34, 0, 0.07); group.add(door);
  const panel = new THREE.Mesh(new RoundedBoxGeometry(0.7, 1.12, 0.07, 3, 0.03), lam("#eef0f5")); panel.position.set(0.34, 0, 0.0); panel.castShadow = true; door.add(panel);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), lam("#e07a2d")); knob.position.set(0.55, 0, 0.06); door.add(knob);
  return { group, door };
}
/** four landing legs that unfold from the body: unfold(0..1) */
export function makeLegs(height_m: number, bodyR: number): { group: THREE.Group; unfold: (k: number) => void } {
  const group = new THREE.Group(), H = height_m * 0.2, legs: THREE.Group[] = [];
  for (let i = 0; i < 4; i++) {
    const az = (i / 4) * Math.PI * 2 + Math.PI / 4, pivot = new THREE.Group(); pivot.position.set(Math.sin(az) * bodyR, H, Math.cos(az) * bodyR); pivot.rotation.y = az;
    const arm = new THREE.Group(); pivot.add(arm);
    const L = H / Math.cos(0.6);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, L, 8).translate(0, -L / 2, 0), lam("#7d818c")); strut.castShadow = true; arm.add(strut);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 14), lam("#4a4f5e")); pad.position.y = -L; arm.add(pad);
    group.add(pivot); legs.push(arm);
  }
  return { group, unfold: (k: number) => legs.forEach((a) => { a.rotation.x = 0.6 * k + 0.04; a.scale.y = 0.55 + 0.45 * k; }) };
}
