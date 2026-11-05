// "The Dancing Plague" — timed to voice.mp3 (28.9 s, 30 fps). Author's shot plan: scripts/tests/dance_plague.txt
import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, M as MO } from './motion.js';
export const FPS = 30, TOTAL = 866, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 31, light: 'dawn' }, { id: 'dance', a: 32, b: 140, light: 'day' }, { id: 'days', a: 141, b: 198, light: 'cycle' },
  { id: 'join', a: 199, b: 275, light: 'day' }, { id: 'four', a: 276, b: 326, light: 'golden' }, { id: 'nobody', a: 327, b: 356, light: 'indoor' },
  { id: 'cure', a: 357, b: 454, light: 'indoor' }, { id: 'stage', a: 455, b: 530, light: 'day' }, { id: 'worse', a: 531, b: 586, light: 'dusk' },
  { id: 'feet', a: 587, b: 644, light: 'dusk' }, { id: 'collapse', a: 645, b: 710, light: 'night' }, { id: 'stop', a: 711, b: 760, light: 'dawn' },
  { id: 'quiet', a: 761, b: 808, light: 'dawn' }, { id: 'end', a: 809, b: 865, light: 'golden' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;
const base = { waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff', shadowExt: 26 };
export const LIGHTS = {
  dawn: { ...base, az: 90, el: 8, sky: '#cdb8c8', ground: '#8a7a70', hemi: 0.95, sun: '#ffb89a', sunI: 2.3, fog: '#ead0c4', fogNear: 30, fogFar: 260, skyTop: '#7a84c0', skyHor: '#f8c8b4', sunDisc: '#fff0d0', sunSize: 0.003, sat: 1.05, vig: 0.3 },
  day: { ...base, az: 130, el: 52, sky: '#bcd6f0', ground: '#8a7a62', hemi: 1.15, sun: '#fff3dc', sunI: 2.6, fog: '#dfe6ee', fogNear: 60, fogFar: 520, skyTop: '#3f86d8', skyHor: '#d6e6f0', sat: 1.12, vig: 0.2 },
  golden: { ...base, az: 25, el: 12, sky: '#d9a888', ground: '#8a5c3a', hemi: 1.0, sun: '#ffb050', sunI: 3.0, fog: '#f0b480', fogNear: 40, fogFar: 420, skyTop: '#7c6ab0', skyHor: '#ffb46a', sunDisc: '#fff0c8', sunSize: 0.004, sat: 1.15, gain: '#fff0dc', vig: 0.28 },
  dusk: { ...base, az: 15, el: 5, sky: '#b88890', ground: '#6a4a48', hemi: 0.85, sun: '#ff7a50', sunI: 2.6, fog: '#d88a78', fogNear: 30, fogFar: 300, skyTop: '#4a4a98', skyHor: '#ff8a64', sunDisc: '#ffd0a0', sunSize: 0.004, sat: 1.15, gain: '#ffe6d6', vig: 0.34 },
  night: { ...base, az: 200, el: 38, sky: '#5a6aa8', ground: '#2a3050', hemi: 0.75, sun: '#a8bcff', sunI: 1.5, fog: '#2a3258', fogNear: 20, fogFar: 240, skyTop: '#0e1438', skyHor: '#2a3a78', sunDisc: '#e8eeff', sunSize: 0.004, sat: 1.0, gain: '#d6defa', vig: 0.4 },
  indoor: { ...base, az: 60, el: 30, sky: '#d8b890', ground: '#6a4a30', hemi: 0.95, sun: '#ffcc88', sunI: 1.8, fog: '#3a2a20', fogNear: 18, fogFar: 90, skyTop: '#3a2a20', skyHor: '#3a2a20', sat: 1.08, gain: '#ffe8cc', vig: 0.42 },
};
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mixHex = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(lerp(v, hex(b)[i], t)).toString(16).padStart(2, '0')).join('');
const blend = (A, B, t) => { const o = {}; for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' ? lerp(A[k], B[k] ?? A[k], t) : (typeof A[k] === 'string' && A[k][0] === '#' && B[k]) ? mixHex(A[k], B[k], t) : A[k]; return o; };
export const lightFor = (S, f) => {
  if (S.light !== 'cycle') return { ...LIGHTS[S.light] };
  const u = ((f - 141) / 58) * 3, seq = ['dawn', 'day', 'dusk', 'night'], i = Math.floor(u * 4 / 1) % 4, t = (u * 4) % 1;
  return blend(LIGHTS[seq[i]], LIGHTS[seq[(i + 1) % 4]], MO.smooth(t));
};

// ---------- cameras (portrait: ~5 m wide at 10 m with fov 50) ----------
const CAMS = {
  hook: [{ f: 0, pos: [0.3, 0.3, 1.8], look: [0, 0.3, 0], fov: 38 }, { f: 10, pos: [0.3, 0.32, 1.8], look: [0, 0.35, 0], fov: 37 }, { f: 31, pos: [0.4, 1.35, 2.2], look: [0, 1.45, 0], fov: 30 }],
  dance: [{ f: 32, pos: [0.4, 1.5, 3.4], look: [0, 1.3, 0], fov: 32 }, { f: 100, pos: [0.8, 2.4, 9.5], look: [0, 1.4, 0], fov: 46 }, { f: 140, pos: [-0.4, 2.4, 9.0], look: [0, 1.4, 0], fov: 44 }],
  days: [{ f: 141, pos: [0, 2.2, 9], look: [0, 1.4, 0], fov: 44 }, { f: 198, pos: [0, 2.2, 8.6], look: [0, 1.4, 0], fov: 43 }],
  join: [{ f: 199, pos: [6, 7, 9], look: [0, 1.0, -3], fov: 52, path: [[8, 8, 3]] }, { f: 275, pos: [-6, 7, 8], look: [0, 1.0, -3], fov: 52 }],
  four: [{ f: 276, pos: [0, 9, 8], look: [0, 0.5, -8], fov: 40 }, { f: 326, pos: [0, 19, 10], look: [0, 0, -9], fov: 56 }],
  nobody: [{ f: 327, pos: [118.6, 1.6, 5.6], look: [119.9, 1.6, 4.4], fov: 32 }, { f: 356, pos: [118.8, 1.6, 5.4], look: [119.9, 1.6, 4.4], fov: 29 }],
  cure: [{ f: 357, pos: [112, 2.4, 14], look: [112, 1.5, 4], fov: 52 }, { f: 432, pos: [112.4, 2.3, 13], look: [112, 1.5, 4], fov: 50 }, { f: 440, pos: [111.8, 1.9, 7.2], look: [111.8, 1.7, 4], fov: 30, ease: 'easeOut' }, { f: 454, pos: [111.8, 1.9, 6.9], look: [111.8, 1.7, 4], fov: 27 }],
  stage: [{ f: 455, pos: [0, 3, 14], look: [0, 1.5, -8], fov: 54 }, { f: 530, pos: [0, 3.2, 11], look: [0, 1.8, -8], fov: 52 }],
  worse: [{ f: 531, pos: [0, 2.8, 11], look: [0, 1.5, -8], fov: 52 }, { f: 586, pos: [0, 2.6, 9.5], look: [0, 1.5, -8], fov: 50 }],
  feet: [{ f: 587, pos: [-2.6, 0.3, 3.0], look: [-1.2, 0.2, 0], fov: 40 }, { f: 644, pos: [2.6, 0.3, 3.0], look: [1.2, 0.2, 0], fov: 40 }],
  collapse: [{ f: 645, pos: [0, 2.6, 10], look: [0, 1.0, -6], fov: 54 }, { f: 710, pos: [0, 2.4, 8.5], look: [0, 0.9, -6], fov: 50 }],
  stop: [{ f: 711, pos: [0.4, 2.2, -6.2], look: [0.2, 2.0, -9], fov: 36 }, { f: 760, pos: [0.3, 2.1, -6.8], look: [0.2, 2.0, -9], fov: 26 }],
  quiet: [{ f: 761, pos: [0, 1.4, 5], look: [0, 0.8, -2], fov: 36 }, { f: 808, pos: [0, 3.2, 12], look: [0, 0.8, -4], fov: 52 }],
  end: [{ f: 809, pos: [0.4, 1.7, 6.5], look: [0.1, 1.6, -1], fov: 54 }, { f: 865, pos: [0.2, 0.9, 3.4], look: [0, 0.9, -1], fov: 44 }],
};
const KICKS = []; for (let f = 531; f < 586; f += 6) KICKS.push({ f, a: 0.012 + (f - 531) * 0.0008 });
export const camAt = (f) => {
  const S = shotAt(f), c = camFromKeys(CAMS[S.id], f, { creep: 0.0006, kicks: S.id === 'worse' ? KICKS : [] });
  c.flash = f >= 357 && f < 360 ? 0.3 : f >= 276 && f < 279 ? 0.4 : 0; c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => { const S = shotAt(f), C = camAt(f); return { focus: dist(C.pos, C.look), cinf: { hook: 11, nobody: 8, stop: 10, end: 8, feet: 7 }[S.id] ?? 0, near: 1 }; };

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f), W = { inside: S.id === 'nobody' || S.id === 'cure', stage: f < 455 ? 0 : f < 530 ? ramp(f, 455, 505) : 1, shoe: f >= 761 };
  W.mist = S.id === 'hook' || S.id === 'quiet' || S.id === 'stop';
  return W;
};

// ---------- actors ----------
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const C = (T, o, pos, s = 2.4, extra = {}) => ({ key: 'crowd' + JSON.stringify(o), draw: (p) => T.crowd(p, o), x: pos[0], y: pos[1], z: pos[2], s, blob: false, ...extra });
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
const danceOpts = (f, seed, speed = 1, o = {}) => { const ph = ((f / 30) * 1.4 * speed + seed * 0.3) % 1, up = Math.sin(ph * 6.2832) > 0; return { L: up ? 'up' : 'hang', R: up ? 'hang' : 'wave', wv: q(ph * 12, 1), tilt: q(8 * Math.sin(ph * 6.2832), 1), headTilt: q(6 * Math.cos(ph * 6.2832), 1), step: q(ph, 2), bob: q(0.012 * Math.sin(ph * 12.566), 3), ...o }; };
export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [], tint = S.light === 'golden' ? '#ffe2c8' : S.light === 'dusk' ? '#ffd8c8' : S.light === 'night' ? '#c0ccf0' : S.light === 'indoor' ? '#ffe6cc' : '#ffffff';
  const t = f / 30, ex = { tint };
  const crowdAt = (rows, cols, x0, dx, z0, dz, mode = 'dance', sp = 1, extra = {}) => { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(C(T, { n: 5, t: q(t, 1), seed: r * 7 + c, mode, speed: sp, ...extra }, [x0 + c * dx + (r % 2) * 0.9, 0, z0 - r * dz], 2.4, ex)); };
  switch (S.id) {
    case 'hook': out.push(R(T, 'troffea', { seed: 11, expr: 'neutral', blink: blinkAt(f, 11), L: 'hang', R: 'hang', ...idle(f, 1) }, [0, 0, 0], ex)); break;
    case 'dance': {
      out.push(R(T, 'troffea', { seed: 11, expr: f > 90 ? 'tired' : 'grin', blink: blinkAt(f, 11), ...danceOpts(f, 1, 1.1, { expr: 'grin' }) }, [0, 0, 0], ex));
      [[-3.2, -3], [3.4, -4], [-2.4, -9], [2.8, -10]].forEach(([x, z], i) => out.push(R(T, ['peasA', 'peasC', 'peasD', 'peasE'][i], { seed: 20 + i, expr: 'shock', blink: blinkAt(f, 20 + i), L: 'hang', R: 'hang', facing: x < 0 ? 1 : -1, ...idle(f, i) }, [x, 0, z], ex)));
      break; }
    case 'days': out.push(R(T, 'troffea', { seed: 11, expr: 'tired', ...danceOpts(f, 1, 1.1, { expr: 'tired' }) }, [0, 0, 0], ex)); break;
    case 'join': crowdAt(5, 4, -5.2, 3.0, 0.5, 1.6); out.push(R(T, 'troffea', { seed: 11, ...danceOpts(f, 1, 1.2, { expr: 'grin' }) }, [0, 0, 0], ex)); break;
    case 'four': { const k = ramp(f, 276, 326); crowdAt(9, 5, -7.5, 3.4, 4, 1.7, 'dance', 1.3); break; }
    case 'nobody': out.push(R(T, 'councilman', { seed: 41, expr: 'nervous', blink: blinkAt(f, 41), L: 'hang', R: 'cheek', headTilt: q(5 * Math.sin(f * 0.15), 1), ...idle(f, 3) }, [120.0, 0, 4.4], { tint, flip: false }));
      out.push(FX('sweat' + (f % 3), (p) => T.fxDrip(p), [119.75, 1.95 - (f % 20) * 0.01, 4.5], 0.18)); break;
    case 'cure': {
      const bang = f >= 436 && f < 446;
      out.push(R(T, 'councilman', { seed: 41, expr: f >= 428 ? 'proud' : 'stern', blink: f >= 428 ? 0 : blinkAt(f, 41), L: bang ? 'up' : 'hang', R: bang ? 'up' : 'hang', ...idle(f, 3) }, [111.8, 0, 4.0], { tint }));
      out.push(R(T, 'council2', { seed: 42, expr: 'stern', blink: blinkAt(f, 42), L: 'hang', R: 'hang', facing: 1, ...idle(f, 4) }, [109.8, 0, 4.1], { tint }));
      out.push(R(T, 'council2', { seed: 43, expr: 'neutral', blink: blinkAt(f, 43), L: 'hang', R: 'hang', facing: -1, ...idle(f, 5), headTilt: q(5 * Math.sin(f * 0.1), 1) }, [113.9, 0, 4.1], { tint }));
      break; }
    case 'stage': {
      crowdAt(3, 4, -5.5, 3.2, -1, 2.2, 'dance', 1.2);
      const st = ramp(f, 455, 505);
      for (let i = 0; i < 2; i++) out.push(R(T, 'carpenter', { seed: 51 + i, expr: 'neutral', L: 'up', R: 'hang', facing: i ? -1 : 1, ...idle(f, 6 + i), tilt: q(4 * Math.sin(f * 0.6 + i), 1) }, [-3.8 + i * 7.6, 0, -9.8], ex));
      if (f >= 500) for (let i = 0; i < 3; i++) { const rise = ramp(f, 500 + i * 6, 515 + i * 6); out.push(R(T, i === 1 ? 'musician2' : 'musician', { seed: 61 + i, expr: 'grin', L: 'up', R: 'wave', wv: q(f * 0.5, 1), ...idle(f, 8 + i) }, [-1.4 + i * 1.4, 0.3 + 1.2 * 0 + lerp(-3, 0, MO.back(rise)) * 0.0, -9.4 - 0.1 * i], { tint, y: 1.2 })); }
      break; }
    case 'worse': { const sp = 1.4 + ramp(f, 531, 586) * 1.4; crowdAt(3, 4, -5.5, 3.2, -1, 2.2, 'dance', sp, { expr: 'scared' }); crowdAt(1, 4, -5, 3.2, 8, 0, 'fall', sp, { fall: q(ramp(f, 540, 586), 2), expr: 'scared' });
      for (let i = 0; i < 3; i++) out.push(R(T, i === 1 ? 'musician2' : 'musician', { seed: 61 + i, expr: 'tired', L: 'up', R: 'wave', wv: q(f * 0.8, 1), ...idle(f, 8 + i) }, [-1.4 + i * 1.4, 1.2, -9.4], { tint })); break; }
    case 'feet': for (let i = 0; i < 3; i++) out.push(R(T, ['peasA', 'peasC', 'peasD'][i], { seed: 70 + i, expr: 'pained', ...danceOpts(f, i, 2.4, { expr: 'pained' }) }, [-1.2 + i * 1.2 + Math.sin(f * 0.1) * 0.0, 0, -0.5 - i * 0.6], ex)); break;
    case 'collapse': { const k = ramp(f, 645, 705); crowdAt(3, 4, -5.5, 3.2, -1, 2.2, 'fall', 1.2, { fall: q(k, 2), expr: 'scared' }); break; }
    case 'stop': out.push(R(T, 'musician', { seed: 61, expr: 'tired', L: f < 725 ? 'up' : 'hang', R: 'hang', ...idle(f, 8), headTilt: q(f > 730 ? 10 : 0, 1) }, [0.2, 1.2, -9.4], ex)); out.push(R(T, 'musician2', { seed: 62, expr: 'tired', L: 'hang', R: 'hang', ...idle(f, 9) }, [-1.2, 1.2, -9.2], ex)); break;
    case 'quiet': {
      crowdAt(1, 3, -3.5, 3.2, -2, 0, 'sit', 1); crowdAt(1, 2, -2.5, 4.5, -5, 0, 'fall', 1, { fall: 1 });
      [[3.2, -3.2, 1], [-3.4, -5.0, -1], [4.2, -7.2, 1]].forEach(([x, z, fc], i) => out.push(R(T, ['peasB', 'walker', 'walkerB'][i], { seed: 80 + i, expr: 'tired', L: 'hang', R: 'hang', facing: fc, step: q((f / 30 * 0.8 + i * 0.3) % 1, 2) }, [x + fc * (f - 761) * 0.01, 0, z], ex)));
      break; }
    case 'end': break;
  }
  return out;
};
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'feet') for (let i = 0; i < 4; i++) { const k = q(((f - 587) / 12 + i * 0.25) % 1, 2); out.push(FX('bl' + k, (p) => T.fxBlood(p, k), [-0.8 + i * 0.6, 0.1, -0.2], 0.5)); }
  if (S.id === 'end') { const t = q(ramp(f, 815, 860), 2); out.push(FX('qm' + t, (p) => T.fxQuestion(p, t), [0.2, 3.4, -3], 3.2, { alpha: 0.95 })); }
  if (S.id === 'dance' || S.id === 'join') for (let i = 0; i < 3; i++) { const t = ((f * 0.02 + i / 3) % 1); out.push(FX('dust' + q(t, 1), (p) => T.fxDust(p, q(t, 1), '#e8dcc4'), [-0.5 + Math.sin(i * 2.3) * 1.2, 0.3, 0.2 + (i % 3) * 0.3], 0.3)); }
  return out;
};
