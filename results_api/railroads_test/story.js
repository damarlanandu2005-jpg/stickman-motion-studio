import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, M as MO } from './motion.js';
export const FPS = 30, TOTAL = 1701, DECK = 0;
export const SHOTS = [
  { id: 's1', place: 'RAIL-CLOSEUP', a: 0, b: 89, light: 'day' },
  { id: 's2', place: 'BRIDGE-WIDE', a: 90, b: 218, light: 'day' },
  { id: 's3', place: 'OFFICE', a: 219, b: 297, light: 'indoor' },
  { id: 's4', place: 'CANYON-EDGE', a: 298, b: 352, light: 'day' },
  { id: 's5', place: 'RAIL-CLOSEUP', a: 353, b: 484, light: 'day' },
  { id: 's6', place: 'CANYON-EDGE', a: 485, b: 524, light: 'day' },
  { id: 's7', place: 'CANYON-EDGE', a: 525, b: 576, light: 'day' },
  { id: 's8', place: 'RAIL-CLOSEUP', a: 577, b: 691, light: 'day' },
  { id: 's9', place: 'BRIDGE-WIDE', a: 692, b: 823, light: 'day' },
  { id: 's10', place: 'OFFICE', a: 824, b: 955, light: 'indoor' },
  { id: 's11', place: 'CANYON-EDGE', a: 956, b: 1023, light: 'golden' },
  { id: 's12', place: 'RAIL-CLOSEUP', a: 1024, b: 1076, light: 'golden' },
  { id: 's13', place: 'RAIL-CLOSEUP', a: 1077, b: 1138, light: 'golden' },
  { id: 's14', place: 'RAIL-CLOSEUP', a: 1139, b: 1208, light: 'golden' },
  { id: 's15', place: 'CANYON-EDGE', a: 1209, b: 1263, light: 'golden' },
  { id: 's16', place: 'RAIL-CLOSEUP', a: 1264, b: 1418, light: 'golden' },
  { id: 's17', place: 'BRIDGE-WIDE', a: 1419, b: 1473, light: 'golden' },
  { id: 's18', place: 'RAIL-CLOSEUP', a: 1474, b: 1548, light: 'golden' },
  { id: 's19', place: 'BRIDGE-WIDE', a: 1549, b: 1700, light: 'golden' }
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;

export const LIGHTS = {
  day: { az: 130, el: 55, sky: '#bcd6f0', ground: '#b88a58', hemi: 1.15, sun: '#fff3dc', sunI: 2.6, fog: '#e8d9c0', fogNear: 90, fogFar: 700, skyTop: '#3f86d8', skyHor: '#d6e6f0', sat: 1.12, vig: 0.2, shadowExt: 26 },
  golden: { az: 20, el: 12, sky: '#d9a888', ground: '#9a5c3a', hemi: 1.0, sun: '#ffb050', sunI: 3.0, fog: '#f0b480', fogNear: 50, fogFar: 520, skyTop: '#7c6ab0', skyHor: '#ffb46a', sunDisc: '#fff0c8', sunSize: 0.004, sat: 1.15, gain: '#fff0dc', vig: 0.28, shadowExt: 26 },
  indoor: { az: 160, el: 35, sky: '#4a4a4a', ground: '#3a3a3a', hemi: 0.8, sun: '#ffeedd', sunI: 1.5, fog: '#2a2a2a', fogNear: 20, fogFar: 100, skyTop: '#222222', skyHor: '#333333', sat: 1.1, vig: 0.4, shadowExt: 15 }
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

const CAMS = {
  s1: [{ f: 0, pos: [0.7, 1.2, 1.5], look: [0.7, 0.1, 0], fov: 40 }, { f: 89, pos: [0.7, 1.2, 1.5], look: [0.7, 0.1, 0], fov: 40 }],
  s2: [{ f: 90, pos: [0, 10, 15], look: [0, 0, -10], fov: 50 }, { f: 218, pos: [0, 12, 25], look: [0, 0, -10], fov: 50 }],
  s3: [{ f: 219, pos: [0, 1.5, 6], look: [0, 1.2, -1], fov: 45 }, { f: 297, pos: [0, 1.5, 4], look: [0, 1.2, -1], fov: 45 }],
  s4: [{ f: 298, pos: [0, 1.5, 2], look: [0, 1.3, 0], fov: 40 }, { f: 352, pos: [0, 1.5, 2], look: [0, 1.3, 0], fov: 40 }],
  s5: [{ f: 353, pos: [0, 1.8, 1.5], look: [0, 0.2, 0], fov: 45 }, { f: 484, pos: [0, 1.5, 1.0], look: [0, 0.2, 0], fov: 45 }],
  s6: [{ f: 485, pos: [0, 1.5, 6], look: [0, 1.2, 0], fov: 45 }, { f: 524, pos: [0, 1.5, 6], look: [0, 1.2, 0], fov: 45 }],
  s7: [{ f: 525, pos: [0, 1.5, 2], look: [0, 1.3, 0], fov: 40 }, { f: 576, pos: [0, 1.5, 1.5], look: [0, 1.3, 0], fov: 40 }],
  s8: [{ f: 577, pos: [0, 1.5, 1.5], look: [0, 0.2, 0], fov: 40 }, { f: 691, pos: [0, 1.5, 1.5], look: [0, 0.2, 0], fov: 40 }],
  s9: [{ f: 692, pos: [0, 8, 15], look: [0, 0, -10], fov: 50 }, { f: 823, pos: [0, 8, 15], look: [0, 0, -10], fov: 50 }],
  s10: [{ f: 824, pos: [0, 1.5, 2], look: [0, 1.0, -3], fov: 40 }, { f: 955, pos: [0, 1.5, 1.5], look: [0, 1.0, -3], fov: 40 }],
  s11: [{ f: 956, pos: [0, 2, 12], look: [0, 2, 0], fov: 50 }, { f: 1023, pos: [0, 8, 15], look: [0, 2, 0], fov: 50 }],
  s12: [{ f: 1024, pos: [0.7, 1.5, 1.5], look: [0.7, 0.1, 0], fov: 35 }, { f: 1076, pos: [0.7, 1.0, 1.0], look: [0.7, 0.1, 0], fov: 35 }],
  s13: [{ f: 1077, pos: [0.7, 1.0, 1.0], look: [0.7, 0.1, 0], fov: 35 }, { f: 1138, pos: [0.7, 1.0, 1.0], look: [0.7, 0.1, 0], fov: 35 }],
  s14: [{ f: 1139, pos: [0.7, 1.0, 1.0], look: [0.7, 0.1, 0], fov: 35 }, { f: 1208, pos: [0.7, 1.0, 1.0], look: [0.7, 0.1, 0], fov: 35 }],
  s15: [{ f: 1209, pos: [0, 1.5, 6], look: [0, 1.2, 0], fov: 45 }, { f: 1263, pos: [0, 1.5, 6], look: [0, 1.2, 0], fov: 45 }],
  s16: [{ f: 1264, pos: [0.7, 1.5, 1.5], look: [0.7, 0.1, 0], fov: 35 }, { f: 1418, pos: [0.7, 1.0, 1.0], look: [0.7, 0.1, 0], fov: 35 }],
  s17: [{ f: 1419, pos: [0, 10, 20], look: [0, 0, -10], fov: 50 }, { f: 1473, pos: [0, 10, 20], look: [0, 0, -10], fov: 50 }],
  s18: [{ f: 1474, pos: [0.7, 1.5, 1.5], look: [0.7, 0.1, 0], fov: 35 }, { f: 1548, pos: [0.7, 1.0, 1.0], look: [0.7, 0.1, 0], fov: 35 }],
  s19: [{ f: 1549, pos: [0, 10, 20], look: [0, 0, -10], fov: 50 }, { f: 1700, pos: [5, 6, -4], look: [5, 1, -10], fov: 45, ease: 'easeOut' }]
};

export const camAt = (f) => {
  const S = shotAt(f), c = camFromKeys(CAMS[S.id], f, { creep: 0.001 });
  c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const cinf = ['s1', 's4', 's5', 's7', 's8', 's10', 's12', 's13', 's14', 's16', 's18'].includes(S.id) ? 12 : 0;
  return { focus: dist(C.pos, C.look), cinf, near: 1 };
};

export const worldAt = (f) => {
  const S = shotAt(f);
  return { place: S.place, id: S.id };
};

const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const ENGINEER = { who: 'worker1', o: { moustache: null } };
  const BOSS = { who: 'councilman', o: {} };
  const RIVAL = { who: 'council2', o: { skin: "#8c5a35", beard: "#111111", brows: "#111111", moustache: null } };

  if (S.id === 's1') out.push(R(T, ENGINEER.who, { ...ENGINEER.o, expr: 'determined', L: 'spear', R: 'spear', facing: 0, look: 0.5, blink: blinkAt(f, 1), ...idle(f, 1) }, [0.7, 0, -0.5]));
  if (S.id === 's3') out.push(R(T, BOSS.who, { ...BOSS.o, expr: 'proud', L: 'point', R: 'hang', facing: 1, blink: blinkAt(f, 2), ...idle(f, 2) }, [0, 0, -1]));
  if (S.id === 's4') out.push(R(T, ENGINEER.who, { ...ENGINEER.o, expr: 'proud', L: 'hip', R: 'hang', facing: 1, blink: blinkAt(f, 1), ...idle(f, 1) }, [0, 0, 0]));
  if (S.id === 's5') out.push(R(T, BOSS.who, { ...BOSS.o, expr: 'angry+vein', L: 'point', R: 'hang', facing: 0, look: 0.5, blink: blinkAt(f, 2), ...idle(f, 2) }, [0, 0, -0.5]));
  if (S.id === 's6') {
    out.push(R(T, BOSS.who, { ...BOSS.o, expr: 'angry+vein', L: 'point', R: 'hang', facing: 1, blink: blinkAt(f, 2), ...idle(f, 2) }, [-1.5, 0, 0]));
    out.push(R(T, ENGINEER.who, { ...ENGINEER.o, expr: 'neutral', L: 'hang', R: 'hang', facing: -1, blink: blinkAt(f, 1), ...idle(f, 1) }, [1.5, 0, 0]));
  }
  if (S.id === 's7') out.push(R(T, ENGINEER.who, { ...ENGINEER.o, expr: 'stubborn', L: 'cross', R: 'cross', facing: -1, blink: blinkAt(f, 1), ...idle(f, 1) }, [0, 0, 0]));
  if (S.id === 's8') out.push(R(T, RIVAL.who, { ...RIVAL.o, expr: 'proud', L: 'point', R: 'hang', facing: 0, look: 0.5, blink: blinkAt(f, 3), ...idle(f, 3) }, [0, 0, -0.5]));
  if (S.id === 's10') out.push(R(T, BOSS.who, { ...BOSS.o, expr: 'sad+sweat', L: 'temple', R: 'hang', facing: 1, blink: blinkAt(f, 2), ...idle(f, 2) }, [0, 0, -1]));
  if (S.id === 's11') out.push(R(T, ENGINEER.who, { ...ENGINEER.o, expr: 'neutral', L: 'point', R: 'hang', facing: 0, blink: blinkAt(f, 1), ...idle(f, 1) }, [0, 0, 0]));
  if (S.id === 's13') out.push(R(T, ENGINEER.who, { ...ENGINEER.o, expr: 'neutral', L: 'reach', R: 'hang', facing: 0, look: 0.5, blink: blinkAt(f, 1), ...idle(f, 1) }, [0.7, 0, -0.5]));
  if (S.id === 's14') out.push(R(T, BOSS.who, { ...BOSS.o, expr: 'grin', L: 'reach', R: 'hang', facing: 0, look: 0.5, blink: blinkAt(f, 2), ...idle(f, 2) }, [0.7, 0, -0.5]));
  if (S.id === 's15') {
    out.push(R(T, BOSS.who, { ...BOSS.o, expr: 'laugh', L: 'hip', R: 'hang', facing: 1, blink: blinkAt(f, 2), ...idle(f, 2) }, [-1.5, 0, 0]));
    out.push(R(T, ENGINEER.who, { ...ENGINEER.o, expr: 'neutral', L: 'cross', R: 'cross', facing: -1, blink: blinkAt(f, 1), ...idle(f, 1) }, [1.5, 0, 0]));
  }

  return out;
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 's2') out.push(FX('crowd', (p) => T.crowd(p, { n: 10, mode: 'stand' }), [0, 0, 5], 1));
  if (S.id === 's9') out.push(FX('smoke', (p) => T.fxSmoke(p, (f % 30) / 30), [-6, 4, -20 + (f - 692) * 0.2], 2));
  if (S.id === 's16') out.push(FX('glow', (p) => T.fxGlow(p, (f % 30) / 30, '#ffaa55'), [0.7, 0.2, 0], 1.5));
  if (S.id === 's17') out.push(FX('motes', (p) => T.fxMotes(p, (f % 60) / 60), [0, 5, -5], 3));
  if (S.id === 's19') {
    out.push(FX('debris', (p) => T.fxDebris(p, Math.min(1, (f - 1549) / 30)), [5, 1, -10], 2));
    out.push(FX('smoke', (p) => T.fxSmoke(p, (f % 30) / 30), [5, 4, -30 + (f - 1549) * 0.3], 2));
  }
  return out;
};
export const LOOK = { sat: 0.78, vibr: 0.25, drift: 1, push: 1 };
