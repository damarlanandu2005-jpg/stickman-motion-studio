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
  'STREET': () => {
    const g = new THREE.Group();
    // Road
    const roadTex = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#444444'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#dddddd'; ctx.fillRect(w/2 - 5, 0, 10, h);
    }, 10, 10);
    add(new THREE.PlaneGeometry(20, 20), toon({map: roadTex}), 0, 0, 0, g).rotation.x = -Math.PI/2;
    
    // Brick building (right)
    const brickTex = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#8b4513'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#cccccc';
      for(let y=0; y<h; y+=32) {
        ctx.fillRect(0, y, w, 4);
        for(let x=0; x<w; x+=64) {
          ctx.fillRect(x + (y%64===0?0:32), y, 4, 32);
        }
      }
    }, 4, 4);
    add(tbox(8, 15, 8, 2), toon({map: brickTex}), 8, 7.5, -5, g);
    
    // Concrete barricade (left)
    add(tbox(3, 1, 1, 1), M.stone, -4, 0.5, 2, g);
    
    // Police car (middle)
    const car = new THREE.Group();
    add(tbox(4, 0.8, 1.8, 1), toon({color: '#111111'}), 0, 0.6, 0, car);
    add(tbox(2, 0.7, 1.6, 1), toon({color: '#ffffff'}), 0, 1.35, 0, car);
    add(tbox(0.5, 0.15, 0.4, 1), toon({color: '#ff0000'}), -0.5, 1.775, 0, car);
    add(tbox(0.5, 0.15, 0.4, 1), toon({color: '#0000ff'}), 0.5, 1.775, 0, car);
    for(let x of [-1.2, 1.2]) {
      for(let z of [-0.9, 0.9]) {
        const w = add(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 16), toon({color: '#222222'}), x, 0.35, z, car);
        w.rotation.x = Math.PI/2;
      }
    }
    car.position.set(2, 0, -4);
    g.add(car);
    return g;
  },
  'BOMB-TENT': () => {
    const g = new THREE.Group();
    // Floor
    const floorTex = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#6a7d43'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#5a6d33';
      for(let i=0; i<700; i++) {
        ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, 2+Math.random()*5, 0, Math.PI*2); ctx.fill();
      }
    }, 4, 4);
    add(new THREE.PlaneGeometry(6, 6), toon({map: floorTex}), 0, 0, 0, g).rotation.x = -Math.PI/2;
    
    // Walls
    const wallTex = canvasTex(512, 512, (ctx, w, h) => {
      const grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#7a8d53');
      grd.addColorStop(1, '#4a5d23');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#3a4d13'; ctx.lineWidth = 4;
      for(let i=0; i<w; i+=64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }
    }, 2, 1);
    const wallMat = toon({map: wallTex, side: THREE.DoubleSide});
    add(new THREE.PlaneGeometry(6, 3), wallMat, 0, 1.5, -3, g);
    add(new THREE.PlaneGeometry(6, 3), wallMat, -3, 1.5, 0, g).rotation.y = Math.PI/2;
    add(new THREE.PlaneGeometry(6, 3), wallMat, 3, 1.5, 0, g).rotation.y = -Math.PI/2;
    
    // Warning Sign on back wall
    const signTex = canvasTex(256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#ffcc00'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#000000'; ctx.fillRect(10, 10, w-20, h-20);
      ctx.fillStyle = '#ffcc00'; ctx.fillRect(15, 15, w-30, h-30);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('DANGER', w/2, 55);
      ctx.font = 'bold 20px sans-serif'; ctx.fillText('EXPLOSIVES', w/2, 90);
    }, 1, 1);
    add(new THREE.PlaneGeometry(1.5, 0.75), toon({map: signTex}), 0, 2, -2.9, g);

    // Blueprint on side wall
    const bpTex = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#2244aa'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, w-20, h-20);
      ctx.beginPath(); ctx.arc(w/2, h/2, 50, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(20, 20); ctx.lineTo(w-20, h-20); ctx.stroke();
    }, 1, 1);
    add(new THREE.PlaneGeometry(1.5, 1.5), toon({map: bpTex}), -2.9, 1.8, -1, g).rotation.y = Math.PI/2;

    // Fire extinguisher
    const fe = new THREE.Group();
    add(new THREE.CylinderGeometry(0.15, 0.15, 0.6), M.red, 0, 0.3, 0, fe);
    add(new THREE.CylinderGeometry(0.05, 0.15, 0.15), M.red, 0, 0.675, 0, fe);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.1), toon({color: '#222222'}), 0, 0.8, 0, fe);
    add(tbox(0.1, 0.3, 0.1, 1), toon({color: '#dddddd'}), 0, 0.3, 0.16, fe);
    fe.position.set(2.5, 0, -2.5);
    g.add(fe);

    // Table
    const tableTex = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#777777'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#888888';
      for(let i=0; i<100; i++) {
        ctx.fillRect(Math.random()*w, Math.random()*h, 2, 2);
      }
    }, 2, 2);
    const tableMat = toon({map: tableTex});
    add(tbox(1.5, 0.05, 0.8, 1), tableMat, 0, 0.9, 0, g);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.9), M.iron, -0.6, 0.45, -0.3, g);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.9), M.iron, 0.6, 0.45, -0.3, g);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.9), M.iron, -0.6, 0.45, 0.3, g);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.9), M.iron, 0.6, 0.45, 0.3, g);
    
    // Spotlight
    add(new THREE.CylinderGeometry(0.05, 0.05, 2.5), M.iron, 2, 1.25, -2, g);
    add(new THREE.CylinderGeometry(0.2, 0.4, 0.4), toon({color: '#444444'}), 1.8, 2.5, -1.8, g).rotation.x = Math.PI/4;
    add(new THREE.CylinderGeometry(0.18, 0.38, 0.41), toon({color: '#ffffff'}), 1.8, 2.5, -1.8, g).rotation.x = Math.PI/4;
    
    // Tool case
    add(tbox(0.5, 0.2, 0.3, 1), toon({color: '#333333'}), -1.5, 0.1, -1, g);
    add(tbox(0.1, 0.05, 0.31, 1), M.iron, -1.5, 0.1, -1, g);
    
    // Crates
    add(tbox(0.8, 0.8, 0.8, 1), M.wood, 2, 0.4, -2.5, g);
    add(tbox(0.6, 0.6, 0.6, 1), M.wood, 2.2, 1.1, -2.5, g);
    
    // Tools on table
    add(tbox(0.2, 0.05, 0.1, 1), toon({color: '#cc2222'}), -0.4, 0.925, 0.2, g);
    add(tbox(0.15, 0.04, 0.08, 1), toon({color: '#2222cc'}), -0.2, 0.92, 0.25, g);
    add(tbox(0.3, 0.02, 0.2, 1), toon({color: '#dddddd'}), 0.4, 0.91, 0.15, g);
    
    return g;
  },
  'COMMAND-POST': () => {
    const g = new THREE.Group();
    const floorTex = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#555566'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#666677';
      for(let i=0; i<w; i+=64) {
        for(let j=0; j<h; j+=64) {
          if((i/64 + j/64) % 2 === 0) ctx.fillRect(i, j, 64, 64);
        }
      }
    }, 4, 4);
    add(new THREE.PlaneGeometry(10, 10), toon({map: floorTex}), 0, 0, 0, g).rotation.x = -Math.PI/2;
    
    const wallTex = canvasTex(512, 512, (ctx, w, h) => {
      const grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#888899');
      grd.addColorStop(1, '#555566');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
    }, 1, 1);
    add(new THREE.PlaneGeometry(10, 4), toon({map: wallTex}), 0, 2, -5, g);
    add(new THREE.PlaneGeometry(10, 4), toon({map: wallTex}), -5, 2, 0, g).rotation.y = Math.PI/2;
    
    // Poster
    const posterTex = canvasTex(256, 512, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff0000'; ctx.fillRect(20, 20, w-40, 60);
      ctx.fillStyle = '#000000'; ctx.fillRect(20, 100, w-40, 20);
      ctx.fillRect(20, 140, w-40, 20);
      ctx.fillRect(20, 180, w-40, 20);
    }, 1, 1);
    add(new THREE.PlaneGeometry(1, 2), toon({map: posterTex}), -2, 2, -4.9, g);
    
    // Radio desk
    add(tbox(2, 1, 1, 1), M.wood, -3, 0.5, -2, g);
    add(tbox(0.8, 0.4, 0.4, 1), toon({color: '#222222'}), -3, 1.2, -2, g);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.1), M.iron, -2.8, 1.3, -1.75, g).rotation.x = Math.PI/2;
    
    // Screens
    add(tbox(4, 1.5, 0.2, 1), toon({color: '#222222'}), 0, 2, -4.8, g);
    add(new THREE.PlaneGeometry(1.2, 0.8), toon({color: '#66aaff'}), -1.3, 2, -4.69, g);
    add(new THREE.PlaneGeometry(1.2, 0.8), toon({color: '#66aaff'}), 0, 2, -4.69, g);
    add(new THREE.PlaneGeometry(1.2, 0.8), toon({color: '#66aaff'}), 1.3, 2, -4.69, g);
    add(new THREE.PlaneGeometry(1.2, 0.8), toon({color: '#ffaa66'}), -1.3, 1.1, -4.69, g);
    add(new THREE.PlaneGeometry(1.2, 0.8), toon({color: '#ffaa66'}), 0, 1.1, -4.69, g);
    add(new THREE.PlaneGeometry(1.2, 0.8), toon({color: '#ffaa66'}), 1.3, 1.1, -4.69, g);
    
    // Coffee cups table
    add(tbox(1.5, 1, 1, 1), M.wood, 3, 0.5, -2, g);
    add(new THREE.CylinderGeometry(0.05, 0.04, 0.15), toon({color: '#ffffff'}), 3, 1.075, -2, g);
    add(new THREE.CylinderGeometry(0.05, 0.04, 0.15), toon({color: '#ffffff'}), 3.2, 1.075, -1.9, g);
    return g;
  },
  'bomb suit': () => {
    const g = new THREE.Group();
    add(tbox(0.6, 1.8, 0.4, 1), toon({color: '#4a5d23'}), 0, 0.9, 0, g);
    return g;
  },
  'bomb helmet': () => {
    const g = new THREE.Group();
    add(new THREE.SphereGeometry(0.2, 16, 16), toon({color: '#4a5d23'}), 0, 0.2, 0, g);
    add(box(0.3, 0.15, 0.1), toon({color: '#88ccff'}), 0, 0.2, 0.15, g);
    return g;
  },
  'police uniform': () => {
    const g = new THREE.Group();
    add(tbox(0.5, 1.8, 0.25, 1), toon({color: '#2a3b5c'}), 0, 0.9, 0, g);
    add(box(0.1, 0.1, 0.05), toon({color: '#c0c0c0'}), -0.1, 1.4, 0.15, g);
    return g;
  },
  'police cap': () => {
    const g = new THREE.Group();
    add(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 8), toon({color: '#2a3b5c'}), 0, 0.05, 0, g);
    add(box(0.3, 0.02, 0.15), toon({color: '#111111'}), 0, 0.01, 0.1, g);
    return g;
  },
  'bomb': () => {
    const g = new THREE.Group();
    const bombTex = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#444444'; ctx.fillRect(0, 0, w, h);
      // Hazard stripes on edges
      ctx.fillStyle = '#ffcc00';
      for(let i=-w; i<w*2; i+=40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i+20, 0); ctx.lineTo(i+h+20, h); ctx.lineTo(i+h, h); ctx.fill();
      }
      ctx.fillStyle = '#222222'; ctx.fillRect(20, 20, w-40, h-40); // Inner dark area
      
      // Panel lines
      ctx.strokeStyle = '#111111'; ctx.lineWidth = 4;
      ctx.strokeRect(30, 30, w-60, h-60);
      ctx.beginPath(); ctx.moveTo(w/2, 30); ctx.lineTo(w/2, h-30); ctx.stroke();
    }, 1, 1);
    add(tbox(0.4, 0.2, 0.3, 1), toon({map: bombTex}), 0, 0.1, 0, g);
    
    // Keypad
    const kp = new THREE.Group();
    add(tbox(0.1, 0.02, 0.1, 1), toon({color: '#cccccc'}), 0, 0, 0, kp);
    for(let i=0; i<3; i++) {
      for(let j=0; j<3; j++) {
        add(tbox(0.02, 0.03, 0.02, 1), toon({color: '#333333'}), -0.03 + i*0.03, 0, -0.03 + j*0.03, kp);
      }
    }
    kp.position.set(-0.1, 0.2, 0.05);
    g.add(kp);

    // Bolts
    for(let x of [-0.18, 0.18]) {
      for(let z of [-0.13, 0.13]) {
        add(new THREE.CylinderGeometry(0.01, 0.01, 0.02), M.iron, x, 0.2, z, g);
      }
    }

    return g;
  },
  'circuit board': () => {
    const g = new THREE.Group();
    const pcbTex = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#228822'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#44aa44'; ctx.lineWidth = 3;
      for(let i=0; i<30; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random()*w, Math.random()*h);
        ctx.lineTo(Math.random()*w, Math.random()*h);
        ctx.stroke();
      }
      // Gold pins on edge
      ctx.fillStyle = '#ffcc00';
      for(let i=0; i<w; i+=10) {
        ctx.fillRect(i, h-10, 6, 10);
      }
    }, 1, 1);
    add(tbox(0.2, 0.02, 0.15, 1), toon({map: pcbTex}), 0, 0.01, 0, g);
    
    // Chips
    add(tbox(0.04, 0.03, 0.04, 1), toon({color: '#111111'}), -0.05, 0.02, -0.03, g);
    add(tbox(0.06, 0.03, 0.03, 1), toon({color: '#111111'}), 0.04, 0.02, 0.02, g);
    
    // Capacitors
    add(new THREE.CylinderGeometry(0.01, 0.01, 0.03), toon({color: '#2244cc'}), -0.08, 0.025, 0.04, g);
    add(new THREE.CylinderGeometry(0.01, 0.01, 0.03), toon({color: '#2244cc'}), -0.05, 0.025, 0.04, g);
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.04), toon({color: '#cc4422'}), 0.07, 0.03, -0.04, g);

    return g;
  },
  'wire bundle': () => {
    const g = new THREE.Group();
    const cols = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff8800', '#ffffff'];
    cols.forEach((c, i) => {
      const w = add(new THREE.CylinderGeometry(0.005, 0.005, 0.15), toon({color: c}), (i-2.5)*0.015, 0.01, 0, g);
      w.rotation.x = Math.PI/2;
      w.rotation.z = (Math.random()-0.5)*0.2;
      w.name = `wire_${i}`;
    });
    return g;
  },
  'wire snips': () => {
    const g = new THREE.Group();
    const handleTex = canvasTex(64, 256, (ctx, w, h) => {
      ctx.fillStyle = '#cc0000'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#aa0000';
      for(let y=0; y<h; y+=10) { ctx.fillRect(0, y, w, 5); }
    }, 1, 1);
    const handleMat = toon({map: handleTex});
    add(tbox(0.02, 0.08, 0.01, 1), handleMat, -0.015, 0.04, 0, g).rotation.z = -0.2;
    add(tbox(0.02, 0.08, 0.01, 1), handleMat, 0.015, 0.04, 0, g).rotation.z = 0.2;
    add(tbox(0.01, 0.05, 0.01, 1), M.iron, -0.01, 0.1, 0, g).rotation.z = 0.2;
    add(tbox(0.01, 0.05, 0.01, 1), M.iron, 0.01, 0.1, 0, g).rotation.z = -0.2;
    add(new THREE.CylinderGeometry(0.005, 0.005, 0.012), toon({color: '#333333'}), 0, 0.08, 0, g).rotation.x = Math.PI/2;
    return g;
  },
  'digital timer': () => {
    const g = new THREE.Group();
    // Bezel
    add(tbox(0.12, 0.04, 0.04, 1), toon({color: '#333333'}), 0, 0.02, 0, g);
    // Screen bg
    const screenBg = add(new THREE.PlaneGeometry(0.09, 0.03), toon({color: '#220000'}), 0, 0.041, -0.005, g);
    screenBg.rotation.x = -Math.PI/2;
    // Buttons
    add(new THREE.CylinderGeometry(0.005, 0.005, 0.01), toon({color: '#00ff00'}), -0.03, 0.04, 0.015, g);
    add(new THREE.CylinderGeometry(0.005, 0.005, 0.01), toon({color: '#ff0000'}), 0.03, 0.04, 0.015, g);
    return g;
  }
};

const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const clouds = cloudsInit();

const envStreet = ASSETS['STREET']();
const envTent = ASSETS['BOMB-TENT']();
const envPost = ASSETS['COMMAND-POST']();
world.add(envStreet);
world.add(envTent);
world.add(envPost);

const theBomb = ASSETS['bomb']();
const theTimer = ASSETS['digital timer']();
const theCircuit = ASSETS['circuit board']();
const theWires = ASSETS['wire bundle']();
const theSnips = ASSETS['wire snips']();

theBomb.add(theTimer);
theTimer.position.set(0, 0.2, 0.1);
theBomb.add(theCircuit);
theCircuit.position.set(0, 0.2, -0.05);
theBomb.add(theWires);
theWires.position.set(0, 0.22, -0.05);

envTent.add(theBomb);
theBomb.position.set(0, 0.95, 0);

envTent.add(theSnips);
theSnips.position.set(0.3, 0.95, 0.2);

envStreet.position.set(0, 0, 0);
envTent.position.set(100, 0, 0);
envPost.position.set(200, 0, 0);

function worldState(S, f) {
  waterU.t.value = f / 30;
  
  if (S.shotId === 's8') {
    theSnips.position.set(0.1, 1.15, 0.1);
    theSnips.rotation.set(-Math.PI/4, 0, 0);
  } else if (S.shotId === 's12') {
    theSnips.position.set(0, 1.17, -0.05);
    theSnips.rotation.set(-Math.PI/2, 0, 0);
  } else {
    theSnips.position.set(0.3, 0.95, 0.2);
    theSnips.rotation.set(0, 0, 0);
  }
  
  const redWire = theWires.getObjectByName('wire_0');
  if (redWire) {
    redWire.visible = f < 960;
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
