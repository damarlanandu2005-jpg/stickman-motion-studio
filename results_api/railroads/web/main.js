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

const ASSETS = {
  'TRACK-VIEW': () => {
    const g = new THREE.Group();
    add(tbox(2.4, 0.2, 4), M.stone, 0, -0.1, 0, g);
    add(tbox(6, 0.1, 4), M.dirt, 0, -0.15, 0, g);
    
    // Ballast - more dense and varied
    const ballastGeo1 = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    const ballastGeo2 = new THREE.BoxGeometry(0.08, 0.04, 0.06);
    const ballastList1 = [], ballastList2 = [];
    for(let i=0; i<300; i++) {
      ballastList1.push(placed(ballastGeo1, (Math.random()-0.5)*2.2, 0.02, (Math.random()-0.5)*3.8, Math.random()*Math.PI, 1, 1, 1));
      ballastList2.push(placed(ballastGeo2, (Math.random()-0.5)*2.2, 0.02, (Math.random()-0.5)*3.8, Math.random()*Math.PI, 1, 1, 1));
    }
    add(mergeGeos(ballastList1), toon({color: '#7a7a7a'}), 0, 0, 0, g);
    add(mergeGeos(ballastList2), toon({color: '#6a6a6a'}), 0, 0, 0, g);

    for (let i = -3; i <= 3; i++) {
      add(tbox(0.25, 0.12, 1.8), M.wood, i * 0.6, 0.06, 0, g);
      add(tbox(0.15, 0.02, 0.2), M.iron, i * 0.6, 0.13, 0.4, g);
      add(tbox(0.15, 0.02, 0.2), M.iron, i * 0.6, 0.13, -0.4, g);
      // Add spikes
      add(tbox(0.02, 0.05, 0.02), M.iron, i * 0.6 + 0.1, 0.15, 0.45, g);
      add(tbox(0.02, 0.05, 0.02), M.iron, i * 0.6 - 0.1, 0.15, -0.45, g);
    }
    for (let i = 0; i < 30; i++) {
      add(tbox(0.1, 0.2, 0.1), M.grass, (Math.random()-0.5)*2.5, 0, (Math.random()-0.5)*3.8, g);
    }
    add(tbox(0.4, 0.6, 0.4), M.wood, 1.5, 0.3, 1.5, g); // barrel/crate
    add(tbox(0.5, 0.1, 0.2), M.iron, -1.2, 0.05, -1.0, g); // random tool/metal scrap
    return g;
  },
  'CANYON-EDGE': () => {
    const g = new THREE.Group();
    add(tbox(15, 20, 30), M.stone, -7.5, -10, 0, g);
    add(tbox(15, 0.2, 30), M.dirt, -7.5, 0.1, 0, g);
    
    // Dressing
    for (let i = 0; i < 8; i++) {
      add(new THREE.ConeGeometry(1, 3, 5), M.pine, -10 + Math.random()*5, 1.5, (Math.random()-0.5)*20, g);
      add(tbox(1, 1, 1), M.wood, -5 + Math.random()*2, 0.5, (Math.random()-0.5)*10, g); // crates
      add(new THREE.DodecahedronGeometry(0.8), M.stone, -2 + Math.random()*2, 0.4, (Math.random()-0.5)*15, g); // rocks
    }

    const bridge = new THREE.Group();
    g.add(bridge);
    add(tbox(8, 0.4, 0.4), M.wood, 4, -0.2, 1, bridge);
    add(tbox(8, 0.4, 0.4), M.wood, 4, -0.2, -1, bridge);
    for (let i = 0; i < 12; i++) {
      add(tbox(0.3, 0.2, 3), M.wood, i * 0.6, 0.1, 0, bridge);
    }
    for (let i = 1; i < 4; i++) {
      add(tbox(0.3, 10, 0.3), M.wood, i * 2, -5, 1, bridge);
      add(tbox(0.3, 10, 0.3), M.wood, i * 2, -5, -1, bridge);
      const cross = add(tbox(0.2, 4, 0.2), M.wood, i * 2, -2, 0, bridge);
      cross.rotation.x = Math.PI / 4;
    }
    return g;
  },
  'STATION': () => {
    const g = new THREE.Group();
    add(tbox(20, 1, 6), M.plank, 0, 0.5, 3, g);
    add(tbox(8, 4, 4), M.plaster, -4, 3, 5, g);
    const roof = add(tbox(9, 0.4, 6), M.roof, -4, 5.2, 4, g);
    roof.rotation.x = -0.1;
    add(new THREE.PlaneGeometry(2, 1.5), toon({color: '#2b2430'}), -3, 2.5, 2.9, g);
    add(new THREE.PlaneGeometry(1.2, 2.5), M.door, -6, 2.25, 2.9, g);
    
    // Dressing
    add(tbox(2, 0.5, 0.5), toon({color: '#2f5f3f'}), 2, 1.25, 4, g); // bench
    add(tbox(2, 0.5, 0.5), toon({color: '#2f5f3f'}), 6, 1.25, 4, g); // bench
    add(tbox(0.8, 0.6, 0.4), toon({color: '#8f3f3f'}), 4, 1.3, 3.5, g); // luggage
    add(tbox(0.6, 0.8, 0.3), toon({color: '#3f4f8f'}), 4.5, 1.4, 3.2, g); // luggage

    add(tbox(20, 0.2, 6), M.stone, 0, 0.1, -3, g);
    add(tbox(20, 0.15, 0.15), M.iron, 0, 0.275, -2.6, g);
    add(tbox(20, 0.15, 0.15), M.iron, 0, 0.275, -3.4, g);
    for(let i=-10; i<=10; i+=0.6) add(tbox(0.2, 0.12, 1.8), M.wood, i, 0.16, -3, g);
    return g;
  },
  'BRIDGE-WIDE': () => {
    const g = new THREE.Group();
    add(tbox(15, 40, 30), M.stone, -25, -20, 0, g);
    add(tbox(15, 40, 30), M.stone, 25, -20, 0, g);
    add(tbox(15, 0.2, 30), M.dirt, -25, 0.1, 0, g);
    add(tbox(15, 0.2, 30), M.dirt, 25, 0.1, 0, g);
    
    // River
    add(new THREE.PlaneGeometry(35, 30), toon({color: '#3f7f9f'}), 0, -35, 0, g).rotation.x = -Math.PI/2;

    const bridge = new THREE.Group();
    g.add(bridge);
    add(tbox(35, 0.4, 0.4), M.wood, 0, -0.2, 1.5, bridge);
    add(tbox(35, 0.4, 0.4), M.wood, 0, -0.2, -1.5, bridge);
    for (let x = -17.4; x <= 17.4; x += 0.6) {
      add(tbox(0.3, 0.2, 4), M.wood, x, 0.1, 0, bridge);
    }
    for (let x = -16; x <= 16; x += 4) {
      add(tbox(0.4, 30, 0.4), M.wood, x, -15, 1.5, bridge);
      add(tbox(0.4, 30, 0.4), M.wood, x, -15, -1.5, bridge);
      for(let y = -5; y >= -25; y -= 5) {
        add(tbox(0.3, 0.3, 4), M.wood, x, y, 0, bridge);
        if (x < 16) {
          add(tbox(4, 0.3, 0.3), M.wood, x+2, y, 1.5, bridge);
          add(tbox(4, 0.3, 0.3), M.wood, x+2, y, -1.5, bridge);
        }
      }
      if (x < 16) {
        for(let y = -2.5; y >= -22.5; y -= 5) {
          const cross1 = add(tbox(0.2, 6, 0.2), M.wood, x+2, y, 1.3, bridge);
          cross1.rotation.z = Math.PI / 4;
          const cross2 = add(tbox(0.2, 6, 0.2), M.wood, x+2, y, -1.3, bridge);
          cross2.rotation.z = -Math.PI / 4;
        }
      }
    }
    return g;
  },
  'steel rail': () => {
    const g = new THREE.Group();
    add(tbox(12, 0.15, 0.15), M.iron, 0, 0.075, 0, g);
    return g;
  },
  'hand saw': () => {
    const g = new THREE.Group();
    add(tbox(0.12, 0.15, 0.04), M.wood, -0.24, 0, 0, g);
    add(tbox(0.04, 0.1, 0.04), M.wood, -0.28, -0.05, 0, g);
    add(tbox(0.45, 0.12, 0.01), M.iron, 0.045, -0.015, 0, g);
    return g;
  },
  'train': () => {
    const g = new THREE.Group();
    const black = toon({ color: '#1a1a1a' });
    const red = toon({ color: '#8a2a2a' });
    const grey = toon({ color: '#4a4a4a' });
    add(tbox(14, 0.5, 3.2), black, 0, 1.5, 0, g);
    const boiler = add(new THREE.CylinderGeometry(1.4, 1.4, 9, 16), black, 1.5, 3.2, 0, g);
    boiler.rotation.z = Math.PI / 2;
    add(tbox(4, 4.5, 3.4), red, -5, 4, 0, g);
    add(tbox(4.4, 0.2, 3.8), black, -5, 6.3, 0, g);
    add(new THREE.PlaneGeometry(1.5, 1.5), toon({color: '#88ccff'}), -5, 4.5, 1.71, g);
    add(new THREE.PlaneGeometry(1.5, 1.5), toon({color: '#88ccff'}), -5, 4.5, -1.71, g);
    add(new THREE.CylinderGeometry(0.4, 0.3, 2, 16), black, 4.5, 5, 0, g);
    const cow = add(new THREE.ConeGeometry(1.5, 2, 4), grey, 7.5, 1.5, 0, g);
    cow.rotation.y = Math.PI / 4;
    cow.rotation.x = Math.PI / 2;
    for (let x = -4; x <= 5; x += 3) {
      for (let z of [-1.6, 1.6]) {
        const w = add(new THREE.CylinderGeometry(1.2, 1.2, 0.3, 16), red, x, 1.2, z, g);
        w.rotation.x = Math.PI / 2;
        const hub = add(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 8), grey, x, 1.2, z, g);
        hub.rotation.x = Math.PI / 2;
      }
    }
    return g;
  },
  'newspaper': () => {
    const g = new THREE.Group();
    const tex = canvasTex(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#000000'; ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center'; ctx.fillText('CLICKETY CLACK LINE', w / 2, h / 2);
    });
    add(new THREE.PlaneGeometry(0.4, 0.2), toon({ map: tex }), 0, 0, 0, g);
    return g;
  },
  'gold coin': () => {
    const g = new THREE.Group();
    const w = add(new THREE.CylinderGeometry(0.025, 0.025, 0.005, 16), toon({ color: '#ffd700' }), 0, 0, 0, g);
    w.rotation.x = Math.PI / 2;
    return g;
  },
  'sheet of paper': () => {
    const g = new THREE.Group();
    add(new THREE.PlaneGeometry(0.3, 0.2), toon({ color: '#ffffff' }), 0, 0, 0, g);
    return g;
  }
};

const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const clouds = cloudsInit();

const trackView = new THREE.Group(); world.add(trackView);
for(let i=-4; i<=4; i++) {
  const tv = ASSETS['TRACK-VIEW']();
  tv.position.set(i * 2.4, 0, 0);
  trackView.add(tv);
}
const canyonEdge = ASSETS['CANYON-EDGE'](); canyonEdge.position.set(100, 0, 0); world.add(canyonEdge);
const station = ASSETS['STATION'](); station.position.set(200, 0, 0); world.add(station);
const bridgeWide = ASSETS['BRIDGE-WIDE'](); bridgeWide.position.set(300, 0, 0); world.add(bridgeWide);

const railL1 = ASSETS['steel rail'](); railL1.position.set(-6, 0.175, -0.4); trackView.add(railL1);
const railL2 = ASSETS['steel rail'](); railL2.position.set(6, 0.175, -0.4); trackView.add(railL2);
const railR1 = ASSETS['steel rail'](); railR1.position.set(-6, 0.175, 0.4); trackView.add(railR1);
const railR2 = ASSETS['steel rail'](); railR2.position.set(6, 0.175, 0.4); trackView.add(railR2);

const saw = ASSETS['hand saw'](); trackView.add(saw);
const coin = ASSETS['gold coin'](); trackView.add(coin);
const paper = ASSETS['sheet of paper'](); trackView.add(paper);
const news = ASSETS['newspaper'](); station.add(news);
const trainStat = ASSETS['train'](); station.add(trainStat);
const trainBridge = ASSETS['train'](); bridgeWide.add(trainBridge);

const bridgeRails = [];
for (let x = -24; x <= 24; x += 12) {
  const r1 = ASSETS['steel rail'](); r1.position.set(x, 0.275, -0.4); r1.userData.z0 = -0.4; bridgeWide.add(r1);
  const r2 = ASSETS['steel rail'](); r2.position.set(x, 0.275, 0.4); r2.userData.z0 = 0.4; bridgeWide.add(r2);
  bridgeRails.push(r1, r2);
}

function worldState(S, f) {
  railL1.position.x = -6 - S.gapSize / 2;
  railL2.position.x = 6 + S.gapSize / 2;
  railR1.position.x = -6 - S.gapSize / 2;
  railR2.position.x = 6 + S.gapSize / 2;
  
  saw.visible = S.sawVis;
  saw.position.set(0, 0.25 + S.sawPos, 0.4);
  
  coin.visible = S.coinVis;
  coin.position.set(0, 0.2, 0.4);
  
  paper.visible = S.paperVis;
  paper.position.set(0, 0.2, 0.4);
  paper.rotation.x = -Math.PI / 2;
  
  news.visible = S.newsVis;
  news.position.set(200, 1.5, 4);
  
  trainStat.position.set(S.trainStatX, 0.15, -3);
  trainBridge.position.set(S.trainX, 0.15, 0);
  trainBridge.visible = S.trainVis;
  
  bridgeRails.forEach(r => {
    r.position.z = r.userData.z0 + Math.sin(r.position.x * 0.3) * S.warpAmt;
  });
  
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
