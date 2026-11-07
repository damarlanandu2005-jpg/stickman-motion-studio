import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, M as MO } from './motion.js';

export const FPS = 30, TOTAL = 1007, DECK = 0;

export const SHOTS = [
  { id: 's1', a: 0, b: 54, light: 'indoor' },
  { id: 's2', a: 55, b: 135, light: 'indoor' },
  { id: 's3', a: 136, b: 212, light: 'indoor' },
  { id: 's4', a: 213, b: 290, light: 'indoor' },
  { id: 's5', a: 291, b: 426, light: 'indoor' },
  { id: 's6', a: 427, b: 542, light: 'indoor' },
  { id: 's7', a: 543, b: 677, light: 'indoor' },
  { id: 's8', a: 678, b: 691, light: 'indoor' },
  { id: 's9', a: 692, b: 732, light: 'indoor' },
  { id: 's10', a: 733, b: 895, light: 'indoor' },
  { id: 's11', a: 896, b: 946, light: 'indoor' },
  { id: 's12', a: 947, b: 1006, light: 'indoor' }
];

export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;

export const LIGHTS = {
  indoor: { az: 45, el: 30, sky: '#4a3a30', ground: '#2a201a', hemi: 0.6, sun: '#ffd0a0', sunI: 1.5, fog: '#2a201a', fogNear: 10, fogFar: 40, skyTop: '#2a201a', skyHor: '#4a3a30', sat: 1.1, vig: 0.4, shadowExt: 10 }
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

const CAMS = {
  s1: [{ f: 0, pos: [0, 1.5, 5], look: [0, 1.0, -1], fov: 54 }, { f: 54, pos: [0, 1.5, 4], look: [0, 1.0, -1], fov: 54 }],
  s2: [{ f: 55, pos: [10, 0.5, 0.5], look: [10, 0.5, 0], fov: 50 }, { f: 135, pos: [10, 0.5, 0.8], look: [10, 0.5, 0], fov: 50, ease: 'easeOut' }],
  s3: [{ f: 136, pos: [10, 0.5, 0.8], look: [10, 0.5, 0], fov: 50 }, { f: 212, pos: [10, 0.5, 0.4], look: [10, 0.5, 0], fov: 50, ease: 'easeIn' }],
  s4: [{ f: 213, pos: [20, 0.05, 0.3], look: [20, 0.05, 0], fov: 50 }, { f: 290, pos: [20, 0.05, 0.3], look: [20, 0.05, 0], fov: 50 }],
  s5: [{ f: 291, pos: [20.1, 0.05, 0.2], look: [20, 0.05, 0], fov: 50 }, { f: 426, pos: [19.9, 0.05, 0.2], look: [20, 0.05, 0], fov: 50 }],
  s6: [{ f: 427, pos: [20, 0.05, 0.4], look: [20, 0.05, 0], fov: 50 }, { f: 542, pos: [20, 0.05, 0.2], look: [20, 0.05, 0], fov: 50, ease: 'easeOut' }],
  s7: [{ f: 543, pos: [20, 0.05, 0.2], look: [20, 0.05, 0], fov: 50 }, { f: 677, pos: [20, 0.05, 0.2], look: [20, 0.05, 0], fov: 50 }],
  s8: [{ f: 678, pos: [20, 0.05, 0.15], look: [20, 0.05, 0], fov: 50 }, { f: 691, pos: [20, 0.05, 0.1], look: [20, 0.05, 0], fov: 50, ease: 'easeIn' }],
  s9: [{ f: 692, pos: [20, 0.05, 0.2], look: [20, 0.05, 0], fov: 50 }, { f: 732, pos: [20, 0.05, 0.4], look: [20, 0.05, 0], fov: 50, ease: 'easeOut' }],
  s10: [{ f: 733, pos: [10, 0.8, 0.6], look: [10, 0.5, 0], fov: 54 }, { f: 895, pos: [10, 0.3, 1.0], look: [10, 0.3, 0], fov: 54 }],
  s11: [{ f: 896, pos: [9.7, 0.5, 0.5], look: [9.7, 0.5, 0], fov: 50 }, { f: 946, pos: [9.7, 0.5, 0.3], look: [9.7, 0.5, 0], fov: 50, ease: 'easeOut' }],
  s12: [{ f: 947, pos: [0, 1.5, 6], look: [0, 1.0, -1], fov: 54 }, { f: 1006, pos: [0, 1.5, 8], look: [0, 1.0, -1], fov: 54, ease: 'easeOut' }]
};

const KICKS = [{ f: 678, a: 0.02 }];

export const camAt = (f) => {
  const S = shotAt(f), c = camFromKeys(CAMS[S.id], f, { creep: 0.001, kicks: S.id === 's8' ? KICKS : [] });
  c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const isMacro = ['s2','s3','s4','s5','s6','s7','s8','s9','s10','s11'].includes(S.id);
  return { focus: dist(C.pos, C.look), cinf: isMacro ? 12 : 0, near: 1 };
};

export const worldAt = (f) => {
  const S = shotAt(f);
  return { id: S.id };
};

const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 's1') {
    out.push(R(T, 'clockmaker', { seed: 1, expr: 'neutral', facing: 1, L: 'hip', R: 'hip', ...idle(f, 1), blink: blinkAt(f, 1) }, [-1.5, 0, 1]));
  }
  if (S.id === 's12') {
    out.push(R(T, 'clockmaker', { seed: 1, expr: 'smile', facing: 0, L: 'hang', R: 'hang', ...idle(f, 1), blink: blinkAt(f, 1) }, [0, 0, 1]));
  }
  return out;
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 's1' || S.id === 's12') {
    out.push(FX('motes', (p) => T.fxMotes(p, (f / 30) % 1), [0, 1.5, 0], 2));
  }
  if (S.id === 's3') {
    out.push(FX('speed', (p) => T.fxSpeed(p, (f / 30) % 1), [10, 0.5, 0.2], 1));
  }
  if (S.id === 's8') {
    out.push(FX('spark', (p) => T.fxSparkle(p, (f / 30) % 1, '#ffaa00'), [20, 0.05, 0.05], 0.2));
  }
  return out;
};
export const LOOK = { sat: 1.08, vibr: 0.25, drift: 1, push: 1 };
