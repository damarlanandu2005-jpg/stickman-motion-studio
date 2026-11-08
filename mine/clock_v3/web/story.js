import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, M as MO } from './motion.js';

export const FPS = 30, TOTAL = 1007, DECK = 0;

export const SHOTS = [
  { id: 's1', a: 0, b: 54, light: 'indoor', env: 'WORKSHOP' },
  { id: 's2', a: 55, b: 135, light: 'indoor', env: 'CLOCK-INTERIOR' },
  { id: 's3', a: 136, b: 212, light: 'indoor', env: 'CLOCK-INTERIOR' },
  { id: 's4', a: 213, b: 290, light: 'indoor', env: 'CLOCK-INTERIOR' },
  { id: 's5', a: 291, b: 426, light: 'indoor', env: 'CLOCK-INTERIOR' },
  { id: 's6', a: 427, b: 542, light: 'indoor', env: 'CLOCK-INTERIOR' },
  { id: 's7', a: 543, b: 677, light: 'indoor', env: 'CLOCK-INTERIOR' },
  { id: 's8', a: 678, b: 732, light: 'indoor', env: 'WORKSHOP' },
  { id: 's9', a: 733, b: 895, light: 'indoor', env: 'CLOCK-INTERIOR' },
  { id: 's10', a: 896, b: 946, light: 'indoor', env: 'CLOCK-INTERIOR' },
  { id: 's11', a: 947, b: 1006, light: 'indoor', env: 'WORKSHOP' }
];

export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;

export const LIGHTS = {
  indoor: { az: 45, el: 30, sky: '#7a6a60', ground: '#6a5a50', hemi: 1.3, sun: '#ffffff', sunI: 3.5, fog: '#5b4d42', fogNear: 6, fogFar: 25, skyTop: '#5b4d42', skyHor: '#7a6a60', sat: 1.2, vig: 0.2, shadowExt: 10 }
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

const CAMS = {
  s1: [{ f: 0, pos: [0, 1.5, 6.0], look: [-1, 1.2, -2], fov: 50, ease: 'easeOut' }, { f: 54, pos: [0, 1.5, 4.0], look: [-1, 1.2, -2], fov: 50 }],
  s2: [{ f: 55, pos: [0, 0.5, 0.8], look: [-0.1, 0.5, 0], fov: 50, ease: 'smooth' }, { f: 135, pos: [0.4, 0.5, 0.6], look: [-0.1, 0.5, 0], fov: 50 }],
  s3: [{ f: 136, pos: [-0.35, 0.5, 0.8], look: [-0.35, 0.5, 0], fov: 50 }, { f: 212, pos: [-0.35, 0.5, 0.8], look: [-0.35, 0.5, 0], fov: 50 }],
  s4: [{ f: 213, pos: [0.7,0.75,1.7], look: [0.3,0.5,0], fov: 46, ease: 'easeOut' }, { f: 290, pos: [0.45,0.65,1.2], look: [0.3,0.5,0], fov: 44 }],
  s5: [{ f: 291, pos: [0.6,0.7,1.0], look: [0.3,0.5,0], fov: 44 }, { f: 426, pos: [0.3,0.62,0.75], look: [0.3,0.5,0], fov: 42 }],
  s6: [{ f: 427, pos: [0.0,0.7,1.2], look: [0.3,0.5,0], fov: 46, ease: 'smooth' }, { f: 542, pos: [0.2,0.6,0.95], look: [0.3,0.5,0], fov: 44 }],
  s7: [{ f: 543, pos: [0.65,0.55,0.95], look: [0.35,0.5,0], fov: 44 }, { f: 677, pos: [0.45,0.5,0.7], look: [0.35,0.5,0], fov: 40 }],
  s8: [{ f: 678, pos: [0, 1.5, 2.0], look: [0, 1.5, 0], fov: 50 }, { f: 732, pos: [0, 1.5, 2.0], look: [0, 1.5, 0], fov: 50 }],
  s9: [{ f: 733, pos: [0.35,0.9,1.5], look: [0.3,0.4,0], fov: 50, ease: 'smooth' }, { f: 895, pos: [0.3,0.3,1.5], look: [0.3,0.35,0], fov: 50 }],
  s10: [{ f: 896, pos: [0, 0.5, 0.6], look: [0, 0.5, 0], fov: 50, ease: 'easeIn' }, { f: 946, pos: [0, 0.5, 0.4], look: [0, 0.5, 0], fov: 50 }],
  s11: [{ f: 947, pos: [0, 1.5, 6.0], look: [0, 1.5, 0], fov: 50, ease: 'easeOut' }, { f: 1006, pos: [0, 1.5, 8.0], look: [0, 1.5, 0], fov: 50 }]
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
  const cinf = (S.env === 'CLOCK-INTERIOR' && S.id !== 's9') ? 8 : (S.id === 's8' ? 10 : 0);
  return { focus: dist(C.pos, C.look), cinf, near: 1 };
};

export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { env: S.env };
  
  // Default tick-tock mechanics
  const phase = f * 0.1;
  W.pendZ = Math.sin(phase) * 0.25;
  W.anchorZ = Math.sin(phase) * 0.25;
  const step = Math.floor(phase / Math.PI + 0.5);
  W.escZ = -step * (Math.PI / 8) - 0.05 * Math.sin(phase);
  W.gearsZ = -W.escZ * 0.5;
  W.springZ = f * 0.01;

  // Overrides
  if (S.id === 's3') {
    W.gearsZ = f * 0.5;
    W.escZ = -f * 0.5;
    W.anchorZ = -0.3; // moved away
    W.pendZ = -0.3;
  }
  
  return W;
};

const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.env === 'WORKSHOP') {
    if (S.id === 's1') {
      out.push(R(T, 'clockmaker', { expr: 'neutral', facing: 1, L: 'hip', R: 'hang', ...idle(f, 1), blink: blinkAt(f, 1) }, [-2, 0, -1]));
    } else if (S.id === 's8') {
      out.push(R(T, 'clockmaker', { expr: 'smile', facing: 0, L: 'hang', R: 'hang', ...idle(f, 1), blink: blinkAt(f, 1) }, [0, 0, 0]));
    } else if (S.id === 's11') {
      out.push(R(T, 'clockmaker', { expr: 'proud', facing: 0, L: 'hip', R: 'hip', ...idle(f, 1), blink: blinkAt(f, 1) }, [0, 0, 0]));
    }
  }
  return out;
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 's1' || S.id === 's11') {
    out.push(FX('motes', (p) => T.fxMotes(p, (f % 150) / 150), [0, 1.5, -1], 2));
  }
  if (S.id === 's3') {
    out.push(FX('speed', (p) => T.fxSpeed(p, (f % 30) / 30), [-0.35, 0.5, 0.1], 0.4));
  }
  if (S.id === 's10') {
    out.push(FX('glow', (p) => T.fxGlow(p, (f % 60) / 60, '#ffcc88'), [0, 0.5, -0.05], 0.6));
  }
  return out;
};
export const LOOK = { sat: 1.04, vibr: 0.25, drift: 1, push: 1 };
