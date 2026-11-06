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
  { id: 's10', a: 696, b: 771, light: 'indoor', place: 'CIRCUIT-VIEW' },
  { id: 's11', a: 772, b: 796, light: 'indoor', place: 'BOMB-ROOM' },
  { id: 's12', a: 797, b: 857, light: 'indoor', place: 'CONTROL-ROOM' },
  { id: 's13', a: 858, b: 917, light: 'indoor', place: 'BOMB-ROOM' },
  { id: 's14', a: 918, b: 990, light: 'indoor', place: 'BOMB-ROOM' },
  { id: 's15', a: 991, b: 1082, light: 'indoor', place: 'CONTROL-ROOM' }
];

export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;

export const LIGHTS = {
  indoor: { az: 45, el: 45, sky: '#ffffff', ground: '#aaaaaa', hemi: 0.8, sun: '#ffffff', sunI: 1.0, fog: '#222222', fogNear: 10, fogFar: 50, sat: 1.0, vig: 0.3, shadowExt: 10 },
  day: { az: 130, el: 55, sky: '#bcd6f0', ground: '#b88a58', hemi: 1.15, sun: '#fff3dc', sunI: 2.6, fog: '#e8d9c0', fogNear: 90, fogFar: 700, skyTop: '#3f86d8', skyHor: '#d6e6f0', sat: 1.12, vig: 0.2, shadowExt: 26 }
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

const CAMS = {
  s1: [{ f: 0, pos: [0, 1.5, -0.2], look: [0, 1.5, -2], fov: 30 }, { f: 42, pos: [0, 1.5, -0.5], look: [0, 1.5, -2], fov: 30 }],
  s2: [{ f: 43, pos: [0, 1.5, 4], look: [0, 1.5, -2], fov: 45 }, { f: 143, pos: [0, 1.5, 3], look: [0, 1.5, -2], fov: 45 }],
  s3: [{ f: 144, pos: [0, 2, 10], look: [0, 1.5, -2], fov: 55 }, { f: 249, pos: [0, 5, 12], look: [0, 1.5, -2], fov: 55 }],
  s4: [{ f: 250, pos: [0.4, 1.1, -1.2], look: [0, 0.95, -1.92], fov: 35 }, { f: 338, pos: [0.3, 1.05, -1.4], look: [0, 0.95, -1.92], fov: 35 }],
  s5: [{ f: 339, pos: [0, 0.7, 0.01], look: [0, 0.15, 0], fov: 30 }, { f: 435, pos: [0, 0.6, 0.01], look: [0, 0.15, 0], fov: 30 }],
  s6: [{ f: 436, pos: [0, 1.0, -1.0], look: [0, 1.4, -3], fov: 40 }, { f: 498, pos: [0, 1.0, -1.0], look: [0, 1.4, -3], fov: 40 }],
  s7: [{ f: 499, pos: [0.8, 1.2, -1.2], look: [0, 1.0, -2.5], fov: 45 }, { f: 546, pos: [0.6, 1.2, -1.2], look: [0, 1.0, -2.5], fov: 45 }],
  s8: [{ f: 547, pos: [0, 0.6, 0.01], look: [0, 0.15, 0], fov: 35 }, { f: 615, pos: [0, 0.5, 0.01], look: [0, 0.15, 0], fov: 35 }],
  s9: [{ f: 616, pos: [0.1, 0.4, 0.15], look: [0, 0.17, -0.15], fov: 30 }, { f: 695, pos: [0.1, 0.4, -0.15], look: [0, 0.17, 0.15], fov: 30 }],
  s10: [{ f: 696, pos: [0.2, 0.3, 0], look: [0, 0.17, 0], fov: 25 }, { f: 771, pos: [0.2, 0.3, 0], look: [0, 0.17, 0], fov: 25 }],
  s11: [{ f: 772, pos: [0, 0.96, -1.4], look: [0, 0.95, -1.92], fov: 25, ease: 'easeOut' }, { f: 796, pos: [0, 0.96, -1.6], look: [0, 0.95, -1.92], fov: 15 }],
  s12: [{ f: 797, pos: [0, 1.5, 3], look: [0, 1.5, -3], fov: 45 }, { f: 857, pos: [0, 1.5, 2], look: [0, 1.5, -3], fov: 45 }],
  s13: [{ f: 858, pos: [0, 1.5, -2.5], look: [0, 1.5, -3], fov: 20 }, { f: 917, pos: [0, 1.5, -2.6], look: [0, 1.5, -3], fov: 20 }],
  s14: [{ f: 918, pos: [0, 1.4, 1.5], look: [0, 1.0, -2.5], fov: 40 }, { f: 990, pos: [0, 1.5, 2.5], look: [0, 1.0, -2.5], fov: 40 }],
  s15: [{ f: 991, pos: [1, 1.5, 3], look: [1, 1.5, -3], fov: 45 }, { f: 1082, pos: [1, 1.5, 2], look: [1, 1.5, -3], fov: 45 }]
};

export const camAt = (f) => {
  const S = shotAt(f), c = camFromKeys(CAMS[S.id], f, { creep: 0.001 });
  c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};

export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const cinf = ['s1', 's4', 's5', 's6', 's8', 's9', 's10', 's11', 's13'].includes(S.id) ? 12 : 0;
  return { focus: Math.hypot(C.pos[0]-C.look[0], C.pos[1]-C.look[1], C.pos[2]-C.look[2]), cinf, near: 1 };
};

export const worldAt = (f) => {
  const S = shotAt(f);
  return { place: S.place };
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const R = (who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
  const BOMB_SUIT = (o, pos, extra = {}) => ({ key: 'bombsuit' + JSON.stringify(o), draw: (p) => T.arthurBombSuit(p, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
  const TECH = (o, pos, extra = {}) => ({ key: 'tech' + JSON.stringify(o), draw: (p) => T.techWithHeadset(p, o), x: pos[0], y: pos[1], z: pos[2], ...extra });

  if (S.id === 's1') {
    out.push(R('arthur', { expr: 'neutral', L: 'hang', R: 'hang', facing: 1, ...idle(f, 1) }, [0, 0, -2]));
  } else if (S.id === 's2') {
    out.push(BOMB_SUIT({ expr: 'stern', L: 'hang', R: 'hang', facing: 1, ...idle(f, 1) }, [0, 0, -2]));
    out.push(R('police', { expr: 'stern', L: 'hang', R: 'hang', facing: -1, ...idle(f, 2) }, [2, 0, -2]));
  } else if (S.id === 's3') {
    out.push(BOMB_SUIT({ expr: 'stern', L: 'hang', R: 'hang', facing: 1, ...idle(f, 1) }, [0, 0, -2]));
    out.push(R('police', { expr: 'stern', L: 'point', R: 'hang', facing: 1, ...idle(f, 2) }, [-2, 0, -2]));
    out.push({ key: 'crowd', draw: (p) => T.crowd(p, {n:12, mode:'stand', t: f/30}), x: 0, y: 0, z: -12, s: 2.0 });
  } else if (S.id === 's4') {
    out.push(BOMB_SUIT({ expr: 'nervous', L: 'hang', R: 'hang', facing: -1, ...idle(f, 1) }, [0.8, 0, -2.5]));
  } else if (S.id === 's6') {
    out.push(BOMB_SUIT({ expr: 'nervous', L: 'temple', R: 'hang', facing: 1, headTilt: 10, ...idle(f, 1) }, [0, 0, -3]));
  } else if (S.id === 's7') {
    out.push(BOMB_SUIT({ expr: 'stern', L: 'temple', R: 'hang', facing: 1, headTilt: 10, ...idle(f, 1) }, [0, 0, -3]));
  } else if (S.id === 's12') {
    out.push(R('commander', { expr: 'stern', L: 'cross', R: 'cross', facing: 1, ...idle(f, 1) }, [0, 0, -3]));
    out.push(R('police', { expr: 'nervous', L: 'hang', R: 'hang', facing: 1, ...idle(f, 2) }, [-2, 0, -3]));
    out.push(TECH({ expr: 'nervous', L: 'temple', R: 'hang', facing: 1, ...idle(f, 3) }, [2, 0, -3]));
  } else if (S.id === 's13') {
    out.push(BOMB_SUIT({ expr: 'squint', L: 'temple', R: 'hang', facing: 1, headTilt: 10, ...idle(f, 1) }, [0, 0, -3]));
  } else if (S.id === 's14') {
    out.push(BOMB_SUIT({ expr: 'relief', L: 'up', R: 'up', facing: 1, ...idle(f, 1) }, [0, 0, -3]));
  } else if (S.id === 's15') {
    out.push(R('arthur', { expr: 'proud', L: 'hang', R: 'hang', facing: 1, ...idle(f, 1) }, [0, 0, -3]));
    out.push(R('commander', { expr: 'relief', L: 'hang', R: 'hang', facing: -1, ...idle(f, 2) }, [2, 0, -3]));
  }
  return out;
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
  if (S.id === 's8') {
    out.push(FX('trace', (p) => T.fxWireTrace(p, (f%60)/60), [0, 0.18, 0], 1.0));
  }
  if (S.id === 's9') {
    out.push(FX('trace', (p) => T.fxWireTrace(p, (f%30)/30), [0, 0.18, 0], 1.0));
  }
  return out;
};
export const LOOK = { sat: 1.42, vibr: 0.25, drift: 1, push: 1 };
