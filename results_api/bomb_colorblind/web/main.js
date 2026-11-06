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

// Timer Canvas Setup
let timerCtx, timerTexObj;
const timerTex = new THREE.CanvasTexture(document.createElement('canvas'));
timerTex.image.width = 256; timerTex.image.height = 128;
timerCtx = timerTex.image.getContext('2d');
timerTexObj = timerTex;

// Custom Textures
const asphaltTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#333333'; g.fillRect(0, 0, w, h);
    for(let i=0; i<2000; i++) {
        g.fillStyle = rnd() > 0.5 ? '#444444' : '#222222';
        g.fillRect(rnd()*w, rnd()*h, 2+rnd()*3, 2+rnd()*3);
    }
}, 20, 20);

const tileTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#dddddd'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#aaaaaa';
    for(let y=0; y<h; y+=64) {
        for(let x=0; x<w; x+=64) {
            if ((x/64 + y/64) % 2 === 0) g.fillRect(x, y, 64, 64);
        }
    }
}, 4, 4);

const concreteTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#999999'; g.fillRect(0, 0, w, h);
    for(let i=0; i<1000; i++) {
        g.fillStyle = `rgba(0,0,0,${rnd()*0.1})`;
        g.beginPath(); g.arc(rnd()*w, rnd()*h, 5+rnd()*15, 0, Math.PI*2); g.fill();
    }
}, 10, 10);

const matTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#2b4c6f'; g.fillRect(0, 0, w, h);
    for(let i=0; i<1000; i++) {
        g.fillStyle = rnd() > 0.5 ? '#203c5c' : '#365c85';
        g.fillRect(rnd()*w, rnd()*h, 2+rnd()*4, 2+rnd()*4);
    }
    // Grid
    g.strokeStyle = '#3b5c7f'; g.lineWidth = 4;
    for(let i=0; i<=w; i+=128) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke();
        g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke();
    }
}, 2, 2);

const ASSETS = {
    'CITY-STREET': () => {
        const g = new THREE.Group();
        // Road
        add(new THREE.PlaneGeometry(25, 25), toon({map: asphaltTex}), 0, 0, 0, g).rotation.x = -Math.PI/2;
        // Sidewalks
        add(tbox(25, 0.3, 6, 2), toon({map: concreteTex}), 0, 0.15, -9.5, g);
        add(tbox(25, 0.3, 6, 2), toon({map: concreteTex}), 0, 0.15, 9.5, g);
        
        // Concrete barriers
        for(let i=-12; i<=12; i+=3) {
            add(tbox(2.8, 1.2, 0.8, 1), toon({map: concreteTex}), -4, 0.6, i, g);
            // Warning stripes
            add(tbox(2.82, 0.4, 0.82, 1), toon({color: '#e6c068'}), -4, 0.6, i, g);
        }
        
        // Police vehicles
        const car = new THREE.Group();
        add(tbox(4.5, 1.2, 2.0, 1), toon({color: '#1a2436'}), 0, 0.8, 0, car); // body
        add(tbox(2.5, 0.9, 1.8, 1), toon({color: '#ffffff'}), -0.2, 1.8, 0, car); // cabin
        add(tbox(2.3, 0.8, 1.85, 1), toon({color: '#111111'}), -0.2, 1.8, 0, car); // windows
        add(tbox(0.8, 0.2, 1.2, 1), toon({color: '#222222'}), -0.2, 2.3, 0, car); // lightbar base
        add(tbox(0.3, 0.25, 0.5, 1), toon({color: '#ff0000'}), -0.2, 2.35, 0.3, car); // red light
        add(tbox(0.3, 0.25, 0.5, 1), toon({color: '#0000ff'}), -0.2, 2.35, -0.3, car); // blue light
        // Wheels
        for(let wx of [-1.4, 1.4]) {
            for(let wz of [-1, 1]) {
                const w = add(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16), toon({color: '#111111'}), wx, 0.4, wz, car);
                w.rotation.x = Math.PI/2;
                const hub = add(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8), toon({color: '#aaaaaa'}), wx, 0.4, wz, car);
                hub.rotation.x = Math.PI/2;
            }
        }
        car.position.set(2, 0, -3);
        car.rotation.y = 0.2;
        g.add(car);
        
        const car2 = car.clone();
        car2.position.set(2, 0, 8); // Moved further back to clear camera
        car2.rotation.y = -0.1;
        g.add(car2);

        // City buildings
        for(let i=-10; i<=10; i+=6) {
            const bldg = new THREE.Group();
            add(tbox(5.5, 18, 5.5, 2), M.plaster, 0, 9, 0, bldg);
            // Windows
            for(let wy=3; wy<=15; wy+=3) {
                for(let wx=-1.5; wx<=1.5; wx+=1.5) {
                    add(tbox(1, 1.5, 5.6, 1), toon({color: '#2b2430'}), wx, wy, 0, bldg);
                }
            }
            // Door
            add(tbox(1.5, 2.5, 5.6, 1), M.door, 0, 1.25, 0, bldg);
            bldg.position.set(10, 0, i);
            g.add(bldg);
        }
        return g;
    },
    'POLICE-OFFICE': () => {
        const g = new THREE.Group();
        // Floor
        add(new THREE.PlaneGeometry(12, 12), M.plank, 0, 0, 0, g).rotation.x = -Math.PI/2;
        // Walls
        add(tbox(12, 4, 0.4, 2), M.plaster2, 0, 2, -6, g); // back
        add(tbox(0.4, 4, 12, 2), M.plaster2, -6, 2, 0, g); // left
        add(tbox(0.4, 4, 12, 2), M.plaster2, 6, 2, 0, g); // right
        
        // Lights
        add(tbox(2, 0.1, 0.5, 1), toon({color: '#ffffff', emissive: '#ffffff'}), 0, 3.9, 0, g);
        const pl = new THREE.PointLight('#ffffff', 2.0, 20);
        pl.position.set(0, 3.5, 0);
        g.add(pl);
        
        // Desk
        const desk = new THREE.Group();
        add(tbox(2.4, 0.1, 1.2, 1), M.wood, 0, 1, 0, desk); // top
        add(tbox(0.8, 1, 1.1, 1), M.wood, 0.7, 0.5, 0, desk); // drawers right
        add(tbox(0.8, 1, 1.1, 1), M.wood, -0.7, 0.5, 0, desk); // drawers left
        desk.position.set(3, 0, -2);
        g.add(desk);
        
        // Chair
        add(tbox(0.6, 0.1, 0.6, 1), toon({color: '#333333'}), 3, 0.5, -0.8, g);
        add(tbox(0.6, 0.6, 0.1, 1), toon({color: '#333333'}), 3, 0.8, -0.55, g);
        add(new THREE.CylinderGeometry(0.05, 0.05, 0.4), M.iron, 3, 0.2, -0.8, g);

        // Bench
        add(tbox(3, 0.1, 0.8, 1), M.wood, -3, 0.5, -2, g);
        add(tbox(0.1, 0.5, 0.7, 1), M.wood, -4.4, 0.25, -2, g);
        add(tbox(0.1, 0.5, 0.7, 1), M.wood, -1.6, 0.25, -2, g);

        // Papers on wall
        add(new THREE.PlaneGeometry(0.6, 0.8), toon({color: '#ffffff'}), -1, 2.5, -5.79, g);
        add(tbox(0.4, 0.05, 0.02, 1), toon({color: '#111111'}), -1, 2.7, -5.78, g);
        add(tbox(0.4, 0.05, 0.02, 1), toon({color: '#111111'}), -1, 2.5, -5.78, g);
        
        add(new THREE.PlaneGeometry(0.6, 0.8), toon({color: '#ffffff'}), 1, 2.5, -5.79, g);
        add(tbox(0.4, 0.05, 0.02, 1), toon({color: '#111111'}), 1, 2.7, -5.78, g);
        add(tbox(0.4, 0.05, 0.02, 1), toon({color: '#111111'}), 1, 2.5, -5.78, g);

        // Filing cabinet
        add(tbox(1, 2, 1.2, 1), toon({color: '#7a7a7a'}), 5, 1, -5, g);
        add(tbox(0.8, 0.6, 1.25, 1), toon({color: '#8a8a8a'}), 5, 1.6, -5, g);
        add(tbox(0.8, 0.6, 1.25, 1), toon({color: '#8a8a8a'}), 5, 0.9, -5, g);
        add(tbox(0.8, 0.6, 1.25, 1), toon({color: '#8a8a8a'}), 5, 0.2, -5, g);

        // Door
        add(tbox(1.5, 2.5, 0.5, 1), M.door, -5.8, 1.25, 2, g);

        return g;
    },
    'BOMB-ROOM': () => {
        const g = new THREE.Group();
        // Floor
        add(new THREE.PlaneGeometry(10, 10), toon({map: concreteTex}), 0, 0, 0, g).rotation.x = -Math.PI/2;
        // Walls
        add(tbox(10, 4, 0.4, 2), toon({map: concreteTex}), 0, 2, -5, g); // back
        add(tbox(0.4, 4, 10, 2), toon({map: concreteTex}), -5, 2, 0, g); // left
        add(tbox(0.4, 4, 10, 2), toon({map: concreteTex}), 5, 2, 0, g); // right
        
        // Industrial light
        add(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16), M.iron, 0, 3.8, 0, g);
        add(new THREE.CylinderGeometry(0.05, 0.05, 0.4), M.iron, 0, 4.0, 0, g);
        add(new THREE.SphereGeometry(0.2), toon({color: '#ffffff', emissive: '#ffffff'}), 0, 3.7, 0, g);
        const pl = new THREE.PointLight('#ffffff', 2.0, 20);
        pl.position.set(0, 3.5, 0);
        g.add(pl);
        
        const pl2 = new THREE.PointLight('#ffffff', 1.0, 10);
        pl2.position.set(0, 1.5, 1.5);
        g.add(pl2);

        // Bomb table in center
        add(tbox(1, 0.8, 1, 1), M.iron, 0, 0.4, 0, g);

        // Tool table
        const table = new THREE.Group();
        add(tbox(2.5, 0.1, 1.2, 1), M.iron, 0, 1, 0, table);
        for(let x of [-1.1, 1.1]) {
            for(let z of [-0.5, 0.5]) {
                add(tbox(0.1, 1, 0.1, 1), M.iron, x, 0.5, z, table);
            }
        }
        // Tools on table
        add(tbox(0.4, 0.05, 0.1, 1), toon({color: '#cc0000'}), 0.5, 1.05, 0.2, table); // wrench
        add(tbox(0.2, 0.05, 0.15, 1), toon({color: '#222222'}), -0.5, 1.05, -0.2, table); // meter
        table.position.set(3, 0, -2);
        g.add(table);

        // Warning sign
        add(tbox(1.5, 1, 0.1, 1), toon({color: '#e6c068'}), 0, 2.5, -4.9, g);
        add(tbox(1.3, 0.2, 0.12, 1), toon({color: '#111111'}), 0, 2.6, -4.9, g);
        add(tbox(1.0, 0.1, 0.12, 1), toon({color: '#111111'}), 0, 2.3, -4.9, g);

        // Blast door
        add(tbox(2, 2.8, 0.5, 1), M.iron, -4.8, 1.4, 2, g);
        add(new THREE.CylinderGeometry(0.2, 0.2, 0.1), toon({color: '#e6c068'}), -4.5, 1.4, 2, g).rotation.x = Math.PI/2;

        // Crates
        add(tbox(1.2, 1.2, 1.2, 1), M.wood, -3, 0.6, -3, g);
        add(tbox(1, 1, 1, 1), M.wood, -2.8, 1.7, -3.2, g);

        return g;
    },
    'CIRCUIT-VIEW': () => {
        const g = new THREE.Group();
        // Anti-static mat / workbench surface
        add(new THREE.PlaneGeometry(2, 2), toon({map: matTex}), 0, 0, 0, g).rotation.x = -Math.PI/2;
        
        // Tools scattered around
        const sd = new THREE.Group();
        add(tbox(0.1, 0.02, 0.02, 1), toon({color: '#cc0000'}), 0.05, 0, 0, sd);
        add(new THREE.CylinderGeometry(0.003, 0.003, 0.1), M.iron, -0.05, 0, 0, sd).rotation.z = Math.PI/2;
        sd.position.set(0.25, 0.01, 0.15);
        sd.rotation.y = 0.5;
        g.add(sd);

        const multi = new THREE.Group();
        add(tbox(0.12, 0.03, 0.08, 1), toon({color: '#222222'}), 0, 0, 0, multi);
        add(tbox(0.08, 0.031, 0.05, 1), toon({color: '#88ccff'}), 0, 0, -0.01, multi);
        multi.position.set(-0.25, 0.015, -0.1);
        multi.rotation.y = -0.3;
        g.add(multi);

        return g;
    },
    'CONTROL-ROOM': () => {
        const g = new THREE.Group();
        // Floor
        add(new THREE.PlaneGeometry(15, 15), toon({map: tileTex}), 0, 0, 0, g).rotation.x = -Math.PI/2;
        // Walls
        add(tbox(15, 4, 0.4, 2), M.plaster, 0, 2, -7.5, g); // back
        add(tbox(0.4, 4, 15, 2), M.plaster, -7.5, 2, 0, g); // left
        add(tbox(0.4, 4, 15, 2), M.plaster, 7.5, 2, 0, g); // right
        
        // Recessed lights
        for(let x=-4; x<=4; x+=4) {
            for(let z=-4; z<=4; z+=4) {
                add(tbox(1.5, 0.1, 1.5, 1), toon({color: '#ffffff', emissive: '#ffffff'}), x, 3.95, z, g);
            }
        }
        const pl = new THREE.PointLight('#ffffff', 2.0, 25);
        pl.position.set(0, 3.5, 0);
        g.add(pl);

        // Equipment desk
        const desk = new THREE.Group();
        add(tbox(5, 0.1, 1.5, 1), M.iron, 0, 1, 0, desk);
        add(tbox(4.8, 1, 1.3, 1), toon({color: '#333333'}), 0, 0.5, 0, desk);
        desk.position.set(-4, 0, -3);
        g.add(desk);

        // Chairs
        for(let z of [-2, -4]) {
            add(tbox(0.6, 0.1, 0.6, 1), toon({color: '#111111'}), -2.5, 0.5, z, g);
            add(tbox(0.1, 0.6, 0.6, 1), toon({color: '#111111'}), -2.2, 0.8, z, g);
            add(new THREE.CylinderGeometry(0.05, 0.05, 0.4), M.iron, -2.5, 0.2, z, g);
        }

        // Monitors
        for(let i=-1.5; i<=1.5; i+=1.5) {
            const mon = new THREE.Group();
            add(tbox(0.8, 0.5, 0.1, 1), toon({color: '#111111'}), 0, 1.3, 0, mon);
            add(new THREE.PlaneGeometry(0.75, 0.45), toon({color: '#88ccff', emissive: '#224466'}), 0, 1.3, 0.06, mon);
            add(tbox(0.1, 0.2, 0.1, 1), toon({color: '#111111'}), 0, 1.1, 0, mon);
            add(tbox(0.4, 0.05, 0.3, 1), toon({color: '#111111'}), 0, 1.025, 0, mon);
            mon.position.set(-4, 0, -3 + i);
            mon.rotation.y = Math.PI/2;
            if(i === -1.5) mon.rotation.y += 0.3;
            if(i === 1.5) mon.rotation.y -= 0.3;
            g.add(mon);
        }

        // Keyboards
        for(let i=-1.5; i<=1.5; i+=1.5) {
            add(tbox(0.2, 0.02, 0.5, 1), toon({color: '#222222'}), -3.5, 1.06, -3 + i, g);
        }

        // Server Racks / Cabinets
        for(let x of [4, 6]) {
            const rack = new THREE.Group();
            add(tbox(1.5, 3, 1.5, 1), toon({color: '#222222'}), 0, 1.5, 0, rack);
            // Blinking lights panel
            add(tbox(1.3, 2.8, 1.6, 1), toon({color: '#111111'}), 0, 1.5, 0, rack);
            for(let y=0.5; y<=2.5; y+=0.2) {
                add(tbox(1.1, 0.05, 1.62, 1), toon({color: '#444444'}), 0, y, 0, rack);
                add(tbox(0.1, 0.05, 1.65, 1), toon({color: '#00ff00', emissive: '#00ff00'}), -0.3, y, 0, rack);
                add(tbox(0.1, 0.05, 1.65, 1), toon({color: '#ff0000', emissive: '#ff0000'}), 0.3, y, 0, rack);
            }
            rack.position.set(x, 0, -6);
            g.add(rack);
        }

        // Large wall screen
        add(tbox(6, 2.5, 0.1, 1), toon({color: '#111111'}), 0, 2.5, -7.4, g);
        add(new THREE.PlaneGeometry(5.8, 2.3), toon({color: '#224466', emissive: '#112233'}), 0, 2.5, -7.34, g);
        // Map graphics on screen
        add(new THREE.PlaneGeometry(2, 1.5), toon({color: '#4488cc'}), -1, 2.5, -7.33, g);
        add(new THREE.PlaneGeometry(1.5, 1.5), toon({color: '#4488cc'}), 1.5, 2.5, -7.33, g);

        return g;
    },
    'bomb device': () => {
        const g = new THREE.Group();
        // Main case
        add(tbox(0.35, 0.2, 0.25, 1), toon({color: '#1a1a1a'}), 0, 0.1, 0, g);
        // Metallic trim
        add(tbox(0.36, 0.02, 0.26, 1), M.iron, 0, 0.1, 0, g);
        add(tbox(0.36, 0.02, 0.26, 1), M.iron, 0, 0.18, 0, g);
        // Battery pack
        add(tbox(0.1, 0.08, 0.15, 1), toon({color: '#cc0000'}), -0.1, 0.24, 0, g);
        add(tbox(0.08, 0.08, 0.16, 1), toon({color: '#111111'}), -0.1, 0.24, 0, g);
        // Static wires
        const w1 = add(new THREE.CylinderGeometry(0.005, 0.005, 0.15), toon({color: '#ffff00'}), -0.05, 0.24, 0.05, g);
        w1.rotation.z = Math.PI/2;
        const w2 = add(new THREE.CylinderGeometry(0.005, 0.005, 0.15), toon({color: '#0000ff'}), -0.05, 0.24, -0.05, g);
        w2.rotation.z = Math.PI/2;
        // Screws
        for(let x of [-0.15, 0.15]) {
            for(let z of [-0.1, 0.1]) {
                add(new THREE.CylinderGeometry(0.01, 0.01, 0.01), M.iron, x, 0.205, z, g);
            }
        }
        return g;
    },
    'six bomb wires': () => {
        const g = new THREE.Group();
        const colors = ['#c0302c', '#3fa1e8', '#58c25a', '#f2c230', '#e88a3c', '#ffffff'];
        for(let i=0; i<6; i++) {
            const wire = add(new THREE.CylinderGeometry(0.005, 0.005, 0.4), toon({color: colors[i]}), -0.1 + i*0.04, 0.02, 0, g);
            wire.rotation.x = Math.PI/2;
            wire.rotation.z = (i - 2.5) * 0.05; // Spread them out slightly
        }
        return g;
    },
    'digital countdown display': () => {
        const g = new THREE.Group();
        add(tbox(0.15, 0.08, 0.02, 1), toon({color: '#050505'}), 0, 0.04, 0, g);
        add(new THREE.PlaneGeometry(0.13, 0.06), new THREE.MeshBasicMaterial({map: timerTexObj}), 0, 0.04, 0.011, g);
        return g;
    },
    'circuit board': () => {
        const g = new THREE.Group();
        // Board
        add(tbox(0.25, 0.01, 0.2, 1), toon({color: '#1a4a1a'}), 0, 0.005, 0, g);
        // Chips
        add(tbox(0.05, 0.01, 0.05, 1), toon({color: '#111111'}), -0.05, 0.015, -0.05, g);
        add(tbox(0.03, 0.01, 0.08, 1), toon({color: '#111111'}), 0.05, 0.015, 0.05, g);
        add(tbox(0.02, 0.01, 0.02, 1), toon({color: '#111111'}), 0.08, 0.015, -0.05, g);
        add(tbox(0.04, 0.01, 0.03, 1), toon({color: '#111111'}), -0.08, 0.015, 0.06, g);
        // Capacitors (cylinders)
        add(new THREE.CylinderGeometry(0.008, 0.008, 0.02), toon({color: '#004488'}), 0, 0.02, 0.05, g);
        add(new THREE.CylinderGeometry(0.008, 0.008, 0.02), toon({color: '#004488'}), 0, 0.02, 0.07, g);
        add(new THREE.CylinderGeometry(0.006, 0.006, 0.015), toon({color: '#888888'}), -0.02, 0.0175, 0.06, g);
        // Add some more colorful components
        add(tbox(0.01, 0.01, 0.02, 1), toon({color: '#ccaa00'}), 0.02, 0.015, -0.08, g);
        add(tbox(0.01, 0.01, 0.02, 1), toon({color: '#ccaa00'}), 0.04, 0.015, -0.08, g);
        add(tbox(0.015, 0.01, 0.015, 1), toon({color: '#cc0000'}), -0.08, 0.015, -0.02, g);
        // Solder points (silver dots)
        for(let i=0; i<40; i++) {
            const x = (rnd() - 0.5) * 0.22;
            const z = (rnd() - 0.5) * 0.18;
            add(new THREE.CylinderGeometry(0.003, 0.003, 0.002), M.iron, x, 0.011, z, g);
        }
        // Traces (thin lines)
        add(tbox(0.1, 0.001, 0.002, 1), toon({color: '#44aa44'}), -0.02, 0.011, -0.02, g);
        add(tbox(0.002, 0.001, 0.08, 1), toon({color: '#44aa44'}), 0.03, 0.011, 0.02, g);
        add(tbox(0.05, 0.001, 0.002, 1), toon({color: '#44aa44'}), 0.05, 0.011, -0.05, g);
        add(tbox(0.002, 0.001, 0.05, 1), toon({color: '#44aa44'}), -0.05, 0.011, 0.02, g);
        
        return g;
    },
    'protective bomb disposal suit': () => {
        const g = new THREE.Group();
        const suitMat = toon({color: '#3a5a3a'});
        // Torso
        add(new THREE.CylinderGeometry(0.28, 0.25, 0.8), suitMat, 0, 1.0, 0, g);
        // Legs
        add(new THREE.CylinderGeometry(0.12, 0.12, 0.6), suitMat, -0.12, 0.3, 0, g);
        add(new THREE.CylinderGeometry(0.12, 0.12, 0.6), suitMat, 0.12, 0.3, 0, g);
        // Arms
        const armL = add(new THREE.CylinderGeometry(0.1, 0.1, 0.7), suitMat, -0.35, 1.0, 0, g);
        armL.rotation.z = 0.2;
        const armR = add(new THREE.CylinderGeometry(0.1, 0.1, 0.7), suitMat, 0.35, 1.0, 0, g);
        armR.rotation.z = -0.2;
        // Padding segments (horizontal rings)
        for(let y=0.7; y<=1.3; y+=0.15) {
            add(new THREE.TorusGeometry(0.26, 0.03, 8, 16), toon({color: '#2a4a2a'}), 0, y, 0, g).rotation.x = Math.PI/2;
        }
        // Helmet
        add(new THREE.SphereGeometry(0.2), suitMat, 0, 1.6, 0, g);
        // Visor
        add(new THREE.PlaneGeometry(0.22, 0.16), toon({color: '#88ccff', transparent: true, opacity: 0.6}), 0, 1.6, 0.19, g);
        // Helmet rim
        add(new THREE.TorusGeometry(0.2, 0.02, 8, 16), toon({color: '#2a4a2a'}), 0, 1.45, 0, g).rotation.x = Math.PI/2;
        
        return g;
    }
};

const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const clouds = cloudsInit();

// Instantiate and compose the world
const cityStreet = ASSETS['CITY-STREET'](); world.add(cityStreet);
const policeOffice = ASSETS['POLICE-OFFICE'](); world.add(policeOffice);
const bombRoom = ASSETS['BOMB-ROOM'](); world.add(bombRoom);
const circuitView = ASSETS['CIRCUIT-VIEW'](); world.add(circuitView);
const controlRoom = ASSETS['CONTROL-ROOM'](); world.add(controlRoom);

// Add bomb device to BOMB-ROOM
const bomb1 = ASSETS['bomb device']();
bomb1.position.set(0, 0.8, 0);
bombRoom.add(bomb1);
const timer1 = ASSETS['digital countdown display']();
timer1.position.set(0, 0.2, 0.05);
bomb1.add(timer1);
const wires1 = ASSETS['six bomb wires']();
wires1.position.set(0, 0.2, 0);
wires1.scale.set(0.5, 0.5, 0.5);
bomb1.add(wires1);

// Add circuit board, wires, timer to CIRCUIT-VIEW
const cb = ASSETS['circuit board']();
cb.position.set(0, 0.01, 0);
circuitView.add(cb);
const wires = ASSETS['six bomb wires']();
wires.position.set(0, 0.02, 0);
circuitView.add(wires);
const timerDisp = ASSETS['digital countdown display']();
timerDisp.position.set(0, 0.05, -0.15);
circuitView.add(timerDisp);

// Trace highlight for shot 9
const traceHighlight = add(new THREE.SphereGeometry(0.008, 8, 8), toon({color: '#ffffff', emissive: '#ffffff'}), 0, 0.03, 0, circuitView);

// Warning light for bomb room
const warningLight = new THREE.PointLight('#ff0000', 0, 5);
warningLight.position.set(0, 1, 0);
bombRoom.add(warningLight);

function worldState(S, f) {
    cityStreet.visible = S.place === 'CITY-STREET';
    policeOffice.visible = S.place === 'POLICE-OFFICE';
    bombRoom.visible = S.place === 'BOMB-ROOM';
    circuitView.visible = S.place === 'CIRCUIT-VIEW';
    controlRoom.visible = S.place === 'CONTROL-ROOM';

    // Update timer
    timerCtx.fillStyle = '#050505'; 
    timerCtx.fillRect(0,0,256,128);
    timerCtx.fillStyle = '#ffffff'; 
    timerCtx.font = 'bold 80px monospace';
    timerCtx.textAlign = 'center'; 
    timerCtx.textBaseline = 'middle';
    
    let sec = 8 - Math.floor((f - 772)/30); // s11 starts at 8s
    if (f < 400) sec = 5 - Math.floor((f - 250)/30); // s4 starts at 5s
    if (sec < 0) sec = 0;
    if (f >= 918) sec = 2; // Timer stops in s14
    
    timerCtx.fillText(`00:0${sec}`, 128, 64);
    timerTexObj.needsUpdate = true;

    // Trace highlight for s9
    traceHighlight.visible = S.id === 's9';
    if (S.id === 's9') {
        const progress = ((f - 616) / (695 - 616));
        // Move along the blue wire (x = -0.06) from z = -0.15 to z = 0.15
        traceHighlight.position.set(-0.06, 0.03, -0.15 + progress * 0.3);
    }

    // Warning light pulse
    if (S.id === 's4' || S.id === 's10' || S.id === 's11') {
        warningLight.intensity = (Math.sin(f * 0.5) > 0) ? 2 : 0;
    } else {
        warningLight.intensity = 0;
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
