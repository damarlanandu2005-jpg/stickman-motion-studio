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

// ---- light: one recipe per place (bright, with colour) ----
const mixHex = (a, b, t) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
export const LIGHTS = {
  indoor: { az: 45, el: 45, sky: '#ffffff', ground: '#bbbbbb', hemi: 1.2, sun: '#ffffff', sunI: 1.2, fog: '#6a7690', fogNear: 14, fogFar: 70, skyTop: '#6a7690', skyHor: '#6a7690', sat: 1.0, vig: 0.25, shadowExt: 10 },
  day: { az: 130, el: 55, sky: '#cfe3ff', ground: '#c9a070', hemi: 1.3, sun: '#fff1d2', sunI: 2.6, fog: '#e6d8c0', fogNear: 60, fogFar: 600, skyTop: '#3d86e0', skyHor: '#e0ecf6', sat: 1.12, vig: 0.2, shadowExt: 26 },
  police: { az: 50, el: 50, sky: '#fff3dc', ground: '#cfa878', hemi: 1.4, sun: '#fff0cc', sunI: 1.1, fog: '#c9b08a', fogNear: 14, fogFar: 70, skyTop: '#c9b08a', skyHor: '#c9b08a', sat: 1.0, vig: 0.28, shadowExt: 10 },
  bomb: { az: 60, el: 60, sky: '#f4f8ff', ground: '#d4dae8', hemi: 1.9, sun: '#fff0d8', sunI: 1.7, fog: '#9aa8c8', fogNear: 14, fogFar: 70, skyTop: '#9aa8c8', skyHor: '#9aa8c8', sat: 1.0, vig: 0.22, shadowExt: 10 },
  circuit: { az: 40, el: 65, sky: '#f2fff6', ground: '#8cc4a4', hemi: 1.9, sun: '#ffffff', sunI: 1.2, fog: '#3f7a62', fogNear: 10, fogFar: 40, skyTop: '#3f7a62', skyHor: '#3f7a62', sat: 1.0, vig: 0.24, shadowExt: 4 },
  control: { az: 70, el: 55, sky: '#e9f1ff', ground: '#9ab0d8', hemi: 1.4, sun: '#f4f8ff', sunI: 1.1, fog: '#4a6a9a', fogNear: 16, fogFar: 80, skyTop: '#4a6a9a', skyHor: '#4a6a9a', sat: 1.05, vig: 0.28, shadowExt: 12 }
};
const KEY = { 'POLICE-OFFICE': 'police', 'CITY-STREET': 'day', 'BOMB-ROOM': 'bomb', 'CIRCUIT-VIEW': 'circuit', 'CONTROL-ROOM': 'control' };
export const lightFor = (S, f) => {
  const L = { ...LIGHTS[KEY[S.place]] || LIGHTS[S.light] };
  const red = { s4: [0.1, 0.2], s10: [0.25, 0.3], s11: [0.35, 0.9], s6: [0.06, 0.15], s7: [0.06, 0.15] }[S.id];
  if (red) { const k = red[0] * (0.5 + 0.5 * Math.sin(f * red[1] * 2)); L.sky = mixHex(L.sky, '#ff5040', k); L.ground = mixHex(L.ground, '#ff3a30', k); }
  if (S.id === 's14' && f < 940) { const k = 0.25 * (1 - (f - 918) / 22); L.sky = mixHex(L.sky, '#ff5040', Math.max(0, k)); }
  return L;
};

// ---- camera: every shot is cut into short segments (new angle, still moving) ----
const sg = (a, b, p0, l0, f0, p1, l1, f1, ease = 'smooth') => [{ f: a, pos: p0, look: l0, fov: f0 }, { f: b, pos: p1, look: l1, fov: f1, ease }];
const CAMS = {
  s1: [sg(0, 20, [0, 1.5, 0.5], [0, 1.45, -2], 36, [0, 1.5, 0.2], [0, 1.45, -2], 36), sg(21, 42, [0, 1.55, 0.0], [0, 1.5, -2], 30, [0, 1.55, -0.4], [0, 1.5, -2], 30)],
  s2: [sg(43, 80, [0.5, 1.5, 3.4], [0.5, 1.5, -2], 40, [0.4, 1.5, 2.8], [0.5, 1.5, -2], 40),
       sg(81, 112, [3.4, 1.3, 0.8], [-0.5, 1.45, -2.2], 46, [2.8, 1.35, 0.5], [-0.5, 1.45, -2.2], 46),
       sg(113, 143, [0.3, 1.62, 0.2], [0, 1.58, -2], 28, [0.15, 1.62, -0.1], [0, 1.58, -2], 28)],
  s3: [sg(144, 185, [1.5, 0.9, 10], [0, 1.6, -8], 52, [1.2, 1.2, 9], [0, 1.6, -8], 52),
       sg(186, 217, [-1, 1.8, 9.5], [0, 1.2, -7], 56, [0.5, 15, 7.5], [0, 0.4, -10], 60),
       sg(218, 249, [-0.8, 1.5, 1.6], [-2, 1.5, -2], 36, [-0.9, 1.55, 1.2], [-2, 1.5, -2], 36)],
  s4: [sg(250, 285, [0.5, 1.2, -0.6], [0, 1.0, -1.85], 34, [0.4, 1.15, -0.7], [0, 1.0, -1.85], 34),
       sg(286, 315, [-1.4, 1.4, 0.6], [0.3, 1.1, -2.2], 42, [-1.1, 1.35, 0.3], [0.3, 1.1, -2.2], 42),
       sg(316, 338, [0.3, 1.15, -0.7], [0, 1.02, -1.85], 38, [0.15, 1.1, -0.75], [0, 1.02, -1.85], 34)],
  s5: [sg(339, 370, [0, 1.45, 0.04], [0, 0, 0], 38, [0, 1.25, 0.03], [0, 0, 0], 38),
       sg(371, 405, [0, 0.95, 0.1], [0, 0, 0.02], 34, [0, 0.85, 0.05], [0, 0, 0.02], 34),
       sg(406, 435, [0.05, 0.6, 0.28], [0, 0, 0.28], 34, [0.03, 0.5, 0.25], [0, 0, 0.28], 34)],
  s6: [sg(436, 466, [0.3, 1.4, -1.3], [0, 1.62, -3], 28, [0.2, 1.45, -1.5], [0, 1.62, -3], 28),
       sg(467, 498, [-0.45, 1.65, -1.1], [0.1, 1.55, -3], 30, [-0.3, 1.65, -1.3], [0.1, 1.55, -3], 30)],
  s7: [sg(499, 522, [0.9, 1.45, -0.9], [0, 1.3, -2.6], 40, [0.7, 1.45, -1.1], [0, 1.3, -2.6], 40),
       sg(523, 546, [-0.7, 1.4, -0.9], [0, 1.3, -2.6], 36, [-0.5, 1.4, -1.0], [0, 1.3, -2.6], 36)],
  s8: [sg(547, 580, [0, 1.3, 0.05], [0, 0, 0], 38, [0, 1.1, 0.05], [0, 0, 0], 38),
       sg(581, 615, [0.35, 0.6, 0.55], [0, 0.02, 0], 36, [0.25, 0.5, 0.4], [0, 0.02, 0], 36)],
  s9: [sg(616, 645, [0, 0.55, 0.35], [0, 0.02, 0.25], 32, [0, 0.5, 0.2], [0, 0.02, 0.1], 32),
       sg(646, 675, [0, 0.5, 0.1], [0, 0.02, 0], 32, [0, 0.5, -0.05], [0, 0.02, -0.1], 32),
       sg(676, 695, [0, 0.55, -0.1], [0, 0.02, -0.2], 32, [0, 0.5, -0.2], [0, 0.02, -0.25], 32)],
  s10: [sg(696, 722, [0, 0.9, 0.05], [0, 0, 0.02], 34, [0, 0.88, 0.05], [0, 0, 0.02], 34),
        sg(723, 748, [0.3, 0.35, 0.5], [0, 0.03, 0], 38, [0.2, 0.3, 0.3], [0, 0.03, 0], 38),
        sg(749, 771, [0, 0.7, -0.15], [0, 0, -0.25], 34, [0, 0.6, -0.18], [0, 0, -0.25], 34)],
  s11: [sg(772, 796, [0.12, 1.08, -0.8], [0, 1.0, -1.83], 36, [0.04, 1.04, -0.75], [0, 1.0, -1.83], 32, 'easeOut')],
  s12: [sg(797, 826, [0, 1.5, 4.5], [0, 1.3, -3], 44, [0, 1.5, 3.6], [0, 1.3, -3], 44),
        sg(827, 857, [0.3, 1.5, 2.5], [0, 1.45, -3], 36, [0.15, 1.5, 1.7], [0, 1.45, -3], 36)],
  s13: [sg(858, 887, [0, 1.52, -1.2], [0, 1.5, -3], 24, [0, 1.52, -1.45], [0, 1.5, -3], 24),
        sg(888, 917, [0.05, 1.5, -1.6], [0, 1.48, -3], 24, [0.03, 1.5, -1.8], [0, 1.48, -3], 21)],
  s14: [sg(918, 945, [0, 1.4, 0.2], [0.35, 1.05, -2.4], 40, [0, 1.4, 0.7], [0.35, 1.05, -2.4], 40),
        sg(946, 968, [0.35, 1.15, -0.7], [0, 1.0, -1.85], 34, [0.2, 1.1, -0.75], [0, 1.0, -1.85], 32),
        sg(969, 990, [0, 1.5, 1.6], [0.3, 1.0, -2.4], 44, [0, 1.6, 2.6], [0.3, 1.0, -2.4], 44)],
  s15: [sg(991, 1030, [0, 1.5, 2.5], [0, 1.4, -3], 40, [0, 1.5, 1.9], [0, 1.4, -3], 40),
        sg(1031, 1060, [-0.3, 1.5, 0.5], [-0.55, 1.5, -3], 32, [-0.4, 1.5, 0.2], [-0.55, 1.5, -3], 32),
        sg(1061, 1082, [0.1, 1.5, 2.2], [0.05, 1.4, -3], 40, [0.1, 1.5, 1.8], [0.05, 1.4, -3], 40)]
};

export const camAt = (f) => {
  const S = shotAt(f), segs = CAMS[S.id], seg = segs.find((s) => f >= s[0].f && f <= s[1].f) || segs[segs.length - 1];
  const c = camFromKeys(seg, f, { creep: 0.0004 });
  c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};

export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const cinf = ['s1', 's6', 's7', 's13'].includes(S.id) ? 8 : 0;
  return { focus: Math.hypot(C.pos[0] - C.look[0], C.pos[1] - C.look[1], C.pos[2] - C.look[2]), cinf, near: 1 };
};

export const worldAt = (f) => { const S = shotAt(f); return { place: S.place, id: S.id, a: S.a, b: S.b }; };

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const B = (who, k) => ({ blink: blinkAt(f, k), ...idle(f, k) });
  const R = (who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
  const BOMB_SUIT = (o, pos, extra = {}) => ({ key: 'bombsuit' + JSON.stringify(o), draw: (p) => T.arthurBombSuit(p, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
  const TECH = (o, pos, extra = {}) => ({ key: 'tech' + JSON.stringify(o), draw: (p) => T.techWithHeadset(p, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
  const id = S.id;
  if (id === 's1') out.push(R('arthur', { expr: 'neutral', L: 'hang', R: 'hang', facing: 1, ...B('a', 1) }, [0, 0, -2]));
  else if (id === 's2') {
    out.push(BOMB_SUIT({ expr: 'stern', L: 'hang', R: 'hang', facing: 1, ...B('a', 1) }, [0, 0, -2]));
    out.push(R('police', { expr: 'stern', L: 'hang', R: 'hang', facing: -1, ...B('p', 2) }, [1.4, 0, -2]));
  } else if (id === 's3') {
    out.push(BOMB_SUIT({ expr: 'stern', L: 'hang', R: 'hang', facing: 1, ...B('a', 1) }, [0, 0, -2]));
    out.push(R('police', { expr: 'stern', L: 'point', R: 'hang', facing: 1, ...B('p', 2) }, [-2, 0, -2]));
    for (const [k, z, n, sd, sc, dx] of [[0, -10.5, 14, 0, 3.6, -0.6], [1, -12.5, 16, 4, 4.4, 0.8], [2, -15, 16, 8, 5.2, -0.3]])
      out.push({ key: 'crowd' + k, draw: (p) => T.crowd(p, { n, mode: 'stand', t: 0, seed: sd, expr: 'nervous' }), x: dx, y: 0, z, s: sc });
  } else if (id === 's4') out.push(BOMB_SUIT({ expr: 'nervous+sweat', L: 'hang', R: 'hang', facing: -1, ...B('a', 1) }, [0.8, 0, -2.6]));
  else if (id === 's6') out.push(BOMB_SUIT({ expr: 'nervous+sweat', L: 'hang', R: 'hang', facing: 1, headTilt: 8, ...B('a', 1) }, [0, 0, -3]));
  else if (id === 's7') out.push(BOMB_SUIT({ expr: 'stern', L: 'temple', R: 'hang', facing: 1, headTilt: 8, ...B('a', 1) }, [0, 0, -3]));
  else if (id === 's11') out.push(BOMB_SUIT({ expr: 'nervous+sweat2', L: 'hang', R: 'hang', facing: 1, ...B('a', 1) }, [0.9, 0, -3.2]));
  else if (id === 's12') {
    out.push(R('commander', { expr: 'stern', L: 'cross', R: 'cross', facing: 1, ...B('c', 1) }, [0, 0, -3]));
    out.push(R('police', { expr: 'nervous+sweat2', L: 'hang', R: 'hang', facing: 1, ...B('p', 2) }, [-1.05, 0, -3]));
    out.push(TECH({ expr: 'nervous+sweat', L: 'temple', R: 'hang', facing: 1, ...B('t', 3) }, [1.05, 0, -3]));
  } else if (id === 's13') out.push(BOMB_SUIT({ expr: 'squint', L: 'temple', R: 'hang', facing: 1, headTilt: 8, ...B('a', 1) }, [0, 0, -3]));
  else if (id === 's14') out.push(BOMB_SUIT({ expr: 'relief+sparkle', L: 'up', R: 'up', facing: 1, ...B('a', 1) }, [0.8, 0, -2.6]));
  else if (id === 's15') {
    out.push(R('arthur', { expr: 'proud', L: 'hang', R: 'hang', facing: 1, ...B('a', 1) }, [-0.55, 0, -3]));
    out.push(R('commander', { expr: 'relief', L: 'hang', R: 'hang', facing: -1, ...B('c', 2) }, [0.65, 0, -3]));
  }
  return out;
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
  if (S.id === 's13') out.push(FX('glint' + (f >> 2), (p) => T.fxSparkle(p, ((f - S.a) % 40) / 40, '#ffffff'), [0.12, 1.85, -2.9], 0.6));
  if (S.id === 's14') out.push(FX('rel' + (f >> 2), (p) => T.fxSparkle(p, ((f - S.a) % 36) / 36, '#fff2a8'), [0.85, 1.9, -2.5], 0.9));
  if (S.id === 's3') out.push(FX('mote' + (f >> 1), (p) => T.fxMotes(p, ((f - S.a) % 90) / 90, '#fff6d8'), [0, 1.6, 6], 3.0, { alpha: 0.7 }));
  return out;
};
export const LOOK = { sat: 1.0, vibr: 0.35, drift: 1, push: 1 };
