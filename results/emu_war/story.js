export const FPS = 30, TOTAL = 597, DECK = 0;

// SHOTS
// 1: 0-35
// 2: 35-106
// 3: 106-168
// 4: 168-243
// 5: 243-322
// 6: 322-358
// 7: 358-391
// 8: 391-449
// 9: 449-475
// 10: 475-531
// 11: 531-597
export const SHOTS = [
  { id: 'hook', a: 0, b: 34, light: 'golden' },
  { id: 'war', a: 35, b: 105, light: 'day' },
  { id: 'wheat', a: 106, b: 167, light: 'day' },
  { id: 'guns', a: 168, b: 242, light: 'day' },
  { id: 'split', a: 243, b: 321, light: 'day' },
  { id: 'truck', a: 322, b: 357, light: 'day' },
  { id: 'miss', a: 358, b: 390, light: 'day' },
  { id: 'month', a: 391, b: 448, light: 'dawn' },
  { id: 'birds', a: 449, b: 474, light: 'golden' },
  { id: 'today', a: 475, b: 530, light: 'day' },
  { id: 'score', a: 531, b: 597, light: 'golden' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const ramp = (f, a, b) => clamp((f - a) / (b - a));

export const LIGHTS = {
  day: { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 70, fogFar: 900,
    skyTop: '#3f80d4', skyHor: '#c3daf2', sat: 1.1, waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff', vig: 0.2, shadowExt: 30 },
  golden: { az: -10, el: 8, sky: '#9a90c8', ground: '#6a4c40', hemi: 1.0, sun: '#ffb46c', sunI: 2.9, fog: '#f0b88c', fogNear: 60, fogFar: 760,
    skyTop: '#6f6eb0', skyHor: '#ffc27e', sunDisc: '#fff0c8', sunSize: 0.0035, sat: 1.12, gain: '#fff2e2', waterDeep: '#3d5a86', waterShal: '#d99a6e',
    glint: '#ffe2a8', vig: 0.26, shadowExt: 30 },
  dawn: { az: 160, el: 4, sky: '#8b8496', ground: '#5a5462', hemi: 0.8, sun: '#ffa08c', sunI: 1.5, fog: '#c8a8aa', fogNear: 40, fogFar: 600,
    skyTop: '#6b6678', skyHor: '#d8b8ba', sat: 0.9, gain: '#e0d8e2', waterDeep: '#4c4c5a', waterShal: '#8c7a84', glint: '#ffc8c8', vig: 0.3, shadowExt: 30 },
};
export const lightFor = (S, f) => LIGHTS[S.light];

const SOL = [0, 0, 0];
const CAMS = {
  hook: [
    { f: 0, pos: [-2, 1, 4], look: [0, 1.5, 0], fov: 38 },
    { f: 34, pos: [-2.5, 3.5, 4.5], look: [0, 6, 0], fov: 34 },
  ],
  war: [
    { f: 35, pos: [0, 6, 25], look: [0, 3, 0], fov: 34 },
    { f: 90, pos: [0, 8, 35], look: [0, 3, 0], fov: 46 },
    { f: 105, pos: [-10, 4, -4], look: [-12, 3.5, -8], fov: 20 }, // snap-zoom on "lost" (f=101) - wait, snap zoom should happen at 101, but we can just end it at 105
  ],
  wheat: [
    { f: 106, pos: [20, 18, 40], look: [0, 0, -20], fov: 48 },
    { f: 167, pos: [15, 14, 30], look: [0, 0, -20], fov: 44 },
  ],
  guns: [
    { f: 168, pos: [-15, 2, 8], look: [-5, 3, 0], fov: 40 },
    { f: 242, pos: [5, 2, 8], look: [15, 3, 0], fov: 40 },
  ],
  split: [
    { f: 243, pos: [0, 50, 0], look: [0, 0, -5], fov: 50 },
    { f: 321, pos: [0, 50, 0], look: [0, 0, -5], fov: 50 },
  ],
  truck: [
    { f: 322, pos: [15, 4, 15], look: [15, 3, 0], fov: 36 },
    { f: 357, pos: [30, 4, 15], look: [30, 3, 0], fov: 36 },
  ],
  miss: [
    { f: 358, pos: [0, 4, 25], look: [0, 2, -10], fov: 44 },
    { f: 390, pos: [0, 4, 25], look: [0, 2, -10], fov: 44 },
  ],
  month: [
    { f: 391, pos: [0, 4, -5], look: [0, 3, -30], fov: 40 },
    { f: 448, pos: [0, 6, 5], look: [0, 3, -30], fov: 48 },
  ],
  birds: [
    { f: 449, pos: [-4, 2, -5], look: [-6, 3, -8], fov: 36 },
    { f: 474, pos: [-4.5, 2, -5.5], look: [-6, 3, -8], fov: 32 },
  ],
  today: [
    { f: 475, pos: [0, 4, 25], look: [0, 2, -10], fov: 44 },
    { f: 530, pos: [0, 4, 25], look: [0, 2, -10], fov: 44 },
  ],
  score: [
    { f: 531, pos: [-3, 4, 2], look: [-5, 4, -10], fov: 46 },
    { f: 597, pos: [-4, 4, -1], look: [-5, 4, -10], fov: 36 },
  ],
};

const KICKS = [{ f: 365, a: 0.05 }, { f: 375, a: 0.05 }, { f: 385, a: 0.05 }]; // gun shots
export const camAt = (f) => {
  const S = shotAt(f), K = CAMS[S.id];
  let c;
  if (f <= K[0].f) c = { ...K[0] };
  else if (f >= K[K.length - 1].f) c = { ...K[K.length - 1] };
  else for (let i = 0; i < K.length - 1; i++) if (f >= K[i].f && f <= K[i + 1].f) {
    const t = smooth((f - K[i].f) / (K[i + 1].f - K[i].f)), a = K[i], b = K[i + 1];
    c = { pos: lerp3(a.pos, b.pos, t), look: lerp3(a.look, b.look, t), fov: lerp(a.fov, b.fov, t), roll: lerp(a.roll || 0, b.roll || 0, t) };
  }
  
  if (S.id === 'war' && f >= 101) { // hard snap zoom
     c = { pos: [-10, 4, -4], look: [-12, 3.5, -8], fov: 20, roll: 0 };
  }
  if (S.id === 'truck') {
     c.pos[0] = 15 + (f - 322)*0.8; c.look[0] = c.pos[0];
     c.pos[1] += Math.sin(f*1.5)*0.2; c.look[1] += Math.sin(f*1.5)*0.2; // bouncing
  }
  
  for (const k of KICKS) { const d = f - k.f; if (d >= 0 && d < 7) { const s = (d % 2 ? -1 : 1) * k.a * (1 - d / 7); c.look = [c.look[0], c.look[1] + s * 3, c.look[2] + s * 2]; c.roll = (c.roll || 0) + s * 20; } }
  
  c.flash = 0;
  return c;
};

export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  if (S.id === 'hook') return { focus: 4, cinf: 12 };
  if (S.id === 'birds') return { focus: 4, cinf: 8 };
  if (S.id === 'score') return { focus: 10, cinf: 6 };
  return { focus: 20, cinf: 0 };
};

export const worldAt = (f) => { return {}; };

const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const E = (T, o, pos, extra = {}) => ({ key: 'emu' + JSON.stringify(o), draw: (p) => T.emuFront(p, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const q = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = S.light === 'golden' ? '#ffe2c8' : '#ffffff';
  
  if (S.id === 'hook') {
    out.push(R(T, 'soldier', { seed: 1, expr: 'neutral', step: q((f%20)/20) }, [0, 0, 0], { tint }));
  }
  if (S.id === 'war') {
    for (let i=0; i<6; i++) out.push(R(T, 'soldier', { seed: i, expr: 'neutral', R: 'rifle' }, [-8 + i*3.2, 0, 0], { tint, facing: 1 }));
    for (let i=0; i<5; i++) out.push(E(T, { look: (f>=101 && i===4) ? 0.8 : 0 }, [-12 + i*3.5, 0, -8], { tint, facing: (f>=101 && i===4) ? -1 : -1 })); // emu facing soldiers
    // truck box
    out.push({ key: 'truck', draw: (p) => { p.g.fillStyle='#445'; p.g.fillRect(100,500,800,400); }, x: 10, y: 0, z: 2, order: 3 });
  }
  if (S.id === 'wheat' || S.id === 'today') {
    if (S.id === 'wheat') out.push(R(T, 'farmer', { seed: 8, expr: 'nervous', L: 'temple' }, [-10, 0, -10], { tint }));
    for (let i=0; i<30; i++) out.push(E(T, { headTilt: q(Math.sin(f*0.2 + i)*0.5), toyHat: (S.id === 'today' && i===15) }, [-30 + (i%10)*6, 0, -10 - Math.floor(i/10)*6], { tint, facing: i%2?1:-1 }));
  }
  if (S.id === 'guns') {
    const tx = -10 + (f-168)*0.3;
    for (let i=0; i<3; i++) out.push(R(T, 'soldier', { seed: i, expr: 'grin', R: i===0?'rifle':'hang' }, [tx + i*2, 0, 0], { tint }));
  }
  if (S.id === 'split') {
    for (let i=0; i<3; i++) out.push(R(T, 'soldier', { seed: i, expr: 'nervous', look: q(Math.sin(f*0.3)*0.5) }, [0 + i*2, 0, 0], { tint }));
    for (let i=0; i<18; i++) {
       const a = (i%6)*Math.PI/3, d = (f-243)*0.4;
       out.push(E(T, { step: q((f%10)/10) }, [Math.cos(a)*d + (i%3)*2, 0, Math.sin(a)*d], { tint, facing: Math.cos(a)>0?1:-1 }));
    }
  }
  if (S.id === 'truck') {
    const tx = 15 + (f - 322)*0.8;
    out.push(E(T, { step: q((f%8)/8), look: 0.8 }, [tx + 12, 0, 0], { tint, facing: 1 })); // running ahead, looking back
    out.push(R(T, 'soldier', { seed: 1, expr: 'shock', L: 'temple' }, [tx, 2, 0], { tint })); // in truck, holding hat
  }
  if (S.id === 'miss') {
    out.push(R(T, 'soldier', { seed: 1, expr: 'stern', R: 'rifle', bob: q(Math.sin(f*2)*0.05) }, [-5, 0, 0], { tint }));
    out.push(E(T, { step: q((f%10)/10), hop: f>370?Math.max(0, Math.sin((f-370)*0.2)*0.5):0 }, [10, 0, -20], { tint, facing: 1 }));
  }
  if (S.id === 'month') {
    out.push(R(T, 'soldier', { seed: 1, expr: 'nervous', headTilt: 0.5 }, [0, 2, -15 - (f-391)*0.2], { tint }));
  }
  if (S.id === 'birds') {
    out.push(E(T, { look: -0.5 }, [-6, 0, -8], { tint, facing: 1 }));
    for (let i=0; i<5; i++) out.push(E(T, { headTilt: 0.5 }, [0+i*4, 0, -12], { tint }));
  }
  if (S.id === 'score') {
    out.push(E(T, { look: -0.5 }, [-5, 0, -8], { tint, facing: 1 }));
  }
  
  return out;
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'hook' && f%10 < 2) out.push({ key: 'puff', draw: (p) => T.fxDust(p, (f%10)/10), x: 0, y: 0, z: 0, s: 0.5 });
  if (S.id === 'score' && f>570) {
     for (let i=0; i<10; i++) out.push({ key: 'confetti'+i, draw: (p) => { p.g.fillStyle=['#f00','#0f0','#00f'][i%3]; p.g.fillRect(300,500,20,20); }, x: -5+(i%5)*2, y: 5 - ((f-570)*0.1+i)%5, z: -5, s: 0.2 });
  }
  // Score text
  if (S.id === 'score') {
     out.push({ key: 'scoretext', draw: (p) => { p.g.fillStyle='#fff'; p.g.font='bold 60px Arial'; p.g.fillText('BIRDS 1 - ARMY 0', 100, 300); }, x: -5, y: 4, z: -9.5, s: 1, order: 4 });
  }
  return out;
};
