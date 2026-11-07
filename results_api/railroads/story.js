import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, M as MO } from './motion.js';
export const FPS = 30, TOTAL = 1701, DECK = 0;
export const SHOTS = [
  { id: 's1', a: 0, b: 89, light: 'day' },
  { id: 's2', a: 90, b: 218, light: 'day' },
  { id: 's3', a: 219, b: 297, light: 'day' },
  { id: 's4', a: 298, b: 352, light: 'day' },
  { id: 's5', a: 353, b: 484, light: 'day' },
  { id: 's6', a: 485, b: 576, light: 'day' },
  { id: 's7', a: 577, b: 691, light: 'day' },
  { id: 's8', a: 692, b: 823, light: 'day' },
  { id: 's9', a: 824, b: 955, light: 'day' },
  { id: 's10', a: 956, b: 1023, light: 'golden' },
  { id: 's11', a: 1024, b: 1076, light: 'golden' },
  { id: 's12', a: 1077, b: 1138, light: 'golden' },
  { id: 's13', a: 1139, b: 1208, light: 'golden' },
  { id: 's14', a: 1209, b: 1263, light: 'golden' },
  { id: 's15', a: 1264, b: 1357, light: 'golden' },
  { id: 's16', a: 1358, b: 1418, light: 'golden' },
  { id: 's17', a: 1419, b: 1473, light: 'golden' },
  { id: 's18', a: 1474, b: 1548, light: 'golden' },
  { id: 's19', a: 1549, b: 1655, light: 'golden' },
  { id: 's20', a: 1656, b: 1700, light: 'golden' }
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;

export const LIGHTS = {
  day: { az: 130, el: 55, sky: '#bcd6f0', ground: '#b88a58', hemi: 1.15, sun: '#fff3dc', sunI: 2.6, fog: '#e8d9c0', fogNear: 90, fogFar: 700,
    skyTop: '#3f86d8', skyHor: '#d6e6f0', sat: 1.12, waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff', vig: 0.2, shadowExt: 26 },
  golden: { az: 20, el: 12, sky: '#d9a888', ground: '#9a5c3a', hemi: 1.0, sun: '#ffb050', sunI: 3.0, fog: '#f0b480', fogNear: 50, fogFar: 520,
    skyTop: '#7c6ab0', skyHor: '#ffb46a', sunDisc: '#fff0c8', sunSize: 0.004, sat: 1.15, gain: '#fff0dc', waterDeep: '#3d5a86', waterShal: '#d99a6e', glint: '#ffe2a8', vig: 0.28, shadowExt: 26 }
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

const CAMS = {
  s1: [{ f: 0, pos: [0, 0.8, 1.5], look: [0, 0.5, 0], fov: 40 }, { f: 89, pos: [0, 0.7, 1.3], look: [0, 0.5, 0], fov: 38 }],
  s2: [{ f: 90, pos: [115, 12, 20], look: [95, 2, -5], fov: 50 }, { f: 218, pos: [115, 8, 15], look: [95, 2, -5], fov: 50 }],
  s3: [{ f: 219, pos: [200, 6, 18], look: [200, 2, 0], fov: 50 }, { f: 297, pos: [200, 8, 22], look: [200, 2, 0], fov: 50 }],
  s4: [{ f: 298, pos: [105, 1.5, 6], look: [100, 1.2, 0], fov: 40 }, { f: 352, pos: [105, 1.5, 5], look: [100, 1.2, 0], fov: 38 }],
  s5: [{ f: 353, pos: [0, 1.5, 2.5], look: [0, 1.5, 0], fov: 40, ease: 'easeOut' }, { f: 484, pos: [0, 1.5, 1.5], look: [0, 1.5, 0], fov: 38 }],
  s6: [{ f: 485, pos: [0, 1.5, 5], look: [0, 1.2, 0], fov: 40 }, { f: 576, pos: [0, 1.5, 5], look: [0, 1.2, 0], fov: 40 }],
  s7: [{ f: 577, pos: [108, 3, 8], look: [98, 1.5, 0], fov: 40 }, { f: 691, pos: [106, 3, 7], look: [98, 1.5, 0], fov: 38 }],
  s8: [{ f: 692, pos: [280, 10, 20], look: [290, 5, 0], fov: 50 }, { f: 823, pos: [320, 10, 20], look: [310, 5, 0], fov: 50 }],
  s9: [{ f: 824, pos: [200, 1.5, 4.5], look: [200, 1.5, 4], fov: 40 }, { f: 955, pos: [200, 1.5, 5.5], look: [200, 1.5, 4], fov: 40 }],
  s10: [{ f: 956, pos: [110, 1, 10], look: [95, 2, -5], fov: 50 }, { f: 1023, pos: [110, 3, 10], look: [95, 5, -5], fov: 50 }],
  s11: [{ f: 1024, pos: [2.5, 1.5, 2.5], look: [0, 0.1, 0.4], fov: 45 }, { f: 1076, pos: [2.0, 1.2, 2.0], look: [0, 0.1, 0.4], fov: 42 }],
  s12: [{ f: 1077, pos: [1.8, 1.0, 1.8], look: [0, 0.1, 0.4], fov: 45 }, { f: 1138, pos: [1.8, 1.0, 1.8], look: [0, 0.1, 0.4], fov: 45 }],
  s13: [{ f: 1139, pos: [0, 1.0, 1.5], look: [0, 0.5, 0.4], fov: 40 }, { f: 1208, pos: [0, 1.2, 2.0], look: [0, 0.5, 0.4], fov: 40 }],
  s14: [{ f: 1209, pos: [0, 1.5, 5], look: [0, 1.2, 0], fov: 40 }, { f: 1263, pos: [0, 1.5, 5], look: [0, 1.2, 0], fov: 40 }],
  s15: [{ f: 1264, pos: [300, 3, 10], look: [300, 1, -10], fov: 40 }, { f: 1357, pos: [300, 2, 5], look: [300, 1, -10], fov: 40 }],
  s16: [{ f: 1358, pos: [2.5, 1.5, 2.5], look: [0, 0.1, 0.4], fov: 45, ease: 'easeOut' }, { f: 1418, pos: [1.5, 0.8, 1.5], look: [0, 0.1, 0.4], fov: 42 }],
  s17: [{ f: 1419, pos: [102, 1.5, 6], look: [100, 1.5, 0], fov: 40 }, { f: 1473, pos: [102, 1.5, 6], look: [100, 1.5, 0], fov: 40 }],
  s18: [{ f: 1474, pos: [2.0, 1.2, 2.0], look: [0, 0.1, 0.4], fov: 45 }, { f: 1548, pos: [1.5, 0.8, 1.5], look: [0, 0.1, 0.4], fov: 42 }],
  s19: [{ f: 1549, pos: [300, 5, 15], look: [300, 0, 0], fov: 50, ease: 'easeOut' }, { f: 1655, pos: [305, 5, 15], look: [305, 0, 0], fov: 50 }],
  s20: [{ f: 1656, pos: [280, 8, 18], look: [300, 2, 0], fov: 50 }, { f: 1700, pos: [300, 8, 18], look: [300, 2, 0], fov: 50 }]
};

export const camAt = (f) => {
  const S = shotAt(f);
  const c = camFromKeys(CAMS[S.id], f, { creep: 0.001 });
  c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const cinf = ['s1','s4','s5','s6','s7','s9','s11','s12','s13','s14','s15','s16','s17','s18'].includes(S.id) ? 10 : 0;
  return { focus: dist(C.pos, C.look), cinf, near: 1 };
};

export const worldAt = (f) => {
  const S = shotAt(f);
  let gapSize = 0.05;
  if (f >= 1024 && f <= 1076) gapSize = lerp(0.05, 0.02, ramp(f, 1024, 1076));
  else if (f > 1076 && f < 1139) gapSize = 0.02;
  else if (f >= 1139 && f < 1474) gapSize = 0.005;
  else if (f >= 1474) gapSize = lerp(0.005, 0, ramp(f, 1474, 1500));

  let warpAmt = 0;
  if (f >= 1549) warpAmt = lerp(0, 1.5, ramp(f, 1549, 1580));

  let trainX = 0;
  if (S.id === 's8') trainX = lerp(-25, 25, ramp(f, 692, 823));
  if (S.id === 's20') trainX = lerp(-25, 0, ramp(f, 1656, 1700));

  return {
    gapSize,
    warpAmt,
    trainX,
    sawVis: S.id === 's1',
    sawPos: Math.sin(f * 0.5) * 0.05,
    coinVis: S.id === 's12',
    paperVis: S.id === 's13',
    newsVis: S.id === 's9',
    trainStatX: S.id === 's3' ? lerp(-10, 10, ramp(f, 219, 297)) : 0,
    trainVis: S.id === 's8' || S.id === 's20'
  };
};

const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const engOpts = { hatx: null, cap: '#6a6a70', skin: '#f5c9a0', moustache: null, beard: null };
  const bossOpts = { hatx: 'tophat', cap: null, skin: '#5c3a21', beard: '#1a1a1a', moustache: null };
  const rivalOpts = { hatx: 'slouch', cap: null, skin: '#f5c9a0', moustache: '#4a3020' };

  if (S.id === 's1') out.push(R(T, 'worker1', { ...engOpts, expr: 'determined', L: 'spear', R: 'spear', facing: 1, ...idle(f, 1) }, [0, 0, -0.3]));
  if (S.id === 's2') out.push({ key: 'crowd2', draw: (p) => T.crowd(p, { n: 6, mode: 'stand', t: f/30 }), x: 100, y: 0, z: -5, s: 2.0, shadow: false });
  if (S.id === 's3') out.push({ key: 'crowd3', draw: (p) => T.crowd(p, { n: 20, mode: 'stand', t: f/30 }), x: 200, y: 1, z: 3, s: 2.0, shadow: false });
  if (S.id === 's4') out.push(R(T, 'worker1', { ...engOpts, expr: 'proud', L: 'point', facing: 0, ...idle(f, 1) }, [100, 0, 2]));
  if (S.id === 's5') out.push(R(T, 'worker2', { ...bossOpts, expr: 'angry+vein', L: 'hip', facing: -1, ...idle(f, 2) }, [0, 0, -0.5]));
  if (S.id === 's6') {
    out.push(R(T, 'worker2', { ...bossOpts, expr: 'angry', L: 'point', facing: 1, ...idle(f, 2) }, [-1, 0, 0]));
    out.push(R(T, 'worker1', { ...engOpts, expr: 'stubborn', L: 'cross', R: 'cross', facing: -1, ...idle(f, 1) }, [1, 0, 0]));
  }
  if (S.id === 's7') out.push(R(T, 'workA', { ...rivalOpts, expr: 'grin', L: 'point', facing: 1, ...idle(f, 3) }, [100, 0, 1]));
  if (S.id === 's9') out.push({ key: 'crowd9', draw: (p) => T.crowd(p, { n: 15, mode: 'stand', t: f/30 }), x: 200, y: 1, z: 3, s: 2.0, shadow: false });
  if (S.id === 's12') out.push(R(T, 'worker1', { ...engOpts, expr: 'neutral', L: 'point', facing: 1, ...idle(f, 1) }, [0.5, 0, -1]));
  if (S.id === 's13') out.push(R(T, 'worker2', { ...bossOpts, expr: 'laugh', L: 'up', R: 'up', facing: -1, ...idle(f, 2) }, [0.5, 0, -0.5]));
  if (S.id === 's14') {
    out.push(R(T, 'worker2', { ...bossOpts, expr: 'grin', L: 'point', facing: 1, ...idle(f, 2) }, [-1, 0, 0]));
    out.push(R(T, 'worker1', { ...engOpts, expr: 'neutral', L: 'cross', R: 'cross', facing: -1, ...idle(f, 1) }, [1, 0, 0]));
  }
  if (S.id === 's17') out.push(R(T, 'workA', { ...rivalOpts, expr: 'nervous+sweat', L: 'cheek', facing: 0, ...idle(f, 3) }, [100, 0, 2]));

  return out;
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const t = (f % 30) / 30;
  if (S.id === 's1') out.push(FX('sparks', (p) => T.fxSparkle(p, t, '#ffcc00'), [0, 0.2, 0.4], 1.0));
  if (S.id === 's2') out.push(FX('dust', (p) => T.fxDust(p, t), [100, 0, -5], 2.0));
  if (S.id === 's3') out.push(FX('steam', (p) => T.fxSmoke(p, t, '#e0e0e0'), [200, 2, -2], 3.0));
  if (S.id === 's5') out.push(FX('steam', (p) => T.fxSmoke(p, t, '#e0e0e0'), [0, 2, -0.5], 1.5));
  if (S.id === 's7') out.push(FX('flash', (p) => T.fxSparkle(p, t, '#ffffff'), [100, 1, 0], 1.5));
  if (S.id === 's8') {
    const trainX = lerp(-25, 25, ramp(f, 692, 823));
    out.push(FX('steam', (p) => T.fxSmoke(p, t, '#e0e0e0'), [300+trainX, 4, 0], 3.0));
  }
  if (S.id === 's9') out.push(FX('dust', (p) => T.fxDust(p, t), [200, 1, 3], 1.5));
  if (S.id === 's10') out.push(FX('dust', (p) => T.fxDust(p, t), [100, 0, -5], 2.0));
  if (S.id === 's13') out.push(FX('flash', (p) => T.fxSparkle(p, t, '#ffffff'), [0, 1, 0.4], 1.5));
  if (S.id === 's15') out.push(FX('dust', (p) => T.fxDust(p, t), [300, 0, 0], 2.0));
  if (S.id === 's16') out.push(FX('sparks', (p) => T.fxSparkle(p, t, '#ffcc00'), [0, 0.2, 0.4], 1.0));
  if (S.id === 's17') out.push(FX('dust', (p) => T.fxDust(p, t), [100, 0, 2], 1.5));
  if (S.id === 's19') out.push(FX('dust', (p) => T.fxDust(p, t), [300, 0, 0], 3.0));
  if (S.id === 's20') {
    const trainX = lerp(-25, 0, ramp(f, 1656, 1700));
    out.push(FX('smoke', (p) => T.fxSmoke(p, t, '#e0e0e0'), [300+trainX, 4, 0], 3.0));
  }
  return out;
};
export const LOOK = { sat: 1.00, vibr: 0.25, drift: 1, push: 1 };
