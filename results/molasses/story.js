export const FPS = 30, TOTAL = 947, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 67, light: 'golden' },
  { id: 'wave', a: 68, b: 158, light: 'day' },
  { id: 'tank', a: 159, b: 263, light: 'day' },
  { id: 'neighborhood', a: 264, b: 327, light: 'day' },
  { id: 'built', a: 328, b: 404, light: 'day' },
  { id: 'groan', a: 405, b: 501, light: 'golden' },
  { id: 'rivets', a: 502, b: 555, light: 'golden' },
  { id: 'burst', a: 556, b: 587, light: 'day' }, // day with flash handled in camAt
  { id: 'wave2', a: 588, b: 721, light: 'day' },
  { id: 'flatten', a: 722, b: 784, light: 'day' },
  { id: 'clean', a: 785, b: 846, light: 'dawn' },
  { id: 'smell', a: 847, b: 947, light: 'golden' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const ramp = (f, a, b) => clamp((f - a) / (b - a));

// ---------- lights ----------
export const LIGHTS = {
  day: { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 70, fogFar: 900,
    skyTop: '#3f80d4', skyHor: '#c3daf2', sat: 1.1, waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff', vig: 0.2, shadowExt: 40 },
  golden: { az: 30, el: 12, sky: '#9a90c8', ground: '#6a4c40', hemi: 1.0, sun: '#ffb46c', sunI: 2.9, fog: '#f0b88c', fogNear: 60, fogFar: 760,
    skyTop: '#6f6eb0', skyHor: '#ffc27e', sunDisc: '#fff0c8', sunSize: 0.0035, sat: 1.12, gain: '#fff2e2', waterDeep: '#3d5a86', waterShal: '#d99a6e',
    glint: '#ffe2a8', vig: 0.26, shadowExt: 40 },
  dawn: { az: -40, el: 6, sky: '#a690c8', ground: '#605a5a', hemi: 0.9, sun: '#ff9070', sunI: 2.0, fog: '#e0a0b0', fogNear: 40, fogFar: 600,
    skyTop: '#504090', skyHor: '#ff9070', sunDisc: '#ff7050', sunSize: 0.005, sat: 1.0, gain: '#ffe0d0', waterDeep: '#403060', waterShal: '#a06060',
    glint: '#ffc0a0', vig: 0.3, shadowExt: 40 },
};
export const lightFor = (S, f) => {
  return LIGHTS[S.light];
};

// ---------- cameras ----------
const CAMS = {
  hook: [
    { f: 0, pos: [-4, 3, 2], look: [2, 1, 0], fov: 30 },
    { f: 67, pos: [-4, 3, 2.2], look: [2, 1, 0], fov: 30 },
  ],
  wave: [
    { f: 68, pos: [-4, 3, 2], look: [2, 1, 0], fov: 30 },
    { f: 120, pos: [0, 8, 30], look: [0, 4, -10], fov: 44 },
    { f: 158, pos: [0, 8.5, 32], look: [0, 4, -10], fov: 44 },
  ],
  tank: [
    { f: 159, pos: [-15, 2, -10], look: [-15, 12, -25], fov: 46 },
    { f: 263, pos: [-15, 2.5, -8], look: [-15, 18, -25], fov: 46 },
  ],
  neighborhood: [
    { f: 264, pos: [25, 45, 10], look: [-15, 0, -25], fov: 50 },
    { f: 327, pos: [15, 45, -15], look: [-15, 0, -25], fov: 50 },
  ],
  built: [
    { f: 328, pos: [-15, 8, -5], look: [-15, 8, -25], fov: 40 },
    { f: 404, pos: [-15, 8.2, -4], look: [-15, 8, -25], fov: 40 },
  ],
  groan: [
    { f: 405, pos: [-15, 1, -12], look: [-15, 5, -25], fov: 36 },
    { f: 501, pos: [-15, 1, -11], look: [-15, 5, -25], fov: 36 },
  ],
  rivets: [
    { f: 502, pos: [-15, 7, -13.5], look: [-15, 7, -25], fov: 28 },
    { f: 555, pos: [-15, 7, -13.5], look: [-15, 7, -25], fov: 28 },
  ],
  burst: [
    { f: 556, pos: [-15, 7, -13.5], look: [-15, 7, -25], fov: 28 },
    { f: 566, pos: [5, 12, 15], look: [-15, 5, -25], fov: 54 },
    { f: 587, pos: [6, 12, 16], look: [-15, 5, -25], fov: 54 },
  ],
  wave2: [
    { f: 588, pos: [0, 2, 20], look: [0, 4, -20], fov: 40 },
    { f: 721, pos: [0, 2, 60], look: [0, 4, -20], fov: 40 },
  ],
  flatten: [
    { f: 722, pos: [40, 10, 0], look: [0, 5, 0], fov: 48 },
    { f: 784, pos: [40, 10, -2], look: [0, 5, 0], fov: 48 },
  ],
  clean: [
    { f: 785, pos: [0, 5, 20], look: [0, 1, 0], fov: 40 },
    { f: 846, pos: [0, 8, 30], look: [0, 1, -10], fov: 48 },
  ],
  smell: [
    { f: 847, pos: [-15, 2, -15], look: [-15, 2.5, -20], fov: 46 },
    { f: 920, pos: [-15, 2, -18.5], look: [-15, 2.5, -20], fov: 30 },
    { f: 947, pos: [-15, 2, -18.6], look: [-15, 2.5, -20], fov: 30 },
  ],
};
const KICKS = [
  { f: 236, a: 0.05 }, // snap zoom in neighborhood or tank
  { f: 470, a: 0.03 }, // groan shake
  { f: 504, a: 0.05 }, { f: 520, a: 0.05 }, { f: 540, a: 0.05 }, // pops
  { f: 556, a: 0.1 }, // burst boom
  { f: 730, a: 0.06 }, { f: 750, a: 0.06 }, // crashes
];
export const camAt = (f) => {
  const S = shotAt(f), K = CAMS[S.id];
  let c;
  if (f <= K[0].f) c = { ...K[0] };
  else if (f >= K[K.length - 1].f) c = { ...K[K.length - 1] };
  else for (let i = 0; i < K.length - 1; i++) if (f >= K[i].f && f <= K[i + 1].f) {
    const t = smooth((f - K[i].f) / (K[i + 1].f - K[i].f)), a = K[i], b = K[i + 1];
    c = { pos: lerp3(a.pos, b.pos, t), look: lerp3(a.look, b.look, t), fov: lerp(a.fov, b.fov, t), roll: lerp(a.roll || 0, b.roll || 0, t) };
  }
  for (const k of KICKS) { const d = f - k.f; if (d >= 0 && d < 7) { const s = (d % 2 ? -1 : 1) * k.a * (1 - d / 7); c.look = [c.look[0], c.look[1] + s * 10, c.look[2] + s * 5]; c.roll = (c.roll || 0) + s * 20; } }
  
  // flash on burst
  c.flash = f >= 556 && f < 559 ? (1 - (f - 556) / 3) * 1.0 : 0;
  
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'hook': return { focus: dist(C.pos, [2,1,0]), cinf: 12 };
    case 'tank': return { focus: dist(C.pos, [-15,0,-15]), cinf: 4 };
    case 'rivets': return { focus: 4, cinf: 12 };
    case 'burst': return { focus: 10, cinf: 0 };
    case 'smell': return { focus: dist(C.pos, [-15,2,-20]), cinf: 8 };
  }
  return { focus: 20, cinf: 0 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  if (!window.WORLD_ELEMS) return {};
  const { tankG, waveC, trackG, scaffoldG, parkG, tankMesh } = window.WORLD_ELEMS;
  
  tankG.visible = S.id !== 'hook' && S.id !== 'wave' && S.id !== 'clean' && S.id !== 'smell';
  parkG.visible = S.id === 'smell';
  scaffoldG.visible = S.id === 'built';
  
  if (S.id === 'groan') {
    const bulge = Math.sin(f * 0.5) * 0.2;
    tankMesh.scale.set(1 + bulge, 1, 1 + bulge);
  } else {
    tankMesh.scale.set(1, 1, 1);
  }
  
  if (f >= 556 && f < 784) { // burst and wave
    waveC.visible = true;
    let wZ = lerp(-25, 40, (f - 556) / 200);
    waveC.position.set(0, 0, wZ);
    // tank tear open
    tankMesh.scale.set(1.5, 1, 1.5);
    tankMesh.position.y = -5; // broken
  } else {
    waveC.visible = false;
  }
  
  if (f >= 722 && f < 785) { // flatten track
    let twist = clamp((f - 722) / 30);
    trackG.rotation.x = twist * 0.2;
    trackG.position.y = 10 - twist * 3;
  } else {
    trackG.rotation.x = 0;
    trackG.position.y = 10;
  }
  
  return {};
};

// ---------- actors (2D cards) ----------
const blinkAt = (f, seed) => { const per = 38 + (seed * 17) % 31, ph = (f + seed * 13) % per; return ph < 2 ? 0.5 : ph < 4 ? 1 : 0; };
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const q = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = '#ffffff';
  
  switch (S.id) {
    case 'wave':
      out.push(R(T, 'workA', { seed: 1, expr: 'neutral', step: q((f%20)/20), facing: 1 }, [-5 + f*0.05, 0, 5], { tint }));
      out.push(R(T, 'kidA', { seed: 2, expr: 'neutral', step: q(((f+10)%20)/20), facing: -1 }, [10 - f*0.06, 0, 8], { tint }));
      break;
    case 'tank':
      out.push(R(T, 'workA', { seed: 3, expr: 'neutral', L: 'hip', R: 'point' }, [-12, 0, -12], { tint }));
      out.push(R(T, 'workB', { seed: 4, expr: 'neutral', L: 'belly', R: 'hang' }, [-10, 0, -11], { tint }));
      break;
    case 'neighborhood':
      out.push(R(T, 'horse', { step: q((f%20)/20), facing: 1 }, [-20 + f*0.1, 0, 15], { tint }));
      break;
    case 'built':
      const hammer = f % 10 < 5 ? 'up' : 'hang';
      out.push(R(T, 'workA', { seed: 5, R: hammer, expr: 'stern' }, [-20, 6, -15], { tint }));
      out.push(R(T, 'workB', { seed: 6, R: 'wave', expr: 'smile' }, [-10, 9, -14], { tint }));
      break;
    case 'groan':
      out.push(R(T, 'kidA', { seed: 7, expr: f > 430 ? 'shock' : 'smile', L: f > 430 ? 'cheek' : 'hang' }, [-18, 0, -14], { tint }));
      out.push(R(T, 'kidB', { seed: 8, expr: f > 430 ? 'shock' : 'smile', R: f > 430 ? 'cheek' : 'hang' }, [-15, 0, -15], { tint }));
      break;
    case 'burst':
      out.push(R(T, 'workA', { seed: 9, expr: 'shock', L: 'up', R: 'up', step: q((f%10)/10), facing: 1 }, [-5 + (f-556)*0.2, 0, -10], { tint }));
      break;
    case 'wave2':
      out.push(R(T, 'horse', { scared: true, step: q((f%10)/10), facing: 1 }, [2, 0, -10 + (f-588)*0.25], { tint }));
      out.push(R(T, 'workB', { seed: 10, expr: 'shock', step: q((f%10)/10), facing: 1 }, [-4, 0, -5 + (f-588)*0.2], { tint }));
      break;
    case 'flatten':
      const lift = clamp((f - 722) / 30);
      out.push(R(T, 'fireman', { seed: 11, expr: 'shock', L: 'up', R: 'up' }, [0, lift * 5, 0], { tint }));
      break;
    case 'clean':
      const scrub = f % 16 < 8 ? 'reach' : 'hang';
      out.push(R(T, 'workA', { seed: 12, expr: 'pained', L: scrub, R: 'hip', bob: scrub=='reach'?0.05:0 }, [-5, 0, 10], { tint }));
      out.push(R(T, 'workB', { seed: 13, expr: 'pained', L: scrub, bob: scrub=='reach'?0.05:0 }, [5, 0, 12], { tint }));
      break;
    case 'smell':
      out.push(R(T, 'man', { seed: 14, expr: f > 900 ? 'shock' : 'neutral', headTilt: f > 890 ? -0.1 : 0 }, [-15, 0, -20], { tint }));
      break;
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  
  if (S.id === 'hook') {
    out.push(FX('drip', (p) => T.fxDrip(p), [2, 1.5 - (f * 0.05) % 1, 0], 0.5));
  }
  if (S.id === 'wave' && f > 120 && f < 150) { // text 21
    out.push(FX('text', (p) => {
      p.g.font = "bold 200px sans-serif";
      p.g.fillStyle = "#fff";
      p.g.fillText("21", 200, 300);
      p.g.lineWidth = 10; p.g.strokeStyle = "#000"; p.g.strokeText("21", 200, 300);
    }, [0, 20, 0], 3.0));
  }
  if (S.id === 'tank') { // steam
    const t = (f % 60) / 60;
    out.push(FX('steam', (p) => T.fxPuff(p, t), [-15, 16 + t * 5, -25], 2.0));
  }
  if (S.id === 'built') { // sparks
    if (f % 20 < 5) out.push(FX('spark', (p) => T.fxSplash(p, (f%20)/5), [-20, 6, -15], 0.5));
  }
  if (S.id === 'rivets') { // flying rivets
    for (let i = 0; i < 5; i++) {
      const fr = f - 502 - i * 10;
      if (fr > 0 && fr < 20) {
        out.push(FX('rivet'+i, (p) => { p.ell(300, 300, 40, 40, '#444', 0); }, [-15, 7 + (i%2), -15 + fr*0.5], 0.2));
        out.push(FX('spray'+i, (p) => T.fxSplash(p, fr/20), [-15, 7 + (i%2), -15], 0.4, { tint: '#5c3214' }));
      }
    }
  }
  if (S.id === 'smell' && f > 900) { // heart smell
    const t = clamp((f - 900) / 40);
    out.push(FX('heart', (p) => {
      p.g.font = "bold 200px sans-serif";
      p.g.fillStyle = "#ff66aa"; p.g.fillText("♥", 200, 300);
    }, [-15, 3 + t * 2, -20], 1.0 + t));
  }
  
  return out;
};
