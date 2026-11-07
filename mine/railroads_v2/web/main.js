import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt } from './story.js';
import * as STORY from './story.js';
import { WORDS } from './words.js';
// OPTIONAL look controls (a story may export LOOK; without it nothing changes): { sat: colour strength multiplier (1 = off), vibr: lifts dull colours (0 = off),
//   drift: slow camera sway amount (0 = off), push: slow push-in amount per shot (0 = off) }
const LK = STORY.LOOK || {};

const W = 1080, H = 1920;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, 0.08, 1500);
const rx = (a) => a * Math.PI / 180;

// ---------- materials ----------
const grad = (() => { const d = new Uint8Array([90, 90, 90, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 2, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap: grad, ...opts });
const texM = (c, rx_ = 1, ry_ = 1, color = '#ffffff') => toon({ map: P.tex(c, rx_, ry_), color });
const M = {
  plank: texM(P.planks(1), 1, 6), beam: texM(P.beam(2), 1, 2), beamDark: texM(P.beam(3, [28, 36, 30]), 1, 2),
  rot: texM(P.rotten(4), 1, 1), rotB: texM(P.rotten(14), 1, 1),
  stone: texM(P.stone(4), 1, 1), stoneMoss: texM(P.mossy(P.stone(4), 5, 1.2), 1, 1),
  grass: texM(P.grass(6), 40, 40), dirt: texM(P.dirt(7), 6, 30), plaster: texM(P.plaster(8), 1, 1), plaster2: texM(P.plaster(18, 28), 1, 1),
  roof: texM(P.roof(9), 2, 2), marble: texM(P.marble(10), 1, 1), marbleTop: toon({ color: '#ece2cf' }),
  trunk: toon({ color: '#6a4a32' }), cypress: toon({ color: '#3f6b36' }), pine: toon({ color: '#5c8a3c' }), bush: toon({ color: '#6c9a42' }),
  hill: toon({ color: '#7aa64c' }), hillFar: toon({ color: '#86ad60' }), mount: toon({ color: '#8fa7b8' }), snow: toon({ color: '#f4f6fa' }),
  iron: toon({ color: '#5c5a57' }), bronze: toon({ color: '#b08a4a' }), wood: toon({ color: '#7a5434' }), door: toon({ color: '#5a3a24' }),
  window: toon({ color: '#2b2430' }), red: toon({ color: '#b8282b' }),
};
M.banner = new THREE.MeshToonMaterial({ gradientMap: grad, map: P.tex(P.banner()), alphaTest: 0.5, side: THREE.DoubleSide });
// helmet
const helmetIn = P.tex(P.helmetInside()); helmetIn.wrapS = helmetIn.wrapT = THREE.ClampToEdgeWrapping;
M.helmIn = new THREE.MeshToonMaterial({ gradientMap: grad, map: helmetIn, side: THREE.BackSide });
M.helmOut = toon({ color: '#8f8a7e' });

// ---------- ink / normal-depth contract ----------
const NOINK = 'noink'; // userData flag: never outlined (cards, fx, water handled specially)
const ndMat = new THREE.ShaderMaterial({
  vertexShader: `varying vec3 vN; varying float vD; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vN; varying float vD; void main(){ vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n; gl_FragColor = vec4(n*.5+.5, vD); }`,
  side: THREE.DoubleSide,
});
const cardNd = (map) => new THREE.ShaderMaterial({
  uniforms: { map: { value: map } },
  vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vD; void main(){ if(texture2D(map,vUv).a<.5) discard; gl_FragColor=vec4(0.,0.,0.,vD); }`,
  side: THREE.DoubleSide,
});
const waterNd = new THREE.ShaderMaterial({
  vertexShader: `varying float vD; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying float vD; void main(){ gl_FragColor=vec4(.5,1.,.5,vD); }`,
});

// ---------- helpers ----------
const add = (geo, mat, x = 0, y = 0, z = 0, parent = scene, opts = {}) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = opts.cast ?? true; m.receiveShadow = true; parent.add(m); return m;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const uvScale = (geo, su, sv) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return geo; };
/** box with world-scaled UVs per face (texel density 1 tile per `t` metres) */
const tbox = (w, h, d, t = 2) => {
  const g = box(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
  return g;
};

// ---------- sky ----------
const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunSize: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float sunSize; varying vec3 vP;
    void main(){ float h = clamp(vP.y,0.,1.); vec3 c = mix(hor, top, pow(h, .55)); if(vP.y<0.) c = hor;
      float s = dot(normalize(vP), normalize(sunDir)); c += sunCol * (smoothstep(1.-sunSize, 1.-sunSize*.6, s) + .35*pow(max(s,0.), 24.)*step(.001,sunSize));
      gl_FragColor = vec4(c,1.); }`,
}));
sky.userData.sky = true; scene.add(sky);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1); scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffffff', 2); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
scene.add(sun); scene.add(sun.target);
scene.fog = new THREE.Fog('#ffffff', 40, 600);

// ---------- shared world helpers (merged geometry keeps the ink pass correct) ----------
const mergeGeos = (list) => {
  const pos = [], nor = [], uvs = [], idx = []; let off = 0;
  for (const g0 of list) {
    const g = g0.index ? g0 : g0; const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uvs.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); o.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); o.setIndex(idx); return o;
};
const placed = (geo, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz)); const g = geo.clone(); g.applyMatrix4(m); return g; };
const canvasTex = (w, h, fn, rx = 1, ry = 1) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return P.tex(c, rx, ry); };
const rnd = P.rng(77);
const cloudsInit = () => {
  const cl = []; const r = P.rng(90);
  for (let i = 0; i < 14; i++) {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; const pen = new T.Pen(c.getContext('2d')); pen.ol = 0;
    pen.g.translate(300, 200); pen.g.scale(1.4, 1.2); pen.g.translate(-300, -200); T.fxCloud(pen, i + 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.667), new THREE.MeshBasicMaterial({ map: P.tex(c), transparent: true, fog: false, depthWrite: false }));
    const a = r() * Math.PI * 2, d = 650 + r() * 250; m.position.set(Math.cos(a) * d, 120 + r() * 160, Math.sin(a) * d); m.scale.setScalar(160 + r() * 140);
    m.userData.ndSkip = true; m.renderOrder = -1; scene.add(m); cl.push(m);
  }
  return cl;
};

// ---------- world ---------- (railroad polish: one continuous outdoor set + the office)
const DECK = 0;
const world = new THREE.Group(); scene.add(world);
const TAU = Math.PI * 2;

// ---- surface textures painted in code (sand grain, ballast gravel, rock strata, wood grain)
const spk = (base, cols, n, rmin, rmax, seed, edge) => canvasTex(512, 512, (g, w, h) => {
  const r = P.rng(seed); g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[Math.floor(r() * cols.length)]; g.beginPath();
    const rr = rmin + r() * (rmax - rmin); g.ellipse(r() * w, r() * h, rr, rr * (0.55 + r() * 0.5), r() * 3.14, 0, TAU); g.fill();
    if (edge) { g.strokeStyle = edge; g.lineWidth = 1.4; g.stroke(); }
  }
});
const sandTex = spk('#d6924f', ['#e6a966', '#c97f3f', '#bf7338', '#eeb97c', '#a85f30'], 2200, 1.5, 6, 11);
const gravelTex = spk('#7a6d66', ['#a99c90', '#8b6f66', '#c3ab97', '#5d534e', '#b9877b', '#98a0a8', '#d2c2b0'], 520, 8, 18, 12, '#352a26');
const strataTex = canvasTex(256, 512, (g, w, h) => {
  const r = P.rng(21), pal = ['#a8482a', '#c0643a', '#d98a4e', '#8f3d26', '#c97a45', '#7a3624', '#e0a060']; let y = 0;
  while (y < h) { const bh = 8 + r() * 44; g.fillStyle = pal[Math.floor(r() * pal.length)]; g.fillRect(0, y, w, bh); g.fillStyle = 'rgba(40,12,6,.35)'; g.fillRect(0, y, w, 2); y += bh; }
  for (let i = 0; i < 1500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,225,170,.20)' : 'rgba(50,16,8,.25)'; g.fillRect(r() * w, r() * h, 2 + r() * 16, 1 + r() * 2); }
});
const woodTex = canvasTex(256, 256, (g, w, h) => {
  const r = P.rng(31); g.fillStyle = '#6a4a2e'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { g.strokeStyle = r() < 0.5 ? 'rgba(30,16,8,.45)' : 'rgba(150,110,70,.35)'; g.lineWidth = 1 + r() * 2; const y = r() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + r() * 8 - 4, w * 0.6, y + r() * 8 - 4, w, y + r() * 6 - 3); g.stroke(); }
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(25,12,6,.5)'; g.beginPath(); g.ellipse(r() * w, r() * h, 4 + r() * 6, 2 + r() * 3, 0, 0, TAU); g.fill(); }
});
const MT = {
  sand: toon({ map: sandTex }), gravel: toon({ map: gravelTex }), strata: toon({ map: strataTex }), wood: toon({ map: woodTex }),
  deck: toon({ map: woodTex, color: '#b59a80' }),
  rust: toon({ color: '#8a4a2c' }), blueSteel: toon({ color: '#5f7488' }), dark: toon({ color: '#2b2230' }),
  cactus: toon({ color: '#5f8f4a' }), butte: toon({ color: '#a8482a' }), floor: toon({ color: '#4a2a4a' }),
  railBody: toon({ color: '#7f848c' }), plate: toon({ color: '#c9a16a' }), bolt: toon({ color: '#d8dce2' }),
  loco: toon({ color: '#2f3a3a' }), locoRed: toon({ color: '#b8282b' }), brass: toon({ color: '#d8a640' }), white: toon({ color: '#f4f0e6' }),
};
// rails that heat up: a head and a body material per track, colour set per frame (steel > purple > pink > orange > yellow-white)
const HEAT = ['#8d9199', '#7a46c8', '#e0589a', '#ff9b3d', '#ffe27a'].map((c) => new THREE.Color(c));
const heatCol = (h, out) => { const k = Math.max(0, Math.min(0.9999, h)) * (HEAT.length - 1), i = Math.floor(k); return out.copy(HEAT[i]).lerp(HEAT[i + 1], k - i); };
const mkRailMats = () => ({ head: new THREE.MeshToonMaterial({ gradientMap: grad, color: '#c6cbd3', emissive: '#000000' }), body: new THREE.MeshToonMaterial({ gradientMap: grad, color: '#7f848c', emissive: '#000000' }) });
const RAILS = { R: mkRailMats(), L: mkRailMats() };
const tmpC = new THREE.Color();
const setHeat = (set, h) => { heatCol(h, tmpC); set.head.color.set('#c6cbd3').lerp(tmpC, Math.min(1, h * 1.6)); set.head.emissive.copy(tmpC).multiplyScalar(h > 0.02 ? 0.55 * Math.min(1, h * 1.5) : 0); set.body.color.set('#7f848c').lerp(tmpC, Math.min(1, h * 1.3)); set.body.emissive.copy(tmpC).multiplyScalar(0.4 * Math.min(1, h * 1.4)); };

// rail section geometry (profile exaggerated a little so it reads in a vertical frame): base on y = 0, along z
const railParts = (len) => ({ flange: box(0.24, 0.05, len), web: new THREE.BoxGeometry(0.07, 0.2, len), head: box(0.13, 0.085, len) });
const railMesh = (set, len) => {
  const g = new THREE.Group(), p = railParts(len);
  add(p.flange, set.body, 0, 0.025, 0, g); add(p.web, set.body, 0, 0.15, 0, g); add(p.head, set.head, 0, 0.2925, 0, g);
  return g;
};
const GAUGE = 0.72, TOPY = 0.24, JOINT = 12, Z0 = 86, Z1 = -104;   // track runs from z=86 to z=-104, a rail joint every 12 m
const TRACK_X = { R: 4.5, L: -4.5 };

const buildOutdoor = () => {
  const g = new THREE.Group();
  // ground: near cliff top (z > 8), far cliff top (z < -64), canyon walls with painted strata, a dark floor far below
  add(tbox(500, 4, 90, 4), MT.sand, 0, -2, 53, g);                       // near ground
  add(tbox(500, 4, 80, 4), MT.sand, 0, -2, -104, g);                     // far ground
  add(tbox(500, 90, 3, 8), MT.strata, 0, -45, 8.5, g);                   // near cliff face (front = canyon side)
  add(tbox(500, 90, 3, 8), MT.strata, 0, -45, -64.5, g);                 // far cliff face
  add(box(500, 2, 80), MT.floor, 0, -88, -28, g);                        // canyon floor in the haze
  const rr = P.rng(5);
  for (let k = 0; k < 70; k++) {                                         // ledges and blocks on both cliff faces give the walls depth
    const w = 5 + rr() * 16, h = 1.5 + rr() * 4, d = 1.5 + rr() * 4.5, y = -2 - rr() * 70, x = -70 + rr() * 140, near = k % 2 === 0;
    add(tbox(w, h, d, 4), MT.strata, x, y, near ? 8 - d / 2 : -64 + d / 2, g);
  }
  // far desert: wide flat mesas with a stepped top, hazed by the fog
  for (let k = 0; k < 7; k++) { const w = 60 + rr() * 70, h = 8 + rr() * 16, x = -190 + k * 62 + rr() * 20, z = -135 - rr() * 30; add(box(w, h, 40), MT.butte, x, h / 2, z, g); add(box(w * 0.62, h * 0.45, 30), MT.butte, x + rr() * 8, h + h * 0.22, z, g); }
  // desert rocks and cactus near the track
  const rocks = [];
  for (let k = 0; k < 90; k++) { const s = 0.15 + rr() * 0.9, x = (rr() - 0.5) * 70, z = 12 + rr() * 60; if (Math.abs(x - 4.5) < 2.6 || Math.abs(x + 4.5) < 2.6) continue; rocks.push(placed(new THREE.DodecahedronGeometry(1, 0), x, s * 0.4, z, rr() * 3, s, s * 0.7, s * 1.1)); }
  add(mergeGeos(rocks), toon({ map: strataTex, color: '#e0c0a0' }), 0, 0, 0, g);
  for (let k = 0; k < 12; k++) {
    const x = (rr() - 0.5) * 50, z = 14 + rr() * 50; if (Math.abs(x - 4.5) < 3.2 || Math.abs(x + 4.5) < 3.2) continue;
    const h = 1.2 + rr() * 1.6; add(new THREE.CylinderGeometry(0.2, 0.24, h, 8), MT.cactus, x, h / 2, z, g);
    add(new THREE.CylinderGeometry(0.13, 0.15, 0.7, 8), MT.cactus, x + 0.4, h * 0.6, z, g).rotation.z = -0.5; add(new THREE.CylinderGeometry(0.13, 0.15, 0.6, 8), MT.cactus, x - 0.4, h * 0.45, z, g).rotation.z = 0.5;
  }
  // company sign and crates at the cliff
  add(tbox(0.12, 2.1, 0.12, 1), MT.wood, 8.6, 1.05, 30, g); add(tbox(2.0, 0.9, 0.1, 1), toon({ map: canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#e8dcc0'; c.fillRect(0, 0, w, h); c.fillStyle = '#7a2a20'; c.font = 'bold 30px Arial'; c.fillText('CANYON', 52, 52); c.fillText('RAIL CO.', 44, 94); }) }), 8.6, 1.9, 30.1, g);
  for (let k = 0; k < 4; k++) add(tbox(0.9, 0.9, 0.9, 1), MT.wood, 7.4 + (k % 2) * 0.95, 0.45 + Math.floor(k / 2) * 0.9, 27 - (k % 3) * 0.2, g);

  // the two bridges (steel truss) over the canyon: right = his (rust), left = the perfect one (blue steel)
  for (const [key, mat] of [['R', MT.rust], ['L', MT.blueSteel]]) {
    const x = TRACK_X[key], b = new THREE.Group(); b.position.x = x; g.add(b);
    add(tbox(3.6, 0.3, 72, 2), MT.deck, 0, -0.15, -28, b);
    for (const sx of [-1.75, 1.75]) {
      add(box(0.22, 0.22, 72), mat, sx, 3.4, -28, b); add(box(0.22, 0.3, 72), mat, sx, 0.1, -28, b);
      for (let z = 7; z >= -63; z -= 3.5) { add(box(0.14, 3.3, 0.14), mat, sx, 1.75, z, b); const d = add(box(0.1, 3.9, 0.1), mat, sx, 1.75, z - 1.75, b); d.rotation.x = (Math.floor(z / 3.5) % 2 ? 1 : -1) * 0.84; }
    }
    for (const pz of [-6, -22, -38, -54]) {
      for (const sx of [-1.4, 1.4]) add(box(0.55, 86, 0.55), mat, sx, -43, pz, b);
      for (let y = -8; y > -80; y -= 12) { add(box(2.8, 0.2, 0.2), mat, 0, y, pz, b); const d1 = add(box(0.16, 0.16, 12.6), mat, 0, y - 6, pz, b); d1.rotation.z = 0; const dx = add(box(3.4, 0.16, 0.16), mat, 0, y - 6, pz, b); dx.rotation.z = 0.55; const dy = add(box(3.4, 0.16, 0.16), mat, 0, y - 6, pz, b); dy.rotation.z = -0.55; }
    }
  }
  return g;
};

// track pieces. Static sleepers + ballast are merged; rails move (gap, heat, buckle) so they are separate meshes.
const buildTrackStatic = (g, x) => {
  const sl = [], bl = [];
  for (let z = Z0; z > Z1; z -= 0.62) sl.push(placed(box(2.6, 0.14, 0.24), x, TOPY - 0.07, z));
  add(mergeGeos(sl), MT.wood, 0, 0, 0, g);
  add(tbox(3.8, 0.2, 98 - 8, 1.4), MT.gravel, x, 0.1, 8 + 45, g);                 // gravel bed on the cliff top (z 8..98)
  add(tbox(3.8, 0.2, 40, 1.4), MT.gravel, x, 0.1, -64 - 20, g);                  // and on the far side
};
const trackR = { segs: [], plates: [] };
const buildRightTrack = (g) => {
  const x = TRACK_X.R, grp = new THREE.Group(); g.add(grp); buildTrackStatic(grp, x);
  const joints = []; for (let z = Z0 - 6; z > Z1; z -= JOINT) joints.push(z);   // 80, 68, 56 ... -100
  const zs = [Z0 + 4, ...joints, Z1 - 4];
  for (const sx of [-GAUGE, GAUGE]) for (let i = 0; i < zs.length - 1; i++) {
    const len = zs[i] - zs[i + 1], m = railMesh(RAILS.R, len); m.position.set(x + sx, TOPY, (zs[i] + zs[i + 1]) / 2); grp.add(m);
    m.userData = { zc: (zs[i] + zs[i + 1]) / 2, len, first: i === 0, last: i === zs.length - 2 }; trackR.segs.push(m);
  }
  for (const jz of joints) for (const sx of [-GAUGE, GAUGE]) {   // fish plates + bolts that bridge each joint
    for (const s of [-0.045, 0.045]) { add(box(0.025, 0.14, 0.9), MT.plate, x + sx + s * 1.55, TOPY + 0.17, jz, grp); for (const bz of [-0.3, -0.1, 0.1, 0.3]) add(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 6).rotateZ(Math.PI / 2), MT.bolt, x + sx + s * 2.1, TOPY + 0.17, jz + bz, grp); }
  }
  return grp;
};
const trackL = { units: [] };
const buildLeftTrack = (g) => {
  const x = TRACK_X.L, grp = new THREE.Group(); g.add(grp);
  add(tbox(3.8, 0.2, 98 - 8, 1.4), MT.gravel, x, 0.1, 8 + 45, grp); add(tbox(3.8, 0.2, 40, 1.4), MT.gravel, x, 0.1, -64 - 20, grp);
  // pieces: 3 m long, but only 1 m long where the track will buckle (z -46 .. -6) so the S-bend stays one smooth line
  const cuts = []; let z = Z0 + 3;
  while (z > Z1) { const len = z <= -6 && z > -46 ? 1 : 3; cuts.push([z, Math.max(Z1, z - len)]); z -= len; }
  cuts.forEach(([za, zb], i) => {
    const len = za - zb, u = new THREE.Group(); u.position.set(x, 0, (za + zb) / 2); grp.add(u);
    for (const sx of [-GAUGE, GAUGE]) { const r = railMesh(RAILS.L, len + 0.08); r.position.set(sx, TOPY, 0); u.add(r); }
    for (let k = 0; k * 0.62 < len; k++) add(box(2.6, 0.14, 0.24), MT.wood, 0, TOPY - 0.07, -len / 2 + 0.3 + k * 0.62, u);
    u.userData.z0 = u.position.z; trackL.units.push(u);
  });
};
// a steam locomotive + tender (about 9 m long), nose toward -z, wheels on the rails
const buildTrain = (tone) => {
  const t = new THREE.Group(), body = tone === 'L' ? MT.loco : toon({ color: '#4a3226' });
  add(new THREE.CylinderGeometry(1.0, 1.0, 5, 16).rotateX(Math.PI / 2), body, 0, 1.75, -1.2, t);
  add(new THREE.CylinderGeometry(0.2, 0.34, 1.1, 10), body, 0, 3.15, -3.2, t); add(new THREE.CylinderGeometry(0.42, 0.2, 0.3, 10), MT.dark, 0, 3.8, -3.2, t);
  add(new THREE.SphereGeometry(0.34, 10, 8), MT.brass, 0, 2.85, -0.6, t);
  add(tbox(2.2, 2.6, 2.0, 1), body, 0, 2.2, 2.0, t); add(tbox(2.5, 0.2, 2.4, 1), MT.dark, 0, 3.6, 2.0, t); add(tbox(1.5, 0.9, 0.05, 1), MT.dark, 0, 2.7, 0.98, t);
  add(new THREE.CylinderGeometry(0.28, 0.28, 0.3, 12).rotateX(Math.PI / 2), MT.brass, 0, 1.9, -3.75, t); add(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12).rotateX(Math.PI / 2), toon({ color: '#fff3b0', emissive: '#c8a030' }), 0, 1.9, -3.93, t);
  const cc = add(new THREE.ConeGeometry(0.9, 1.4, 4).rotateX(-Math.PI / 2), MT.dark, 0, 0.55, -4.4, t); cc.rotation.y = Math.PI / 4;
  add(tbox(2.0, 1.7, 2.6, 1), body, 0, 1.15, 5.3, t); add(tbox(1.8, 0.3, 2.4, 1), toon({ color: '#1a1a1a' }), 0, 2.1, 5.3, t);
  for (const z of [-2.6, -1.2, 0.2]) for (const sx of [-0.72, 0.72]) add(new THREE.CylinderGeometry(0.62, 0.62, 0.16, 16).rotateZ(Math.PI / 2), MT.locoRed, sx, 0.62, z, t);
  for (const z of [2.0]) for (const sx of [-0.72, 0.72]) add(new THREE.CylinderGeometry(0.85, 0.85, 0.16, 18).rotateZ(Math.PI / 2), MT.locoRed, sx, 0.85, z, t);
  for (const z of [4.6, 6.0]) for (const sx of [-0.72, 0.72]) add(new THREE.CylinderGeometry(0.45, 0.45, 0.14, 14).rotateZ(Math.PI / 2), MT.locoRed, sx, 0.45, z, t);
  add(tbox(2.0, 0.2, 9.8, 1), MT.dark, 0, 0.42, 0.9, t);
  t.position.y = TOPY + 0.33 - 0.0;
  return t;
};
const ASSETS = {
  'OUTDOOR': () => { const g = buildOutdoor(); buildRightTrack(g); buildLeftTrack(g); return g; },
  'OFFICE': () => {
    const g = new THREE.Group();
    // Floor
    add(tbox(12, 0.2, 10, 2), M.plank, 0, -0.1, -2, g);
    // Rug
    add(tbox(6, 0.05, 4, 2), toon({color: '#8a3a3a'}), 0, 0.02, -2.5, g);
    // Back wall
    add(tbox(12, 6, 0.2, 2), M.plaster2, 0, 3, -7, g);
    // Wainscoting
    add(tbox(12, 1, 0.3, 2), M.wood, 0, 0.5, -6.9, g);
    // Side walls
    add(tbox(0.2, 6, 10, 2), M.plaster2, -6, 3, -2, g);
    add(tbox(0.2, 6, 10, 2), M.plaster2, 6, 3, -2, g);
    
    // Desk
    add(tbox(3, 0.1, 1.5, 1), M.wood, 0, 1.2, -3, g); // top
    add(tbox(0.1, 1.2, 1.4, 1), M.wood, -1.4, 0.6, -3, g); // leg L
    add(tbox(0.1, 1.2, 1.4, 1), M.wood, 1.4, 0.6, -3, g); // leg R
    add(tbox(2.8, 1.0, 0.1, 1), M.wood, 0, 0.6, -3.6, g); // modesty panel
    
    // Bookshelf
    add(tbox(2, 4, 0.8, 1), M.wood, -4, 2, -6.5, g);
    for(let y=0.5; y<4; y+=0.8) {
      add(tbox(1.8, 0.05, 0.7, 1), M.wood, -4, y, -6.5, g);
      // add some books
      add(tbox(0.2, 0.6, 0.5, 1), toon({color: '#2a4a6a'}), -4.5 + Math.random(), y+0.3, -6.5, g);
      add(tbox(0.15, 0.5, 0.5, 1), toon({color: '#6a2a2a'}), -4.5 + Math.random(), y+0.25, -6.5, g);
    }
    
    // Plant
    add(new THREE.CylinderGeometry(0.3, 0.2, 0.4, 8), toon({color: '#8a5a3a'}), -4, 0.2, -2, g);
    add(new THREE.DodecahedronGeometry(0.6, 1), toon({color: '#3a7a3a'}), -4, 0.8, -2, g);
    
    // Filing cabinet
    add(tbox(1, 2, 1, 1), toon({color: '#4a6a8a'}), 4, 1, -6.5, g);
    add(tbox(0.8, 0.4, 0.1, 1), toon({color: '#3a5a7a'}), 4, 1.5, -6.0, g);
    add(tbox(0.8, 0.4, 0.1, 1), toon({color: '#3a5a7a'}), 4, 0.9, -6.0, g);
    add(tbox(0.8, 0.4, 0.1, 1), toon({color: '#3a5a7a'}), 4, 0.3, -6.0, g);
    
    // Window on right wall
    add(tbox(0.3, 2.5, 3, 1), toon({color: '#ffcf8a', emissive:'#a86a20'}), 5.9, 3, -2, g);
    add(tbox(0.4, 2.5, 0.1, 1), M.wood, 5.9, 3, -2, g); // frame vertical
    add(tbox(0.4, 0.1, 3, 1), M.wood, 5.9, 3, -2, g); // frame horizontal
    
    // Map on left wall
    const mapTex = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#e0d0b0'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#503020'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(20, 20); ctx.lineTo(200, 150); ctx.lineTo(230, 230); ctx.stroke();
      ctx.fillStyle = '#a04040'; ctx.beginPath(); ctx.arc(100, 80, 10, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(200, 150, 10, 0, Math.PI*2); ctx.fill();
    });
    add(tbox(0.1, 2, 3, 1), toon({map: mapTex}), -5.9, 3, -3, g);
    
    // Painting on back wall
    add(tbox(2, 1.5, 0.1, 1), M.wood, 3, 3, -6.9, g);
    add(tbox(1.8, 1.3, 0.12, 1), toon({color: '#4a6a4a'}), 3, 3, -6.9, g);
    
    // Calendar
    const calTex = canvasTex(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#cc3333'; ctx.fillRect(0, 0, w, 30);
      ctx.fillStyle = '#222222'; ctx.font = 'bold 60px Arial'; ctx.fillText('14', 30, 100);
    });
    add(tbox(0.1, 0.8, 0.6, 1), toon({map: calTex}), -5.9, 2.5, -5, g);
    
    // Desk lamp
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12), M.iron, 1, 1.25, -3.2, g);
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8).rotateZ(0.3), M.iron, 0.9, 1.5, -3.2, g);
    add(new THREE.CylinderGeometry(0.15, 0.05, 0.2, 12).rotateZ(-0.5), toon({color: '#2a6a4a'}), 0.7, 1.7, -3.2, g);
    
    // Door
    add(tbox(1.5, 3, 0.3, 1), M.door, -3, 1.5, -6.9, g);
    // Framed certificate
    add(tbox(1, 0.8, 0.1, 1), toon({color: '#eeeeee'}), -1.5, 3.5, -6.9, g);
    
    return g;
  },
  // ---- single props
  'handsaw': () => { const g = new THREE.Group(); add(tbox(0.5, 0.13, 0.025, 1), toon({ color: '#d4d8de' }), 0, 0, 0, g); for (let i = 0; i < 14; i++) add(box(0.014, 0.02, 0.03), toon({ color: '#d4d8de' }), -0.23 + i * 0.035, -0.07, 0, g); add(tbox(0.14, 0.16, 0.06, 1), MT.wood, 0.3, 0.03, 0, g); return g; },
  'newspaper': () => {
    const g = new THREE.Group();
    const tx = canvasTex(256, 360, (c, w, h) => {
      c.fillStyle = '#efe4c8'; c.fillRect(0, 0, w, h); c.fillStyle = '#1e1a16'; c.font = 'bold 22px Georgia, serif'; c.textAlign = 'center';
      c.fillText('THE CLICKETY', w / 2, 40); c.fillText('CLACK LINE!', w / 2, 66); c.fillRect(14, 76, w - 28, 3);
      c.strokeStyle = '#1e1a16'; c.lineWidth = 3; c.strokeRect(34, 96, w - 68, 100);
      c.fillRect(54, 150, 110, 26); c.fillRect(120, 124, 30, 28); c.fillRect(58, 132, 24, 18); c.beginPath(); c.arc(76, 186, 10, 0, 6.3); c.arc(134, 186, 10, 0, 6.3); c.arc(166, 186, 10, 0, 6.3); c.fill();
      for (let y = 214; y < 340; y += 14) { c.fillRect(18, y, 100, 6); c.fillRect(138, y, 100, 6); }
    });
    add(tbox(1.0, 1.4, 0.03, 1), toon({ map: tx }), 0, 0, 0, g); return g;
  },
  'gold coin': () => { const g = new THREE.Group(); add(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 20).rotateX(Math.PI / 2), toon({ color: '#ffd23a', emissive: '#7a5a10' }), 0, 0, 0, g); add(new THREE.CylinderGeometry(0.09, 0.09, 0.045, 20).rotateX(Math.PI / 2), toon({ color: '#f0b020' }), 0, 0, 0, g); return g; },
  'sheet of paper': () => { const g = new THREE.Group(); add(box(0.24, 0.32, 0.012), toon({ color: '#ffffff' }), 0, 0, 0, g); return g; },
};

const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const clouds = cloudsInit();

const outdoor = ASSETS['OUTDOOR'](); world.add(outdoor);
const office = ASSETS['OFFICE'](); world.add(office);
const newspaper = ASSETS['newspaper'](); office.add(newspaper); newspaper.position.set(-0.55, 1.05, -3.3); newspaper.rotation.set(-0.1, 0.35, 0.05); newspaper.scale.setScalar(0.55);
const handsaw = ASSETS['handsaw'](); outdoor.add(handsaw);
const goldCoin = ASSETS['gold coin'](); outdoor.add(goldCoin);
const sheetPaper = ASSETS['sheet of paper'](); outdoor.add(sheetPaper);
const trainL = buildTrain('L'); outdoor.add(trainL); const trainR = buildTrain('R'); outdoor.add(trainR);
const JOINT_Z = 32;   // the joint every close-up looks at (right track, near cliff)

const buckleDx = (z, A) => { const u = (z - -40) / 28; return u > 0 && u < 1 ? A * Math.sin(TAU * u) * Math.sin(Math.PI * u) : 0; };

function worldState(S, f) {
  const st = STORY.STATE(f, S);
  outdoor.visible = S.place === 'OUTDOOR'; office.visible = S.place === 'OFFICE';
  newspaper.visible = office.visible;
  // right track: every joint opens by the same gap
  for (const m of trackR.segs) { const u = m.userData; m.scale.z = Math.max(0.001, (u.len - (u.first || u.last ? 0 : st.gapR)) / u.len); }
  setHeat(RAILS.R, st.heatR); setHeat(RAILS.L, st.heatL);
  // left track: heat pushes it sideways into an S (buckle 0..1)
  for (const u of trackL.units) {
    const z = u.userData.z0, dx = buckleDx(z, 1.5 * st.buckle), dx2 = buckleDx(z - 0.5, 1.5 * st.buckle), dx1 = buckleDx(z + 0.5, 1.5 * st.buckle);
    u.position.x = TRACK_X.L + dx; u.rotation.y = Math.atan2(dx2 - dx1, 1.0);
  }
  handsaw.visible = st.saw !== null; if (st.saw !== null) { handsaw.position.set(TRACK_X.R + GAUGE + 0.35 + Math.sin(st.saw * 40) * 0.12, TOPY + 0.36, JOINT_Z); handsaw.rotation.set(0, Math.PI / 2, 0.0); }
  goldCoin.visible = st.coin; goldCoin.position.set(TRACK_X.R + GAUGE, TOPY + 0.33, JOINT_Z); goldCoin.rotation.set(0, 0.6, 0);
  sheetPaper.visible = st.paper; sheetPaper.position.set(TRACK_X.R + GAUGE, TOPY + 0.45, JOINT_Z); sheetPaper.rotation.set(0, 0.6, 0);
  trainL.visible = st.trainL !== null; if (st.trainL !== null) { const z = st.trainL, dx = buckleDx(z, 1.5 * st.buckle), dxa = buckleDx(z - 1, 1.5 * st.buckle), dxb = buckleDx(z + 1, 1.5 * st.buckle); trainL.position.set(TRACK_X.L + dx, TOPY + 0.33, z); trainL.rotation.y = Math.atan2(dxa - dxb, 2.0) ; }
  trainR.visible = st.trainR !== null; if (st.trainR !== null) { const z = st.trainR, ph = ((z - 80) / JOINT) % 1; trainR.position.set(TRACK_X.R, TOPY + 0.33 + 0.05 * Math.pow(Math.abs(Math.sin(Math.PI * ph * 1.0 * 2)), 8), z); trainR.rotation.z = 0.012 * Math.sin(Math.PI * ph * 4); }
  waterU.t.value = f / 30;
}


// ---------- cards ----------
const CW = 1200, CH = 2000, CM = 2.25; // canvas px, card height in metres (design 600x1000 -> 2.25 m)
const cardGeo = new THREE.PlaneGeometry(CM * 0.6, CM); cardGeo.translate(0, CM / 2 - CM * 0.025, 0);
const blobTex = P.tex(P.radial('20,14,30', 0.6));
class Card {
  constructor(scale = 1) {
    [this.c, this.g] = (() => { const c = document.createElement('canvas'); c.width = CW; c.height = CH; return [c, c.getContext('2d')]; })();
    this.t = new THREE.CanvasTexture(this.c); this.t.colorSpace = THREE.SRGBColorSpace; this.t.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.t, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, fog: true });
    this.mesh = new THREE.Mesh(cardGeo, this.mat); this.mesh.userData.nd = cardNd(this.t); this.mesh.castShadow = true;
    this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.t, alphaTest: 0.5 });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.userData.ndSkip = true; this.blob.renderOrder = 1;
    scene.add(this.mesh); scene.add(this.blob); this.key = ''; this.mesh.visible = this.blob.visible = false;
  }
  draw(key, fn) {
    if (key === this.key) return; this.key = key;
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, CW, CH); g.setTransform(CW / 600, 0, 0, CH / 1000, 0, 0);
    const p = new T.Pen(g); fn(p); this.t.needsUpdate = true;
  }
}
const cards = []; const getCard = (i) => cards[i] || (cards[i] = new Card());

// ---------- render targets & post ----------
const rtColor = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const rtNd = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const rtInk = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.PlaneGeometry(2, 2);
const fs = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(fsGeo, mat)); return s; };
const inkU = { col: { value: rtColor.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, px: { value: 1.6 }, fogCol: { value: new THREE.Color() },
  sat: { value: 1.08 }, vibr: { value: 0 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 }, grain: { value: 0 }, grad: { value: 0 } };
const inkScene = fs(new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vibr, vig, flash, grain, grad; uniform vec3 fogCol, lift, gain; varying vec2 vUv;
  float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float vnz(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hsh(i),hsh(i+vec2(1.,0.)),f.x), mix(hsh(i+vec2(0.,1.)),hsh(i+vec2(1.,1.)),f.x), f.y); }
  float edgeAt(vec2 uv, float r){
    vec4 c = texture2D(nd, uv); if (dot(c.rgb,c.rgb) < .01) return 0.; float d = c.a; vec3 n = c.rgb*2.-1.;
    float e = 0.; float rr = r * clamp(7./d, .62, 1.25);
    for (int i=0;i<16;i++){ float a = float(i)*.785398 + (i>7 ? .39 : 0.); float k = i>7 ? .5 : 1.;
      vec2 o = vec2(cos(a), sin(a))*rr*k/res; vec4 s = texture2D(nd, uv+o);
      float ds = s.a; bool card = dot(s.rgb,s.rgb) < .01;
      if (card && ds > 0.) continue;            // character cards: never outlined by the world ink
      if (card) ds = 1e4;                        // sky
      vec3 ns = s.rgb*2.-1.;
      e = max(e, smoothstep(.006, .02, (ds - d)/d));                           // depth jump, near side only
      if (!card && abs(ds-d)/d < .06) e = max(e, smoothstep(.88, .72, dot(n, ns)) * .9); // crease
    }
    return e * (1. - smoothstep(140., 520., d)*.8);
  }
  void main(){
    vec3 c = texture2D(col, vUv).rgb;
    float e = edgeAt(vUv, px);
    c = mix(c, vec3(.012,.01,.014), e);
    if (flash < -0.5) c = vec3(e);
    float l = dot(c, vec3(.299,.587,.114)); c = mix(vec3(l), c, sat);
    float cs = max(c.r,max(c.g,c.b)) - min(c.r,min(c.g,c.b)); c = mix(vec3(l), c, 1. + vibr*(1.-clamp(cs*1.6,0.,1.)));
    c = c*gain + lift;
    // v2.2 (rule COL-02): surfaces are never one flat colour: soft top-to-bottom light gradient + fine painted grain, strongest on mid tones
    c *= 1. + grad*(vUv.y-.5);
    float nz = vnz(vUv*res/5.)*.45 + vnz(vUv*res/19.)*.35 + (hsh(vUv*res)-.5)*.35;
    c *= 1. + grain*(nz-.4)*(1.-.6*abs(l-.5)*2.);
    vec2 q = vUv-.5; c *= 1. - vig*dot(q*vec2(1.,.75), q*vec2(1.,.75))*2.2;
    c = mix(c, vec3(1.), flash);
    gl_FragColor = vec4(c,1.); }` }));
const dofU = { src: { value: rtInk.texture }, nd: { value: rtNd.texture }, res: { value: new THREE.Vector2(W, H) }, focus: { value: 5 }, cinf: { value: 0 }, near: { value: 1 } };
const dofScene = fs(new THREE.ShaderMaterial({ uniforms: dofU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D src, nd; uniform vec2 res; uniform float focus, cinf, near; varying vec2 vUv;
  float coc(vec2 uv){ float d = texture2D(nd, uv).a; if (d <= 0.) d = 2000.; float k = 1. - focus/d; return k > 0. ? cinf*k : min(-k*cinf*near, cinf*1.4); }
  void main(){
    float c0 = coc(vUv);
    if (cinf < .5 || c0 < .6) { gl_FragColor = linearToOutputTexel(vec4(texture2D(src, vUv).rgb, 1.)); return; }
    vec3 acc = vec3(0.); float wsum = 0.;
    for (int i=0;i<48;i++){ float fi = float(i); float r = sqrt((fi+.5)/48.); float a = fi*2.39996;
      vec2 o = vec2(cos(a), sin(a))*r*c0/res; float cs = coc(vUv+o);
      float w = smoothstep(r*c0-1.5, r*c0+.5, cs + .5);
      acc += texture2D(src, vUv+o).rgb*w; wsum += w; }
    gl_FragColor = linearToOutputTexel(vec4(acc/max(wsum,1e-3), 1.)); }` }));
// final copy with sRGB handled by the renderer output (we render to screen with linear->sRGB in the shader chunk)
dofScene.children[0].material.toneMapped = false;

// ---------- per-frame state ----------
const tmpV = new THREE.Vector3();
function applyLight(L, f) {
  hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemi;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  scene.fog.color.set(L.fog); scene.fog.near = L.fogNear; scene.fog.far = L.fogFar;
  skyU.top.value.set(L.skyTop); skyU.hor.value.set(L.skyHor); skyU.sunCol.value.set(L.sunDisc || '#000'); skyU.sunSize.value = L.sunSize || 0;
  inkU.sat.value = L.sat * (LK.sat ?? 1); inkU.vibr.value = LK.vibr ?? 0; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
  waterU.deep.value.set(L.waterDeep); waterU.shal.value.set(L.waterShal); waterU.glint.value.set(L.glint);
}
function placeSun(L, focus) {
  // sun direction from azimuth/elevation in world space
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}

function drawActors(list, cam) {
  cards.forEach((c) => { c.mesh.visible = c.blob.visible = false; });
  list.forEach((a, i) => {
    const c = getCard(i);
    c.draw(a.key, a.draw);
    c.mesh.visible = true; c.mesh.position.set(a.x, a.y, a.z);
    const s = a.s || 1; c.mesh.scale.set(s * (a.flip ? -1 : 1), s, s);
    c.mesh.rotation.set(0, Math.atan2(cam.position.x - a.x, cam.position.z - a.z) + (a.yaw || 0), a.roll || 0);
    c.mat.color.set(a.tint || '#ffffff'); c.mat.opacity = a.alpha ?? 1;
    c.mesh.castShadow = a.shadow !== false;
    c.mesh.renderOrder = a.order || 2;
    if (a.blob !== false && a.y < DECK + 0.5) { c.blob.visible = true; c.blob.position.set(a.x, (a.ground ?? DECK) + 0.02, a.z); c.blob.scale.set(0.95 * s, 0.6 * s, 1); }
  });
}

const helmetState = (h) => {
  helmet.visible = !!h; if (!h) return;
  helmet.position.set(h.x, h.y, h.z); helmet.rotation.set(h.rx || 0, h.ry || 0, h.rz || 0); helmet.scale.setScalar(h.s || 0.17);
};

const swapForNd = (on) => {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      o.userData.mat0 = o.material;
      if (o.userData.ndSkip) { o.userData.vis0 = o.visible; o.visible = false; return; }
      if (o === sky || o.userData.sky) { o.userData.vis0 = o.visible; o.visible = false; return; }
      o.material = o.userData.nd || ndMat;
    } else {
      o.material = o.userData.mat0; if (o.userData.vis0 !== undefined) { o.visible = o.userData.vis0; delete o.userData.vis0; }
    }
  });
};

// ---------- asset test mode (used by tools/gen_api.py to check every ASSETS builder alone, with a person card for scale) ----------
let testObj = null, testGround = null;
window.setupTest = (spec) => {
  if (testObj) { scene.remove(testObj); testObj = null; }
  if (!testGround) { testGround = add(new THREE.PlaneGeometry(600, 600), toon({ color: '#9a9486' }), 0, -0.02, 0, scene, { cast: false }); testGround.rotation.x = -Math.PI / 2; }
  world.visible = false; testGround.visible = true;
  const info = { name: spec.name, view: spec.view, ok: false };
  try {
    const mk = typeof ASSETS !== 'undefined' ? ASSETS[spec.name] : null; if (!mk) throw new Error('no ASSETS entry named "' + spec.name + '"');
    testObj = mk(); scene.add(testObj); testObj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(testObj), sz = b.getSize(new THREE.Vector3()), ct = b.getCenter(new THREE.Vector3());
    info.ok = true; info.size = [sz.x, sz.y, sz.z].map((v) => +v.toFixed(2)); info.min_y = +b.min.y.toFixed(2);
    const hx = Math.max(sz.x, sz.z), place = spec.kind === 'place', v = spec.view || 'front';
    const small = hx < 1.2 && !place;
    let d = Math.max((hx / 2 + (small ? 0.1 : 1.3)) / 0.26, 1.4 * sz.y, 0.5), pos, look = [ct.x, Math.max(ct.y, 0.3), ct.z], fov = 50, px = b.max.x + 0.6, pz = b.max.z;
    if (v === 'front') pos = [ct.x, Math.max(1.4, ct.y), b.max.z + d];
    else if (v === 'side') pos = [b.max.x + d, Math.max(1.4, ct.y), ct.z];
    else if (v === 'high') pos = [ct.x + d * 0.7, ct.y + d * 0.55, b.max.z + d * 0.7];
    else if (v === 'in1') { pos = [ct.x, 1.6, ct.z + Math.min(sz.z * 0.35, 8)]; look = [ct.x, 1.5, ct.z - sz.z]; fov = 62; px = ct.x; pz = ct.z - 4; }
    else { pos = [ct.x - Math.min(sz.x * 0.3, 8), 1.6, ct.z]; look = [ct.x + sz.x, 1.5, ct.z]; fov = 62; px = ct.x + 4; pz = ct.z; }
    window.TEST = { light: spec.light || 'day', cam: { pos, look, fov }, dist: d, actors: small ? [] : [{ key: 'scale', draw: (p) => T.romanFront(p, 'civA', {}), x: px, y: DECK, z: pz, s: 0.8 }] };
    if (small) info.note = 'no person card (object smaller than 1.2 m); sizes printed';
  } catch (e) { info.err = String(e && e.message || e); window.TEST = null; }
  return info;
};
window.renderFrame = (f) => {
  const T0 = window.TEST;
  const S = T0 ? { light: T0.light } : shotAt(f), L = T0 ? { ...(LIGHTS[T0.light] || LIGHTS.day || Object.values(LIGHTS)[0]) } : lightFor(S, f), C = T0 ? T0.cam : camAt(f);
  applyLight(L, f);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ(rx(C.roll || 0));
  if (!T0 && (LK.drift || LK.push)) { // optional: nothing is ever frozen
    const dist = camera.position.distanceTo(new THREE.Vector3(...C.look)), a = (LK.drift || 0) * 0.012 * Math.max(dist, 1.5), sf = f - (S.a || 0);
    camera.translateX(a * Math.sin(f * 0.013 + 1.1)); camera.translateY(a * 0.6 * Math.sin(f * 0.019)); camera.rotateZ(rx(0.35 * (LK.drift || 0) * Math.sin(f * 0.009)));
    camera.translateZ(-(LK.push || 0) * 0.0007 * Math.min(sf, 150) * dist);
  }
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  if (!T0) { world.visible = true; if (testGround) testGround.visible = false; const W_ = worldAt(f); worldState(W_, f); }
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors(T0 ? T0.actors : [...actorsAt(f, T), ...fxAt(f, T)], camera);
  sky.position.copy(camera.position);
  for (const c of clouds) c.quaternion.copy(camera.quaternion);
  // pass A: colour
  renderer.setRenderTarget(rtColor); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
  // pass B: normal + depth
  const fog = scene.fog; scene.fog = null; const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false; renderer.shadowMap.autoUpdate = false;
  swapForNd(true); renderer.setRenderTarget(rtNd); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera); swapForNd(false);
  scene.fog = fog; renderer.shadowMap.enabled = sm; renderer.shadowMap.autoUpdate = true;
  if (window.DEBUG_ND) { const dm = new THREE.MeshBasicMaterial({ map: rtNd.texture }); const ds = fs(dm); renderer.setRenderTarget(null); renderer.render(ds, fsCam); return true; }
  // ink + grade
  const D = T0 ? { focus: T0.dist, cinf: 0, near: 1 } : dofAt(f);
  inkU.px.value = LK.ink ?? 2.5; inkU.grain.value = LK.grain ?? 0; inkU.grad.value = LK.grad ?? 0; inkU.flash.value = window.DEBUG_E ? -1 : (C.flash || 0); inkU.vig.value = L.vig ?? 0.22;
  renderer.setRenderTarget(rtInk); renderer.render(inkScene, fsCam);
  // lens
  dofU.focus.value = D.focus; dofU.cinf.value = D.cinf; dofU.near.value = D.near ?? 1;
  renderer.setRenderTarget(null); renderer.render(dofScene, fsCam);
  return true;
};
// ---------- v2.2: final picture = scene-change blend (rule TRN-06) + one-word captions (rule CAP-02) ----------
const mk2d = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const compC = mk2d(), compX = compC.getContext('2d'), outC = mk2d(), outX = outC.getContext('2d');
const FC = STORY.FORCE;
window.snap = (f, q) => {
  const tr = (STORY.TRANS || []).find((t) => (t.kind === 'dissolve' || t.kind === 'fly') && f >= t.b - t.n / 2 && f < t.b + t.n / 2);
  if (tr) {
    const a = (f - (tr.b - tr.n / 2) + 0.5) / tr.n, toShot = shotAt(tr.b).id;
    FC.shot = tr.fromShot; FC.scene = tr.from; window.renderFrame(f); outX.drawImage(canvas, 0, 0);
    FC.shot = toShot; FC.scene = tr.to; window.renderFrame(f); FC.shot = null; FC.scene = null;
    compX.globalAlpha = 1; compX.drawImage(outC, 0, 0); compX.globalAlpha = a; compX.drawImage(canvas, 0, 0); compX.globalAlpha = 1;
  } else { window.renderFrame(f); compX.drawImage(canvas, 0, 0); }
  const t = (f + 0.5) / 30; let wi = -1;
  for (let i = 0; i < WORDS.length; i++) { const w = WORDS[i], nx = WORDS[i + 1], end = nx && nx.s - w.e < 0.3 ? nx.s : w.e + 0.12; if (t >= w.s && t < end) { wi = i; break; } }
  if (wi >= 0 && !window.NOCAP) {
    const w = WORDS[wi], age = t - w.s, k = age < 0.1 ? 1 + 0.12 * Math.pow(1 - age / 0.1, 2) : 1, fs_ = 84;
    compX.save(); compX.font = `900 ${fs_}px Impact, "Arial Black", "DejaVu Sans", sans-serif`; compX.textAlign = 'center'; compX.textBaseline = 'middle'; compX.lineJoin = 'round';
    compX.translate(W / 2, H * 0.70); compX.scale(k, k); compX.lineWidth = 12; compX.strokeStyle = '#1b1424'; compX.strokeText(w.w, 0, 0); compX.fillStyle = '#ffffff'; compX.fillText(w.w, 0, 0); compX.restore();
  }
  return compC.toDataURL('image/jpeg', q);
};
window.TOTAL = TOTAL;
window.ready = true;
