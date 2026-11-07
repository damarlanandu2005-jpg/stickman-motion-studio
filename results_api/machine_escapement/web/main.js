import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt } from './story.js';
import * as STORY from './story.js';
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

// ---------- world ----------
const DECK = 0;
const world = new THREE.Group(); scene.add(world);

M.brass = toon({ color: '#d4af37' });
M.steel = toon({ color: '#a0a5ab' });
M.copper = toon({ color: '#b87333' });
M.ruby = toon({ color: '#cc1133' });
M.darkMetal = toon({ color: '#333333' });
M.blueprint = toon({ color: '#1144aa' });
M.blueSteel = toon({ color: '#2244aa' });
M.darkBlueMetal = toon({ color: '#2a3b4c' });

const ASSETS = {
  'WORKSHOP': () => {
    const ws = new THREE.Group();
    // Room
    add(tbox(8, 0.1, 6, 2), M.plank, 0, -0.05, 0, ws); // Floor
    add(tbox(8, 4, 0.1, 2), M.plaster, 0, 2, -3, ws); // Back wall
    add(tbox(0.1, 4, 6, 2), M.plaster, -4, 2, 0, ws); // Left wall
    add(tbox(0.1, 4, 6, 2), M.plaster, 4, 2, 0, ws); // Right wall
    add(tbox(8, 0.1, 6, 2), M.plaster2, 0, 4.05, 0, ws); // Ceiling
    
    // Workbench
    add(tbox(2.5, 0.1, 1.2, 1), M.wood, 0, 0.95, -1, ws); // Top
    add(tbox(0.1, 0.9, 1.0, 1), M.wood, -1.1, 0.45, -1, ws); // Leg L
    add(tbox(0.1, 0.9, 1.0, 1), M.wood, 1.1, 0.45, -1, ws); // Leg R
    
    // Stool
    add(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), M.wood, 0, 0.5, 0.5, ws);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), M.wood, 0, 0.25, 0.5, ws);
    add(tbox(0.4, 0.05, 0.4, 1), M.wood, 0, 0.025, 0.5, ws);
    
    // Window on right
    add(tbox(1.6, 1.6, 0.2, 1), M.wood, 3.9, 2, -1, ws); // Frame outer
    add(tbox(1.4, 1.4, 0.1, 1), toon({color:'#aaddff', transparent: true, opacity: 0.5}), 3.9, 2, -1, ws); // Glass
    add(tbox(1.4, 0.1, 0.15, 1), M.wood, 3.9, 2, -1, ws); // Mullion H
    add(tbox(0.1, 1.4, 0.15, 1), M.wood, 3.9, 2, -1, ws); // Mullion V
    // View outside window
    add(tbox(0.1, 4, 4, 2), toon({color:'#4488cc'}), 4.5, 2, -1, ws); // Sky
    add(tbox(0.1, 2, 4, 2), toon({color:'#336622'}), 4.4, 0.5, -1, ws); // Ground
    
    // Tools on left wall
    add(tbox(1.5, 0.8, 0.1, 1), M.wood, -3.9, 2, -1, ws); // Tool board
    for(let i=0; i<3; i++) {
        // Hammers / wrenches
        add(box(0.05, 0.3, 0.05), M.iron, -3.8, 2.1, -1.5 + i*0.3, ws);
        add(box(0.15, 0.05, 0.05), M.iron, -3.8, 2.25, -1.5 + i*0.3, ws);
    }
    // Some gears hanging
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8), M.brass, -3.8, 1.8, -1.2, ws).rotation.z = Math.PI/2;
    add(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 8), M.brass, -3.8, 1.7, -0.7, ws).rotation.z = Math.PI/2;
    
    // Shelf on back wall
    add(tbox(2, 0.05, 0.3, 1), M.wood, -2, 2.5, -2.9, ws);
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8), toon({color:'#ccddff'}), -2.5, 2.6, -2.8, ws);
    add(new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8), toon({color:'#ffddcc'}), -1.5, 2.575, -2.8, ws);
    
    // Blueprints on back wall
    add(tbox(1.0, 0.8, 0.02, 1), M.blueprint, 2, 2.2, -2.95, ws);
    add(tbox(0.8, 0.6, 0.02, 1), M.blueprint, 1.5, 1.5, -2.95, ws);
    
    // Clutter on desk
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8), M.brass, -0.8, 1.01, -0.8, ws);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8), M.brass, -0.6, 1.01, -0.9, ws);
    add(box(0.2, 0.02, 0.05), M.iron, 0.8, 1.01, -0.7, ws);
    
    // Lamp
    add(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16), M.iron, 0, 3.9, -1, ws);
    add(new THREE.SphereGeometry(0.15, 8, 8), toon({color:'#ffeedd'}), 0, 3.8, -1, ws);
    
    // Interior Light
    const light = new THREE.PointLight('#ffeedd', 2.5, 12);
    light.position.set(0, 3.5, -1);
    ws.add(light);
    
    return ws;
  },
  'CLOCK-INTERIOR': () => {
    const ci = new THREE.Group();
    // Back plate - dark metal
    add(tbox(1.2, 1.2, 0.05, 1), M.darkMetal, 0, 0.5, -0.2, ci);
    // Side walls to enclose
    add(tbox(0.05, 1.2, 0.4, 1), M.brass, -0.6, 0.5, 0, ci);
    add(tbox(0.05, 1.2, 0.4, 1), M.brass, 0.6, 0.5, 0, ci);
    
    // Screws on backplate (Blue Steel)
    for(let x of [-0.5, -0.2, 0.2, 0.5]) {
        for(let y of [0.1, 0.5, 0.9]) {
            const screw = add(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 8), M.blueSteel, x, y, -0.17, ci);
            screw.rotation.x = Math.PI/2;
            add(box(0.04, 0.005, 0.005), M.darkMetal, x, y, -0.16, ci); // slot
        }
    }

    // Background static gears (copper/brass mix)
    const bgGear1 = add(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16), M.copper, -0.3, 0.7, -0.15, ci); bgGear1.rotation.x = Math.PI/2;
    const bgGear2 = add(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 16), M.brass, 0.3, 0.3, -0.15, ci); bgGear2.rotation.x = Math.PI/2;
    
    // Details behind mainspring
    add(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 32), M.copper, -0.3, 0.5, -0.18, ci).rotation.x = Math.PI/2;
    for(let i=0; i<6; i++) {
        const a = (i/6)*Math.PI*2;
        add(new THREE.CylinderGeometry(0.01, 0.01, 0.02, 8), M.blueSteel, -0.3+Math.cos(a)*0.09, 0.5+Math.sin(a)*0.09, -0.17, ci).rotation.x = Math.PI/2;
    }

    // Standoffs (steel)
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), M.steel, -0.4, 0.8, -0.1, ci).rotation.x = Math.PI/2;
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), M.steel, 0.4, 0.8, -0.1, ci).rotation.x = Math.PI/2;
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), M.steel, -0.4, 0.2, -0.1, ci).rotation.x = Math.PI/2;
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), M.steel, 0.4, 0.2, -0.1, ci).rotation.x = Math.PI/2;
    
    // Bridge plate (brass)
    add(tbox(0.8, 0.1, 0.02, 1), M.brass, 0, 0.8, 0.02, ci);
    add(tbox(0.8, 0.1, 0.02, 1), M.brass, 0, 0.2, 0.02, ci);
    
    // Ruby bearings on bridge
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 8), M.ruby, -0.2, 0.8, 0.03, ci).rotation.x = Math.PI/2;
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 8), M.ruby, 0.2, 0.2, 0.03, ci).rotation.x = Math.PI/2;

    // Add some blue screws to the bridge
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 8), M.blueSteel, -0.35, 0.8, 0.03, ci).rotation.x = Math.PI/2;
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 8), M.blueSteel, 0.35, 0.8, 0.03, ci).rotation.x = Math.PI/2;
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 8), M.blueSteel, -0.35, 0.2, 0.03, ci).rotation.x = Math.PI/2;
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 8), M.blueSteel, 0.35, 0.2, 0.03, ci).rotation.x = Math.PI/2;

    // Local light to ensure visibility
    const light = new THREE.PointLight('#ffffff', 0.8, 3);
    light.position.set(0, 0.5, 0.5);
    ci.add(light);

    return ci;
  },
  'ESCAPEMENT-VIEW': () => {
    const ev = new THREE.Group();
    // Base plate - dark blue metal for high contrast
    add(tbox(0.6, 0.6, 0.02, 1), M.darkBlueMetal, 0, 0, -0.1, ev);
    
    // Decorative engraving/recesses on base plate
    add(new THREE.CylinderGeometry(0.15, 0.15, 0.022, 32), M.darkMetal, 0, 0, -0.1, ev).rotation.x = Math.PI/2;
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.022, 32), M.darkMetal, 0, 0.1, -0.1, ev).rotation.x = Math.PI/2;

    // Background gears (copper, brass, steel)
    const bg1 = add(new THREE.CylinderGeometry(0.12, 0.12, 0.01, 16), M.copper, -0.1, 0.1, -0.08, ev); bg1.rotation.x = Math.PI/2;
    for(let i=0; i<12; i++) { add(box(0.02, 0.02, 0.01), M.copper, -0.1+Math.cos(i*Math.PI/6)*0.12, 0.1+Math.sin(i*Math.PI/6)*0.12, -0.08, ev).rotation.z = i*Math.PI/6; }
    
    const bg2 = add(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 16), M.steel, 0.12, -0.05, -0.06, ev); bg2.rotation.x = Math.PI/2;
    for(let i=0; i<10; i++) { add(box(0.02, 0.02, 0.01), M.steel, 0.12+Math.cos(i*Math.PI/5)*0.1, -0.05+Math.sin(i*Math.PI/5)*0.1, -0.06, ev).rotation.z = i*Math.PI/5; }

    const bg3 = add(new THREE.CylinderGeometry(0.08, 0.08, 0.01, 16), M.brass, -0.12, -0.1, -0.07, ev); bg3.rotation.x = Math.PI/2;

    // Mid-ground bridge plate (steel)
    const bridge = add(tbox(0.35, 0.35, 0.01, 1), M.steel, 0, 0, -0.04, ev);
    // Cutout in bridge to see background
    add(new THREE.CylinderGeometry(0.08, 0.08, 0.012, 32), M.darkBlueMetal, 0, 0, -0.04, ev).rotation.x = Math.PI/2; 
    
    // Screws (Blue Steel and Copper) on the bridge
    for(let x of [-0.12, 0.12]) {
        for(let y of [-0.12, 0.12]) {
            const mat = (x === y) ? M.blueSteel : M.copper;
            const screw = add(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 8), mat, x, y, -0.035, ev);
            screw.rotation.x = Math.PI/2;
            add(box(0.024, 0.004, 0.004), M.darkMetal, x, y, -0.03, ev); // slot
        }
    }

    // Pivot holes/mounts with rubies
    const p1 = add(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 16), M.brass, 0, 0, -0.03, ev); p1.rotation.x = Math.PI/2; // Wheel pivot
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.022, 8), M.ruby, 0, 0, -0.03, ev).rotation.x = Math.PI/2;
    
    const p2 = add(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 16), M.brass, 0, 0.10, -0.03, ev); p2.rotation.x = Math.PI/2; // Anchor pivot
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.022, 8), M.ruby, 0, 0.10, -0.03, ev).rotation.x = Math.PI/2;

    // Some surface detail (raised copper bars)
    add(tbox(0.25, 0.015, 0.01, 1), M.copper, 0, -0.1, -0.035, ev);
    add(tbox(0.015, 0.25, 0.01, 1), M.copper, -0.1, 0, -0.035, ev);
    
    // Local light
    const light = new THREE.PointLight('#ffffff', 1.0, 1.5);
    light.position.set(0, 0, 0.2);
    ev.add(light);

    return ev;
  },
  'mechanical clock': () => {
    const clock = new THREE.Group();
    // Case
    add(tbox(0.35, 0.4, 0.2, 1), M.wood, 0, 0.25, 0, clock);
    // Base
    add(tbox(0.4, 0.05, 0.25, 1), M.wood, 0, 0.025, 0, clock);
    // Top
    add(tbox(0.4, 0.05, 0.25, 1), M.wood, 0, 0.475, 0, clock);
    const topArch = add(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 16), M.wood, 0, 0.5, 0, clock);
    topArch.rotation.x = Math.PI/2;
    
    // Face
    const face = add(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 32), toon({color:'#ffffff'}), 0, 0.28, 0.1, clock);
    face.rotation.x = Math.PI/2;
    // Hands (Gold)
    add(box(0.01, 0.08, 0.01), M.brass, 0, 0.32, 0.12, clock); // Minute
    add(box(0.06, 0.01, 0.01), M.brass, 0.03, 0.28, 0.12, clock); // Hour
    // Center pin
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 8), M.brass, 0, 0.28, 0.125, clock).rotation.x = Math.PI/2;
    
    return clock;
  },
  'mainspring': () => {
    const spring = new THREE.Group();
    // Barrel (brass)
    const barrel = add(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 32), M.brass, 0, 0, 0, spring);
    barrel.rotation.x = Math.PI/2;
    // Barrel teeth (gear on the outside)
    for(let i=0; i<30; i++) {
        const a = (i/30)*Math.PI*2;
        add(box(0.02, 0.04, 0.01), M.brass, Math.cos(a)*0.1, Math.sin(a)*0.1, 0, spring).rotation.z = a;
    }
    // Inner dark area
    const inside = add(new THREE.CylinderGeometry(0.095, 0.095, 0.041, 32), M.darkMetal, 0, 0, 0, spring);
    inside.rotation.x = Math.PI/2;
    // Center arbor (steel)
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 16), M.steel, 0, 0, 0, spring).rotation.x = Math.PI/2;
    add(new THREE.CylinderGeometry(0.01, 0.01, 0.052, 8), M.ruby, 0, 0, 0, spring).rotation.x = Math.PI/2;
    // Coiled band
    for(let i=0; i<120; i++) {
        const a = i * 0.2;
        const r = 0.025 + i * 0.0005;
        add(box(0.005, 0.04, 0.015), M.steel, Math.cos(a)*r, Math.sin(a)*r, 0, spring).rotation.z = a;
    }
    return spring;
  },
  'gear stack': () => {
    const gears = new THREE.Group();
    // Gear 1 (large)
    const g1 = add(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16), M.brass, 0, 0, 0, gears); g1.rotation.x = Math.PI/2;
    for(let i=0; i<16; i++) { const a = (i/16)*Math.PI*2; add(box(0.04, 0.04, 0.02), M.brass, Math.cos(a)*0.15, Math.sin(a)*0.15, 0, gears).rotation.z = a; }
    // Cutouts for Gear 1
    for(let i=0; i<4; i++) {
        const a = (i/4)*Math.PI*2;
        const hole = add(new THREE.CylinderGeometry(0.04, 0.04, 0.022, 16), M.darkMetal, Math.cos(a)*0.08, Math.sin(a)*0.08, 0, gears);
        hole.rotation.x = Math.PI/2;
    }
    // Hub 1
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 16), M.steel, 0, 0, 0, gears).rotation.x = Math.PI/2;

    // Gear 2 (small)
    const g2 = add(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16), M.brass, 0, 0, 0.05, gears); g2.rotation.x = Math.PI/2;
    for(let i=0; i<12; i++) { const a = (i/12)*Math.PI*2; add(box(0.03, 0.03, 0.02), M.brass, Math.cos(a)*0.1, Math.sin(a)*0.1, 0.05, gears).rotation.z = a; }
    // Cutouts for Gear 2
    for(let i=0; i<3; i++) {
        const a = (i/3)*Math.PI*2;
        const hole = add(new THREE.CylinderGeometry(0.03, 0.03, 0.022, 16), M.darkMetal, Math.cos(a)*0.05, Math.sin(a)*0.05, 0.05, gears);
        hole.rotation.x = Math.PI/2;
    }
    // Hub 2
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.025, 16), M.steel, 0, 0, 0.05, gears).rotation.x = Math.PI/2;

    return gears;
  },
  'escapement wheel': () => {
    const esc = new THREE.Group();
    // Rim (Brass)
    const rim = add(new THREE.TorusGeometry(0.065, 0.01, 8, 32), M.brass, 0, 0, 0, esc);
    
    for(let i=0; i<15; i++) {
        const a = (i/15)*Math.PI*2;
        const tooth = add(box(0.03, 0.008, 0.015), M.brass, Math.cos(a)*0.075, Math.sin(a)*0.075, 0, esc);
        tooth.rotation.z = a + Math.PI/4;
        // Steel tip
        const tip = add(box(0.01, 0.009, 0.016), M.steel, Math.cos(a)*0.085, Math.sin(a)*0.085, 0, esc);
        tip.rotation.z = a + Math.PI/4;
    }
    // Spokes (Steel to break up the yellow)
    for(let i=0; i<5; i++) {
        const a = (i/5)*Math.PI*2;
        const spoke = add(box(0.06, 0.008, 0.01), M.steel, Math.cos(a)*0.035, Math.sin(a)*0.035, 0, esc);
        spoke.rotation.z = a;
    }
    // Hub
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 16), M.brass, 0, 0, 0, esc).rotation.x = Math.PI/2;
    add(new THREE.CylinderGeometry(0.008, 0.008, 0.022, 16), M.steel, 0, 0, 0, esc).rotation.x = Math.PI/2;
    add(new THREE.CylinderGeometry(0.004, 0.004, 0.024, 8), M.ruby, 0, 0, 0, esc).rotation.x = Math.PI/2;
    
    return esc;
  },
  'anchor piece': () => {
    const anchor = new THREE.Group();
    // Pivot hub
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 16), M.steel, 0, 0, 0, anchor).rotation.x = Math.PI/2;
    add(new THREE.CylinderGeometry(0.008, 0.008, 0.022, 16), M.brass, 0, 0, 0, anchor).rotation.x = Math.PI/2;
    add(new THREE.CylinderGeometry(0.004, 0.004, 0.024, 8), M.ruby, 0, 0, 0, anchor).rotation.x = Math.PI/2;
    
    // Body
    const curve = add(new THREE.TorusGeometry(0.08, 0.01, 8, 16, Math.PI), M.steel, 0, -0.02, 0, anchor);
    curve.rotation.z = Math.PI; 
    
    // Arms connecting pivot to curve
    const armL = add(box(0.08, 0.01, 0.01), M.steel, -0.035, -0.01, 0, anchor);
    armL.rotation.z = -Math.PI/6;
    const armR = add(box(0.08, 0.01, 0.01), M.steel, 0.035, -0.01, 0, anchor);
    armR.rotation.z = Math.PI/6;

    // Brass weights on the arms for color
    const wL = add(new THREE.CylinderGeometry(0.015, 0.015, 0.015, 16), M.brass, -0.05, -0.01, 0, anchor);
    wL.rotation.x = Math.PI/2;
    const wR = add(new THREE.CylinderGeometry(0.015, 0.015, 0.015, 16), M.brass, 0.05, -0.01, 0, anchor);
    wR.rotation.x = Math.PI/2;

    // Hooks
    const lHook = add(box(0.015, 0.03, 0.015), M.steel, -0.08, -0.03, 0, anchor);
    lHook.rotation.z = -Math.PI/8;
    const lPallet = add(box(0.025, 0.012, 0.016), M.ruby, -0.085, -0.045, 0, anchor);
    lPallet.rotation.z = -Math.PI/8;
    // Screw holding pallet
    const lScrew = add(new THREE.CylinderGeometry(0.004, 0.004, 0.018, 8), M.blueSteel, -0.08, -0.035, 0, anchor);
    lScrew.rotation.x = Math.PI/2;

    const rHook = add(box(0.015, 0.03, 0.015), M.steel, 0.08, -0.03, 0, anchor);
    rHook.rotation.z = Math.PI/8;
    const rPallet = add(box(0.025, 0.012, 0.016), M.ruby, 0.085, -0.045, 0, anchor);
    rPallet.rotation.z = Math.PI/8;
    // Screw holding pallet
    const rScrew = add(new THREE.CylinderGeometry(0.004, 0.004, 0.018, 8), M.blueSteel, 0.08, -0.035, 0, anchor);
    rScrew.rotation.x = Math.PI/2;

    return anchor;
  },
  'swinging pendulum': () => {
    const pen = new THREE.Group();
    // Pivot hole extends from -0.01 to +0.01
    add(new THREE.CylinderGeometry(0.01, 0.01, 0.02, 8), toon({color:'#000000'}), 0, 0, 0, pen).rotation.x = Math.PI/2;
    // Rod (0.43m long, centered at -0.215m)
    add(box(0.015, 0.43, 0.015), M.brass, 0, -0.215, 0, pen);
    // Bob (0.12m diameter, centered at -0.43m) -> extends down to -0.49m
    // Total height = +0.01 to -0.49 = 0.50m
    const bob = add(new THREE.CylinderGeometry(0.06, 0.06, 0.025, 32), M.brass, 0, -0.43, 0, pen); 
    bob.rotation.x = Math.PI/2;
    return pen;
  }
};

const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const clouds = cloudsInit();

const ws = ASSETS['WORKSHOP'](); world.add(ws); ws.position.set(0, 0, 0);
const ci = ASSETS['CLOCK-INTERIOR'](); world.add(ci); ci.position.set(10, 0, 0);
const ev = ASSETS['ESCAPEMENT-VIEW'](); world.add(ev); ev.position.set(20, 0, 0);

const parts = {};
parts.clock = ASSETS['mechanical clock'](); world.add(parts.clock); parts.clock.position.set(0, 1.0, -1);
parts.spring = ASSETS['mainspring'](); world.add(parts.spring); parts.spring.position.set(9.7, 0.5, 0);
parts.gears = ASSETS['gear stack'](); world.add(parts.gears); parts.gears.position.set(10, 0.5, 0);
parts.pendulum1 = ASSETS['swinging pendulum'](); world.add(parts.pendulum1); parts.pendulum1.position.set(10.3, 0.8, 0);

parts.escWheel = ASSETS['escapement wheel'](); world.add(parts.escWheel); parts.escWheel.position.set(20, 0, 0);
parts.anchor = ASSETS['anchor piece'](); world.add(parts.anchor); parts.anchor.position.set(20, 0.10, 0);
parts.pendulum2 = ASSETS['swinging pendulum'](); world.add(parts.pendulum2); parts.pendulum2.position.set(20, 0.10, 0);

function worldState(S, f) {
  const t = f / 30;
  let speed = S.id === 's3' ? 10 : 1;
  let tickT = t * 2 * speed;
  let tickPhase = tickT % 1;
  let tickCount = Math.floor(tickT);

  let wheelAngle = -(tickCount + (tickPhase * tickPhase * (3 - 2 * tickPhase))) * (Math.PI * 2 / 15);
  let swingAngle = Math.sin(tickT * Math.PI) * 0.15;

  parts.escWheel.rotation.z = wheelAngle;
  parts.anchor.rotation.z = swingAngle;
  parts.pendulum1.rotation.z = swingAngle;
  parts.pendulum2.rotation.z = swingAngle;

  parts.gears.rotation.z = -wheelAngle * 0.5;
  parts.spring.rotation.z = -wheelAngle * 0.1;

  if (S.id === 's11') {
      parts.spring.scale.setScalar(1 + Math.sin(t * 10) * 0.05);
  } else {
      parts.spring.scale.setScalar(1);
  }

  waterU.t.value = t;
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
  sat: { value: 1.08 }, vibr: { value: 0 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 } };
const inkScene = fs(new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vibr, vig, flash; uniform vec3 fogCol, lift, gain; varying vec2 vUv;
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
  inkU.px.value = 2.5; inkU.flash.value = window.DEBUG_E ? -1 : (C.flash || 0); inkU.vig.value = L.vig ?? 0.22;
  renderer.setRenderTarget(rtInk); renderer.render(inkScene, fsCam);
  // lens
  dofU.focus.value = D.focus; dofU.cinf.value = D.cinf; dofU.near.value = D.near ?? 1;
  renderer.setRenderTarget(null); renderer.render(dofScene, fsCam);
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
