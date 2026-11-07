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

// ---------- world (rewritten by Claude: richer sets, readable bomb, six-wire circuit, live screens/lights) ----------
const DECK = 0;
const world = new THREE.Group(); scene.add(world);
const timerCanvas = document.createElement('canvas'); timerCanvas.width = 256; timerCanvas.height = 96;
const timerCtx = timerCanvas.getContext('2d'); const timerTex = new THREE.CanvasTexture(timerCanvas); timerTex.colorSpace = THREE.SRGBColorSpace;
const timerMat = new THREE.MeshBasicMaterial({ map: timerTex });
const mat = (c) => toon({ color: c });
const bas = (c) => new THREE.MeshBasicMaterial({ color: c });
const plane = (w, d, m, x, y, z, g) => { const p = add(new THREE.PlaneGeometry(w, d), m, x, y, z, g, { cast: false }); p.rotation.x = -Math.PI / 2; return p; };
const cyl = (r, h, m, x, y, z, g, seg = 12) => add(new THREE.CylinderGeometry(r, r, h, seg), m, x, y, z, g);
const faceTex = (base, win, lit, seed) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h); const r = P.rng(seed);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const lx = 14 + x * 60, ly = 14 + y * 60; g.fillStyle = r() < lit ? '#ffe49a' : win; g.fillRect(lx, ly, 38, 40);
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(lx, ly, 38, 5); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(lx - 4, ly + 40, 46, 5);
  }
  g.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < 4; y++) g.fillRect(0, y * 60 + 56, w, 4);
});
const building = (g, w, h, d, x, z, base, seed) => { const m = toon({ map: faceTex(base, '#35506e', 0.22, seed), color: '#ffffff' }); const b = add(tbox(w, h, d, 6), m, x, h / 2, z, g); add(tbox(w + 0.4, 0.4, d + 0.4), mat('#6d6a66'), x, h + 0.2, z, g); return b; };

const flashers = [], beacons = [], screens = [];
const monitorTex = (w = 160, h = 120) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { c, t, g: c.getContext('2d') }; };

const jersey = (g, x, z, ry = 0) => { const b = new THREE.Group(); add(tbox(1.6, 0.35, 0.6), mat('#c9c6bf'), 0, 0.17, 0, b); add(tbox(1.6, 0.5, 0.3), mat('#d6d3cc'), 0, 0.6, 0, b); add(tbox(1.62, 0.12, 0.32), mat('#e0a020'), 0, 0.5, 0, b); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b); };
const cone = (g, x, z) => { add(new THREE.ConeGeometry(0.2, 0.6, 10), mat('#ff6a1a'), x, 0.32, z, g); add(tbox(0.5, 0.05, 0.5), mat('#222'), x, 0.025, z, g); add(new THREE.CylinderGeometry(0.1, 0.13, 0.1, 10), mat('#ffffff'), x, 0.27, z, g); };
const policeCar = (g, x, z, ry) => {
  const car = new THREE.Group();
  add(tbox(2.0, 0.7, 4.6), mat('#f1f1f1'), 0, 0.65, 0, car);
  add(tbox(2.02, 0.28, 4.62), mat('#1d3a8a'), 0, 0.45, 0, car);
  add(tbox(1.8, 0.65, 2.4), mat('#f6f6f6'), 0, 1.3, -0.3, car);
  add(tbox(1.82, 0.4, 2.2), mat('#27415f'), 0, 1.36, -0.3, car);
  const lb = add(tbox(0.5, 0.14, 0.28), bas('#ff1a1a'), -0.4, 1.7, -0.3, car), lr = add(tbox(0.5, 0.14, 0.28), bas('#1a4dff'), 0.4, 1.7, -0.3, car);
  flashers.push({ a: lb, b: lr });
  for (const [wx, wz] of [[1, 1.4], [-1, 1.4], [1, -1.4], [-1, -1.4]]) { const w = cyl(0.36, 0.25, mat('#16161a'), wx * 0.95, 0.36, wz, car, 14); w.rotation.z = Math.PI / 2; const hub = cyl(0.18, 0.27, mat('#b9bcc4'), wx * 0.95, 0.36, wz, car, 10); hub.rotation.z = Math.PI / 2; }
  add(tbox(1.6, 0.18, 0.1), mat('#ffe9a0'), 0, 0.8, 2.31, car); add(tbox(1.6, 0.12, 0.1), mat('#d62020'), 0, 0.8, -2.31, car);
  car.position.set(x, 0, z); car.rotation.y = ry; g.add(car); return car;
};
const tree = (g, x, z, h = 3) => { cyl(0.18, h * 0.5, mat('#6a4a32'), x, h * 0.25, z, g, 8); add(new THREE.SphereGeometry(h * 0.38, 10, 8), mat('#3f9a3a'), x, h * 0.65, z, g); add(new THREE.SphereGeometry(h * 0.26, 10, 8), mat('#58b34a'), x + h * 0.14, h * 0.82, z, g); };
const lampPost = (g, x, z) => { cyl(0.07, 5, mat('#4a4f58'), x, 2.5, z, g, 8); add(tbox(0.9, 0.1, 0.12), mat('#4a4f58'), x + 0.4, 5, z, g); add(tbox(0.4, 0.12, 0.25), bas('#fff2b8'), x + 0.8, 4.92, z, g); };

const ASSETS = {
  'CITY-STREET': () => {
    const g = new THREE.Group();
    plane(80, 100, mat('#4a4f5a'), 0, 0, -20, g);                                   // asphalt
    plane(8, 100, mat('#b9b3a6'), -13, 0.01, -20, g); plane(8, 100, mat('#b9b3a6'), 13, 0.01, -20, g); // pavements
    for (let z = 12; z > -48; z -= 4) plane(0.25, 2, mat('#f0c030'), 6, 0.02, z, g);           // lane dashes
    plane(0.25, 100, mat('#f2f2f2'), -8.6, 0.02, -20, g);
    for (let z = 8; z > -10; z -= 3) plane(3.2, 0.5, mat('#f4f4f4'), 0, 0.02, z + 1, g);       // crossing bars
    const cols = ['#b5503c', '#e3d3a8', '#4f8fa8', '#d9a53a', '#8a6fa8', '#c9704a'];
    let i = 0; for (let z = 14; z > -52; z -= 9) { const h = 11 + ((i * 7) % 9); building(g, 8, h, 8.4, -19, z, cols[i % 6], 11 + i); building(g, 8, 10 + ((i * 5) % 11), 8.4, 19, z - 3, cols[(i + 3) % 6], 31 + i); i++; }
    building(g, 30, 22, 8, 0, -58, '#8a6fa8', 77);
    for (let z = 6; z > -12; z -= 2.3) jersey(g, -5, z, 0);                              // concrete barriers, left
    jersey(g, -3, -11.5, Math.PI / 2); jersey(g, 0.2, -11.5, Math.PI / 2); jersey(g, 3.4, -11.5, Math.PI / 2);
    policeCar(g, 4.2, -3.5, 0.25); policeCar(g, 6.6, -8, -0.15); policeCar(g, -2.2, -14, 1.25);
    for (const [cx, cz] of [[-1.6, -9], [2.2, -9], [1.2, -6.2], [-3.5, -6]]) cone(g, cx, cz);
    // police tape
    const tape = add(new THREE.PlaneGeometry(6, 0.14), toon({ map: canvasTex(64, 8, (c, w, h) => { for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#111' : '#ffd21a'; c.fillRect(k * 8, 0, 8, h); } }, 8, 1), color: '#fff', side: THREE.DoubleSide }), 0, 0.9, -9, g, { cast: false });
    // the device in the road
    add(tbox(0.9, 0.5, 0.6), mat('#22252c'), 0, 0.25, -9.6, g); add(tbox(0.5, 0.12, 0.05), bas('#ff2a2a'), 0, 0.55, -9.3, g); beacons.push(add(new THREE.SphereGeometry(0.1, 8, 8), bas('#ff2a2a'), 0.3, 0.58, -9.6, g));
    for (const z of [4, -6, -20, -34]) { lampPost(g, -8.6, z); lampPost(g, 8.6, z - 3); }
    for (const z of [8, -2, -14, -26]) { tree(g, -10.5, z, 3.4); tree(g, 10.5, z - 4, 3.0); }
    cyl(0.2, 0.7, mat('#d63a2a'), 7.2, 0.35, 3, g, 10);
    // crowd barrier
    for (let z = -12; z > -26; z -= 1.2) add(tbox(0.06, 1.0, 1.1), mat('#9aa3b0'), -7.8, 0.5, z, g);
    return g;
  },
  'POLICE-OFFICE': () => {
    const g = new THREE.Group();
    add(new THREE.PlaneGeometry(12, 12), M.plank, 0, 0, 0, g).rotation.x = -Math.PI / 2;
    const wall = toon({ map: P.tex(P.plaster(8), 3, 1), color: '#f3dcae' });
    add(tbox(12, 4, 0.2), wall, 0, 2, -6, g); add(tbox(0.2, 4, 12), wall, -6, 2, 0, g); add(tbox(0.2, 4, 12), wall, 6, 2, 0, g);
    add(tbox(12, 0.15, 12), mat('#e9e2d2'), 0, 4.1, 0, g, {});
    add(tbox(12, 1.1, 0.25), mat('#3f6b52'), 0, 0.55, -5.95, g);                       // wainscot
    add(tbox(12, 0.1, 0.3), mat('#e8d8b0'), 0, 1.12, -5.95, g);
    for (const x of [-1.2, 1.2]) add(tbox(0.7, 0.9, 0.04), mat('#ffffff'), x, 2.1, -5.86, g);   // two instruction papers
    add(tbox(0.9, 0.7, 0.04), mat('#fff6c8'), 0, 2.45, -5.86, g);
    add(tbox(1.4, 1.9, 0.06), mat('#2266cc'), -3, 2.1, -5.86, g); add(tbox(1.0, 0.1, 0.07), mat('#ffd21a'), -3, 2.7, -5.84, g);
    add(tbox(1.2, 0.8, 0.06), mat('#c9a06a'), -4.6, 2.3, -5.86, g);                    // cork board
    for (const [px, py, pc] of [[-4.9, 2.4, '#ff8a8a'], [-4.5, 2.1, '#8ad0ff'], [-4.3, 2.5, '#fff'], [-4.8, 2.1, '#ffe58a']]) add(tbox(0.25, 0.3, 0.02), mat(pc), px, py, -5.82, g);
    add(tbox(2.0, 1.4, 0.1), mat('#6a4a2a'), 3.2, 2.4, -5.9, g); add(tbox(1.8, 1.2, 0.05), mat('#8ec8f0'), 3.2, 2.4, -5.84, g);   // window
    for (let k = 0; k < 6; k++) add(tbox(1.8, 0.05, 0.04), mat('#f4f4f4'), 3.2, 1.9 + k * 0.2, -5.8, g);                                  // blinds
    const clk = cyl(0.3, 0.06, mat('#ffffff'), 1.5, 3.2, -5.85, g, 20); clk.rotation.x = Math.PI / 2; add(tbox(0.04, 0.22, 0.02), mat('#111'), 1.5, 3.25, -5.8, g);
    cyl(0.15, 0.6, mat('#dd2222'), 5.2, 0.3, -5.5, g, 10); add(tbox(0.1, 0.1, 0.1), mat('#222'), 5.2, 0.65, -5.5, g);
    // desk (right)
    add(tbox(2.2, 0.08, 1.1), M.wood, 3, 0.95, -2, g); add(tbox(2.0, 0.9, 0.9), mat('#8a5a34'), 3, 0.45, -2, g);
    add(tbox(0.6, 0.4, 0.05), mat('#1a1f2b'), 3, 1.35, -2.3, g); add(tbox(0.55, 0.35, 0.02), bas('#5fb4e8'), 3, 1.35, -2.27, g); add(tbox(0.5, 0.02, 0.2), mat('#2a2a2a'), 3, 1.0, -1.9, g);
    cyl(0.09, 0.14, mat('#e8e8e8'), 3.9, 1.05, -1.8, g, 10); cyl(0.1, 0.02, mat('#c93a3a'), 3.9, 1.12, -1.8, g, 10);
    add(tbox(0.12, 0.3, 0.12), mat('#444'), 2.3, 1.15, -2.2, g); add(tbox(0.34, 0.1, 0.3), mat('#e0b020'), 2.3, 1.4, -2.1, g);
    add(tbox(0.7, 0.06, 0.5), mat('#ffffff'), 3.4, 1.01, -2.1, g); add(tbox(0.5, 0.05, 0.4), mat('#ffd9a0'), 2.9, 1.0, -1.7, g);
    // bench (left) + cabinet + plant + door
    add(tbox(3, 0.12, 0.8), M.wood, -3, 0.5, -2, g); add(tbox(0.12, 0.5, 0.8), M.wood, -4.45, 0.25, -2, g); add(tbox(0.12, 0.5, 0.8), M.wood, -1.55, 0.25, -2, g);
    add(tbox(3, 0.6, 0.1), M.wood, -3, 0.9, -2.4, g);
    add(tbox(0.9, 1.8, 0.6), mat('#6f7c8c'), -5.4, 0.9, -4.2, g); for (let k = 0; k < 4; k++) add(tbox(0.8, 0.02, 0.02), mat('#222'), -5.4, 0.4 + k * 0.4, -3.89, g);
    cyl(0.25, 0.4, mat('#b5603a'), 0.5, 0.2, -5.3, g, 10); add(new THREE.SphereGeometry(0.4, 10, 8), mat('#3fa84a'), 0.5, 0.75, -5.3, g);
    for (const x of [-3, 0, 3]) add(tbox(1.6, 0.06, 0.35), bas('#fffbe8'), x, 3.98, -1, g);       // ceiling lights
    return g;
  },
  'BOMB-ROOM': () => {
    const g = new THREE.Group();
    plane(10, 10, toon({ map: P.tex(P.stone(4), 4, 4), color: '#aeb3bf' }), 0, 0, 0, g);
    const wallMat = toon({ map: P.tex(P.plaster(8), 4, 2), color: '#9db3d0' });
    add(tbox(10, 4, 0.2), wallMat, 0, 2, -5, g); add(tbox(0.2, 4, 10), mat('#5b86b0'), -5, 2, 0, g); add(tbox(0.2, 4, 10), wallMat, 5, 2, 0, g);
    add(tbox(10, 0.15, 10), mat('#d6dbe6'), 0, 4.1, 0, g);
    for (let i = -5; i < 5; i++) add(tbox(0.5, 0.3, 0.12), mat(i % 2 ? '#e8b822' : '#22242c'), i + 0.5, 1.0, -4.88, g);     // hazard stripe
    for (let i = -5; i < 5; i++) add(tbox(0.12, 0.3, 0.5), mat(i % 2 ? '#e8b822' : '#22242c'), -4.88, 1.0, i + 0.5, g);
    plane(3.2, 3.2, mat('#e8b822'), 0, 0.02, -2, g); plane(2.8, 2.8, toon({ map: P.tex(P.stone(4), 2, 2), color: '#9ba0ac' }), 0, 0.03, -2, g);  // floor safety square
    add(tbox(2.2, 1.3, 0.06), mat('#f4f4f4'), -2, 2.4, -4.86, g); add(tbox(0.3, 0.3, 0.05), mat('#2255cc'), -2.6, 2.7, -4.82, g); add(tbox(0.5, 0.1, 0.05), mat('#cc2222'), -1.6, 2.2, -4.82, g);
    add(tbox(1.2, 1.7, 0.06), mat('#2d78d8'), 2, 2.3, -4.86, g); add(tbox(0.9, 0.2, 0.07), mat('#ffd21a'), 2, 2.95, -4.84, g);
    cyl(0.15, 0.6, mat('#dd2222'), -4.1, 0.3, -4.5, g, 10);
    // blast shield panels either side of the table
    for (const sx of [-1, 1]) { add(tbox(0.12, 1.8, 1.6), mat('#8ea0b8'), sx * 1.9, 0.9, -2, g); add(tbox(0.16, 0.12, 1.7), mat('#e8b822'), sx * 1.9, 1.85, -2, g); }
    for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(0.7, 0.28, 0.4), mat('#c9ad78'), -3.4 + (k % 3) * 0.72, 0.14 + Math.floor(k / 3) * 0.28, -3.6, g);   // sandbags
    // bomb table + tool table
    add(tbox(1.3, 0.06, 1.3), mat('#8a5a34'), 0, 0.75, -2, g);
    for (const [lx, lz] of [[-0.55, -1.5], [0.55, -1.5], [-0.55, -2.5], [0.55, -2.5]]) add(tbox(0.1, 0.75, 0.1), M.iron, lx, 0.375, lz, g);
    add(tbox(2.2, 0.06, 1.0), mat('#6a7080'), 3.2, 0.75, -2, g);
    for (const [lx, lz] of [[2.2, -1.6], [4.2, -1.6], [2.2, -2.4], [4.2, -2.4]]) add(tbox(0.1, 0.75, 0.1), M.iron, lx, 0.375, lz, g);
    add(tbox(0.3, 0.16, 0.22), mat('#dd2a2a'), 2.6, 0.86, -2, g); add(tbox(0.22, 0.12, 0.17), mat('#2a4ad8'), 3.3, 0.84, -1.8, g);
    add(tbox(0.5, 0.04, 0.1), mat('#9aa0aa'), 3.7, 0.8, -2.2, g); add(tbox(0.12, 0.04, 0.35), mat('#e8c020'), 3.0, 0.79, -2.25, g); add(tbox(0.28, 0.1, 0.18), mat('#2fa84a'), 3.9, 0.83, -1.75, g);
    // X-ray monitor, camera tripod, shelf, beacon, ceiling lights
    add(tbox(0.9, 0.7, 0.08), mat('#15181f'), 4.5, 1.6, -3.6, g); const xm = monitorTex(); screens.push({ k: 'xray', ...xm }); add(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ map: xm.t }), 4.5, 1.6, -3.55, g, { cast: false });
    add(tbox(1.4, 0.06, 0.4), M.wood, -3.8, 1.5, -4.6, g); for (let k = 0; k < 4; k++) add(tbox(0.3, 0.3, 0.3), mat(['#e86a2a', '#3a8ad8', '#e8c82a', '#5ab84a'][k]), -4.3 + k * 0.38, 1.7, -4.6, g);
    cyl(0.04, 1.6, mat('#222'), -3.2, 0.8, -1.2, g, 6); add(tbox(0.3, 0.2, 0.2), mat('#2a2a30'), -3.2, 1.65, -1.2, g);
    beacons.push(add(new THREE.SphereGeometry(0.18, 12, 10), bas('#ff3030'), 4.6, 3.0, -4.7, g));
    for (const x of [-2.5, 0, 2.5]) add(tbox(1.5, 0.06, 0.4), bas('#fff6dc'), x, 3.98, -2, g);
    // v2.1: more colour in the bomb room (teal band, lockers, barrels, cones, signs, poster)
    add(tbox(10, 0.28, 0.22), mat('#2fa8a0'), 0, 3.55, -4.9, g);
    for (const [lz, c] of [[-1.6, '#2fa8a0'], [-0.6, '#e8643a'], [0.4, '#7a4fc8'], [1.4, '#e8b822']]) { add(tbox(0.5, 1.9, 0.8), mat(c), -4.65, 0.95, lz, g); add(tbox(0.04, 0.5, 0.5), mat('#f4f4f4'), -4.38, 1.4, lz, g); }
    cyl(0.28, 0.9, mat('#7a4fc8'), 4.0, 0.45, -4.2, g, 14); cyl(0.28, 0.9, mat('#2fa8a0'), 4.5, 0.45, -3.3, g, 14);
    for (const [cx, cz] of [[-2.2, -0.4], [2.3, -0.5], [-3.3, -1.5]]) { cyl(0.2, 0.5, mat('#f07a1a'), cx, 0.25, cz, g, 12); cyl(0.205, 0.08, mat('#f6f6f6'), cx, 0.3, cz, g, 12); }
    add(tbox(0.9, 0.9, 0.06), mat('#ffd21a'), 3.9, 2.5, -4.86, g); add(tbox(0.12, 0.5, 0.07), mat('#22242c'), 3.9, 2.55, -4.83, g); add(tbox(0.12, 0.12, 0.07), mat('#22242c'), 3.9, 2.2, -4.83, g);
    add(tbox(1.0, 1.4, 0.06), mat('#c2457a'), -0.2, 2.45, -4.86, g);
    return g;
  },
  'CIRCUIT-VIEW': () => {
    const g = new THREE.Group();
    plane(4, 4, toon({ map: P.tex(P.stone(4), 3, 3), color: '#4a5266' }), 0, 0, 0, g);
    const BW = 0.5, BL = 0.8;
    const boardTex = canvasTex(500, 800, (c, w, h) => {
      c.fillStyle = '#12844a'; c.fillRect(0, 0, w, h); const r = P.rng(5);
      c.strokeStyle = '#37c47a'; c.lineWidth = 3; c.lineCap = 'round';
      for (let i = 0; i < 70; i++) { let x = 20 + r() * 460, y = 20 + r() * 760; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { if (k % 2) y += (r() - .5) * 160; else x += (r() - .5) * 160; c.lineTo(x, y); } c.stroke(); }
      c.fillStyle = '#e8c660'; for (let i = 0; i < 90; i++) { c.beginPath(); c.arc(20 + r() * 460, 20 + r() * 760, 3 + r() * 3, 0, 7); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,.8)'; c.font = '14px monospace'; for (let i = 0; i < 16; i++) c.fillText(['R' + i, 'C' + i, 'U' + (i % 5), 'D' + i][i % 4], 30 + r() * 420, 30 + r() * 740);
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3; c.strokeRect(10, 10, w - 20, h - 20);
    });
    add(new THREE.BoxGeometry(BW, 0.02, BL), toon({ map: boardTex, color: '#ffffff' }), 0, 0.02, 0, g);
    add(tbox(BW + 0.02, 0.012, BL + 0.02), mat('#0c5a32'), 0, 0.008, 0, g);
    const top = 0.03;
    // timer unit at the top (screen up = -z)
    add(tbox(0.3, 0.05, 0.12), mat('#6e7890'), 0, top + 0.025, -0.33, g); const ts = add(new THREE.PlaneGeometry(0.26, 0.085), timerMat, 0, top + 0.0525, -0.33, g, { cast: false }); ts.rotation.x = -Math.PI / 2;
    for (const [lx, c] of [[-0.12, '#ff2a2a'], [0.12, '#2aff5a']]) add(new THREE.SphereGeometry(0.008, 8, 6), bas(c), lx, top + 0.055, -0.385, g);
    // terminal block at the bottom
    const cols = ['#e02424', '#1fae2e', '#2a6be0', '#f2d21c', '#f08a14', '#f6f6f6'], wires = [];
    add(tbox(0.4, 0.035, 0.07), mat('#2a5fb8'), 0, top + 0.0175, 0.31, g);
    for (let i = 0; i < 6; i++) {
      const xs = -0.125 + i * 0.05, xe = xs + (i % 2 ? 0.006 : -0.006), bend = (i % 2 ? 1 : -1) * 0.007;
      cyl(0.011, 0.012, mat('#c9ccd4'), xs, top + 0.04, 0.31, g, 10);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(xs, top + 0.03, 0.31), new THREE.Vector3(xs + bend, top + 0.02, 0.2), new THREE.Vector3(xs - bend * 0.5, top + 0.022, 0.05), new THREE.Vector3(xe + bend, top + 0.02, -0.12), new THREE.Vector3(xe, top + 0.03, -0.27)]);
      const tube = add(new THREE.TubeGeometry(curve, 48, 0.0075, 8, false), mat(cols[i]), 0, 0, 0, g);
      cyl(0.013, 0.01, mat('#e8c660'), xe, top + 0.01, -0.27, g, 10); cyl(0.009, 0.014, mat('#e8c660'), xs, top + 0.012, 0.31, g, 10);
      wires.push(curve);
    }
    g.userData.wires = wires;
    // components in the margins and ends
    for (const sx of [-1, 1]) {
      add(tbox(0.07, 0.016, 0.1), mat('#17181d'), sx * 0.2, top + 0.008, -0.1, g); for (let k = 0; k < 6; k++) { add(tbox(0.012, 0.004, 0.006), mat('#b8bcc4'), sx * 0.2 - 0.04, top + 0.003, -0.14 + k * 0.016, g); add(tbox(0.012, 0.004, 0.006), mat('#b8bcc4'), sx * 0.2 + 0.04, top + 0.003, -0.14 + k * 0.016, g); }
      for (let k = 0; k < 3; k++) { cyl(0.014, 0.034, mat('#2a50d0'), sx * 0.2 + (k - 1) * 0.001, top + 0.017, 0.07 + k * 0.045, g, 10); cyl(0.012, 0.004, mat('#d8dce6'), sx * 0.2, top + 0.036, 0.07 + k * 0.045, g, 10); }
      for (let k = 0; k < 4; k++) { add(tbox(0.04, 0.012, 0.012), mat('#d9b27a'), sx * 0.215, top + 0.006, -0.25 + k * 0.025, g); add(tbox(0.006, 0.013, 0.013), mat('#e83a3a'), sx * 0.2 + 0.006, top + 0.006, -0.25 + k * 0.025, g); }
      add(new THREE.SphereGeometry(0.012, 8, 6), bas(sx > 0 ? '#ff4a3a' : '#3aff7a'), sx * 0.2, top + 0.014, 0.25, g);
    }
    cyl(0.03, 0.05, mat('#e8e8ee'), 0.02, top + 0.025, 0.36 - 0.0, g, 16).rotation.z = Math.PI / 2;
    // highlight ("tracer") chain, moved from worldState
    const hl = new THREE.Group(); for (let k = 0; k < 7; k++) hl.add(add(new THREE.SphereGeometry(0.012 - k * 0.001, 8, 6), bas('#ffffff'), 0, 0, 0, hl, { cast: false })); hl.visible = false; g.add(hl); g.userData.hl = hl;
    return g;
  },
  'CONTROL-ROOM': () => {
    const g = new THREE.Group();
    const tile = toon({ map: canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#e4e8f0'; c.fillRect(0, 0, w, h); c.fillStyle = '#9aa6bd'; c.fillRect(0, 0, 64, 64); c.fillRect(64, 64, 64, 64); }, 7, 7), color: '#ffffff' });
    plane(16, 16, tile, 0, 0, 0, g);
    const wallMat = toon({ map: P.tex(P.plaster(8), 6, 2), color: '#5f86b8' });
    add(tbox(16, 4.4, 0.2), wallMat, 0, 2.2, -7.5, g); add(tbox(0.2, 4.4, 16), mat('#4d6f9c'), -7.5, 2.2, 0, g); add(tbox(0.2, 4.4, 16), mat('#4d6f9c'), 7.5, 2.2, 0, g);
    add(tbox(16, 0.15, 16), mat('#dfe4ee'), 0, 4.5, 0, g);
    add(tbox(16, 0.5, 0.25), mat('#e8b822'), 0, 0.25, -7.4, g);
    // big wall screen with live map
    add(tbox(6.4, 3.2, 0.2), mat('#14171e'), 0, 2.5, -7.3, g); const big = monitorTex(320, 160); screens.push({ k: 'map', ...big });
    add(new THREE.PlaneGeometry(6.0, 2.8), new THREE.MeshBasicMaterial({ map: big.t }), 0, 2.5, -7.18, g, { cast: false });
    // desks: equipment left, monitors middle, storage right
    add(tbox(3, 1, 1.4), mat('#8f98a8'), -5.2, 0.5, -4.6, g); for (const [x, c] of [[-5.9, '#2a2a30'], [-5.2, '#d83a3a'], [-4.5, '#2a2a30']]) { add(tbox(0.5, 0.35, 0.35), mat(c), x, 1.18, -4.6, g); add(tbox(0.04, 0.4, 0.04), mat('#111'), x + 0.2, 1.5, -4.6, g); }
    add(tbox(9, 1, 2), mat('#a9b2c2'), 0.5, 0.5, -5.4, g); add(tbox(9.1, 0.08, 2.1), mat('#e7ebf2'), 0.5, 1.02, -5.4, g);
    for (let i = 0; i < 3; i++) {
      const x = -2.5 + i * 3, m = monitorTex(); screens.push({ k: 'mon' + i, ...m });
      add(tbox(1.4, 0.95, 0.1), mat('#14171e'), x, 1.9, -5.9, g); add(new THREE.PlaneGeometry(1.25, 0.8), new THREE.MeshBasicMaterial({ map: m.t }), x, 1.9, -5.83, g, { cast: false });
      cyl(0.06, 0.4, mat('#333'), x, 1.3, -5.9, g, 8); add(tbox(0.7, 0.04, 0.25), mat('#252830'), x, 1.06, -5.0, g);
      add(tbox(0.6, 0.1, 0.6), mat('#2b2f3c'), x, 0.55, -3.6, g); add(tbox(0.6, 0.7, 0.1), mat('#2b2f3c'), x, 0.95, -3.3, g); cyl(0.05, 0.4, mat('#9aa0aa'), x, 0.25, -3.6, g, 8);
    }
    for (let k = 0; k < 4; k++) { add(tbox(0.9, 2.6, 0.7), mat(['#7a8aa0', '#e8a22a', '#7a8aa0', '#d84a4a'][k]), 4.2 + k * 1.0, 1.3, -6.8, g); add(tbox(0.7, 0.06, 0.03), mat('#222'), 4.2 + k * 1.0, 1.7, -6.43, g); add(tbox(0.08, 0.2, 0.04), mat('#eee'), 4.5 + k * 1.0, 1.3, -6.43, g); }
    for (const x of [-5.5, -1, 3.5]) { add(tbox(2.2, 0.06, 0.5), bas('#f6fbff'), x, 4.38, -3, g); add(tbox(2.2, 0.06, 0.5), bas('#f6fbff'), x, 4.38, 0.5, g); }
    cyl(0.3, 0.06, mat('#fff'), -6.8, 3.3, -7.3, g, 20).rotation.x = Math.PI / 2;
    cyl(0.28, 0.4, mat('#b5603a'), 7, 0.2, -3, g, 10); add(new THREE.SphereGeometry(0.5, 10, 8), mat('#3fa84a'), 7, 0.85, -3, g);
    return g;
  },
  // the bomb. front (the display) faces +z. Built at ~2x real size so the timer reads on a phone.
  'bomb device': () => {
    const g = new THREE.Group();
    add(tbox(0.66, 0.2, 0.42), mat('#8d97ad'), 0, 0.1, 0, g);                       // v2.1: lighter steel case (was near black)
    add(tbox(0.665, 0.035, 0.425), mat('#e8b822'), 0, 0.045, 0, g);                 // yellow warning band along the bottom
    add(tbox(0.2, 0.06, 0.012), mat('#d8352f'), -0.2, 0.12, 0.215, g);              // red label on the front
    add(tbox(0.12, 0.06, 0.012), mat('#2a6be0'), 0.22, 0.12, 0.215, g);             // blue label on the front
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(tbox(0.06, 0.22, 0.06), mat('#c8cfdc'), sx * 0.31, 0.11, sz * 0.19, g);
    add(tbox(0.62, 0.02, 0.1), mat('#e8b822'), 0, 0.205, 0.14, g);
    const lid = add(tbox(0.66, 0.025, 0.42), mat('#a3adc2'), 0, 0.38, -0.3, g); lid.rotation.x = -1.15; lid.position.set(0, 0.34, -0.3);
    add(tbox(0.58, 0.012, 0.36), mat('#c4cad8'), 0, 0.203, -0.01, g);
    for (let i = 0; i < 4; i++) { const d = cyl(0.036, 0.3, mat('#d8352f'), -0.1 + i * 0.075, 0.25, -0.04, g, 10); d.rotation.z = Math.PI / 2; d.position.x = -0.12; d.position.z = -0.12 + i * 0.075; }
    add(tbox(0.04, 0.2, 0.34), mat('#d9c58a'), -0.12, 0.25, -0.04, g);
    add(tbox(0.18, 0.06, 0.12), mat('#2fa84a'), 0.2, 0.235, -0.1, g);
    cyl(0.025, 0.1, mat('#e8c660'), 0.24, 0.26, 0.04, g, 8);
    const disp = new THREE.Group(); add(tbox(0.36, 0.13, 0.05), mat('#2c3242'), 0, 0, 0, disp); add(new THREE.PlaneGeometry(0.32, 0.1), timerMat, 0, 0, 0.027, disp, { cast: false });
    for (const [lx, c] of [[-0.14, '#ff2a2a'], [0.14, '#2aff5a']]) add(new THREE.SphereGeometry(0.014, 8, 6), bas(c), lx, 0.082, 0.02, disp);
    disp.position.set(0, 0.235, 0.17); disp.rotation.x = -0.25; g.add(disp);
    // six exposed wires from the front panel into the box's front pocket
    const cols = ['#e02424', '#1fae2e', '#2a6be0', '#f2d21c', '#f08a14', '#f6f6f6'];
    cols.forEach((c, i) => { const x = -0.2 + i * 0.08; const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0.16, 0.2), new THREE.Vector3(x + 0.01, 0.1, 0.28), new THREE.Vector3(x * 1.2, 0.04, 0.34), new THREE.Vector3(x * 1.1, 0.03, 0.4)]); add(new THREE.TubeGeometry(curve, 16, 0.007, 6, false), mat(c), 0, 0, 0, g); });
    return g;
  },
  'six bomb wires': () => new THREE.Group(),
  'digital countdown display': () => new THREE.Group(),
  'circuit board': () => new THREE.Group(),
  'protective bomb disposal suit': () => new THREE.Group(),
};

const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const clouds = cloudsInit();

const cityStreet = ASSETS['CITY-STREET'](), policeOffice = ASSETS['POLICE-OFFICE'](), bombRoom = ASSETS['BOMB-ROOM'](), circuitView = ASSETS['CIRCUIT-VIEW'](), controlRoom = ASSETS['CONTROL-ROOM']();
const bombInRoom = ASSETS['bomb device'](); bombInRoom.position.set(0, 0.78, -2); bombRoom.add(bombInRoom);
world.add(cityStreet, policeOffice, bombRoom, circuitView, controlRoom);


function timerText(S, f) {
  const sf = f - (S.a || 0), sec = Math.floor(sf / 30);
  const T0 = { s4: [5, 3], s5: [9, 7], s6: [7, 6], s7: [6, 5], s8: [5, 3], s9: [4, 2], s10: [3, 1], s11: [8, 8], s13: [3, 2], s14: [3, 3] }[S.id] || [9, 9];
  const v = Math.max(T0[1], T0[0] - sec); return { text: '00:0' + v, stopped: S.id === 's14' || S.id === 's15' };
}
function updateTimer(S, f) {
  const { text, stopped } = timerText(S, f), on = stopped || (f % 30 < 20);
  timerCtx.fillStyle = '#05080a'; timerCtx.fillRect(0, 0, 256, 96);
  timerCtx.fillStyle = stopped ? '#46f08c' : (on ? '#ff3030' : '#a01818'); timerCtx.font = 'bold 82px monospace'; timerCtx.textAlign = 'center'; timerCtx.textBaseline = 'middle';
  timerCtx.fillText(text, 128, 50); timerTex.needsUpdate = true;
}
function drawScreens(f) {
  for (const s of screens) {
    const g = s.g, w = s.c.width, h = s.c.height;
    if (s.k === 'map') {
      g.fillStyle = '#10243e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2f6aa8'; g.lineWidth = 1;
      for (let x = 0; x < w; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.strokeStyle = '#ffd24a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 90); g.lineTo(120, 90); g.lineTo(150, 40); g.lineTo(320, 50); g.stroke(); g.strokeStyle = '#46d6c0'; g.beginPath(); g.moveTo(60, 160); g.lineTo(90, 90); g.lineTo(200, 120); g.lineTo(260, 160); g.stroke();
      const a = f * 0.08; g.strokeStyle = 'rgba(80,255,150,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(150, 80); g.lineTo(150 + Math.cos(a) * 90, 80 + Math.sin(a) * 70); g.stroke();
      g.fillStyle = (f % 24 < 12) ? '#ff3030' : '#802020'; g.beginPath(); g.arc(150, 80, 8, 0, 7); g.fill(); g.fillStyle = '#5affc0'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(40 + k * 60 + 10 * Math.sin(f * 0.05 + k), 130 - 10 * k, 4, 0, 7); g.fill(); }
    } else if (s.k === 'xray') {
      g.fillStyle = '#06222a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#4af0d8'; g.lineWidth = 2; g.strokeRect(30, 40, 100, 50); g.fillStyle = '#4af0d8'; g.fillRect(40, 50, 20, 30); for (let i = 0; i < 5; i++) g.fillRect(70 + i * 10, 52, 4, 26);
      g.fillStyle = 'rgba(74,240,216,.35)'; g.fillRect(0, (f * 2) % h, w, 6);
    } else {
      const i = +s.k.slice(3); g.fillStyle = ['#0c2b3a', '#2a1238', '#12301c'][i]; g.fillRect(0, 0, w, h);
      g.strokeStyle = ['#52e0ff', '#ff7ae0', '#7aff9a'][i]; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= w; x += 4) { const y = h / 2 + Math.sin((x + f * (3 + i)) * 0.07) * 24 * Math.sin((x * 0.02) + f * 0.03 + i); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      g.fillStyle = 'rgba(255,255,255,.15)'; for (let k = 0; k < 6; k++) g.fillRect(8, 10 + k * 18, 40 + ((f + k * 17 + i * 9) % 60), 6);
    }
    s.t.needsUpdate = true;
  }
}
const tracePath = [[-0.2, 0.28], [-0.2, -0.2], [0.2, -0.2], [0.2, 0.28], [-0.2, 0.28]];
function worldState(S, f) {
  cityStreet.visible = S.place === 'CITY-STREET'; policeOffice.visible = S.place === 'POLICE-OFFICE'; bombRoom.visible = S.place === 'BOMB-ROOM';
  circuitView.visible = S.place === 'CIRCUIT-VIEW'; controlRoom.visible = S.place === 'CONTROL-ROOM';
  updateTimer(S, f); waterU.t.value = f / 30;
  const ph = (f >> 2) & 1; for (const fl of flashers) { fl.a.material.color.set(ph ? '#ff1a1a' : '#3a0808'); fl.b.material.color.set(ph ? '#0a1a4a' : '#2a5cff'); }
  const pulse = 0.5 + 0.5 * Math.sin(f * 0.45); for (const b of beacons) b.material.color.setRGB(0.35 + 0.65 * pulse, 0.05 * pulse, 0.05 * pulse);
  if (controlRoom.visible || bombRoom.visible) drawScreens(f);
  const hl = circuitView.userData.hl, wires = circuitView.userData.wires; hl.visible = false;
  if (circuitView.visible && wires) {
    const sf = Math.max(0, Math.min(S.b - S.a, f - S.a));   // v2.2: clamp, a blended frame can lie outside its shot
    if (S.id === 's9') { const len = (S.b - S.a + 1), k = (sf / len) * 6, wi = Math.min(5, Math.floor(k)), t = k - Math.floor(k); hl.visible = true;
      hl.children.forEach((c, j) => { const p = wires[wi].getPoint(Math.max(0, Math.min(1, 1 - (t * 1.15 - j * 0.03)))); c.position.set(p.x, p.y + 0.012, p.z); }); }
    else if (S.id === 's8') { const len = S.b - S.a + 1, u = (sf / len) * 4, seg = Math.min(3, Math.floor(u)), t = u - seg; hl.visible = true;
      hl.children.forEach((c, j) => { const tt = Math.max(0, t - j * 0.02), a = tracePath[seg], b = tracePath[seg + 1]; c.position.set(a[0] + (b[0] - a[0]) * tt, 0.05, a[1] + (b[1] - a[1]) * tt); }); }
  }
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
