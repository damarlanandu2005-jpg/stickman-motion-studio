import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, M as MO } from './motion.js';
export const FPS = 30, TOTAL = 1701, DECK = 0;
export const SHOTS = [
  { id: 's1', a: 0, b: 89, light: 'day' },
  { id: 's2', a: 90, b: 218, light: 'day' },
  { id: 's3', a: 219, b: 297, light: 'day' },
  { id: 's4', a: 298, b: 352, light: 'indoor' },
  { id: 's5', a: 353, b: 484, light: 'day' },
  { id: 's6', a: 485, b: 524, light: 'day' },
  { id: 's7', a: 525, b: 576, light: 'day' },
  { id: 's8', a: 577, b: 691, light: 'day' },
  { id: 's9', a: 692, b: 747, light: 'day' },
  { id: 's10', a: 748, b: 823, light: 'day' },
  { id: 's11', a: 824, b: 896, light: 'day' },
  { id: 's12', a: 897, b: 955, light: 'day' },
  { id: 's13', a: 956, b: 1023, light: 'golden' },
  { id: 's14', a: 1024, b: 1076, light: 'golden' },
  { id: 's15', a: 1077, b: 1138, light: 'golden' },
  { id: 's16', a: 1139, b: 1208, light: 'golden' },
  { id: 's17', a: 1209, b: 1263, light: 'golden' },
  { id: 's18', a: 1264, b: 1357, light: 'golden' },
  { id: 's19', a: 1358, b: 1418, light: 'golden' },
  { id: 's20', a: 1419, b: 1473, light: 'day' },
  { id: 's21', a: 1474, b: 1548, light: 'day' },
  { id: 's22', a: 1549, b: 1655, light: 'day' },
  { id: 's23', a: 1656, b: 1700, light: 'day' }
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;

export const LIGHTS = {
  day: { az: 130, el: 55, sky: '#bcd6f0', ground: '#b88a58', hemi: 1.15, sun: '#fff3dc', sunI: 2.6, fog: '#e8d9c0', fogNear: 90, fogFar: 700,
    skyTop: '#3f86d8', skyHor: '#d6e6f0', sat: 1.12, waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff', vig: 0.2, shadowExt: 26 },
  golden: { az: 20, el: 12, sky: '#d9a888', ground: '#9a5c3a', hemi: 1.0, sun: '#ffb050', sunI: 3.0, fog: '#f0b480', fogNear: 50, fogFar: 520,
    skyTop: '#7c6ab0', skyHor: '#ffb46a', sunDisc: '#fff0c8', sunSize: 0.004, sat: 1.15, gain: '#fff0dc', waterDeep: '#3d5a86', waterShal: '#d99a6e', glint: '#ffe2a8', vig: 0.28, shadowExt: 26 },
  indoor: { az: 180, el: 30, sky: '#8899aa', ground: '#665544', hemi: 0.8, sun: '#ffddaa', sunI: 1.5, fog: '#887766', fogNear: 20, fogFar: 100,
    skyTop: '#556677', skyHor: '#8899aa', sat: 1.0, vig: 0.4, shadowExt: 15 }
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

const CAMS = {
  s1: [{ f: 0, pos: [1.8,1.1,4.2], look: [0,0.95,-0.4], fov: 42 }, { f: 89, pos: [0.9,1.0,3.0], look: [0,1.05,-0.3], fov: 40 }],
  s2: [{ f: 90, pos: [0, 10, 12], look: [0, 0, -10], fov: 54 }, { f: 218, pos: [0, 12, 15], look: [0, 0, -10], fov: 54 }],
  s3: [{ f: 219, pos: [0, 12, 15], look: [0, 0, -10], fov: 54 }, { f: 297, pos: [0, 12, 15], look: [0, 0, -10], fov: 54 }],
  s4: [{ f: 298, pos: [0, 1.5, 2], look: [0, 1.5, -1.2], fov: 45 }, { f: 352, pos: [0, 1.5, 1], look: [0, 1.5, -1.2], fov: 45 }],
  s5: [{ f: 353, pos: [0,2.0,5.6], look: [0,1.9,-1], fov: 42 }, { f: 360, pos: [0,2.0,3.9], look: [0,1.95,-1], fov: 40, ease: 'easeIn' }, { f: 484, pos: [0,2.0,3.5], look: [0,1.95,-1], fov: 40 }],
  s6: [{ f: 485, pos: [0, 1.5, 6], look: [0, 1.5, 0], fov: 45 }, { f: 524, pos: [0, 1.5, 6], look: [0, 1.5, 0], fov: 45 }],
  s7: [{ f: 525, pos: [0, 0.5, 2.7], look: [0, 0.8, 0], fov: 40 }, { f: 576, pos: [1.5, 0.5, 2.2], look: [0, 0.8, 0], fov: 40 }],
  s8: [{ f: 577, pos: [0, 1.5, 4], look: [0, 1.5, 0], fov: 45 }, { f: 691, pos: [0, 1.5, 2], look: [0, 1.5, 0], fov: 45 }],
  s9: [{ f: 692, pos: [6, 5, 15], look: [6, 2, 0], fov: 54 }, { f: 747, pos: [6, 4, 10], look: [6, 2, -10], fov: 54 }],
  s10: [{ f: 748, pos: [0, 0.5, 2.0], look: [0, 0.3, 0], fov: 40 }, { f: 823, pos: [0, 0.5, 2.0], look: [0, 0.3, 0], fov: 40 }],
  s11: [{ f: 824, pos: [0,1.4,1.6], look: [0,1.3,-0.9], fov: 46 }, { f: 896, pos: [0,1.3,0.9], look: [0,1.25,-0.9], fov: 42 }],
  s12: [{ f: 897, pos: [6, 5, 10], look: [6, 0, 0], fov: 54 }, { f: 955, pos: [6, 8, 15], look: [6, 0, 0], fov: 54 }],
  s13: [{ f: 956, pos: [-0.6,0.9,4.2], look: [-0.4,1.0,-1], fov: 46 }, { f: 1023, pos: [-0.3,0.8,3.2], look: [-0.3,1.05,-1], fov: 44 }],
  s14: [{ f: 1024, pos: [0.9,0.55,3.0], look: [0.3,1.0,-1.2], fov: 48 }, { f: 1076, pos: [0.5,0.45,2.0], look: [0.3,0.95,-1.2], fov: 44 }],
  s15: [{ f: 1077, pos: [0.4,0.55,2.6], look: [0.1,0.9,-1], fov: 44 }, { f: 1138, pos: [0.15,0.45,1.5], look: [0.1,0.7,-0.5], fov: 38 }],
  s16: [{ f: 1139, pos: [0,1.0,3.4], look: [0,1.1,-0.4], fov: 40 }, { f: 1208, pos: [0,1.5,4.4], look: [0,1.3,-0.4], fov: 40 }],
  s17: [{ f: 1209, pos: [0, 1.5, 6], look: [0, 1.5, 0], fov: 45 }, { f: 1263, pos: [0, 1.5, 6], look: [0, 1.5, 0], fov: 45 }],
  s18: [{ f: 1264, pos: [-1.2,0.9,3.8], look: [0.2,0.9,-1], fov: 46 }, { f: 1357, pos: [-0.6,0.8,2.8], look: [0.3,0.9,-1], fov: 44 }],
  s19: [{ f: 1358, pos: [1.2,0.8,3.2], look: [0.2,0.9,-1], fov: 44 }, { f: 1418, pos: [0.6,0.7,2.4], look: [0.3,0.9,-1], fov: 42 }],
  s20: [{ f: 1419, pos: [0, 15, 15], look: [0, 0, -10], fov: 54 }, { f: 1473, pos: [0, 20, 15], look: [0, 0, -10], fov: 54 }],
  s21: [{ f: 1474, pos: [0.9,0.7,3.4], look: [0.5,1.0,-1.2], fov: 46 }, { f: 1548, pos: [0.5,0.55,2.2], look: [0.5,0.9,-1.2], fov: 42 }],
  s22: [{ f: 1549, pos: [0, 1.5, 4.7], look: [0, 0.5, 0], fov: 40 }, { f: 1556, pos: [0, 0.8, 2.7], look: [0, 0.5, 0], fov: 40, ease: 'easeIn' }, { f: 1655, pos: [0, 0.8, 2.5], look: [0, 0.5, 0], fov: 40 }],
  s23: [{ f: 1656, pos: [6, 8, 15], look: [6, 0, 0], fov: 54 }, { f: 1700, pos: [6, 8, 15], look: [6, 0, 0], fov: 54 }]
};

const KICKS = [
  { f: 1549, a: 0.05 }, { f: 1554, a: 0.05 },
  { f: 1656, a: 0.08 }, { f: 1661, a: 0.06 }, { f: 1666, a: 0.04 }
];

export const camAt = (f) => {
  const S = shotAt(f), c = camFromKeys(CAMS[S.id], f, { creep: 0.001, kicks: KICKS });
  c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  let cinf = 10;
  if (['s2', 's3', 's9', 's12', 's20', 's23'].includes(S.id)) cinf = 0;
  if (['s10', 's13', 's14', 's15', 's18', 's19', 's21', 's22'].includes(S.id)) cinf = 4;
  return { focus: dist(C.pos, C.look), cinf, near: 1 };
};

export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { env: '', saw: null, gapRail: null, smoothRail: null, train: null, newspaper: null, coin: null, paper: null, kinkedRail: null };

  if (['s1', 's5', 's6', 's7', 's10', 's13', 's14', 's15', 's16', 's17', 's21'].includes(S.id)) W.env = 'TRACK-CLOSEUP';
  if (['s2', 's3', 's9', 's12', 's20', 's23'].includes(S.id)) W.env = 'CANYON-BRIDGE';
  if (S.id === 's4') W.env = 'OFFICE';
  if (S.id === 's11') W.env = 'NEWSPAPER-STAND';
  if (['s8', 's18', 's19', 's22'].includes(S.id)) W.env = 'SMOOTH-TRACK';

  if (S.id === 's1') W.saw = { x: Math.sin(f * 0.5) * 0.2, y: 0.3, z: 0.7 };

  if (W.env === 'TRACK-CLOSEUP') {
    let gapSize = 0.1;
    if (f >= 1024 && f <= 1076) gapSize = lerp(0.1, 0.05, ramp(f, 1024, 1076));
    else if (f > 1076 && f < 1474) gapSize = 0.05;
    else if (f >= 1474 && f <= 1548) gapSize = lerp(0.05, 0, ramp(f, 1474, 1548));
    else if (f > 1548) gapSize = 0;
    W.gapRail = { gapSize };
  }

  if (W.env === 'SMOOTH-TRACK' && S.id !== 's22') {
    W.smoothRail = { bend: S.id === 's19', amt: S.id === 's18' ? ramp(f, 1264, 1357) * 0.4 : (S.id === 's19' ? 0.4 + ramp(f, 1358, 1418) * 0.8 : 0) };
  }

  if (S.id === 's9') W.train = { x: 6, z: lerp(0, -30, ramp(f, 692, 747)), ry: Math.PI/2 };
  if (S.id === 's10') W.train = { x: lerp(-10, 10, ramp(f, 748, 823)), z: 0, ry: 0 };
  if (S.id === 's12') W.train = { x: 6, z: -15, ry: Math.PI/2 };
  if (S.id === 's23') W.train = { x: 6, z: lerp(-15, -5, ramp(f, 1656, 1680)), ry: Math.PI/2, roll: ramp(f, 1680, 1700) * Math.PI/4 };

  if (S.id === 's11') W.newspaper = true;
  if (S.id === 's15') W.coin = { y: lerp(1.2, 0.34, smooth(ramp(f, 1077, 1120))) };
  if (S.id === 's16') W.paper = true;

  if (S.id === 's22') W.kinkedRail = { x: 0, z: 0 };
  if (S.id === 's23') W.kinkedRail = { x: 6, z: 0 };

  return W;
};

const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [], tint = S.light === 'golden' ? '#ffe6cc' : '#ffffff';
  switch (S.id) {
    case 's1':
      out.push(R(T, 'engineer', { seed: 1, expr: 'neutral', L: 'reach', R: 'reach', ...idle(f, 1) }, [0, 0, -0.5], { tint }));
      break;
    case 's3':
      out.push(R(T, 'engineer', { seed: 1, expr: 'stubborn', L: 'point', facing: 1, ...idle(f, 1) }, [-6, 0.5, 0], { tint }));
      out.push(R(T, 'rival', { seed: 2, expr: 'proud', L: 'point', facing: -1, ...idle(f, 2) }, [6, 0.5, 0], { tint }));
      break;
    case 's4':
      out.push(R(T, 'engineer', { seed: 1, expr: 'stubborn', L: 'hip', facing: 0, ...idle(f, 1) }, [0, 0, -1.2], { tint }));
      break;
    case 's5':
      out.push(R(T, 'boss', { seed: 3, expr: 'angry+vein', L: 'point', facing: 0, ...idle(f, 3) }, [0, 0, -1], { tint }));
      break;
    case 's6':
      out.push(R(T, 'boss', { seed: 3, expr: 'shout+vein', L: 'point', facing: 1, ...idle(f, 3) }, [-1.5, 0, 0], { tint }));
      out.push(R(T, 'engineer', { seed: 1, expr: 'stubborn', L: 'cross', R: 'cross', facing: -1, ...idle(f, 1) }, [1.5, 0, 0], { tint }));
      break;
    case 's7':
      out.push(R(T, 'engineer', { seed: 1, expr: 'stubborn', L: 'cross', R: 'cross', facing: 0, ...idle(f, 1) }, [0, 0, 0], { tint }));
      break;
    case 's8':
      out.push(R(T, 'rival', { seed: 2, expr: 'proud', L: 'hip', facing: 0, ...idle(f, 2) }, [0, 0, 0], { tint }));
      break;
    case 's13':
      out.push(R(T, 'engineer', { seed: 1, expr: 'neutral', L: 'hip', facing: 1, ...idle(f, 1) }, [-0.3, 0, -1.2], { tint }));
      break;
    case 's14':
      out.push(R(T, 'engineer', { seed: 1, expr: 'shock', L: 'point', facing: 1, ...idle(f, 1) }, [0.5, 0, -1.2], { tint }));
      break;
    case 's15':
      out.push(R(T, 'engineer', { seed: 1, expr: 'proud', L: 'hip', facing: 0, ...idle(f, 1) }, [0.2, 0, -1.3], { tint }));
      break;
    case 's18':
      out.push(R(T, 'rival', { seed: 2, expr: 'nervous+sweat2', L: 'temple', facing: 1, ...idle(f, 2) }, [0.4, 0, -1.2], { tint }));
      break;
    case 's19':
      out.push(R(T, 'rival', { seed: 2, expr: 'shock+sweat', L: 'temple', facing: -1, ...idle(f, 2) }, [1.0, 0, -1.4], { tint }));
      break;
    case 's21':
      out.push(R(T, 'engineer', { seed: 1, expr: 'proud', L: 'cross', R: 'cross', facing: 0, ...idle(f, 1) }, [0.6, 0, -1.2], { tint }));
      break;
    case 's12':
      T.crowd && out.push(FX('crowd', (p) => T.crowd(p, { n: 30, t: f/30, mode: 'stand' }), [6, 0.5, 0], 4, { tint }));
      break;
    case 's16':
      out.push(R(T, 'boss', { seed: 3, expr: 'grin+sparkle', L: 'point', facing: 0, ...idle(f, 3) }, [0, 0, -1.2], { tint }));
      break;
    case 's17':
      out.push(R(T, 'boss', { seed: 3, expr: 'grin', L: 'hip', facing: 1, ...idle(f, 3) }, [-1.5, 0, 0], { tint }));
      out.push(R(T, 'engineer', { seed: 1, expr: 'neutral', L: 'cross', R: 'cross', facing: -1, ...idle(f, 1) }, [1.5, 0, 0], { tint }));
      break;
    case 's23':
      out.push(R(T, 'rival', { seed: 2, expr: 'shock', L: 'temple', facing: 1, ...idle(f, 2) }, [8, 0.5, 5], { tint }));
      break;
  }
  return out;
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 's1') out.push(FX('sparks', (p) => T.fxSparkle(p, (f/30)%1, '#ffaa00'), [0, 0.3, 0], 1));
  if (S.id === 's2') out.push(FX('dust', (p) => T.fxMotes(p, (f/30)%1), [0, 5, 0], 10));
  if (S.id === 's5') out.push(FX('steam', (p) => T.fxSmoke(p, (f/30)%1), [0, 2, -1], 2));
  if (S.id === 's11') out.push(FX('headline', (p) => T.fxText(p, 'CLICKETY', 100, '#ffffff'), [0, 0.5, 0.2], 1.6, { order: 9, tint: '#ffffff' }));
  if (S.id === 's8') out.push(FX('stars', (p) => T.fxSparkle(p, (f/30)%1), [0, 1.5, 0], 2));
  if (S.id === 's10') out.push(FX('dust', (p) => T.fxDust(p, (f/30)%1), [0, 0.5, 0], 2));
  if (S.id === 's13') out.push(FX('steam', (p) => T.fxSmoke(p, (f/30)%1), [2.4, 0.3, -1.6], 1.6));
  if (S.id === 's15') out.push(FX('flash', (p) => T.fxGlow(p, (f/30)%1), [0, 0.3, 0.7], 0.4));
  if (S.id === 's18') out.push(FX('steam', (p) => T.fxSmoke(p, (f/30)%1), [-2.4, 0.3, -1.6], 1.6));
  if (S.id === 's19') out.push(FX('dust', (p) => T.fxDust(p, (f/30)%1), [0, 0.5, 0], 1));
  if (S.id === 's20') out.push(FX('steam', (p) => T.fxSmoke(p, (f/30)%1), [0, 5, 0], 10));
  if (S.id === 's22') out.push(FX('debris', (p) => T.fxDebris(p, ramp(f, 1549, 1570)), [0, 0.5, 0], 2));
  if (S.id === 's23') {
    out.push(FX('smoke', (p) => T.fxSmoke(p, (f/30)%1, '#444'), [6, 2, 0], 5));
    out.push(FX('sparks', (p) => T.fxSparkle(p, (f/30)%1, '#ff5500'), [6, 1, 0], 3));
  }
  return out;
};
export const LOOK = { sat: 1.21, vibr: 0.25, drift: 1, push: 1 };
