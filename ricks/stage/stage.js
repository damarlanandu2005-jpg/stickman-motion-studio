// stage.js - three.js stage for @ricksclips3000-style Shorts (v2).
// Flat 2D puppet characters standing in a real 3D set: the sun casts their
// silhouettes on the ground, the set carries painted textures, GLB models and
// an ink outline, the light follows the story, and the camera glides from shot
// to shot. Driven headless by render.mjs:
//   await setup(spec) -> { frames, shots }      spec = short.json with times resolved
//   renderFrame(i)    -> PNG data URL            one finished frame, captions included
//   probeFrame(i)     -> { image, checks... }    a still plus sanity checks
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const W = 1080, H = 1920;             // output pixels; all camera math is in these units
const LINE = '#271925';               // measured line-art colour
const OUTLINE_PER_HEAD = 10 / 216;    // 10 px stroke on a 216 px (20% width) head
const ARRIVE_GAIN = 0.7;              // camera arrives fast, then settles
const GLIDE_S = 0.8, DISSOLVE_S = 8 / 30;
const CAPTION_Y = 1350, CAPTION_PX = 70;

let FPS = 30, SCALE = 1, S;
let renderer, scene, camera, setRoot, sun, hemi, skyMesh, backdrop, inkPass, backdrops = [];
let out, octx;                        // 2D output canvas (render + captions)
const chars = {}, shots = [], anchors = [];
const texCache = new Map();

// ------------------------------------------------------------ small helpers
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const smoother = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const rad = (d) => d * Math.PI / 180;
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };
const projectUrl = (p) => '/project/' + String(p).split('/').map(encodeURIComponent).join('/');

function loadImage(path) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('cannot load image ' + path)); im.src = projectUrl(path); });
}
async function loadJson(path) { const r = await fetch(projectUrl(path)); if (!r.ok) throw new Error('cannot load ' + path); return r.json(); }
async function texture(path, repeat) {
  const key = path + '|' + JSON.stringify(repeat || 1);
  if (texCache.has(key)) return texCache.get(key);
  const img = await loadImage(path), t = new THREE.Texture(img);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  const r = Array.isArray(repeat) ? repeat : [repeat || 1, repeat || 1]; t.repeat.set(r[0], r[1]); t.needsUpdate = true;
  texCache.set(key, t); return t;
}
async function surface(color, texPath, repeat) {
  const m = new THREE.MeshStandardMaterial({ color: texPath ? '#ffffff' : (color || '#b8794a'), roughness: 0.85, metalness: 0 });
  if (texPath) m.map = await texture(texPath, repeat);
  return m;
}

// ------------------------------------------------------------ camera drift (measured)
function driftTable(n, speedGain = ARRIVE_GAIN) {
  const T = [0]; let acc = 0;
  for (let i = 1; i < n; i++) { const u = (i + 0.5) / n; acc += (1 + speedGain * (1 - smoothstep(0.15, 0.40, u))) / FPS; T.push(acc); }
  return T;
}
function driftAt(shot, tl) {                       // profile time at local seconds tl (extrapolates both ways)
  const T = shot.T, f = tl * FPS, n = T.length;
  let t;
  if (f <= 0) t = f / FPS * (1 + ARRIVE_GAIN);
  else if (f >= n - 1) t = T[n - 1] + (f - (n - 1)) / FPS;
  else { const i = Math.floor(f); t = lerp(T[i], T[i + 1], f - i); }
  return { dx: shot.pan[0] * t, dy: shot.pan[1] * t, scale: Math.exp(Math.log1p(shot.zoom / 100) * t) };
}

// ------------------------------------------------------------ puppets
function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

function placeholderRig(c) {
  // The built-in stand-in figure, drawn as separate layers so it animates like a real rig.
  const tw = 512, th = 1024, headD = 300, lw = Math.max(2, headD * OUTLINE_PER_HEAD);
  const cx = tw / 2, headCy = 30 + lw + headD / 2, hipY = 700, footY = th - lw - 6, neckY = headCy + headD / 2 - 14;
  const layer = (box, pivot, draw) => { const cv = canvasOf(box[2], box[3]), g = cv.getContext('2d'); g.translate(-box[0], -box[1]); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = LINE; g.fillStyle = LINE; draw(g); return { img: cv, box, pivot }; };
  const limb = (x0, y0, x1, y1, foot) => layer([Math.min(x0, x1) - 40, y0 - 20, Math.abs(x1 - x0) + 80, y1 - y0 + 44], [x0, y0], (g) => {
    g.lineWidth = lw * 1.25; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.beginPath(); if (foot) g.ellipse(x1 + Math.sign(x1 - x0) * 12, y1 - 4, 26, 12, 0, 0, Math.PI * 2); else g.arc(x1, y1, lw * 1.3, 0, Math.PI * 2); g.fill();
  });
  const layers = {
    legL: limb(cx - 34, hipY, cx - 58, footY, true), legR: limb(cx + 34, hipY, cx + 58, footY, true),
    armL: limb(cx - 78, 480, cx - 140, 640, false), armR: limb(cx + 78, 480, cx + 150, 600, false),
    body: layer([cx - 110, neckY - 30, 220, hipY - neckY + 70], [cx, hipY], (g) => {
      const tx = cx - 92, ty = neckY - 6, twd = 184, tht = hipY - ty + 20, r = 70;
      g.lineWidth = lw; g.fillStyle = c.shirt || '#e0603a';
      g.beginPath(); g.moveTo(tx + r, ty); g.arcTo(tx + twd, ty, tx + twd, ty + tht, r); g.arcTo(tx + twd, ty + tht, tx, ty + tht, 30);
      g.arcTo(tx, ty + tht, tx, ty, 30); g.arcTo(tx, ty, tx + twd, ty, r); g.closePath(); g.fill(); g.stroke();
    }),
    head: layer([cx - headD / 2 - lw, headCy - headD / 2 - lw, headD + 2 * lw, headD + 2 * lw], [cx, neckY], (g) => {
      g.lineWidth = lw; g.fillStyle = c.head || '#f4f1e8';
      g.beginPath(); g.arc(cx, headCy, headD / 2, 0, Math.PI * 2); g.fill(); g.stroke();
      if (c.hair) { g.fillStyle = c.hair; g.beginPath(); g.arc(cx, headCy, headD / 2, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill(); g.stroke(); }
      g.fillStyle = LINE; g.beginPath(); g.ellipse(cx - 46, headCy + 4, 13, 19, 0, 0, Math.PI * 2); g.ellipse(cx + 46, headCy + 4, 13, 19, 0, 0, Math.PI * 2); g.fill();
      g.lineWidth = lw * 0.8; g.beginPath(); g.moveTo(cx - 34, headCy + 72); g.quadraticCurveTo(cx, headCy + (c.smile ? 96 : 76), cx + 34, headCy + 72); g.stroke();
    }),
  };
  return { size: [tw, th], feetY: footY + 8, head: { center: [cx, headCy], diameter: headD }, skin: c.head || '#f4f1e8', layers,
    order: ['legL', 'legR', 'armL', 'armR', 'body', 'head'], eyes: [{ c: [cx - 46, headCy + 4], r: 19 }, { c: [cx + 46, headCy + 4], r: 19 }], faces: {} };
}

async function loadRig(c) {
  if (!c.puppet) return placeholderRig(c);
  const dir = String(c.puppet).replace(/\/+$/, ''), rig = await loadJson(dir + '/rig.json');
  for (const k of Object.keys(rig.layers || {})) rig.layers[k].img = await loadImage(dir + '/' + rig.layers[k].file);
  rig.faces = rig.faces || {};
  for (const k of Object.keys(rig.faces)) rig.faces[k].img = await loadImage(dir + '/' + rig.faces[k].file);
  if (c.hat) { const h = typeof c.hat === 'string' ? { file: c.hat } : c.hat; rig.hat = { img: await loadImage(h.file), scale: h.scale ?? 1.05, sit: h.sit ?? 0.2, dx: h.dx ?? 0 }; }   // separate hat cutout, drawn over the head
  for (const n of ['armL', 'armR']) { const L = rig.layers[n]; if (!L || !L.img) continue;      // hand tip = the arm pixel farthest from the shoulder
    const cc = document.createElement('canvas'); cc.width = L.img.width; cc.height = L.img.height; const cg = cc.getContext('2d'); cg.drawImage(L.img, 0, 0);
    const d = cg.getImageData(0, 0, cc.width, cc.height).data; let best = -1, tip = [0, 0];
    for (let y = 0; y < cc.height; y += 2) for (let x = 0; x < cc.width; x += 2) if (d[(y * cc.width + x) * 4 + 3] > 120) { const dx = L.box[0] + x - L.pivot[0], dy = L.box[1] + y - L.pivot[1], q = dx * dx + dy * dy; if (q > best) { best = q; tip = [dx, dy]; } }
    L.tip = tip; }
  rig.order = (rig.order || ['legL', 'legR', 'armL', 'armR', 'body', 'head']).filter(k => rig.layers[k]);
  if (!rig.layers.body || !rig.layers.head) throw new Error(dir + ': rig needs at least body and head layers');
  return rig;
}

// Channel = a value that actions move over time. from_i is the value the chain
// had when keyframe i began, so overlapping moves blend instead of popping.
function makeChannel(base, keys) {
  keys = keys.slice().sort((a, b) => a.t - b.t);
  const evalTo = (n, t) => { let v = base; for (let i = 0; i < n; i++) { const k = keys[i]; if (t < k.t) break; v = lerp(k.from, k.v, smoothstep(0, 1, (t - k.t) / Math.max(1e-3, k.ease))); } return v; };
  keys.forEach((k, i) => { k.from = evalTo(i, k.t); });
  return (t) => evalTo(keys.length, t);
}

async function makeCharacter(c, rig, actions) {
  const figH = rig.feetY, upp = (c.height || 1.8) / figH;                       // world units per rig pixel
  const padX = rig.size[0] * 0.95, padTop = rig.size[1] * (rig.hat ? 0.34 : 0.12), padBot = rig.size[1] * 0.04;
  const k = Math.min(1, 900 / rig.size[1]);                                     // canvas pixels per rig pixel
  const cw = (rig.size[0] + 2 * padX) * k, ch = (rig.size[1] + padTop + padBot) * k;
  const cv = canvasOf(cw, ch), g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const pw = (rig.size[0] + 2 * padX) * upp, ph = (rig.size[1] + padTop + padBot) * upp;
  const geo = new THREE.PlaneGeometry(pw, ph);
  geo.translate(0, ph / 2 - (rig.size[1] + padBot - rig.feetY) * upp, 0);      // feet row sits on y = 0
  // alphaTest is switched per pass (see drawScene): three copies it onto the shadow material, so 0.5 gives a clean silhouette shadow
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, alphaTest: 0.02 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.renderOrder = 10;
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  // soft contact shadow that pins the feet to the ground
  const sc = canvasOf(128, 128), sg = sc.getContext('2d'), gr = sg.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(39,25,37,1)'); gr.addColorStop(0.55, 'rgba(39,25,37,0.45)'); gr.addColorStop(1, 'rgba(39,25,37,0)');
  sg.fillStyle = gr; sg.fillRect(0, 0, 128, 128);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, toneMapped: false, opacity: S.contactShadow ?? 0.55 }));
  blob.rotation.x = -Math.PI / 2; blob.renderOrder = 2;
  const bodyW = rig.layers.body.box[2] * upp; blob.scale.set(bodyW * 1.9, bodyW * 0.8, 1);

  // channels
  const pose = {}, keys = { armL: [], armR: [], legL: [], legR: [], head: [], body: [], spin: [] }, faceKeys = [], posKeys = [], flips = [], hops = [], shakes = [], holds = [], heldImgs = {};
  for (const a of actions) {
    const ease = a.ease ?? 0.3;
    for (const ch of Object.keys(a.pose || {})) if (keys[ch]) keys[ch].push({ t: a.t, v: a.pose[ch], ease });
    if (a.face) faceKeys.push({ t: a.t, face: a.face });
    if (a.to) posKeys.push({ t: a.t, to: a.to, over: a.over ?? 1.0, walk: !!a.walk });
    if (a.flip !== undefined) flips.push({ t: a.t, v: !!a.flip });
    if (a.hop) hops.push({ t: a.t, h: a.hop });
    if (a.shake) shakes.push({ t: a.t, d: a.shake });
    if (a.hold !== undefined) holds.push({ t: a.t, h: a.hold });        // {file, hand: 'L'|'R', scale} or null to let go
  }
  for (const ch of Object.keys(keys)) pose[ch] = makeChannel((c.pose && c.pose[ch]) || 0, keys[ch]);
  faceKeys.sort((a, b) => a.t - b.t); posKeys.sort((a, b) => a.t - b.t);
  { let p = (c.pos || [0, 0, 0]).slice(); for (const pk of posKeys) { pk.from = p.slice(); p = pk.to.slice(); } }
  holds.sort((a, b) => a.t - b.t);
  for (const h of holds) if (h.h && !heldImgs[h.h.file]) heldImgs[h.h.file] = await loadImage(h.h.file);
  const seed = hash(c.id), blinkP = 3.1 + 1.3 * seed;

  const state = (t) => {
    let p = (c.pos || [0, 0, 0]).slice(), walking = 0;
    for (const pk of posKeys) { if (t < pk.t) break; const u = clamp((t - pk.t) / pk.over, 0, 1), e = smoothstep(0, 1, u); p = pk.from.map((v, i) => lerp(v, pk.to[i], e)); walking = pk.walk && u < 1 ? Math.sin(Math.PI * u) : 0; }
    let face = c.face || 'default', faceT = -9; for (const f of faceKeys) { if (t < f.t) break; face = f.face; faceT = f.t; }
    let flip = !!c.flip; for (const f of flips) { if (t >= f.t) flip = f.v; }
    let hop = 0; for (const hp of hops) { const u = (t - hp.t) / 0.36; if (u > 0 && u < 1) hop = Math.max(hop, 4 * u * (1 - u) * hp.h); }
    let shake = 0; for (const sh of shakes) { if (t >= sh.t && t < sh.t + sh.d) shake = 1; }
    return { p, walking, face, faceT, flip, hop, shake };
  };

  const draw = (t) => {
    const st = state(t), idle = c.idle === false ? 0 : 1, ph0 = seed * 6.283;
    const breath = Math.sin(6.283 * t / 3.4 + ph0), sy = 1 + 0.012 * breath * idle;
    const walk = st.walking, wph = Math.sin(6.283 * t * 2.2);
    const ang = {
      armL: pose.armL(t) + idle * 1.6 * Math.sin(6.283 * t / 3.4 + ph0 + 0.6) + walk * 14 * wph + st.shake * 3 * Math.sin(t * 55),
      armR: pose.armR(t) - idle * 1.6 * Math.sin(6.283 * t / 3.4 + ph0 + 0.6) - walk * 14 * wph - st.shake * 3 * Math.sin(t * 55 + 1),
      legL: pose.legL(t) - walk * 22 * wph, legR: pose.legR(t) + walk * 22 * wph,
      head: pose.head(t) + idle * 1.2 * Math.sin(6.283 * t / 5.1 + ph0 * 1.7) + st.shake * 1.5 * Math.sin(t * 61),
      body: pose.body(t), spin: pose.spin(t),
    };
    const pop = 1 + 0.07 * (1 - smoothstep(0, 0.14, t - st.faceT));           // a face change lands with a small pop
    const blinkNow = idle && ((t + seed * 7) % blinkP) < 0.12, blink = blinkNow && rig.eyes && st.face === 'default';
    let held = null; for (const h of holds) { if (t < h.t) break; held = h.h; }
    const bp = rig.layers.body.pivot;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    let heldM = null;
    for (const name of rig.order) {
      const L = rig.layers[name], isLeg = name.startsWith('leg');
      g.setTransform(k, 0, 0, k, padX * k, padTop * k);
      if (ang.spin) { g.translate(bp[0], bp[1]); g.rotate(rad(ang.spin)); g.translate(-bp[0], -bp[1]); }   // whole figure turns (swimming, falling)
      if (!isLeg) { g.translate(bp[0], bp[1]); g.rotate(rad(ang.body)); g.translate(-bp[0], -bp[1]); }
      if (name === 'body') { g.translate(bp[0], bp[1]); g.scale(1, sy); g.translate(-bp[0], -bp[1]); g.drawImage(L.img, L.box[0], L.box[1]); continue; }
      const lift = isLeg ? 0 : (L.pivot[1] - bp[1]) * (sy - 1);                 // ride the breathing torso
      g.translate(L.pivot[0], L.pivot[1] + lift); g.rotate(rad(ang[name] || 0));
      if (name === 'head') {
        const F = rig.faces[st.face];
        g.scale(pop, pop);
        if (F) { const fk = rig.head.diameter / F.diameter; g.save(); g.scale(fk, fk); g.drawImage(F.img, -F.pivot[0], -F.pivot[1]);
          if (blinkNow && F.eyes) for (const e of F.eyes) {                      // blink on a face image: lid over each detected eye
            const ex = e.c[0] - F.pivot[0], ey = e.c[1] - F.pivot[1];
            g.fillStyle = F.skin || '#f4f1e8'; g.beginPath(); g.ellipse(ex, ey, e.r * 1.25, e.r * 1.3, 0, 0, 6.283); g.fill();
            g.strokeStyle = LINE; g.lineWidth = Math.max(3, e.r * 0.3); g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - e.r, ey + e.r * 0.15); g.lineTo(ex + e.r, ey + e.r * 0.15); g.stroke(); }
          g.restore(); }
        else {
          g.drawImage(L.img, L.box[0] - L.pivot[0], L.box[1] - L.pivot[1]);
          if (blink) for (const e of rig.eyes) {
            const ex = e.c[0] - L.pivot[0], ey = e.c[1] - L.pivot[1];
            g.fillStyle = rig.skin || '#f4f1e8'; g.beginPath(); g.ellipse(ex, ey, e.r * 1.45, e.r * 1.55, 0, 0, 6.283); g.fill();
            g.strokeStyle = LINE; g.lineWidth = Math.max(2, e.r * 0.55); g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - e.r * 1.1, ey + e.r * 0.2); g.lineTo(ex + e.r * 1.1, ey + e.r * 0.2); g.stroke();
          }
        }
        if (rig.hat) { const d = rig.head.diameter, cx = rig.head.center[0] - L.pivot[0], top = rig.head.center[1] - d / 2 - L.pivot[1], w = d * rig.hat.scale, hh = w * rig.hat.img.height / rig.hat.img.width;
          g.drawImage(rig.hat.img, cx - w / 2 + rig.hat.dx * d, top + rig.hat.sit * d - hh, w, hh); }
      } else { g.drawImage(L.img, L.box[0] - L.pivot[0], L.box[1] - L.pivot[1]);
        if (held && L.tip && name === (held.hand === 'L' ? 'armL' : 'armR')) heldM = { m: g.getTransform(), tip: L.tip, a: (ang[name] || 0) + ang.body + ang.spin }; }
    }
    if (held && heldM) { const im = heldImgs[held.file], w = rig.head.diameter * (held.scale ?? 0.5), hh = w * im.height / im.width;      // on top of the figure, readable way round
      g.setTransform(heldM.m); g.translate(heldM.tip[0], heldM.tip[1]); g.rotate(-rad(heldM.a) + rad(held.rot || 0)); if (st.flip) g.scale(-1, 1); g.drawImage(im, -w / 2, -hh / 2, w, hh); }
    tex.needsUpdate = true;
    const bob = walk * Math.abs(wph) * 0.02 * (c.height || 1.8), jx = st.shake * 0.012 * (c.height || 1.8) * Math.sin(t * 80);
    mesh.position.set(st.p[0] + jx, st.p[1] + st.hop + bob + Math.abs(Math.sin(rad(ang.spin))) * 0.1 * (c.height || 1.8), st.p[2]);   // a figure lying down rests on the floor, not in it
    mesh.scale.x = st.flip ? -1 : 1;
    blob.position.set(st.p[0], st.p[1] + 0.012, st.p[2]);
    blob.material.opacity = (S.contactShadow ?? 0.55) * (1 - clamp(st.hop * 1.5, 0, 0.7));
  };
  const headAt = (t) => { const st = state(t); return new THREE.Vector3(st.p[0] + (rig.head.center[0] - rig.size[0] / 2) * upp * (st.flip ? -1 : 1), st.p[1] + (rig.feetY - rig.head.center[1]) * upp, st.p[2]); };
  return { id: c.id, mesh, blob, draw, headAt, headD: rig.head.diameter * upp };
}

// ------------------------------------------------------------ set pieces
async function makeProp(p) {
  const grp = new THREE.Group(), add = (geo, mat, y = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; grp.add(m); return m; };
  const size3 = (s, d) => Array.isArray(s) ? s : (s ? [s, s, s] : d);
  if (p.type === 'house') {
    const [w, h, d] = size3(p.size, [3, 2.5, 3]);
    const wallM = (await surface(p.color || '#d9c3a0', p.wall, p.repeat || [Math.max(1, w / 2.5), Math.max(1, h / 2.5)])).clone(); if (wallM.emissive && p.wall) { wallM.emissive.set(p.glow || '#ffffff'); wallM.emissiveIntensity = 0.16; wallM.emissiveMap = wallM.map; }   // textured walls: keep dark beams off pure black in shadow
    add(new THREE.BoxGeometry(w, h, d), wallM, h / 2);
    const roof = add(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.6, 4), await surface(p.roof || '#7a2f2f', p.roofTexture, p.roofRepeat || [3, 2]), h + h * 0.3); roof.rotation.y = Math.PI / 4;
    const door = add(new THREE.BoxGeometry(w * 0.22, h * 0.45, 0.05), await surface(p.door || '#3b2a4a'), h * 0.225); door.position.z = d / 2 + 0.03;
    if (p.windows !== false) { const glass = await surface(p.window || '#7f9cc4'), frame = await surface(p.windowFrame || '#f2e9d4');     // two shuttered windows so a house is not a blank box
      for (const sx of [-1, 1]) { const fr = add(new THREE.BoxGeometry(w * 0.2, h * 0.24, 0.05), frame, h * 0.62); fr.position.set(sx * w * 0.3, h * 0.62, d / 2 + 0.03);
        const gl = add(new THREE.BoxGeometry(w * 0.15, h * 0.18, 0.05), glass, h * 0.62); gl.position.set(sx * w * 0.3, h * 0.62, d / 2 + 0.06); } }
  } else if (p.type === 'cone') {                       // hills, peaks, heaps
    const m = add(new THREE.ConeGeometry(p.r || 3, p.h || 4, p.sides || 7), await surface(p.color || '#8a9a7a', p.texture, p.repeat), (p.h || 4) / 2); m.rotation.y = p.turn || 0.4;
  } else if (p.type === 'box' || p.type === 'crate' || p.type === 'wall') {
    const [w, h, d] = size3(p.size, p.type === 'wall' ? [4, 2.5, 0.3] : [0.7, 0.7, 0.7]);
    add(new THREE.BoxGeometry(w, h, d), await surface(p.color || (p.type === 'crate' ? '#a8743c' : '#b8794a'), p.texture, p.repeat), h / 2);
    if (p.type === 'crate' && !p.texture) { const e = await surface('#7c5228'); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const b = add(new THREE.BoxGeometry(w * 0.09, h * 1.02, d * 0.09), e, h / 2); b.position.x = sx * w * 0.47; b.position.z = sz * d * 0.47; } }
  } else if (p.type === 'barrel') {
    const r = p.r || 0.32, h = p.h || 0.85, wood = await surface(p.color || '#9a6534', p.texture, p.repeat), hoop = await surface('#4a3a3f');
    add(new THREE.CylinderGeometry(r * 0.86, r, h * 0.34, 16), wood, h * 0.17); add(new THREE.CylinderGeometry(r, r, h * 0.32, 16), wood, h * 0.5); add(new THREE.CylinderGeometry(r, r * 0.86, h * 0.34, 16), wood, h * 0.83);
    for (const y of [0.3, 0.7]) add(new THREE.CylinderGeometry(r * 1.03, r * 1.03, h * 0.05, 16), hoop, h * y);
  } else if (p.type === 'tree') {
    const s = p.scale || 1;
    add(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 1.2 * s, 10), await surface('#6b4429'), 0.6 * s); add(new THREE.IcosahedronGeometry(0.9 * s, 1), await surface(p.color || '#4f8f4a'), 1.7 * s);
  } else if (p.type === 'post') {
    const h = p.h || 2.6; add(new THREE.CylinderGeometry(0.06, 0.06, h, 8), await surface(p.color || '#5a3a2a'), h / 2);
  } else if (p.type === 'desk') {
    // office desk: top, two drawer pedestals, drawer fronts and handles, leather blotter, papers, lamp, inkwell. p.w = width
    const w = p.w || 3, d = w * 0.42, h = w * 0.27, lift = (m, c) => { m = m.clone(); if (m.emissive) m.emissive.set(c); return m; }, wood = lift(await surface(p.color || '#6b3f2a', p.texture, p.repeat), '#3a2026'), dark = lift(await surface('#3a2230'), '#2a1a28'), brass = await surface('#c9a24a'), paper = await surface('#efe6d0'), green = await surface('#2f5a4a');
    const top = add(new THREE.BoxGeometry(w, h * 0.09, d), wood, h); 
    for (const sx of [-1, 1]) { const ped = add(new THREE.BoxGeometry(w * 0.3, h * 0.96, d * 0.92), wood, h * 0.48); ped.position.x = sx * w * 0.33;
      for (let i = 0; i < 3; i++) { const dr = add(new THREE.BoxGeometry(w * 0.26, h * 0.26, 0.03), dark, h * (0.18 + i * 0.3)); dr.position.set(sx * w * 0.33, h * (0.18 + i * 0.3), d * 0.47);
        const hd = add(new THREE.BoxGeometry(w * 0.07, h * 0.035, 0.05), brass, h * (0.18 + i * 0.3)); hd.position.set(sx * w * 0.33, h * (0.18 + i * 0.3), d * 0.5); } }
    const rp = add(new THREE.BoxGeometry(w * 0.36, h * 0.9, 0.03), wood, h * 0.5); rp.position.z = -d * 0.44;
    const bl = add(new THREE.BoxGeometry(w * 0.34, 0.02, d * 0.5), green, h * 1.05); bl.position.z = d * 0.08;
    const pp = add(new THREE.BoxGeometry(w * 0.16, 0.012, d * 0.3), paper, h * 1.075); pp.position.set(-w * 0.05, h * 0.0 + h * 1.075, d * 0.1); pp.rotation.y = 0.2;
    const lb = add(new THREE.CylinderGeometry(w * 0.03, w * 0.04, h * 0.05, 12), brass, h * 1.07); lb.position.set(w * 0.38, h * 1.07, -d * 0.2);
    const ln = add(new THREE.CylinderGeometry(w * 0.012, w * 0.012, h * 0.45, 8), brass, h * 1.3); ln.position.set(w * 0.38, h * 1.3, -d * 0.2);
    const sh = add(new THREE.CylinderGeometry(w * 0.05, w * 0.085, h * 0.16, 14), green, h * 1.58); sh.position.set(w * 0.38, h * 1.58, -d * 0.2);
    const ik = add(new THREE.CylinderGeometry(w * 0.025, w * 0.03, h * 0.07, 10), dark, h * 1.09); ik.position.set(-w * 0.27, h * 1.09, d * 0.05);
  } else if (p.type === 'eiffel') {
    // procedural lattice tower: p.h = height, p.color = iron colour. Four curved legs, rings, X braces, two platforms, spire.
    const H = p.h || 30, base = H * 0.21, iron = (await surface(p.color || '#5b4a4f')).clone(), th = Math.max(0.05, H * 0.006);
    const half = (y) => base * Math.exp(-3.1 * y / H) * (1 - y / H) + H * 0.008;       // half-width of the square section at height y
    if (iron.emissive) iron.emissive.set(p.glow || '#3a2c40');   // lift shadowed lattice off pure black
    const seg = (a, b, r) => { const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 5), iron);
      m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); grp.add(m); };
    const top = H * 0.9, N = 16, ys = Array.from({ length: N + 1 }, (_, i) => top * Math.pow(i / N, 1.15));
    const corner = (i, sx, sz) => new THREE.Vector3(sx * half(ys[i]), ys[i], sz * half(ys[i]));
    const cs = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
    for (let i = 0; i < N; i++) {
      for (const [sx, sz] of cs) seg(corner(i, sx, sz), corner(i + 1, sx, sz), th * (1.6 - i / N));
      for (let k = 0; k < 4; k++) {                                                    // ring and X braces on each face
        const [ax, az] = cs[k], [bx, bz] = cs[(k + 1) % 4];
        seg(corner(i + 1, ax, az), corner(i + 1, bx, bz), th * 0.7);
        seg(corner(i, ax, az), corner(i + 1, bx, bz), th * 0.45); seg(corner(i, bx, bz), corner(i + 1, ax, az), th * 0.45);
      }
    }
    for (const [yy, s] of [[H * 0.27, 1.25], [H * 0.55, 0.9]]) {                       // platforms
      const w = half(yy) * 2 * s, pm = add(new THREE.BoxGeometry(w, H * 0.018, w), iron, yy); pm.userData.plat = true;
    }
    for (let k = 0; k < 4; k++) {                                                      // arch between two leg bases on each face
      const [ax, az] = cs[k], [bx, bz] = cs[(k + 1) % 4], hw = half(0), ah = H * 0.13; let prev = null;
      for (let i = 0; i <= 10; i++) { const u = i / 10, e = Math.sin(u * Math.PI), f = 1 - e * 0.0;
        const x = ax * hw + (bx - ax) * hw * u, z = az * hw + (bz - az) * hw * u, yy = e * ah * 0.95 + 0.02;
        // pull the arch inwards a little so it reads as a curve between the legs
        const q = new THREE.Vector3(x - (ax + bx) * hw * 0.04 * e, yy, z - (az + bz) * hw * 0.04 * e);
        if (prev) seg(prev, q, th * 1.3); prev = q; }
    }
    seg(new THREE.Vector3(0, top, 0), new THREE.Vector3(0, H, 0), th * 0.6);          // spire
    grp.userData.thin = true;   // dense lattice: skip the ink outline pass, it would turn the tower solid black
  } else if (p.type === 'plane') {
    const [w, h] = p.size || [2, 2], t = await texture(p.image);
    const m = add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, toneMapped: false }), h / 2); m.userData.noInk = true; m.userData.tint = true;
  } else if (p.type === 'model') {
    const gl = await new Promise((res, rej) => gltf.load(projectUrl(p.file), res, undefined, () => rej(new Error('cannot load model ' + p.file))));
    const obj = gl.scene, box = new THREE.Box3().setFromObject(obj), sz = box.getSize(new THREE.Vector3());
    const sc = p.height ? p.height / Math.max(1e-6, sz.y) : (p.scale || 1);
    obj.scale.setScalar(sc); box.setFromObject(obj); const ctr = box.getCenter(new THREE.Vector3());
    obj.position.set(-ctr.x, -box.min.y, -ctr.z);
    if (p.matte !== false) obj.traverse(o => { if (o.isMesh && o.material && 'roughness' in o.material) { o.material.metalness = 0; o.material.roughness = Math.max(0.8, o.material.roughness); } });
    grp.add(obj);
  } else throw new Error('unknown prop type "' + p.type + '"');
  grp.position.set(...(p.pos || [0, 0, 0])); if (p.rotY) grp.rotation.y = rad(p.rotY);
  grp.traverse(o => { if (o.isMesh) { if (!o.userData.noInk) { o.castShadow = true; o.receiveShadow = true; if (!(grp.userData.thin)) o.layers.enable(1); } } });
  grp.userData.prop = p;
  return grp;
}
let gltf;

// ------------------------------------------------------------ lighting moods
const MOOD0 = { sun: { azimuth: 35, elevation: 50, color: '#ffe0b5', intensity: 2.4 }, sky: { top: '#5f86d8', horizon: '#f2b98a' }, fill: { sky: '#8ea2ff', ground: '#6a3b6e', intensity: 1.1 }, exposure: 1 };
function moodParams(m) {
  m = m || {}; const sn = { ...MOOD0.sun, ...(m.sun || {}) }, sk = { ...MOOD0.sky, ...(m.sky || {}) }, fl = { ...MOOD0.fill, ...(m.fill || {}) };
  const P = { az: sn.azimuth, el: sn.elevation, sunI: sn.intensity, fillI: fl.intensity, exposure: m.exposure ?? 1,
    sunC: new THREE.Color(sn.color), top: new THREE.Color(sk.top), hor: new THREE.Color(sk.horizon), fSky: new THREE.Color(fl.sky), fGnd: new THREE.Color(fl.ground) };
  if (m.cutoutTint) P.tint = new THREE.Color(m.cutoutTint);
  else {                                     // flat characters still take the colour of the light they stand in
    const l = P.sunC.clone().multiplyScalar(P.sunI * 0.6).add(P.fSky.clone().multiplyScalar(P.fillI * 0.5)), mx = Math.max(l.r, l.g, l.b, 1e-3);
    l.multiplyScalar(1 / mx); P.tint = new THREE.Color(1, 1, 1).lerp(l, 0.55).multiplyScalar(clamp(0.55 + 0.2 * P.sunI, 0.6, 1));
  }
  return P;
}
function blendMood(a, b, t) {
  const o = {}; for (const k of ['az', 'el', 'sunI', 'fillI', 'exposure']) o[k] = lerp(a[k], b[k], t);
  for (const k of ['sunC', 'top', 'hor', 'fSky', 'fGnd', 'tint']) o[k] = a[k].clone().lerp(b[k], t);
  return o;
}
let lightKeys = [];
function moodAt(t) {
  let cur = lightKeys[0].P;
  for (let i = 1; i < lightKeys.length; i++) { const k = lightKeys[i]; if (t < k.t) break; cur = blendMood(cur, k.P, smoother((t - k.t) / Math.max(1e-3, k.fade))); }
  return cur;
}
function applyMood(P, focus) {
  const el = rad(P.el), az = rad(P.az), dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  sun.color.copy(P.sunC); sun.intensity = P.sunI; sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(dir, 40); sun.target.updateMatrixWorld();
  hemi.color.copy(P.fSky); hemi.groundColor.copy(P.fGnd); hemi.intensity = P.fillI;
  renderer.toneMappingExposure = (S.exposure ?? 1) * P.exposure;
  const pos = skyMesh.geometry.attributes.position, col = skyMesh.geometry.attributes.color, c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { c.copy(P.hor).lerp(P.top, Math.pow(Math.max(0, pos.getY(i) / 400), 0.6)); col.setXYZ(i, c.r, c.g, c.b); }
  col.needsUpdate = true; scene.fog.color.copy(P.hor);
  for (const ch of Object.values(chars)) ch.mesh.material.color.copy(P.tint);
  setRoot.traverse(o => { if (o.userData.tint) o.material.color.copy(P.tint); });
  for (const b of backdrops) b.material.color.copy(P.tint);
}

// ------------------------------------------------------------ ink outline on the 3D set
function makeInk(width, color) {
  const rt = new THREE.WebGLRenderTarget(Math.round(W * SCALE), Math.round(H * SCALE), { depthTexture: new THREE.DepthTexture(), samples: 0 });
  const mat = new THREE.ShaderMaterial({
    uniforms: { tN: { value: rt.texture }, tD: { value: rt.depthTexture }, px: { value: new THREE.Vector2(1 / (W * SCALE), 1 / (H * SCALE)) }, w: { value: width * SCALE }, ink: { value: new THREE.Color(color).convertLinearToSRGB() }, near: { value: 0.1 }, far: { value: 1000 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tN, tD; uniform vec2 px; uniform float w, near, far; uniform vec3 ink; varying vec2 vUv;
      float lin(vec2 uv){ float z = texture2D(tD, uv).r * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
      void main(){
        vec2 o = px * max(1.0, w * 0.5);
        vec3 n0 = texture2D(tN, vUv).rgb; float d0 = lin(vUv), e = 0.0;
        vec2 dirs[4]; dirs[0] = vec2(1.0, 0.0); dirs[1] = vec2(0.0, 1.0); dirs[2] = vec2(0.7071, 0.7071); dirs[3] = vec2(0.7071, -0.7071);
        for (int i = 0; i < 4; i++) {
          vec2 a = vUv + dirs[i] * o, b = vUv - dirs[i] * o;
          e = max(e, smoothstep(0.18, 0.34, max(distance(texture2D(tN, a).rgb, n0), distance(texture2D(tN, b).rgb, n0))));
          e = max(e, smoothstep(0.012, 0.03, abs(lin(a) + lin(b) - 2.0 * d0) / d0));
        }
        e *= 1.0 - smoothstep(45.0, 110.0, d0);
        gl_FragColor = vec4(ink, e);
      }`,
    transparent: true, depthTest: false, depthWrite: false,
  });
  const sc = new THREE.Scene(); const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; sc.add(quad);
  return { rt, mat, scene: sc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), normal: new THREE.MeshNormalMaterial() };
}

// ------------------------------------------------------------ setup
window.setup = async (spec) => {
  S = spec; FPS = spec.fps || 30; SCALE = spec._scale || 1;
  const rw = Math.round(W * SCALE), rh = Math.round(H * SCALE);
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(1); renderer.setSize(rw, rh);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  out = canvasOf(rw, rh); octx = out.getContext('2d'); document.body.appendChild(out);
  gltf = new GLTFLoader(); gltf.setMeshoptDecoder(MeshoptDecoder);
  const draco = new DRACOLoader(); draco.setDecoderPath('./node_modules/three/examples/jsm/libs/draco/gltf/'); gltf.setDRACOLoader(draco);
  if (spec.font) { try { const ff = new FontFace('ShortCaption', `url(${projectUrl(spec.font)})`); await ff.load(); document.fonts.add(ff); } catch { /* fall back to system heavy sans */ } }

  scene = new THREE.Scene(); setRoot = new THREE.Group(); scene.add(setRoot);
  const skyGeo = new THREE.SphereGeometry(400, 32, 16);
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
  skyMesh = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })); skyMesh.renderOrder = -10; setRoot.add(skyMesh);
  scene.fog = new THREE.Fog('#f2b98a', 40, 160);
  sun = new THREE.DirectionalLight('#ffe0b5', 2.4); sun.castShadow = true;
  const sm = spec.shadowMap || (SCALE < 1 ? 2048 : 4096); sun.shadow.mapSize.set(sm, sm); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  const sc = sun.shadow.camera; sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 120;
  scene.add(sun); scene.add(sun.target);
  hemi = new THREE.HemisphereLight('#8ea2ff', '#6a3b6e', 1.1); scene.add(hemi);

  const gr = spec.ground || {};
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(gr.size || 1000, gr.size || 1000), await surface(gr.color || '#c98a55', gr.texture, gr.repeat || [60, 60]));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.layers.enable(1); setRoot.add(ground);
  for (const p of (spec.props || [])) setRoot.add(await makeProp(p));

  backdrops = [];
  for (const b of [].concat(spec.backdrop || []).filter(x => x && x.image)) {   // flat painting(s) far behind the set; several = one per place, picked by camera x ("near": [x0, x1])
    const img = await loadImage(b.image), bw = 2048, bh = Math.round(2048 * img.height / img.width);
    const cv = canvasOf(bw, bh), g = cv.getContext('2d'); g.filter = `blur(${b.blur ?? 5}px)`; g.drawImage(img, 0, 0, bw, bh); g.filter = 'none';
    g.globalCompositeOperation = 'destination-out'; const fade = g.createLinearGradient(0, 0, 0, bh * 0.22); fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fade; g.fillRect(0, 0, bw, bh * 0.22);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.MirroredRepeatWrapping; t.repeat.set(b.repeat || 4, 1);
    const R = b.distance || 170, hgt = b.height || (2 * Math.PI * R / (b.repeat || 4)) * (img.height / img.width);
    backdrop = new THREE.Mesh(new THREE.CylinderGeometry(R, R, hgt, 64, 1, true), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.BackSide, fog: false, toneMapped: false, depthWrite: false }));
    backdrop.userData.y = (b.y ?? -hgt * 0.03) + hgt / 2; backdrop.userData.near = b.near || null; backdrop.renderOrder = -5; setRoot.add(backdrop); backdrops.push(backdrop);
  }

  // characters and their actions (times already absolute)
  const acts = {}; for (const a of (spec._actions || [])) (acts[a.who] = acts[a.who] || []).push(a);
  for (const c of (spec.characters || [])) { const ch = await makeCharacter(c, await loadRig(c), acts[c.id] || []); chars[c.id] = ch; scene.add(ch.mesh); setRoot.add(ch.blob); }

  // lighting keyframes
  const moods = spec.moods || { default: { sun: spec.sun, sky: spec.sky, fill: spec.fill, exposure: 1 } }, first = Object.keys(moods)[0];
  const lk = (spec._lighting && spec._lighting.length) ? spec._lighting : [{ t: 0, mood: first }];
  lightKeys = lk.map(k => { if (!moods[k.mood]) throw new Error('unknown mood "' + k.mood + '"'); return { t: k.t, fade: k.fade ?? 0.8, P: moodParams(moods[k.mood]) }; });

  camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 1000);
  const ink = spec.ink || {}; if ((ink.set ?? 4) > 0) inkPass = makeInk(ink.set ?? 4, ink.color || LINE);

  for (const s of spec._shots) {
    const n = Math.max(2, Math.round(s.dur * FPS)), yaw = rad(s.yaw || 0), pitch = rad(s.pitch ?? 6);
    if (!s.anchor && !chars[s.target]) throw new Error('shot target "' + s.target + '" is not a character id (or give "anchor")');
    shots.push({ start: s.start, dur: s.dur, n, T: driftTable(n), pan: s.pan || [0, 0], zoom: s.zoom ?? 6, fov: s.fov || 40, glide: s.glide || 'lens',
      out: s.out === 'whip' ? 'glide' : (s.out || 'glide'), outDur: s.outDur, target: s.target, anchor: s.anchor ? new THREE.Vector3(...s.anchor) : null,
      yaw0: s.yaw || 0, pitch0: s.pitch ?? 6, orbit: s.orbit || 0, rise: s.rise || 0, headWidth: s.headWidth || 0.20, distance: s.distance, ox: s.frameX ?? 0, oy: s.frameY ?? 0.12,
      dir: new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)) });
  }
  window.totalFrames = spec._frames;
  return { frames: spec._frames, shots: shots.map(s => ({ start: s.start, dur: s.dur })) };
};

// ------------------------------------------------------------ camera
const tmpCam = new THREE.PerspectiveCamera();
function shotPose(k, t) {                                       // camera of shot k at absolute time t
  const s = shots[k], p = driftAt(s, t - s.start), ch = chars[s.target];
  const anchor = s.anchor ? s.anchor.clone() : ch.headAt(t);
  const t0 = Math.tan(rad(s.fov) / 2);
  const d0 = s.distance || (ch ? ch.headD / (s.headWidth * 2 * t0 * (W / H)) : 6);
  let dir = s.dir;
  if (s.orbit || s.rise) { const u = Math.min(1, Math.max(0, (t - s.start) / s.dur)), e = u * u * (3 - 2 * u), tt = (t - s.start);   // orbit deg/s and crane deg/s, eased at both ends
    const ya = rad(s.yaw0 + s.orbit * s.dur * (e - 0.5) * 1 + 0 * tt), pa = rad(s.pitch0 + s.rise * s.dur * (e - 0.5));
    dir = new THREE.Vector3(Math.sin(ya) * Math.cos(pa), Math.sin(pa), Math.cos(ya) * Math.cos(pa)); }
  const fwd = dir.clone().negate(), right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  let fov = s.fov;
  if (s.glide === 'dolly') {
    const d = d0 / p.scale, wpp = 2 * d * t0 / H;
    const look = anchor.clone().addScaledVector(right, -p.dx * wpp - s.ox * W * wpp).addScaledVector(up, p.dy * wpp - s.oy * H * wpp);
    tmpCam.position.copy(look).addScaledVector(dir, d); tmpCam.lookAt(look);
  } else {
    const tz = t0 / p.scale, wpp0 = 2 * d0 * t0 / H; fov = 2 * Math.atan(tz) * 180 / Math.PI;
    const look = anchor.clone().addScaledVector(right, -s.ox * W * wpp0).addScaledVector(up, -s.oy * H * wpp0);
    tmpCam.position.copy(look).addScaledVector(dir, d0); tmpCam.lookAt(look);
    const pxAng = 2 * tz / H; tmpCam.rotateY(Math.atan(p.dx * pxAng)); tmpCam.rotateX(Math.atan(p.dy * pxAng));
  }
  return { pos: tmpCam.position.clone(), quat: tmpCam.quaternion.clone(), fov, anchor };
}
const shotIndex = (t) => { let k = 0; for (let i = 0; i < shots.length; i++) if (t >= shots[i].start - 1e-6) k = i; return k; };
const handover = (k) => {                                      // transition from shot k to k+1
  const a = shots[k], b = shots[k + 1]; if (!b || a.out === 'cut') return null;
  const want = a.outDur ?? (a.out === 'dissolve' ? DISSOLVE_S : GLIDE_S);
  return { kind: a.out, at: b.start, dur: Math.min(want, 0.9 * a.dur, 0.9 * b.dur) };
};
function cameraPlan(t) {                                        // -> one pose, or two poses with a mix
  const k = shotIndex(t), hin = k > 0 ? handover(k - 1) : null, hout = handover(k);
  if (hin && t < hin.at + hin.dur / 2) return { a: shotPose(k - 1, t), b: shotPose(k, t), mix: (t - (hin.at - hin.dur / 2)) / hin.dur, kind: hin.kind };
  if (hout && t > hout.at - hout.dur / 2) return { a: shotPose(k, t), b: shotPose(k + 1, t), mix: (t - (hout.at - hout.dur / 2)) / hout.dur, kind: hout.kind };
  return { a: shotPose(k, t), mix: 0, kind: 'none' };
}
function setCamera(p) { camera.position.copy(p.pos); camera.quaternion.copy(p.quat); camera.fov = p.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(); }

// ------------------------------------------------------------ drawing one frame
function drawScene() {
  for (const ch of Object.values(chars)) ch.mesh.rotation.y = Math.atan2(camera.position.x - ch.mesh.position.x, camera.position.z - ch.mesh.position.z);
  skyMesh.position.copy(camera.position);
  { let act = backdrops.find(b => b.userData.near && camera.position.x >= b.userData.near[0] && camera.position.x <= b.userData.near[1]) || backdrops.find(b => !b.userData.near) || backdrops[0];
    for (const b of backdrops) { b.visible = b === act; if (b.visible) b.position.set(camera.position.x, b.userData.y, camera.position.z); } }
  const cut = Object.values(chars).map(c => c.mesh);
  if (inkPass) {                                               // normals + depth of the set only
    inkPass.mat.uniforms.near.value = camera.near; inkPass.mat.uniforms.far.value = camera.far;
    camera.layers.set(1); scene.overrideMaterial = inkPass.normal; renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(inkPass.rt); renderer.setClearColor(0x8080ff, 1); renderer.clear(); renderer.render(scene, camera);
    renderer.setRenderTarget(null); scene.overrideMaterial = null; camera.layers.set(0);
  }
  // the set, with the characters present only as shadow casters
  cut.forEach(m => { m.material.colorWrite = false; m.material.alphaTest = 0.5; });
  renderer.shadowMap.autoUpdate = true; renderer.shadowMap.needsUpdate = true; renderer.autoClear = true; renderer.render(scene, camera);
  renderer.autoClear = false;
  if (inkPass) renderer.render(inkPass.scene, inkPass.cam);
  // the characters on top, depth-tested against the set, with soft edges
  cut.forEach(m => { m.material.colorWrite = true; m.material.alphaTest = 0.02; }); setRoot.visible = false; renderer.shadowMap.autoUpdate = false;
  renderer.render(scene, camera); setRoot.visible = true; renderer.autoClear = true;
}
function drawCaption(t) {
  const caps = S._captions || []; let text = null;
  for (const c of caps) { if (t >= c.t0 && t < c.t1) { text = c.text; break; } }
  if (!text) return;
  octx.save(); octx.scale(SCALE, SCALE);
  octx.font = `800 ${CAPTION_PX}px ShortCaption, "Montserrat ExtraBold", Montserrat, "Arial Black", "Helvetica Neue", "DejaVu Sans", sans-serif`;
  octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.lineJoin = 'round';
  octx.strokeStyle = LINE; octx.lineWidth = 16; octx.strokeText(text, W / 2, CAPTION_Y);
  octx.fillStyle = '#ffffff'; octx.fillText(text, W / 2, CAPTION_Y);
  octx.restore();
}
function compose(i, withCaption = true) {
  const t = i / FPS, plan = cameraPlan(t);
  for (const ch of Object.values(chars)) ch.draw(t);
  for (const o of setRoot.children) { const pr = o.userData.prop; if (pr && pr.from !== undefined) o.visible = t >= pr.from && t < (pr.to ?? 1e9); }   // props that exist only while their line is spoken
  const mix = smoother(plan.mix), focusOf = (p) => p.anchor;
  if (plan.kind === 'dissolve') {
    applyMood(moodAt(t), focusOf(plan.a)); setCamera(plan.a); drawScene(); octx.globalAlpha = 1; octx.drawImage(renderer.domElement, 0, 0);
    applyMood(moodAt(t), focusOf(plan.b)); setCamera(plan.b); drawScene(); octx.globalAlpha = clamp(plan.mix, 0, 1); octx.drawImage(renderer.domElement, 0, 0); octx.globalAlpha = 1;
  } else {
    const p = plan.kind === 'glide' ? { pos: plan.a.pos.clone().lerp(plan.b.pos, mix), quat: plan.a.quat.clone().slerp(plan.b.quat, mix), fov: lerp(plan.a.fov, plan.b.fov, mix), anchor: plan.a.anchor.clone().lerp(plan.b.anchor, mix) } : plan.a;
    applyMood(moodAt(t), p.anchor); setCamera(p); drawScene(); octx.drawImage(renderer.domElement, 0, 0);
  }
  if (withCaption) drawCaption(t);
  return plan;
}
window.renderFrame = (i) => { compose(i); return out.toDataURL('image/png'); };

// ------------------------------------------------------------ stills + sanity checks
window.probeFrame = (i, quality = 0.9) => {
  const t = i / FPS, plan = compose(i), k = shotIndex(t), s = shots[k], flags = [];
  const cp = camera.position, boxes = [];
  setRoot.children.forEach(o => { if (o.userData.prop && o.userData.prop.type !== 'plane') boxes.push({ p: o.userData.prop, box: new THREE.Box3().setFromObject(o) }); });
  const inside = boxes.filter(b => b.box.clone().expandByScalar(0.12).containsPoint(cp)).map(b => b.p.type + '@' + (b.p.pos || [0, 0, 0]).join(','));
  if (inside.length) flags.push('CAMERA_INSIDE_PROP');
  if (cp.y < 0.05) flags.push('CAMERA_UNDER_GROUND');
  let head = null;
  if (chars[s.target]) {
    const hw = chars[s.target].headAt(t), ndc = hw.clone().project(camera);
    const onScreen = Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z < 1;
    const ray = new THREE.Raycaster(cp.clone(), hw.clone().sub(cp).normalize(), 0.05, cp.distanceTo(hw) - 0.05); ray.layers.set(1);
    const hit = ray.intersectObjects(setRoot.children, true).find(h => h.object !== skyMesh && !backdrops.includes(h.object));
    if (plan.kind === 'none') { if (!onScreen) flags.push('TARGET_OFF_SCREEN'); else if (hit) flags.push('TARGET_HIDDEN_BEHIND_SET'); }
    head = { x: +(ndc.x * 0.5 + 0.5).toFixed(3), y: +(0.5 - ndc.y * 0.5).toFixed(3), onScreen };
  }
  // picture statistics on a small copy
  const sw = 54, sh = 96, sc = canvasOf(sw, sh), sg = sc.getContext('2d', { willReadFrequently: true }); sg.drawImage(out, 0, 0, sw, sh);
  const d = sg.getImageData(0, 0, sw, sh).data, n = sw * sh, bins = new Map(); let sum = 0, sum2 = 0, black = 0;
  for (let j = 0; j < d.length; j += 4) { const l = 0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2]; sum += l; sum2 += l * l; if (d[j] < 10 && d[j + 1] < 10 && d[j + 2] < 10) black++; const key = (d[j] >> 4) << 8 | (d[j + 1] >> 4) << 4 | (d[j + 2] >> 4); bins.set(key, (bins.get(key) || 0) + 1); }
  const mean = sum / n, std = Math.sqrt(Math.max(0, sum2 / n - mean * mean)), dominant = Math.max(...bins.values()) / n;
  if (std < 10 || dominant > 0.85) flags.push('FLAT_FRAME');
  if (mean < 50) flags.push('TOO_DARK'); if (mean > 215) flags.push('TOO_BRIGHT');
  if (black / n > 0.03) flags.push('PURE_BLACK');
  return { frame: i, t: +t.toFixed(3), shot: k, flags, inside, head, luma: +mean.toFixed(1), contrast: +std.toFixed(1), dominant: +dominant.toFixed(2), image: out.toDataURL('image/jpeg', quality) };
};
window.makeSheet = async (cells, cols = 6) => {                 // cells: [{ image, label, bad }]
  const cw = 270, chh = 480, pad = 6, rows = Math.ceil(cells.length / cols);
  const cv = canvasOf(cols * (cw + pad) + pad, rows * (chh + 34 + pad) + pad), g = cv.getContext('2d');
  g.fillStyle = '#1b1820'; g.fillRect(0, 0, cv.width, cv.height); g.font = '600 16px "Helvetica Neue", Arial, sans-serif'; g.textBaseline = 'middle';
  for (let j = 0; j < cells.length; j++) {
    const im = await new Promise((res, rej) => { const x = new Image(); x.onload = () => res(x); x.onerror = rej; x.src = cells[j].image; });
    const x = pad + (j % cols) * (cw + pad), y = pad + Math.floor(j / cols) * (chh + 34 + pad);
    g.drawImage(im, x, y, cw, chh);
    if (cells[j].bad) { g.strokeStyle = '#ff3b3b'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, cw - 6, chh - 6); }
    g.fillStyle = cells[j].bad ? '#ff8080' : '#e8e4ee'; g.fillText(cells[j].label, x + 4, y + chh + 17, cw - 8);
  }
  return cv.toDataURL('image/jpeg', 0.88);
};
window.ready = true;
