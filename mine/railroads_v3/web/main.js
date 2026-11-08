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

const dirtTex = canvasTex(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(0,0,w,h);
  for(let i=0; i<1000; i++) {
    ctx.fillStyle = rnd() > 0.5 ? '#7a4a1a' : '#9c6b3c';
    ctx.beginPath(); ctx.arc(rnd()*w, rnd()*h, 1+rnd()*3, 0, Math.PI*2); ctx.fill();
  }
}, 4, 4);
const M_dirt = toon({map: dirtTex});

const gravelTex = canvasTex(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#666666'; ctx.fillRect(0,0,w,h);
  for(let i=0; i<2000; i++) {
    ctx.fillStyle = rnd() > 0.5 ? '#555555' : '#777777';
    ctx.beginPath(); ctx.arc(rnd()*w, rnd()*h, 2+rnd()*4, 0, Math.PI*2); ctx.fill();
  }
}, 4, 4);
const M_gravel = toon({map: gravelTex});

const woodTex = canvasTex(512, 512, (ctx, w, h) => {
  ctx.fillStyle = '#5c4033'; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 2;
  for(let i=0; i<w; i+=16) {
    ctx.beginPath(); ctx.moveTo(i + rnd()*4, 0); ctx.lineTo(i + rnd()*4, h); ctx.stroke();
  }
}, 2, 2);
const M_woodTex = toon({map: woodTex});

const ironTex = canvasTex(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#5c5a57'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle = '#4a4845';
  for(let i=0; i<500; i++) {
    ctx.fillRect(rnd()*w, rnd()*h, 2+rnd()*4, 1+rnd()*2);
  }
  ctx.fillStyle = '#6e6c69';
  for(let i=0; i<500; i++) {
    ctx.fillRect(rnd()*w, rnd()*h, 2+rnd()*4, 1+rnd()*2);
  }
}, 2, 2);
const M_ironTex = toon({map: ironTex});

const buildRail = (len, xOffset, z) => {
  const r = new THREE.Group();
  add(tbox(len, 0.02, 0.12), M_ironTex, xOffset, 0.01, z, r); // Base
  add(tbox(len, 0.09, 0.03), M_ironTex, xOffset, 0.065, z, r); // Web
  add(tbox(len, 0.04, 0.08), M_ironTex, xOffset, 0.13, z, r); // Head
  return r;
};

const addTrackDetails = (g) => {
  // Fence in the background (z = -1.5)
  for(let x=-2; x<=2; x+=1.0) {
    add(box(0.08, 1.0, 0.08), M_woodTex, x, 0.5, -1.5, g); // post
  }
  for(let y=0.3; y<=0.8; y+=0.35) {
    add(tbox(4, 0.08, 0.04), M_woodTex, 0, y, -1.46, g); // rails
  }
  // Bushes behind fence
  for(let x=-2; x<=2; x+=1) {
    add(new THREE.DodecahedronGeometry(0.5 + rnd()*0.3), toon({color: '#336622'}), x + rnd()*0.5, 0.3, -1.8, g);
  }

  // Toolbox
  add(tbox(0.6, 0.3, 0.3), toon({color: '#cc4433'}), -1.2, 0.15, -0.2, g);
  add(tbox(0.62, 0.05, 0.32), toon({color: '#aa3322'}), -1.2, 0.325, -0.2, g);
  add(tbox(0.1, 0.05, 0.05), M.iron, -1.2, 0.35, -0.05, g); // handle

  // Lantern
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.05), M.iron, 1.2, 0.125, 0.3, g);
  add(new THREE.CylinderGeometry(0.08, 0.08, 0.2), toon({color: '#ffdd88'}), 1.2, 0.25, 0.3, g);
  add(new THREE.CylinderGeometry(0.1, 0.05, 0.1), M.iron, 1.2, 0.4, 0.3, g);
  add(tbox(0.02, 0.2, 0.02), M.iron, 1.2, 0.5, 0.3, g); // handle

  // Scattered bolts
  for(let i=0; i<15; i++) {
    const bx = (rnd()-0.5)*2;
    const bz = (rnd()-0.5)*2;
    const bolt = add(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 6), M.iron, bx, 0.12, bz, g);
    bolt.rotation.set(rnd()*Math.PI, rnd()*Math.PI, rnd()*Math.PI);
  }

  // Dense ground clutter
  for(let i=0; i<60; i++) {
    // Weeds
    const wx = rnd()*4 - 2;
    const wz = rnd()*4 - 2;
    if(Math.abs(wz) > 0.6) { // Keep off the main rails
      const h = 0.1 + rnd()*0.2;
      const weed = add(new THREE.ConeGeometry(0.04, h, 4), toon({color: rnd()>0.5 ? '#44aa44' : '#88aa44'}), wx, 0.1 + h/2, wz, g);
      weed.rotation.y = rnd()*Math.PI;
      weed.rotation.x = (rnd()-0.5)*0.4;
    }
    // Rocks
    const rx = rnd()*4 - 2;
    const rz = rnd()*4 - 2;
    const s = 0.02 + rnd()*0.04;
    const rock = add(new THREE.DodecahedronGeometry(s), toon({color: rnd()>0.5 ? '#888888' : '#aaaaaa'}), rx, 0.1 + s, rz, g);
    rock.rotation.set(rnd(), rnd(), rnd());
  }
  
  // Twigs/debris
  for(let i=0; i<30; i++) {
    const tx = rnd()*4 - 2;
    const tz = rnd()*4 - 2;
    const twig = add(box(0.02, 0.02, 0.1 + rnd()*0.2), M_woodTex, tx, 0.11, tz, g);
    twig.rotation.y = rnd()*Math.PI;
  }

  // Oil stains on sleepers
  for(let i=-2; i<=2; i+=0.6) {
    if(rnd()>0.2) {
      add(tbox(0.2, 0.01, 0.2), toon({color: '#222222', transparent: true, opacity: 0.7}), i, 0.155, rnd()*0.4 - 0.2, g);
    }
  }

  // SPECIFIC CENTER DETAILS FOR CLOSE-UPS
  // Tie plates on the center sleeper
  add(tbox(0.3, 0.02, 0.2), M.iron, 0, 0.16, -0.7, g);
  add(tbox(0.3, 0.02, 0.2), M.iron, 0, 0.16, 0.7, g);
  
  // A specific weed right near the gap
  const weed = add(new THREE.ConeGeometry(0.03, 0.15, 4), toon({color: '#44aa44'}), 0.2, 0.175, -0.4, g);
  weed.rotation.set(0.2, 1, 0.1);
  
  // Some specific rocks near the gap
  add(new THREE.DodecahedronGeometry(0.03), toon({color: '#888888'}), -0.15, 0.13, -0.45, g).rotation.set(1,2,3);
  add(new THREE.DodecahedronGeometry(0.02), toon({color: '#aaaaaa'}), -0.2, 0.12, -0.35, g).rotation.set(3,2,1);
  add(new THREE.DodecahedronGeometry(0.04), toon({color: '#777777'}), 0.15, 0.14, 0.45, g).rotation.set(0,1,2);

  // A discarded wrench
  const wrench = new THREE.Group();
  add(tbox(0.3, 0.02, 0.04), M.iron, 0, 0, 0, wrench);
  add(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 6), M.iron, 0.15, 0, 0, wrench);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 6), M.iron, -0.15, 0, 0, wrench);
  wrench.position.set(0.3, 0.16, 0.2);
  wrench.rotation.y = 0.5;
  g.add(wrench);
};

const ASSETS = {
  'TRACK-CLOSEUP': () => {
    const g = new THREE.Group();
    add(tbox(4, 0.1, 4), M_dirt, 0, -0.05, 0, g);
    add(tbox(4, 0.1, 3), M_gravel, 0, 0.05, 0, g);
    for(let i=-2; i<=2; i+=0.6) {
      add(box(0.25, 0.15, 2.2), M_woodTex, i, 0.075, 0, g);
      add(box(0.05, 0.05, 0.05), M.iron, i-0.05, 0.175, -0.7, g);
      add(box(0.05, 0.05, 0.05), M.iron, i+0.05, 0.175, -0.7, g);
      add(box(0.05, 0.05, 0.05), M.iron, i-0.05, 0.175, 0.7, g);
      add(box(0.05, 0.05, 0.05), M.iron, i+0.05, 0.175, 0.7, g);
    }
    addTrackDetails(g);
    return g;
  },
  'CANYON-BRIDGE': () => {
    const g = new THREE.Group();
    const strataTex = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#8a4a2a'; ctx.fillRect(0,0,w,h);
      for(let y=0; y<h; y+=32) {
        ctx.fillStyle = rnd() > 0.5 ? '#7a3a1a' : '#9a5a3a';
        ctx.fillRect(0, y, w, 16 + rnd()*16);
      }
    }, 4, 4);
    const M_strata = toon({map: strataTex});
    
    // Left wall
    add(tbox(2, 40, 80), M_strata, -14, -20, 0, g);
    add(tbox(2, 30, 80), M_strata, -13.5, -40, 0, g);
    add(tbox(2, 10, 80), M_strata, -13, -5, 0, g);
    
    // Right wall
    add(tbox(2, 40, 80), M_strata, 14, -20, 0, g);
    add(tbox(2, 30, 80), M_strata, 13.5, -40, 0, g);
    add(tbox(2, 10, 80), M_strata, 13, -5, 0, g);
    
    // Bushes on canyon rim
    for(let z=-40; z<=40; z+=2) {
      if(rnd()>0.3) add(new THREE.DodecahedronGeometry(1 + rnd()), toon({color: '#336622'}), -13, 0, z, g);
      if(rnd()>0.3) add(new THREE.DodecahedronGeometry(1 + rnd()), toon({color: '#336622'}), 13, 0, z, g);
    }

    // Bottomless fog
    const fogTex = canvasTex(256, 256, (ctx, w, h) => {
      const grd = ctx.createLinearGradient(0,0,0,h);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = grd; ctx.fillRect(0,0,w,h);
    });
    const fogPlane = add(new THREE.PlaneGeometry(26, 80), toon({map: fogTex, transparent: true}), 0, -40, 0, g);
    fogPlane.rotation.x = -Math.PI/2;

    // Bridges
    const buildBridge = (x) => {
      const b = new THREE.Group();
      b.position.x = x;
      add(tbox(0.4, 0.6, 80), M_woodTex, -1, -0.3, 0, b);
      add(tbox(0.4, 0.6, 80), M_woodTex, 1, -0.3, 0, b);
      for(let z=-40; z<=40; z+=0.6) {
        add(box(3, 0.2, 0.3), M_woodTex, 0, 0.1, z, b);
      }
      add(tbox(0.1, 0.15, 80), M.iron, -0.7, 0.275, 0, b);
      add(tbox(0.1, 0.15, 80), M.iron, 0.7, 0.275, 0, b);
      for(let z=-38; z<=38; z+=4) {
        add(tbox(2.8, 0.2, 0.2), M_woodTex, 0, -0.8, z, b);
        const diag1 = add(tbox(0.2, 3, 0.2), M_woodTex, -1, -2, z+2, b);
        diag1.rotation.x = Math.PI/4;
        const diag2 = add(tbox(0.2, 3, 0.2), M_woodTex, 1, -2, z+2, b);
        diag2.rotation.x = -Math.PI/4;
        add(tbox(0.4, 4, 0.4), M_woodTex, -1, -2, z, b);
        add(tbox(0.4, 4, 0.4), M_woodTex, 1, -2, z, b);
      }
      g.add(b);
    };
    
    buildBridge(-6);
    buildBridge(6);
    
    return g;
  },
  'OFFICE': () => {
    const g = new THREE.Group();
    add(tbox(8, 0.2, 8), M_woodTex, 0, -0.1, 0, g);
    
    // Rug
    const rugTex = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#883333'; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle = '#ddaa55'; ctx.lineWidth = 10;
      ctx.strokeRect(20, 20, w-40, h-40);
      ctx.beginPath(); ctx.arc(w/2, h/2, 50, 0, Math.PI*2); ctx.stroke();
    });
    add(tbox(4, 0.05, 3), toon({map: rugTex}), 0, 0.025, -0.5, g);

    const wallTex = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#e8e0d0'; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle = '#d0c8b8'; ctx.lineWidth = 4;
      for(let i=0; i<w; i+=32) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,h); ctx.stroke(); }
    });
    const M_wall = toon({map: wallTex});
    
    add(tbox(8, 4, 0.2), M_wall, 0, 2, -4, g);
    add(tbox(0.2, 4, 8), M_wall, -4, 2, 0, g);
    add(tbox(0.2, 4, 8), M_wall, 4, 2, 0, g);
    
    // Desk at z=-0.2
    const deskZ = -0.2;
    add(tbox(2.4, 0.1, 1.2), M_woodTex, 0, 1, deskZ, g);
    add(tbox(0.6, 1, 1.1), M_woodTex, -0.9, 0.5, deskZ, g);
    add(tbox(0.6, 1, 1.1), M_woodTex, 0.9, 0.5, deskZ, g);
    
    // Chair at z=-1.0
    add(tbox(0.6, 0.1, 0.6), M_woodTex, 0, 0.5, deskZ - 0.8, g);
    add(tbox(0.6, 0.6, 0.1), M_woodTex, 0, 0.8, deskZ - 1.05, g);
    add(tbox(0.05, 0.5, 0.05), M.iron, 0, 0.25, deskZ - 0.8, g);
    
    // Desk props
    add(new THREE.CylinderGeometry(0.15, 0.15, 0.05), M.iron, -0.8, 1.05, deskZ - 0.2, g);
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.4), M.iron, -0.8, 1.25, deskZ - 0.2, g);
    const shade = add(new THREE.ConeGeometry(0.15, 0.2, 16), toon({color: '#225533'}), -0.8, 1.4, deskZ);
    shade.rotation.x = Math.PI/4;
    
    add(tbox(0.3, 0.02, 0.4), toon({color: '#ffffff'}), 0.2, 1.06, deskZ, g);
    add(tbox(0.3, 0.02, 0.4), toon({color: '#ffffff'}), -0.2, 1.06, deskZ + 0.1, g).rotation.y = 0.2;
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.12), toon({color: '#cc3333'}), 0.8, 1.11, deskZ, g); // mug
    
    // Blueprints
    const bpTex = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#224488'; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
      ctx.strokeRect(20, 20, w-40, h-40);
      ctx.beginPath(); ctx.moveTo(40, 40); ctx.lineTo(w-40, h-40); ctx.stroke();
      ctx.beginPath(); ctx.arc(w/2, h/2, 100, 0, Math.PI*2); ctx.stroke();
      for(let i=0; i<5; i++) { ctx.fillRect(40, 100+i*30, 150, 10); }
    });
    add(tbox(0.05, 2, 3), toon({map: bpTex}), -3.9, 2, -1.5, g);
    
    // Window
    add(tbox(0.1, 1.6, 2.1), M_woodTex, 3.9, 2, -1, g);
    add(tbox(0.05, 1.5, 2), toon({color: '#88ccff', transparent: true, opacity: 0.5}), 3.9, 2, -1, g);
    add(tbox(0.12, 1.5, 0.05), M_woodTex, 3.9, 2, -1, g);
    add(tbox(0.12, 0.05, 2), M_woodTex, 3.9, 2, -1, g);
    
    // Filing cabinet
    add(tbox(0.8, 1.5, 0.8), toon({color: '#556655'}), -3.5, 0.75, -3.5, g);
    for(let i=0; i<3; i++) add(tbox(0.7, 0.4, 0.05), toon({color: '#445544'}), -3.1, 0.4 + i*0.45, -3.5, g);

    // Bookshelf on back wall
    add(tbox(2, 2, 0.4), M_woodTex, 2, 1, -3.8, g);
    for(let y=0.4; y<=1.8; y+=0.6) {
      add(tbox(1.8, 0.05, 0.35), M_woodTex, 2, y, -3.8, g);
      // Books
      for(let x=1.2; x<=2.8; x+=0.15) {
        if(rnd()>0.3) {
          const h = 0.3 + rnd()*0.2;
          const col = ['#aa3333', '#33aa33', '#3333aa', '#aaaa33', '#33aaaa'][Math.floor(rnd()*5)];
          add(tbox(0.1, h, 0.25), toon({color: col}), x, y + h/2, -3.8, g);
        }
      }
    }

    const calTex = canvasTex(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h);
      ctx.fillStyle = '#d22'; ctx.fillRect(0,0,w,30);
      ctx.fillStyle = '#000'; ctx.font = 'bold 60px Arial'; ctx.textAlign = 'center'; ctx.fillText('14', w/2, 90);
    });
    add(tbox(0.05, 0.6, 0.6), toon({map: calTex}), -1.5, 2.5, -3.9, g);
    
    const clock = new THREE.Group();
    clock.position.set(0, 3, -3.9);
    add(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 16), toon({color: '#333'}), 0, 0, 0, clock).rotation.x = Math.PI/2;
    add(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 16), toon({color: '#fff'}), 0, 0, 0, clock).rotation.x = Math.PI/2;
    add(box(0.05, 0.2, 0.08), toon({color: '#000'}), 0, 0.1, 0, clock);
    add(box(0.15, 0.05, 0.08), toon({color: '#000'}), 0.075, 0, 0, clock);
    g.add(clock);
    
    return g;
  },
  'NEWSPAPER-STAND': () => {
    const g = new THREE.Group();
    add(tbox(6, 0.1, 3), toon({color: '#333333'}), 0, -0.05, 1.5, g);
    add(tbox(6, 0.2, 3), M.stone, 0, 0, -1.5, g);
    add(tbox(6, 0.25, 0.2), M.plaster, 0, 0.025, 0, g);
    
    const brickTex = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#8a3a3a'; ctx.fillRect(0,0,w,h);
      ctx.fillStyle = '#aa4a4a'; 
      for(let y=0; y<h; y+=32) {
        let offset = (y/32)%2 === 0 ? 0 : 32;
        for(let x=-offset; x<w; x+=64) {
          ctx.fillRect(x+2, y+2, 60, 28);
        }
      }
    });
    add(tbox(0.4, 4, 3), toon({map: brickTex}), -2.8, 2, -1.5, g);
    
    add(tbox(0.4, 0.2, 0.4), M.iron, 2, 0.2, -1, g);
    add(new THREE.CylinderGeometry(0.05, 0.08, 4), M.iron, 2, 2.2, -1, g);
    add(new THREE.SphereGeometry(0.3), toon({color: '#ffdd88'}), 2, 4.4, -1, g);
    add(new THREE.CylinderGeometry(0.35, 0.05, 0.2), M.iron, 2, 4.6, -1, g);
    
    const rack = new THREE.Group();
    rack.position.set(0, 0.1, -1);
    add(tbox(1.6, 0.1, 0.8), M_woodTex, 0, 0.05, 0, rack);
    add(tbox(1.6, 1.2, 0.1), M_woodTex, 0, 0.6, -0.35, rack);
    add(tbox(0.1, 1.2, 0.8), M_woodTex, -0.75, 0.6, 0, rack);
    add(tbox(0.1, 1.2, 0.8), M_woodTex, 0.75, 0.6, 0, rack);
    add(tbox(1.6, 0.2, 0.8), M_woodTex, 0, 1.3, 0, rack);
    for(let y=0.3; y<=0.9; y+=0.3) {
      const shelf = add(tbox(1.5, 0.05, 0.6), M_woodTex, 0, y, 0, rack);
      shelf.rotation.x = Math.PI/8;
      add(tbox(0.4, 0.1, 0.3), toon({color: '#eeeeee'}), -0.4, y+0.05, 0.1, rack).rotation.x = Math.PI/8;
      add(tbox(0.4, 0.1, 0.3), toon({color: '#eeeeee'}), 0.4, y+0.05, 0.1, rack).rotation.x = Math.PI/8;
    }
    g.add(rack);
    
    add(new THREE.CylinderGeometry(0.25, 0.2, 0.7), M.iron, -1.5, 0.45, -0.5, g);
    
    return g;
  },
  'SMOOTH-TRACK': () => {
    const g = new THREE.Group();
    add(tbox(4, 0.1, 4), M_dirt, 0, -0.05, 0, g);
    add(tbox(4, 0.1, 3), M_gravel, 0, 0.05, 0, g);
    for(let i=-2; i<=2; i+=0.6) {
      add(box(0.25, 0.15, 2.2), M_woodTex, i, 0.075, 0, g);
      add(box(0.05, 0.05, 0.05), M.iron, i-0.05, 0.175, -0.7, g);
      add(box(0.05, 0.05, 0.05), M.iron, i+0.05, 0.175, -0.7, g);
      add(box(0.05, 0.05, 0.05), M.iron, i-0.05, 0.175, 0.7, g);
      add(box(0.05, 0.05, 0.05), M.iron, i+0.05, 0.175, 0.7, g);
    }
    addTrackDetails(g);
    return g;
  },
  'saw': () => {
    const g = new THREE.Group();
    add(tbox(0.5, 0.1, 0.01), M.iron, 0.25, 0, 0, g);
    add(tbox(0.1, 0.15, 0.05), M.wood, -0.05, 0, 0, g);
    return g;
  },
  'steel rail with gap': () => {
    const g = new THREE.Group();
    const left = new THREE.Group();
    left.add(buildRail(1.0, -0.5, -0.7));
    left.add(buildRail(1.0, -0.5, 0.7));
    // Joint bars (fishplates)
    add(tbox(0.2, 0.06, 0.02), M.iron, -0.1, 0.065, 0.7 - 0.025, left);
    add(tbox(0.2, 0.06, 0.02), M.iron, -0.1, 0.065, 0.7 + 0.025, left);
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.08), toon({color: '#444'}), -0.05, 0.065, 0.7, left).rotation.x = Math.PI/2;
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.08), toon({color: '#444'}), -0.15, 0.065, 0.7, left).rotation.x = Math.PI/2;
    g.add(left);
    
    const right = new THREE.Group();
    right.add(buildRail(1.0, 0.5, -0.7));
    right.add(buildRail(1.0, 0.5, 0.7));
    add(tbox(0.2, 0.06, 0.02), M.iron, 0.1, 0.065, 0.7 - 0.025, right);
    add(tbox(0.2, 0.06, 0.02), M.iron, 0.1, 0.065, 0.7 + 0.025, right);
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.08), toon({color: '#444'}), 0.05, 0.065, 0.7, right).rotation.x = Math.PI/2;
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.08), toon({color: '#444'}), 0.15, 0.065, 0.7, right).rotation.x = Math.PI/2;
    g.add(right);
    
    g.userData = { left, right };
    return g;
  },
  'seamless steel rail': () => {
    const g = new THREE.Group();
    g.add(buildRail(4.0, 0, -0.7));
    g.add(buildRail(4.0, 0, 0.7));
    // Joint bars in the middle to show it's joined seamlessly
    add(tbox(0.4, 0.06, 0.02), M.iron, 0, 0.065, 0.7 - 0.025, g);
    add(tbox(0.4, 0.06, 0.02), M.iron, 0, 0.065, 0.7 + 0.025, g);
    for(let x=-0.15; x<=0.15; x+=0.1) {
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.08), toon({color: '#444'}), x, 0.065, 0.7, g).rotation.x = Math.PI/2;
    }
    return g;
  },
  'train': () => {
    const g = new THREE.Group();
    const black = toon({color: '#222222'}), red = toon({color: '#882222'}), brass = toon({color: '#aa8833'}), grey = toon({color: '#555555'});
    
    const boiler = add(new THREE.CylinderGeometry(1.2, 1.2, 8, 16), black, 0, 2.2, 0, g);
    boiler.rotation.z = Math.PI/2;
    for(let x=-2; x<=2; x+=2) {
      const band = add(new THREE.CylinderGeometry(1.22, 1.22, 0.1, 16), brass, x, 2.2, 0, g);
      band.rotation.z = Math.PI/2;
    }
    add(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 16), brass, 0, 3.5, 0, g);
    add(new THREE.SphereGeometry(0.4, 16, 16), brass, 0, 3.9, 0, g);
    
    add(tbox(3, 4, 3), red, -3.5, 3, 0, g);
    add(tbox(3.2, 0.2, 3.2), black, -3.5, 5.1, 0, g);
    add(tbox(1, 1.5, 3.1), toon({color: '#88ccff'}), -3.5, 3.5, 0, g);
    
    add(tbox(4, 2.5, 2.8), black, -7.5, 2.25, 0, g);
    add(tbox(3.8, 0.5, 2.6), grey, -7.5, 3.6, 0, g);
    
    // Coal in tender
    const coalGeo = new THREE.DodecahedronGeometry(0.3);
    const coalMat = toon({color: '#111111'});
    for(let i=0; i<30; i++) {
      const cx = -7.5 + (rnd()-0.5)*3.5;
      const cz = (rnd()-0.5)*2.5;
      const cy = 3.5 + rnd()*0.5;
      const c = add(coalGeo, coalMat, cx, cy, cz, g);
      c.rotation.set(rnd(), rnd(), rnd());
    }
    // Lantern on back of tender
    add(tbox(0.4, 0.6, 0.4), toon({color: '#ddaa33'}), -9.6, 3, 0, g);
    add(tbox(0.3, 0.4, 0.3), toon({color: '#ffffee'}), -9.6, 3, 0, g);
    
    add(new THREE.CylinderGeometry(0.3, 0.4, 1.5, 16), black, 3, 3.5, 0, g);
    add(new THREE.CylinderGeometry(0.5, 0.3, 0.5, 16), brass, 3, 4.5, 0, g);
    
    const cowcatcher = add(new THREE.ConeGeometry(1.5, 2, 4), black, 4.5, 1, 0, g);
    cowcatcher.rotation.z = -Math.PI/2;
    cowcatcher.rotation.x = Math.PI/4;
    
    const wheels = [];
    for(let i=-1; i<=3; i+=2) {
      for(let z of [-0.7, 0.7]) {
        const w = new THREE.Group();
        w.position.set(i, 0.8, z);
        add(new THREE.CylinderGeometry(0.8, 0.8, 0.15, 16), red, 0, 0, 0, w).rotation.x = Math.PI/2;
        add(new THREE.CylinderGeometry(0.7, 0.7, 0.17, 16), black, 0, 0, 0, w).rotation.x = Math.PI/2;
        for(let a=0; a<Math.PI; a+=Math.PI/4) {
          const spoke = add(box(1.4, 0.1, 0.2), red, 0, 0, 0, w);
          spoke.rotation.z = a;
        }
        add(new THREE.CylinderGeometry(0.2, 0.2, 0.25, 8), brass, 0, 0, 0, w).rotation.x = Math.PI/2;
        g.add(w);
        wheels.push(w);
      }
    }
    
    const rodL = add(tbox(4.5, 0.15, 0.1), grey, 1, 0.8, -0.85, g);
    const rodR = add(tbox(4.5, 0.15, 0.1), grey, 1, 0.8, 0.85, g);
    
    g.userData.wheels = wheels;
    g.userData.rods = { left: rodL, right: rodR };
    return g;
  },
  'newspaper': () => {
    const g = new THREE.Group();
    const tex = canvasTex(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h);
      ctx.fillStyle = '#000'; ctx.font = 'bold 40px Arial'; ctx.textAlign = 'center';
      ctx.fillText('CLICKETY CLACK LINE', w/2, h/2);
      ctx.fillRect(50, h/2 + 20, w-100, 10);
      ctx.fillRect(50, h/2 + 40, w-100, 10);
    });
    add(tbox(0.4, 0.01, 0.3), toon({map: tex}), 0, 0, 0, g);
    return g;
  },
  'coin': () => {
    const g = new THREE.Group();
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.005, 16), toon({color: '#ffdd44'}), 0, 0, 0, g);
    return g;
  },
  'sheet of paper': () => {
    const g = new THREE.Group();
    add(tbox(0.2, 0.01, 0.15), toon({color: '#ffffff'}), 0, 0, 0, g);
    return g;
  },
  'kinked rail': () => {
    const g = new THREE.Group();
    const left = new THREE.Group();
    left.add(buildRail(1.5, -0.75, -0.7));
    left.add(buildRail(1.5, -0.75, 0.7));
    left.rotation.y = Math.PI/6;
    g.add(left);
    const right = new THREE.Group();
    right.add(buildRail(1.5, 0.75, -0.7));
    right.add(buildRail(1.5, 0.75, 0.7));
    right.rotation.y = -Math.PI/6;
    g.add(right);
    return g;
  }
};

const env_track = ASSETS['TRACK-CLOSEUP'](); world.add(env_track);
const env_canyon = ASSETS['CANYON-BRIDGE'](); world.add(env_canyon);
const env_office = ASSETS['OFFICE'](); world.add(env_office);
const env_news = ASSETS['NEWSPAPER-STAND'](); world.add(env_news);
const env_smooth = ASSETS['SMOOTH-TRACK'](); world.add(env_smooth);

const prop_saw = ASSETS['saw'](); world.add(prop_saw);
const prop_gapRail = ASSETS['steel rail with gap'](); world.add(prop_gapRail);
const prop_smoothRail = ASSETS['seamless steel rail'](); world.add(prop_smoothRail);
const prop_train = ASSETS['train'](); world.add(prop_train);
const prop_newspaper = ASSETS['newspaper'](); world.add(prop_newspaper);
const prop_coin = ASSETS['coin'](); world.add(prop_coin);
const prop_paper = ASSETS['sheet of paper'](); world.add(prop_paper);
const prop_kinkedRail = ASSETS['kinked rail'](); world.add(prop_kinkedRail);

const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const clouds = cloudsInit();

function worldState(S, f) {
  env_track.visible = S.env === 'TRACK-CLOSEUP';
  env_canyon.visible = S.env === 'CANYON-BRIDGE';
  env_office.visible = S.env === 'OFFICE';
  env_news.visible = S.env === 'NEWSPAPER-STAND';
  env_smooth.visible = S.env === 'SMOOTH-TRACK';

  prop_saw.visible = !!S.saw;
  if(S.saw) {
    prop_saw.position.set(S.saw.x, S.saw.y, S.saw.z);
  }

  prop_gapRail.visible = !!S.gapRail;
  if(S.gapRail) {
    prop_gapRail.position.set(0, 0.15, 0);
    const gap = S.gapRail.gapSize || 0.1;
    prop_gapRail.userData.left.position.x = -gap/2;
    prop_gapRail.userData.right.position.x = gap/2;
  }

  prop_smoothRail.visible = !!S.smoothRail;
  if(S.smoothRail) {
    prop_smoothRail.position.set(0, 0.15, 0);
    if(S.smoothRail.bend) {
      prop_smoothRail.position.z = Math.sin(f * 0.5) * 0.02;
    } else {
      prop_smoothRail.position.z = 0;
    }
  }

  prop_train.visible = !!S.train;
  if(S.train) {
    const ty = S.env === 'CANYON-BRIDGE' ? 0.35 : 0.3;
    prop_train.position.set(S.train.x, ty, S.train.z);
    prop_train.rotation.y = S.train.ry || 0;
    prop_train.rotation.z = S.train.roll || 0;
    const dist = S.train.ry ? S.train.z : S.train.x;
    const angle = -dist / 0.8;
    prop_train.userData.wheels.forEach(w => w.rotation.z = angle);
    const rodOffset = Math.sin(angle) * 0.4;
    const rodX = Math.cos(angle) * 0.4;
    prop_train.userData.rods.left.position.set(1 + rodX, 0.8 + rodOffset, -0.85);
    prop_train.userData.rods.right.position.set(1 + rodX, 0.8 + rodOffset, 0.85);
  }

  prop_newspaper.visible = !!S.newspaper;
  if(S.newspaper) {
    prop_newspaper.position.set(0, 1.05, -0.9);
    prop_newspaper.rotation.x = Math.PI/8;
  }

  prop_coin.visible = !!S.coin;
  if(S.coin) {
    prop_coin.position.set(0, 0.3, 0.7);
    prop_coin.rotation.x = Math.PI/2;
  }

  prop_paper.visible = !!S.paper;
  if(S.paper) {
    prop_paper.position.set(0, 0.3, 0.7);
  }

  prop_kinkedRail.visible = !!S.kinkedRail;
  if(S.kinkedRail) {
    prop_kinkedRail.position.set(S.kinkedRail.x || 0, 0.15, S.kinkedRail.z || 0);
  }

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
