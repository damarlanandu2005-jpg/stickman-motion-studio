import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, M as MO } from './motion.js';
export const FPS = 30, TOTAL = 947, DECK = 0;

export const SHOTS = [
  { id: 's1_hook', a: 0, b: 68, light: 'golden' },
  { id: 's2_wave', a: 69, b: 158, light: 'day' },
  { id: 's3_tank', a: 159, b: 264, light: 'day' },
  { id: 's4_neighborhood', a: 265, b: 327, light: 'day' },
  { id: 's5_built', a: 328, b: 404, light: 'day' },
  { id: 's6_groan', a: 405, b: 501, light: 'golden' },
  { id: 's7_rivets', a: 502, b: 555, light: 'golden' },
  { id: 's8_burst', a: 556, b: 588, light: 'day' },
  { id: 's9_wave', a: 589, b: 721, light: 'day' },
  { id: 's10_flatten', a: 722, b: 799, light: 'day' },
  { id: 's11_clean', a: 800, b: 846, light: 'dawn' },
  { id: 's12_smell', a: 847, b: 946, light: 'golden' }
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;

export const LIGHTS = {
  day: { az: 130, el: 55, sky: '#bcd6f0', ground: '#b88a58', hemi: 1.15, sun: '#fff3dc', sunI: 2.6, fog: '#e8d9c0', fogNear: 90, fogFar: 700,
    skyTop: '#3f86d8', skyHor: '#d6e6f0', sat: 1.12, waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff', vig: 0.2, shadowExt: 26 },
  golden: { az: 20, el: 12, sky: '#d9a888', ground: '#9a5c3a', hemi: 1.0, sun: '#ffb050', sunI: 3.0, fog: '#f0b480', fogNear: 50, fogFar: 520,
    skyTop: '#7c6ab0', skyHor: '#ffb46a', sunDisc: '#fff0c8', sunSize: 0.004, sat: 1.15, gain: '#fff0dc', waterDeep: '#3d5a86', waterShal: '#d99a6e', glint: '#ffe2a8', vig: 0.28, shadowExt: 26 },
  dawn: { az: 200, el: 7, sky: '#c8a8b8', ground: '#8a6a60', hemi: 0.95, sun: '#ff9a7a', sunI: 2.2, fog: '#e8b0a0', fogNear: 40, fogFar: 460,
    skyTop: '#6a74b8', skyHor: '#f4a8a0', sunDisc: '#ffe0b0', sunSize: 0.003, sat: 1.05, gain: '#f4e6ee', waterDeep: '#3d5a86', waterShal: '#c8908e', glint: '#ffd0c0', vig: 0.3, shadowExt: 26 },
  indoor: { az: 180, el: 40, sky: '#a0a0a0', ground: '#808080', hemi: 0.8, sun: '#ffffff', sunI: 1.5, fog: '#909090', fogNear: 20, fogFar: 200,
    skyTop: '#808080', skyHor: '#a0a0a0', sat: 1.0, vig: 0.4, shadowExt: 15 }
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

const CAMS = {
  s1_hook: [{ f: 0, pos: [0, 1.5, 20], look: [0, 1.5, 10], fov: 30 }, { f: 68, pos: [0, 1.5, 20], look: [0, 1.5, 10], fov: 30 }],
  s2_wave: [{ f: 69, pos: [0, 1.5, 20], look: [0, 1.5, 10], fov: 30 }, { f: 158, pos: [0, 2, 35], look: [0, 1.5, 0], fov: 44, ease: 'easeOut' }],
  s3_tank: [{ f: 159, pos: [0, 1.5, -5], look: [0, 5, -20], fov: 46 }, { f: 264, pos: [0, 1.5, -5], look: [0, 15, -20], fov: 46 }],
  s4_neighborhood: [{ f: 265, pos: [-30, 30, 10], look: [0, 0, -20], fov: 50 }, { f: 327, pos: [20, 30, 15], look: [0, 0, -20], fov: 50 }],
  s5_built: [{ f: 328, pos: [-10, 8, -5], look: [0, 8, -15], fov: 40 }, { f: 404, pos: [-10, 8, -5], look: [0, 8, -15], fov: 40 }],
  s6_groan: [{ f: 405, pos: [-6, 1.5, -8], look: [0, 3, -12.5], fov: 36 }, { f: 501, pos: [-6, 1.5, -8], look: [0, 3, -12.5], fov: 36 }],
  s7_rivets: [{ f: 502, pos: [0, 5, 0], look: [0, 5, -12], fov: 28 }, { f: 555, pos: [0, 5, 0], look: [0, 5, -12], fov: 28 }],
  s8_burst: [{ f: 556, pos: [0, 5, -8], look: [0, 5, -20], fov: 28 }, { f: 588, pos: [0, 5, 10], look: [0, 5, -20], fov: 54, ease: 'easeOut' }],
  s9_wave: [{ f: 589, pos: [0, 2, 15], look: [0, 2, 0], fov: 40 }, { f: 721, pos: [0, 2, 70], look: [0, 2, 50], fov: 40 }],
  s10_flatten: [{ f: 722, pos: [35, 5, 25], look: [0, 5, 25], fov: 48 }, { f: 799, pos: [35, 5, 25], look: [0, 5, 25], fov: 48 }],
  s11_clean: [{ f: 800, pos: [0, 3, 15], look: [0, 1, 5], fov: 40 }, { f: 846, pos: [0, 4, 25], look: [0, 1, 5], fov: 48 }],
  s12_smell: [{ f: 847, pos: [0, 1.5, 5], look: [0, 1.0, -5], fov: 46 }, { f: 946, pos: [0, 1.5, 2], look: [0, 1.0, -5], fov: 30 }]
};

const KICKS = [
  { f: 405, a: 0.02 }, { f: 420, a: 0.02 }, { f: 440, a: 0.02 },
  { f: 502, a: 0.03 }, { f: 520, a: 0.03 }, { f: 540, a: 0.03 },
  { f: 556, a: 0.08 }, { f: 722, a: 0.05 }
];

export const camAt = (f) => {
  const S = shotAt(f), c = camFromKeys(CAMS[S.id], f, { creep: 0.0006, kicks: KICKS });
  c.flash = (f >= 556 && f < 559) ? 1.0 * (1 - (f - 556) / 3) : 0;
  c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const cinf = { s1_hook: 12, s7_rivets: 10, s12_smell: 8 }[S.id] ?? 0;
  return { focus: dist(C.pos, C.look), cinf, near: 1 };
};

export const worldAt = (f) => {
  return { id: shotAt(f).id };
};

const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = S.light === 'golden' ? '#ffe6cc' : S.light === 'dawn' ? '#f4dede' : '#ffffff';
  
  if (S.id === 's2_wave') {
    out.push(FX('crowd', (p) => T.crowd(p, { n: 6, t: f/30, mode: 'stand' }), [0, 0, 10], 2));
  }
  if (S.id === 's3_tank') {
    out.push(R(T, 'worker1', { seed: 1, L: 'hip', R: 'hang', ...idle(f, 1) }, [-2, 0, -12], { tint }));
    out.push(R(T, 'worker2', { seed: 2, L: 'hang', R: 'hang', ...idle(f, 2) }, [2, 0, -12], { tint }));
  }
  if (S.id === 's4_neighborhood') {
    out.push(FX('crowd', (p) => T.crowd(p, { n: 8, t: f/30, mode: 'stand' }), [0, 0, 0], 4));
  }
  if (S.id === 's5_built') {
    out.push(R(T, 'worker1', { seed: 3, L: 'hang', R: f % 10 < 5 ? 'up' : 'hang', ...idle(f, 3) }, [-3, 9, -11.5], { tint }));
    out.push(R(T, 'worker2', { seed: 4, L: 'wave', R: 'hang', ...idle(f, 4) }, [3, 9, -11.5], { tint }));
  }
  if (S.id === 's6_groan') {
    out.push(R(T, 'kid1', { seed: 5, expr: 'shock', L: 'up', R: 'up', ...idle(f, 5) }, [-4, 0, -10], { tint }));
    out.push(R(T, 'kid1', { seed: 6, expr: 'shock', L: 'up', R: 'up', ...idle(f, 6) }, [-2, 0, -9], { tint }));
  }
  if (S.id === 's8_burst') {
    out.push(FX('crowd', (p) => T.crowd(p, { n: 6, t: f/30, mode: 'stand', expr: 'scared' }), [0, 0, -5], 2));
  }
  if (S.id === 's9_wave') {
    const t = (f - 589) / (721 - 589);
    const z = 10 + t * 50;
    out.push(FX('cart', (p) => T.horseCart(p, { step: (f/15)%1, fear: 1 }), [-2, 0, z], 3));
    out.push(R(T, 'worker1', { seed: 7, expr: 'scared', L: 'up', R: 'up', step: (f/10)%1, tilt: 10 }, [3, 0, z], { tint }));
  }
  if (S.id === 's10_flatten') {
    const y = f >= 722 ? ramp(f, 722, 760) * 8 : 0;
    out.push(R(T, 'fireman', { seed: 8, expr: 'shock', L: 'up', R: 'up', ...idle(f, 8) }, [0, y, 25], { tint }));
  }
  if (S.id === 's11_clean') {
    out.push(R(T, 'worker1', { seed: 9, expr: 'tired', L: 'reach', R: 'reach', lift: Math.sin(f*0.2) }, [-2, 0, 8], { tint }));
    out.push(R(T, 'worker2', { seed: 10, expr: 'tired', L: 'reach', R: 'reach', lift: Math.sin(f*0.2+1) }, [2, 0, 8], { tint }));
  }
  if (S.id === 's12_smell') {
    out.push(R(T, 'modern', { seed: 11, expr: 'shock', L: 'hip', R: 'cheek', ...idle(f, 11) }, [1, 0, -2], { tint }));
  }
  return out;
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 's1_hook') {
    out.push(FX('jar', (p) => T.fxJar(p, (f/68)), [0, 1.5, 15], 1, { roll: 0.5 }));
    out.push(FX('drip', (p) => T.fxDrip(p), [0, 1.0 - (f%20)*0.05, 15], 0.2));
    out.push(FX('cart', (p) => T.horseCart(p, { step: 0 }), [-4, 0, 5], 2));
  }
  if (S.id === 's2_wave') {
    if (f > 100 && f < 130) out.push(FX('txt', (p) => T.fxText(p, "21", 200, "#ff4444"), [0, 5, 5], 2));
  }
  if (S.id === 's3_tank') {
    out.push(FX('steam', (p) => T.fxCloud && T.fxCloud(p, 1), [0, 16 + (f%60)*0.05, -20], 3, { alpha: 0.5 }));
  }
  if (S.id === 's4_neighborhood') {
    out.push(FX('smoke', (p) => T.fxCloud && T.fxCloud(p, 2), [15, 15, 0], 5, { alpha: 0.5 }));
  }
  if (S.id === 's5_built') {
    if (f % 10 < 5) out.push(FX('sparks', (p) => T.fxSparks(p, (f%10)/5), [-3, 9.5, -11], 1));
    out.push(FX('drip', (p) => T.fxDrip(p), [0, 5 - (f%20)*0.1, -11.5], 0.3));
  }
  if (S.id === 's6_groan') {
    out.push(FX('thermo', (p) => T.fxThermo(p, Math.sin(f*0.05)*0.5+0.5), [-5, 2, -11], 1.5));
  }
  if (S.id === 's7_rivets') {
    out.push(FX('rivet1', (p) => T.fxRivet(p), [Math.sin(f*0.5)*2, 3 + Math.cos(f*0.4)*2, -5 + (f%20)*0.2], 1));
    out.push(FX('spray', (p) => T.fxWaveSplash(p, (f%15)/15), [0, 3, -6], 2));
  }
  if (S.id === 's8_burst') {
    out.push(FX('splash', (p) => T.fxWaveSplash(p, (f-556)/32), [0, 5, -15], 8));
  }
  if (S.id === 's11_clean') {
    out.push(FX('cal', (p) => T.fxCal(p, (f-800)/46), [-4, 5, 10], 2));
  }
  if (S.id === 's12_smell') {
    out.push(FX('heart', (p) => T.fxHeart(p, (f%40)/40), [1, 2.5, -2], 1.5));
  }
  return out;
};
