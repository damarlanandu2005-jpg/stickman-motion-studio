import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, M as MO } from './motion.js';
export const FPS = 30, TOTAL = 1083, DECK = 0;
export const SHOTS = [
  { id: 's1', a: 0, b: 42, light: 'indoor', place: 'POLICE-OFFICE' },
  { id: 's2', a: 43, b: 143, light: 'day', place: 'CITY-STREET' },
  { id: 's3', a: 144, b: 249, light: 'day', place: 'CITY-STREET' },
  { id: 's4', a: 250, b: 338, light: 'indoor', place: 'BOMB-ROOM' },
  { id: 's5', a: 339, b: 435, light: 'indoor', place: 'CIRCUIT-VIEW' },
  { id: 's6', a: 436, b: 498, light: 'indoor', place: 'BOMB-ROOM' },
  { id: 's7', a: 499, b: 546, light: 'indoor', place: 'BOMB-ROOM' },
  { id: 's8', a: 547, b: 615, light: 'indoor', place: 'CIRCUIT-VIEW' },
  { id: 's9', a: 616, b: 695, light: 'indoor', place: 'CIRCUIT-VIEW' },
  { id: 's10', a: 696, b: 771, light: 'indoor', place: 'BOMB-ROOM' },
  { id: 's11', a: 772, b: 796, light: 'indoor', place: 'CIRCUIT-VIEW' },
  { id: 's12', a: 797, b: 857, light: 'day', place: 'CITY-STREET' },
  { id: 's13', a: 858, b: 917, light: 'indoor', place: 'BOMB-ROOM' },
  { id: 's14', a: 918, b: 990, light: 'indoor', place: 'CIRCUIT-VIEW' },
  { id: 's15', a: 991, b: 1082, light: 'indoor', place: 'POLICE-OFFICE' }
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;

export const LIGHTS = {
  day: { az: 130, el: 55, sky: '#bcd6f0', ground: '#b88a58', hemi: 1.15, sun: '#fff3dc', sunI: 2.6, fog: '#e8d9c0', fogNear: 90, fogFar: 700,
    skyTop: '#3f86d8', skyHor: '#d6e6f0', sat: 1.12, waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff', vig: 0.2, shadowExt: 26 },
  indoor: { az: 45, el: 40, sky: '#7a7a84', ground: '#8a8a90', hemi: 1.5, sun: '#ffeed0', sunI: 3.0, fog: '#4a4a54', fogNear: 20, fogFar: 150,
    skyTop: '#444448', skyHor: '#55555a', sat: 1.1, vig: 0.2, shadowExt: 15 }
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

const CAMS = {
  s1: [{ f: 0, pos: [0, 1.5, 1.0], look: [0, 1.2, -1], fov: 50 }, { f: 42, pos: [0, 1.5, 0.5], look: [0, 1.2, -1], fov: 48 }],
  s2: [{ f: 43, pos: [100, 1.5, 6], look: [100, 1.5, 0], fov: 54 }, { f: 143, pos: [100, 3.0, 8], look: [100, 1.5, 0], fov: 58 }],
  s3: [{ f: 144, pos: [100, 1.5, 15], look: [99, 1.5, 0], fov: 56 }, { f: 249, pos: [105, 1.5, 14], look: [99, 1.5, 0], fov: 56 }],
  s4: [{ f: 250, pos: [200, 1.5, 0.5], look: [200, 1.1, -1], fov: 45 }, { f: 338, pos: [200, 1.4, 0.0], look: [200, 1.1, -1], fov: 42 }],
  s5: [{ f: 339, pos: [300.9,1.15,1.0], look: [300,0.1,-0.1], fov: 44 }, { f: 435, pos: [300.3,0.8,0.7], look: [300,0.1,-0.1], fov: 42 }],
  s6: [{ f: 436, pos: [200, 1.5, 2.0], look: [200, 1.5, 1], fov: 48 }, { f: 498, pos: [200, 1.5, 3.0], look: [200, 1.5, 1], fov: 50 }],
  s7: [{ f: 499, pos: [200, 1.5, 3.0], look: [200, 1.5, 1], fov: 50 }, { f: 546, pos: [200, 1.5, 3.0], look: [200, 1.5, 1], fov: 50 }],
  s8: [{ f: 547, pos: [299.2,0.9,0.9], look: [300,0.1,-0.1], fov: 44 }, { f: 615, pos: [299.7,0.6,0.55], look: [300,0.1,-0.1], fov: 40 }],
  s9: [{ f: 616, pos: [300.6,0.45,0.75], look: [300,0.1,-0.1], fov: 42 }, { f: 695, pos: [300.1,0.35,0.5], look: [299.9,0.1,-0.1], fov: 38 }],
  s10: [{ f: 696, pos: [200, 3.0, 6.0], look: [200, 1.5, 0], fov: 58 }, { f: 771, pos: [200, 1.5, 5.0], look: [200, 1.5, 0], fov: 54 }],
  s11: [{ f: 772, pos: [300,0.55,0.7], look: [300,0.1,-0.1], fov: 42, ease: 'anticip' }, { f: 796, pos: [300,0.35,0.35], look: [300,0.1,-0.1], fov: 36 }],
  s12: [{ f: 797, pos: [100, 1.5, 6.0], look: [100, 1.5, 0], fov: 54 }, { f: 857, pos: [102, 1.5, 6.0], look: [100, 1.5, 0], fov: 54 }],
  s13: [{ f: 858, pos: [201, 1.5, 3.0], look: [200, 1.5, 1], fov: 48 }, { f: 917, pos: [200.5, 1.5, 2.5], look: [200, 1.5, 1], fov: 45 }],
  s14: [{ f: 918, pos: [300,1.3,0.9], look: [300,0.1,-0.1], fov: 44 }, { f: 990, pos: [300.3,0.7,0.6], look: [300,0.1,-0.1], fov: 40 }],
  s15: [{ f: 991, pos: [0, 1.5, 3.0], look: [0, 1.5, -2], fov: 54 }, { f: 1082, pos: [0, 1.5, 6.0], look: [0, 1.5, -2], fov: 58 }]
};

export const camAt = (f) => {
  const S = shotAt(f), c = camFromKeys(CAMS[S.id], f, { creep: 0.001 });
  c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const wides = ['s2', 's3', 's10', 's12', 's15'];
  const cinf = wides.includes(S.id) ? 0 : 10;
  return { focus: dist(C.pos, C.look), cinf, near: 1 };
};

export const worldAt = (f) => {
  const S = shotAt(f);
  return { place: S.place, id: S.id, f };
};

const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T[who] ? T[who](p, o) : T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  
  if (S.id === 's1') {
    out.push(R(T, 'bombSuit', { seed: 1, expr: 'neutral', blink: blinkAt(f, 1), L: 'hang', R: 'hang', ...idle(f, 1) }, [0, 0, -1.5]));
  }
  if (S.id === 's2') {
    out.push(R(T, 'bombSuit', { seed: 1, expr: 'proud', blink: blinkAt(f, 1), L: 'hip', R: 'hip', ...idle(f, 1) }, [100, 0, 0]));
  }
  if (S.id === 's3') {
    out.push(R(T, 'bombSuit', { seed: 1, expr: 'determined', facing: 1, blink: blinkAt(f, 1), L: 'hang', R: 'hang', ...idle(f, 1) }, [100, 0, 0]));
    out.push(R(T, 'policeChief', { seed: 2, expr: 'stern', facing: -1, blink: blinkAt(f, 2), L: 'point', R: 'hang', ...idle(f, 2) }, [98, 0, 0]));
  }
  if (S.id === 's6') {
    out.push(R(T, 'bombSuit', { seed: 1, expr: 'nervous+sweat', blink: blinkAt(f, 1), L: 'temple', R: 'hang', ...idle(f, 1) }, [200, 0, 1]));
  }
  if (S.id === 's7') {
    out.push(R(T, 'bombSuit', { seed: 1, expr: 'determined', blink: blinkAt(f, 1), L: 'temple', R: 'hang', ...idle(f, 1) }, [200, 0, 1]));
  }
  if (S.id === 's10') {
    out.push(R(T, 'bombSuit', { seed: 1, expr: 'nervous', facing: 1, blink: blinkAt(f, 1), L: 'reach', R: 'hang', ...idle(f, 1) }, [200, 0, 1]));
  }
  if (S.id === 's12') {
    out.push(R(T, 'policeChief', { seed: 2, expr: 'nervous+sweat', blink: blinkAt(f, 2), L: 'temple', R: 'hang', ...idle(f, 2) }, [100, 0, 0]));
    out.push({ key: 'crowd', draw: (p) => T.crowd(p, { n: 10, t: f/30, mode: 'stand' }), x: 100, y: 0, z: -5, s: 4.0, blob: false });
  }
  if (S.id === 's13') {
    out.push(R(T, 'bombSuit', { seed: 1, expr: 'shock+sparkle', facing: 1, blink: blinkAt(f, 1), L: 'point', R: 'hang', ...idle(f, 1) }, [200, 0, 1]));
  }
  if (S.id === 's15') {
    out.push(R(T, 'bombSuit', { seed: 1, expr: 'proud', blink: blinkAt(f, 1), L: 'hip', R: 'hip', ...idle(f, 1) }, [0, 0, -0.2]));
  }
  
  return out;
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 's1') out.push(FX('motes', (p) => T.fxMotes(p, (f%120)/120), [0, 1.5, -0.5], 2.0));
  if (S.id === 's4' || S.id === 's11') out.push(FX('glow', (p) => T.fxGlow(p, (f%60)/60, '#ff2222'), [S.id==='s4'?200:300, S.id==='s4'?1.2:0.1, S.id==='s4'?-1:-0.1], 1.0));
  if (S.id === 's14' && f >= 948 && f < 968) out.push(FX('sparks', (p) => T.fxSparkle(p, ((f-948)%20)/20, '#ffaa22'), [300, 0.05, 0], 1.0));
  if (S.id === 's15') out.push(FX('confetti', (p) => T.fxConfetti(p, (f%120)/120), [0, 2.0, -1], 3.0));
  return out;
};
export const LOOK = { sat: 1.00, vibr: 0.25, drift: 1, push: 1 };
