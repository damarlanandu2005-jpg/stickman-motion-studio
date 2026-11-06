import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, M as MO } from './motion.js';
export const FPS = 30, TOTAL = 1083, DECK = 0;
export const SHOTS = [
  { id: 's1', a: 0, b: 42, light: 'indoor' },
  { id: 's2', a: 43, b: 143, light: 'day' },
  { id: 's3', a: 144, b: 249, light: 'day' },
  { id: 's4', a: 250, b: 338, light: 'indoor' },
  { id: 's5', a: 339, b: 435, light: 'indoor' },
  { id: 's6', a: 436, b: 498, light: 'indoor' },
  { id: 's7', a: 499, b: 546, light: 'indoor' },
  { id: 's8', a: 547, b: 615, light: 'indoor' },
  { id: 's9', a: 616, b: 695, light: 'indoor' },
  { id: 's10', a: 696, b: 771, light: 'indoor' },
  { id: 's11', a: 772, b: 796, light: 'indoor' },
  { id: 's12', a: 797, b: 857, light: 'indoor' },
  { id: 's13', a: 858, b: 917, light: 'indoor' },
  { id: 's14', a: 918, b: 990, light: 'indoor' },
  { id: 's15', a: 991, b: 1082, light: 'indoor' }
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;

export const LIGHTS = {
  day: { az: 130, el: 55, sky: '#bcd6f0', ground: '#b88a58', hemi: 1.15, sun: '#fff3dc', sunI: 2.6, fog: '#e8d9c0', fogNear: 90, fogFar: 700, skyTop: '#3f86d8', skyHor: '#d6e6f0', sat: 1.12, vig: 0.2, shadowExt: 26 },
  indoor: { az: 45, el: 45, sky: '#000000', ground: '#000000', hemi: 0.8, sun: '#ffffff', sunI: 1.5, fog: '#111111', fogNear: 20, fogFar: 100, skyTop: '#000000', skyHor: '#000000', sat: 1.0, vig: 0.4, shadowExt: 15 }
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

const CAMS = {
  s1: [{ f: 0, pos: [0, 1.5, 2.0], look: [0, 1.5, 0], fov: 30 }, { f: 42, pos: [0, 1.5, 1.7], look: [0, 1.5, 0], fov: 30 }],
  s2: [{ f: 43, pos: [0, 1.4, 6.0], look: [0, 1.4, 0], fov: 45 }, { f: 143, pos: [0, 1.4, 5.0], look: [0, 1.4, 0], fov: 45 }],
  s3: [{ f: 144, pos: [0, 2.0, 15.0], look: [0, 1.5, 0], fov: 55 }, { f: 249, pos: [0, 5.0, 15.0], look: [0, 1.5, 0], fov: 55 }],
  s4: [{ f: 250, pos: [0.2, 1.0, 2.0], look: [0, 0.85, 0], fov: 25 }, { f: 338, pos: [0.15, 0.95, 1.8], look: [0, 0.85, 0], fov: 25 }],
  s5: [{ f: 339, pos: [0, 1.0, 0.1], look: [0, 0, 0], fov: 35 }, { f: 435, pos: [0, 0.8, 0.1], look: [0, 0, 0], fov: 35 }],
  s6: [{ f: 436, pos: [0, 1.5, 2.0], look: [0, 1.4, 0], fov: 30 }, { f: 498, pos: [0, 1.5, 2.0], look: [0, 1.4, 0], fov: 30 }],
  s7: [{ f: 499, pos: [0, 1.4, 3.5], look: [0, 1.3, 0], fov: 45 }, { f: 546, pos: [0, 1.4, 3.0], look: [0, 1.3, 0], fov: 45 }],
  s8: [{ f: 547, pos: [0, 1.0, 0.1], look: [0, 0, 0], fov: 35 }, { f: 615, pos: [0, 0.8, 0.1], look: [0, 0, 0], fov: 35 }],
  s9: [{ f: 616, pos: [-0.1, 0.8, 0.1], look: [-0.1, 0, 0], fov: 35 }, { f: 695, pos: [0.1, 0.8, 0.1], look: [0.1, 0, 0], fov: 35 }],
  s10: [{ f: 696, pos: [0, 0.8, 0.1], look: [0, 0, 0], fov: 30 }, { f: 771, pos: [0, 0.8, 0.1], look: [0, 0, 0], fov: 30 }],
  s11: [{ f: 772, pos: [0.1, 1.5, 1.5], look: [0, 0.95, -0.15], fov: 30 }, { f: 780, pos: [0.0, 1.0, 0.6], look: [0, 0.95, -0.15], fov: 25, ease: 'easeOut' }, { f: 796, pos: [0.0, 1.0, 0.55], look: [0, 0.95, -0.15], fov: 25 }],
  s12: [{ f: 797, pos: [0, 1.5, 6.0], look: [0, 1.5, 0], fov: 45 }, { f: 857, pos: [0, 1.5, 5.0], look: [0, 1.5, 0], fov: 45 }],
  s13: [{ f: 858, pos: [0, 1.55, 2.0], look: [0, 1.55, 0], fov: 20 }, { f: 917, pos: [0, 1.55, 1.7], look: [0, 1.55, 0], fov: 20 }],
  s14: [{ f: 918, pos: [0, 1.4, 4.0], look: [0, 1.4, 0], fov: 45 }, { f: 990, pos: [0, 1.4, 6.0], look: [0, 1.4, 0], fov: 45 }],
  s15: [{ f: 991, pos: [0, 1.5, 6.0], look: [0, 1.5, 0], fov: 45 }, { f: 1082, pos: [0, 1.5, 5.0], look: [0, 1.5, 0], fov: 45 }]
};

export const camAt = (f) => {
  const S = shotAt(f), c = camFromKeys(CAMS[S.id], f, { creep: 0.001 });
  c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  let cinf = 0;
  if (['s1', 's4', 's6', 's11', 's13'].includes(S.id)) cinf = 12;
  return { focus: dist(C.pos, C.look), cinf, near: 1 };
};

export const worldAt = (f) => {
  const S = shotAt(f);
  return { id: S.id };
};

const R = (T, who, o, pos, extra = {}) => {
  let drawFn = (p) => T.romanFront(p, who, o);
  if (who === 'arthur_suit') drawFn = (p) => T.arthurSuit(p, o);
  if (who === 'tech') drawFn = (p) => T.techHeadset(p, o);
  return { key: who + JSON.stringify(o), draw: drawFn, x: pos[0], y: pos[1], z: pos[2], ...extra };
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const b = (seed) => blinkAt(f, seed);
  const idl = (seed) => idle(f, seed);

  if (S.id === 's1') {
    out.push(R(T, 'arthur', { seed: 1, expr: 'neutral', blink: b(1), L: 'hang', R: 'hang', ...idl(1) }, [0, 0, 0]));
  }
  if (S.id === 's2') {
    out.push(R(T, 'arthur_suit', { seed: 1, expr: 'stern', blink: b(1), L: 'hang', R: 'hang', ...idl(1) }, [0, 0, 0]));
    out.push(R(T, 'police', { seed: 2, expr: 'stern', blink: b(2), L: 'hang', R: 'hang', facing: -1, ...idl(2) }, [1.5, 0, -1]));
  }
  if (S.id === 's3') {
    out.push(R(T, 'arthur_suit', { seed: 1, expr: 'stern', blink: b(1), L: 'hang', R: 'hang', facing: -1, ...idl(1) }, [0, 0, 0]));
    out.push(R(T, 'police', { seed: 2, expr: 'stern', blink: b(2), L: 'point', R: 'hang', facing: 1, ...idl(2) }, [-2, 0, -1]));
    out.push({ key: 'crowd', draw: (p) => T.crowd(p, { n: 12, mode: 'stand', seed: 5 }), x: 0, y: 0, z: -8, s: 3 });
  }
  if (S.id === 's4') {
    out.push(R(T, 'arthur_suit', { seed: 1, expr: 'nervous', blink: b(1), L: 'hang', R: 'hang', facing: -1, ...idl(1) }, [1.5, 0, -1]));
  }
  if (S.id === 's6') {
    out.push(R(T, 'arthur_suit', { seed: 1, expr: 'nervous', blink: b(1), L: 'temple', R: 'hang', headTilt: 10, ...idl(1) }, [0, 0, 0]));
  }
  if (S.id === 's7') {
    out.push(R(T, 'arthur_suit', { seed: 1, expr: 'stern', blink: b(1), L: 'temple', R: 'hang', headTilt: 10, ...idl(1) }, [0, 0, 0]));
  }
  if (S.id === 's12') {
    out.push(R(T, 'commander', { seed: 3, expr: 'stern', blink: b(3), L: 'cross', R: 'cross', ...idl(3) }, [0, 0, 0]));
    out.push(R(T, 'police', { seed: 2, expr: 'nervous', blink: b(2), L: 'hang', R: 'hang', facing: 1, ...idl(2) }, [-1.2, 0, -0.5]));
    out.push(R(T, 'tech', { seed: 4, expr: 'nervous', blink: b(4), L: 'hang', R: 'temple', facing: -1, ...idl(4) }, [1.2, 0, -0.5]));
  }
  if (S.id === 's13') {
    out.push(R(T, 'arthur_suit', { seed: 1, expr: 'squint', blink: b(1), L: 'temple', R: 'hang', headTilt: 15, glare: true, ...idl(1) }, [0, 0, 0]));
  }
  if (S.id === 's14') {
    out.push(R(T, 'arthur_suit', { seed: 1, expr: 'relief', blink: b(1), L: 'up', R: 'up', ...idl(1) }, [0, 0, 0]));
  }
  if (S.id === 's15') {
    out.push(R(T, 'arthur', { seed: 1, expr: 'proud', blink: b(1), L: 'hip', R: 'hang', ...idl(1) }, [-0.8, 0, 0]));
    out.push(R(T, 'commander', { seed: 3, expr: 'relief', blink: b(3), L: 'hang', R: 'hip', facing: -1, ...idl(3) }, [0.8, 0, -0.5]));
  }

  return out;
};

export const fxAt = (f, T) => {
  return [];
};
