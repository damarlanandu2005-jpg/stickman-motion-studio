import * as THREE from './lib/three.module.js';
import * as T from './toon.js';
import * as P from './paint.js';
import { SHOTS, TOTAL, shotAt, camAt, dofAt, LIGHTS, lightFor, actorsAt, worldAt, fxAt } from './story.js';

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
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const clouds = cloudsInit();
const TANKP = [-34, 0, -10];
const streetTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#7d756c'; g.fillRect(0, 0, w, h); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const ox = (y % 2) * 16; g.fillStyle = `hsl(${28 + rnd() * 8},${6 + rnd() * 8}%,${36 + rnd() * 16}%)`; g.fillRect(x * 32 + ox + 2, y * 32 + 2, 28, 28); } }, 60, 60);
const ground = add(new THREE.PlaneGeometry(1800, 1800), toon({ map: streetTex }), 0, -0.02, 0, world, { cast: false }); ground.rotation.x = -Math.PI / 2;
const brickTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#9a4a38'; g.fillRect(0, 0, w, h); for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) { g.fillStyle = `hsl(${10 + rnd() * 8},${48 + rnd() * 10}%,${32 + rnd() * 12}%)`; g.fillRect(x * 32 + (y % 2) * 16 + 1, y * 16 + 1, 30, 14); } for (let wy = 0; wy < 2; wy++) for (let wx = 0; wx < 3; wx++) { g.fillStyle = '#2b2430'; g.fillRect(24 + wx * 80, 28 + wy * 112, 38, 62); g.fillStyle = '#e8dcc0'; g.fillRect(20 + wx * 80, 24 + wy * 112, 46, 6); } }, 1, 1);
const brickM = toon({ map: brickTex }), brickM2 = toon({ map: brickTex, color: '#e8d0c0' });
{ const r = P.rng(12);
  for (let i = 0; i < 16; i++) for (const s of [-1, 1]) { const x = -66 + i * 9 + r() * 2; if (s < 0 && x > -50 && x < -18) continue; const hh = 8 + r() * 7, z = s * (19 + r() * 3);
    const b = add(tbox(8, hh, 7, 4), i % 2 ? brickM : brickM2, x, hh / 2, z, world); add(tbox(8.4, 0.5, 7.4, 2), M.stone, x, hh + 0.2, z, world); add(tbox(0.8, 2.2, 0.8, 1), M.stone, x + 2, hh + 1.4, z, world); }
  for (let i = 0; i < 6; i++) add(tbox(8, 9 + r() * 5, 7, 4), i % 2 ? brickM : brickM2, -62 + i * 9, 6, -22 - r() * 3, world); }
// elevated railway along the street
const trainG = new THREE.Group(); world.add(trainG);
{ const g = new THREE.Group(); world.add(g); const iron = toon({ color: '#3f4650' });
  add(tbox(260, 0.6, 3.2, 3), iron, 10, 8, -15, g); for (let x = -110; x <= 130; x += 8) { add(tbox(0.7, 8, 0.7, 2), iron, x, 4, -13.8, g); add(tbox(0.7, 8, 0.7, 2), iron, x, 4, -16.2, g); }
  for (const z of [-14.2, -15.8]) add(tbox(260, 0.12, 0.12, 2), toon({ color: '#9a9aa0' }), 10, 8.4, z, g);
  const tm = toon({ color: '#2f5f3a' }); for (let i = 0; i < 3; i++) { add(tbox(6, 2.6, 2.6, 2), tm, i * 6.4, 9.9, -15, trainG); add(box(5.6, 0.7, 2.7), toon({ color: '#ffe9b0' }), i * 6.4, 10.1, -15, trainG, { cast: false }); } }
// harbour water far behind
const sea = add(new THREE.PlaneGeometry(1800, 500), toon({ color: '#3f6f90' }), 0, -0.3, -330, world, { cast: false }); sea.rotation.x = -Math.PI / 2;
// ---------- the tank ----------
const steel = toon({ map: canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#8a8f98'; g.fillRect(0, 0, w, h); for (let y = 0; y < 8; y++) { g.fillStyle = y % 2 ? '#7a808a' : '#969ba4'; g.fillRect(0, y * 64, w, 64); g.fillStyle = '#4a4e58'; g.fillRect(0, y * 64, w, 3); for (let x = 0; x < 32; x++) { g.fillStyle = '#5a5e68'; g.beginPath(); g.arc(x * 16 + 8, y * 64 + 12, 3, 0, 7); g.fill(); } } }, 4, 1) });
const tank = new THREE.Group(); tank.position.set(...TANKP); world.add(tank);
const tankWhole = new THREE.Group(); tank.add(tankWhole);
add(new THREE.CylinderGeometry(7.5, 7.5, 13, 36), steel, 0, 6.5, 0, tankWhole); add(new THREE.CylinderGeometry(7.2, 7.6, 1.2, 36), steel, 0, 13.4, 0, tankWhole);
for (const y of [2, 6, 10]) { const t = add(new THREE.TorusGeometry(7.55, 0.16, 6, 40), toon({ color: '#3f444e' }), 0, y, 0, tankWhole); t.rotation.x = Math.PI / 2; }
add(box(1.2, 14, 0.3), toon({ color: '#5a5e68' }), 0, 7, 7.7, tankWhole); // ladder strip
const syrupM = toon({ color: '#5a3216' }), foamM = toon({ color: '#9a6030' });
const halfA = add(new THREE.CylinderGeometry(7.5, 7.5, 13, 28, 1, true, 0, Math.PI), steel, 0, 6.5, 0, tank), halfB = add(new THREE.CylinderGeometry(7.5, 7.5, 13, 28, 1, true, Math.PI, Math.PI), steel, 0, 6.5, 0, tank);
halfA.material = steel.clone(); halfA.material.side = THREE.DoubleSide; halfB.material = halfA.material; halfA.visible = halfB.visible = false;
const rivets = []; { const rm = toon({ color: '#c8ccd4' }); for (let i = 0; i < 26; i++) rivets.push(add(new THREE.SphereGeometry(0.14, 6, 5), rm, 0, 0, 0, world, { cast: false })); }
// ---------- the wave + flood ----------
const waveG = new THREE.Group(); world.add(waveG);
const wBody = add(box(1, 1, 1), syrupM, 0, 0, 0, waveG), wFront = add(new THREE.CylinderGeometry(1, 1, 1, 24), syrupM, 0, 0, 0, waveG), wCrest = add(new THREE.CylinderGeometry(1, 1, 1, 24), foamM, 0, 0, 0, waveG);
wFront.rotation.x = Math.PI / 2; wCrest.rotation.x = Math.PI / 2;
const flood = add(box(1, 1, 1), syrupM, 0, 0, 0, world, { cast: false });
// a house the wave flattens
const victim = new THREE.Group(); victim.position.set(36, 0, -6); world.add(victim);
add(tbox(7, 6, 7, 3), brickM, 0, 3, 0, victim); { const rf = add(new THREE.CylinderGeometry(0.1, 5.4, 2.4, 4), M.roof, 0, 7.2, 0, victim); rf.rotation.y = Math.PI / 4; }
// plaque + bench (today)
const plaque = new THREE.Group(); plaque.position.set(3.6, 0, -1.4); world.add(plaque); add(tbox(1.4, 1.1, 0.3, 1), M.stone, 0, 0.55, 0, plaque); add(box(0.9, 0.55, 0.06), M.bronze, 0, 0.72, 0.18, plaque, { cast: false });
add(tbox(1.8, 0.12, 0.5, 1), M.wood, -3.2, 0.5, 0.5, plaque); for (const x of [-3.9, -2.5]) add(box(0.1, 0.5, 0.4), M.wood, x, 0.25, 0.5, plaque);
{ const t = new THREE.Group(); t.position.set(6.5, 0, -3); world.add(t); add(new THREE.CylinderGeometry(0.2, 0.28, 3, 7), M.trunk, 0, 1.5, 0, t); add(new THREE.SphereGeometry(1.8, 10, 8), M.bush, 0, 4.2, 0, t); }
// clean-up brush stains
const stain = add(box(1, 1, 1), syrupM, 0, 0, 0, world, { cast: false });

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
  sat: { value: 1.08 }, lift: { value: new THREE.Color(0, 0, 0) }, gain: { value: new THREE.Color(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 } };
const inkScene = fs(new THREE.ShaderMaterial({ uniforms: inkU, vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D col, nd; uniform vec2 res; uniform float px, sat, vig, flash; uniform vec3 fogCol, lift, gain; varying vec2 vUv;
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
  inkU.sat.value = L.sat; inkU.gain.value.set(L.gain || '#ffffff'); inkU.lift.value.set(L.lift || '#000000');
  waterU.deep.value.set(L.waterDeep); waterU.shal.value.set(L.waterShal); waterU.glint.value.set(L.glint);
}
function placeSun(L, focus) {
  // sun direction from azimuth/elevation in world space
  const az = rx(L.az), el = rx(L.el); tmpV.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  skyU.sunDir.value.copy(tmpV);
  sun.position.copy(focus).addScaledVector(tmpV, 80); sun.target.position.copy(focus);
  const ext = L.shadowExt || 30, sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 200; sc.updateProjectionMatrix();
}

function worldState(S, f) {
  const k = S.bulge || 0; tankWhole.visible = S.tank === 'whole'; tankWhole.scale.set(1 + 0.03 * k * Math.abs(Math.sin(f * 0.25)) + 0.02 * k, 1, 1 + 0.03 * k * Math.abs(Math.sin(f * 0.25)) + 0.02 * k);
  const b = S.burst; halfA.visible = halfB.visible = S.tank === 'burst';
  if (S.tank === 'burst') { const e = b * b; halfA.position.set(-e * 9, 6.5 - e * 4.5, -e * 3); halfA.rotation.set(0, 0, -e * 1.3); halfB.position.set(e * 9, 6.5 - e * 4.5, e * 3); halfB.rotation.set(0, 0, e * 1.3); }
  rivets.forEach((r, i) => { const t = S.rivets; if (t < 0) { r.visible = false; return; } const life = (t - i * 1.8) / 10; r.visible = life > 0; const sp = 6 + (i % 5) * 2; r.position.set(TANKP[0] + Math.sin(i * 2.7) * 3, 5 + Math.cos(i * 1.9) * 1.6 + life * 1.5, TANKP[2] + 7.5 + life * sp * 1.5); });
  const H = S.waveH; waveG.visible = S.wave && H > 0.05;
  if (waveG.visible) { waveG.position.set(S.waveX, 0, TANKP[2] * 0.2);
    wBody.scale.set(30, H * 0.55, 32); wBody.position.set(-15, H * 0.275, 0); wFront.scale.set(H * 0.55, 32, H * 0.55); wFront.position.set(0, H * 0.55, 0); wCrest.scale.set(H * 0.5, 31.8, H * 0.5); wCrest.position.set(-0.2, H * 0.68, 0); wBody.position.y = H * 0.275; }
  const fl = S.flood * (1 - S.clean), len = Math.max(0.01, S.waveX - TANKP[0]); flood.visible = S.wave && fl > 0.02 && !S.plaque; flood.scale.set(len, 0.5 * fl + 0.05, 32); flood.position.set(TANKP[0] + len / 2, 0.15, TANKP[2] * 0.2);
  stain.visible = S.clean > 0.01 && S.clean < 1; stain.scale.set(10, 0.04, 14); stain.position.set(2, 0.03, -2);
  const fa = S.flat; victim.rotation.z = -fa * 1.1; victim.position.y = -fa * 2.2; victim.position.x = 36 + fa * 3; victim.visible = !S.plaque;
  plaque.visible = !!S.plaque; trainG.position.x = S.train; waterU.t.value = f / 30;
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

window.renderFrame = (f) => {
  const S = shotAt(f), L = lightFor(S, f), C = camAt(f);
  applyLight(L, f);
  camera.position.set(...C.pos); camera.up.set(0, 1, 0); camera.lookAt(...C.look); camera.rotateZ(rx(C.roll || 0));
  camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const W_ = worldAt(f); worldState(W_, f);
  placeSun(L, new THREE.Vector3(...(C.shadowAt || C.look)));
  drawActors([...actorsAt(f, T), ...fxAt(f, T)], camera);
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
  const D = dofAt(f);
  inkU.px.value = 2.5; inkU.flash.value = window.DEBUG_E ? -1 : (C.flash || 0); inkU.vig.value = L.vig ?? 0.22;
  renderer.setRenderTarget(rtInk); renderer.render(inkScene, fsCam);
  // lens
  dofU.focus.value = D.focus; dofU.cinf.value = D.cinf; dofU.near.value = D.near ?? 1;
  renderer.setRenderTarget(null); renderer.render(dofScene, fsCam);
  return true;
};
window.TOTAL = TOTAL;
window.ready = true;
