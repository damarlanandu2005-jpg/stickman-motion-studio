// "The Great Molasses Flood" — timed to voice.mp3 (31.5 s, 30 fps). Author's shot plan: scripts/tests/molasses.txt
import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, M as MO } from './motion.js';
export const FPS = 30, TOTAL = 947, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 68, light: 'golden' }, { id: 'wave2', a: 69, b: 158, light: 'day' }, { id: 'tank', a: 159, b: 264, light: 'day' },
  { id: 'hood', a: 265, b: 327, light: 'day' }, { id: 'built', a: 328, b: 404, light: 'day' }, { id: 'groan', a: 405, b: 501, light: 'golden' },
  { id: 'rivets', a: 502, b: 555, light: 'golden' }, { id: 'burst', a: 556, b: 588, light: 'day' }, { id: 'wave9', a: 589, b: 721, light: 'day' },
  { id: 'flat', a: 722, b: 799, light: 'day' }, { id: 'clean', a: 800, b: 846, light: 'dawn' }, { id: 'smell', a: 847, b: 946, light: 'golden' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;
const base = { waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff', shadowExt: 30 };
export const LIGHTS = {
  day: { ...base, az: 120, el: 50, sky: '#bcd0e4', ground: '#8a7a68', hemi: 1.1, sun: '#fff1dc', sunI: 2.5, fog: '#d8dee6', fogNear: 70, fogFar: 520, skyTop: '#4a86cc', skyHor: '#d6e2ee', sat: 1.1, vig: 0.22 },
  golden: { ...base, az: 20, el: 13, sky: '#d9a888', ground: '#8a5c3a', hemi: 1.0, sun: '#ffb050', sunI: 3.0, fog: '#f0b484', fogNear: 40, fogFar: 380, skyTop: '#7c6ab0', skyHor: '#ffb46a', sunDisc: '#fff0c8', sunSize: 0.004, sat: 1.15, gain: '#fff0dc', vig: 0.28 },
  dawn: { ...base, az: 200, el: 7, sky: '#c8a8b8', ground: '#7a6a60', hemi: 0.95, sun: '#ff9a7a', sunI: 2.2, fog: '#e8b8aa', fogNear: 30, fogFar: 300, skyTop: '#6a74b8', skyHor: '#f4a8a0', sunDisc: '#ffe0b0', sunSize: 0.003, sat: 1.05, gain: '#f4e6ee', vig: 0.3 },
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// the flood (world x increases to the right of the street; the tank is at x = -34)
export const TANK = [-34, 0, -10];
const waveFront = (f) => lerp(-30, 40, MO.easeIn(ramp(f, 556, 640)) * 0.35 + ramp(f, 556, 720) * 0.65);
const CAMS = {
  hook: [{ f: 0, pos: [0.4, 1.7, 3.2], look: [0, 1.6, 0], fov: 30 }, { f: 68, pos: [0.3, 1.7, 2.8], look: [0, 1.5, 0], fov: 28 }],
  wave2: [{ f: 69, pos: [0.3, 1.7, 2.8], look: [0, 1.5, 0], fov: 28 }, { f: 120, pos: [4, 2.6, 11], look: [0, 1.5, 0], fov: 52 }, { f: 158, pos: [5, 3.0, 12.5], look: [0, 1.6, 0], fov: 54 }],
  tank: [{ f: 159, pos: [-26, 1.0, 6], look: [-33, 3.0, -9], fov: 56 }, { f: 264, pos: [-26, 1.0, 6], look: [-33, 13, -9], fov: 56 }],
  hood: [{ f: 265, pos: [-60, 26, 30], look: [-30, 5, -8], fov: 52 }, { f: 327, pos: [-4, 28, 30], look: [-26, 4, -8], fov: 52 }],
  built: [{ f: 328, pos: [-28.2, 2.0, 2.0], look: [-30, 1.8, -8.5], fov: 48 }, { f: 404, pos: [-28.2, 2.0, 1.4], look: [-30, 1.8, -8.5], fov: 46 }],
  groan: [{ f: 405, pos: [-26, 1.6, 8], look: [-27, 2.4, -2], fov: 48 }, { f: 501, pos: [-27, 2.6, 4], look: [-27, 3.4, -2], fov: 40 }],
  rivets: [{ f: 502, pos: [-34, 6.0, -1.8], look: [-34, 6.0, -10], fov: 34 }, { f: 555, pos: [-34, 6.0, -2.8], look: [-34, 6.0, -10], fov: 30 }],
  burst: [{ f: 556, pos: [-32, 3.5, -2], look: [-34, 5, -10], fov: 28 }, { f: 568, pos: [-27, 4.5, 12], look: [-34, 5, -10], fov: 56, ease: 'easeOut' }, { f: 588, pos: [-26, 4.8, 13], look: [-34, 5, -10], fov: 58 }],
  wave9: [{ f: 589, pos: [-14, 2.2, 6], look: [-26, 3.5, -2], fov: 56 }, { f: 721, pos: [34, 2.6, 6], look: [20, 3.5, -2], fov: 56 }],
  flat: [{ f: 722, pos: [30, 3.2, 14], look: [34, 3.5, -2], fov: 56 }, { f: 799, pos: [31, 3.4, 13], look: [36, 3.5, -2], fov: 54 }],
  clean: [{ f: 800, pos: [4, 2.8, 12], look: [2, 1.2, 0], fov: 54 }, { f: 846, pos: [6, 3.4, 15], look: [2, 1.4, 0], fov: 58 }],
  smell: [{ f: 847, pos: [4.4, 2.0, 9], look: [2, 1.5, 0], fov: 46 }, { f: 946, pos: [3.4, 1.8, 5.2], look: [2, 1.2, 0.6], fov: 32 }],
};
const KICKS = [{ f: 405 + 20, a: 0.015 }, { f: 405 + 45, a: 0.02 }, { f: 405 + 70, a: 0.025 }, { f: 504, a: 0.05 }, { f: 510, a: 0.05 }, { f: 517, a: 0.06 }, { f: 525, a: 0.05 }, { f: 534, a: 0.06 }, { f: 545, a: 0.05 }, { f: 556, a: 0.09 }, { f: 562, a: 0.07 }, { f: 570, a: 0.06 }, { f: 735, a: 0.05 }, { f: 752, a: 0.05 }];
export const camAt = (f) => {
  const S = shotAt(f), c = camFromKeys(CAMS[S.id], f, { creep: 0.0005, kicks: ['groan', 'rivets', 'burst', 'flat'].includes(S.id) ? KICKS : [] });
  c.flash = f >= 556 && f < 559 ? 0.9 * (1 - (f - 556) / 3) : 0; c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => { const S = shotAt(f), C = camAt(f); return { focus: dist(C.pos, C.look), cinf: { hook: 12, rivets: 9, smell: 7, built: 6 }[S.id] ?? 0, near: 1 }; };

export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { tank: f < 556 ? 'whole' : 'burst', bulge: S.id === 'groan' || S.id === 'rivets' ? ramp(f, 405, 555) : 0, burst: ramp(f, 556, 580), wave: f >= 556, waveX: waveFront(f), waveH: f < 556 ? 0 : MO.easeOut(ramp(f, 556, 600)) * 8,
    flood: f >= 556 ? ramp(f, 556, 760) : 0, train: f < 600 ? lerp(-60, 10, f / 600) : 10, flat: ramp(f, 722, 760), clean: ramp(f, 800, 846), rivets: S.id === 'rivets' ? (f - 502) : -1, plaque: S.id === 'smell' };
  W.thermo = 0; W.jar = 0;
  return W;
};

const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
const HC = (T, o, pos, extra = {}) => ({ key: 'horse' + JSON.stringify(o), draw: (p) => T.horseCart(p, o), x: pos[0], y: pos[1], z: pos[2], s: 2.0, ...extra });
export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [], tint = S.light === 'golden' ? '#ffe2c8' : S.light === 'dawn' ? '#f4dede' : '#ffffff', ex = { tint };
  const walk = (who, i, x0, z, speed, o = {}) => { const t = f / 30; const dir = speed > 0 ? 1 : -1; out.push(R(T, who, { seed: 5 + i * 3, expr: 'neutral', L: 'hang', R: 'hang', step: q((t * Math.abs(speed) * 0.9 + i * 0.3) % 1, 2), facing: dir, blink: blinkAt(f, 5 + i), ...o }, [x0 + t * speed, 0, z], ex)); };
  switch (S.id) {
    case 'hook': break;
    case 'wave2': for (let i = 0; i < 4; i++) walk(['walker', 'walkerB', 'worker1', 'walker'][i], i, -4 + i * 2.2, -0.5 - (i % 2) * 1.2, 0.9 * (i % 2 ? -1 : 1)); out.push(HC(T, { step: q((f / 30 * 0.8) % 1, 2) }, [-6 + (f - 69) * 0.03, 0, -2.4], ex)); break;
    case 'tank': for (let i = 0; i < 2; i++) out.push(R(T, i ? 'worker2' : 'worker1', { seed: 15 + i, expr: 'neutral', L: 'hang', R: 'hang', blink: blinkAt(f, 15 + i), ...idle(f, i) }, [-31.4 + i * 1.2, 0, -2 - i * 0.4], ex)); break;
    case 'hood': for (let i = 0; i < 7; i++) walk(['walker', 'walkerB', 'worker1', 'kid1', 'worker2'][i % 5], i, -44 + i * 7, 0.5 - (i % 3), 0.9 * (i % 2 ? -1 : 1), i % 5 === 3 ? {} : {}); break;
    case 'built': {
      for (let i = 0; i < 3; i++) out.push(R(T, i === 1 ? 'worker2' : 'worker1', { seed: 25 + i, expr: i === 1 ? 'grin' : 'neutral', L: 'up', R: i === 1 ? 'wave' : 'hang', wv: q(f * 0.4, 1), tilt: q(5 * Math.sin(f * 0.7 + i * 2), 1), ...idle(f, i + 3) }, [-30.8 + i * 1.3, 0, -3.6 - (i % 2) * 0.6], ex));
      if (f > 360) out.push(FX('leak' + (f % 4), (p) => T.fxDrip(p), [-29.3, 1.5 - (f % 20) * 0.04, -2.2], 0.16));
      for (let i = 0; i < 3; i++) { const t = q(((f - 328) / 10 + i / 3) % 1, 2); out.push(FX('spark' + t, (p) => T.fxBurst(p, t, '#ffe08a', 6, 20, 120), [-30.6 + i * 1.3, 2.0, -3.0], 0.4)); }
      break; }
    case 'groan': { const stop = f > 438;
      for (let i = 0; i < 3; i++) out.push(R(T, 'kid1', { seed: 35 + i, expr: stop ? 'shock' : 'grin', L: stop ? 'hang' : 'up', R: stop ? 'hang' : 'wave', wv: q(f * 0.4 + i, 1), step: stop ? 0 : q((f * 0.05 + i * 0.3) % 1, 2), facing: 0, look: stop ? 0.6 : 0, blink: stop ? 0 : blinkAt(f, 35 + i) }, [-26.6 + i * 0.9, 0, 0.5 - i * 0.5 - 0.0], { tint, s: 0.7 }));
      break; }
    case 'burst': for (let i = 0; i < 4; i++) out.push(R(T, ['walker', 'worker1', 'walkerB', 'kid1'][i], { seed: 45 + i, expr: 'scared', L: 'up', R: 'up', step: q((f * 0.12 + i * 0.25) % 1, 2), facing: 1 }, [-27 + i * 1.4 + (f - 556) * 0.2, 0, 6 - i * 0.8], ex)); break;
    case 'wave9': {
      const wx = waveFront(f);
      for (let i = 0; i < 5; i++) out.push(R(T, ['worker1', 'walker', 'walkerB', 'kid1', 'worker2'][i], { seed: 55 + i, expr: 'scared', L: 'up', R: 'up', step: q((f * 0.14 + i * 0.2) % 1, 2), facing: 1 }, [wx + 6 + i * 3.2 + (i % 2) * 1.0, 0, 1 - (i % 3) * 1.4], { tint, s: i === 3 ? 0.7 : 1 }));
      out.push(HC(T, { step: q((f * 0.14) % 1, 2), fear: 1 }, [wx + 7, 0, -3.6], ex)); break; }
    case 'flat': out.push(R(T, 'fireman', { seed: 66, expr: 'shock', L: 'up', R: 'up', tilt: q(18 * Math.sin(f * 0.15), 1), headTilt: q(10 * Math.sin(f * 0.2), 1), blink: 0 }, [34.5 + (f - 722) * 0.05, 1.5 * ramp(f, 735, 760) * (1 - ramp(f, 770, 799)) + 0, -1], ex)); break;
    case 'clean': for (let i = 0; i < 4; i++) out.push(R(T, i % 2 ? 'worker2' : 'worker1', { seed: 75 + i, expr: 'tired', L: 'up', R: 'hang', tilt: q(9 * Math.sin(f * 0.4 + i), 1), headTilt: 6, ...idle(f, i) }, [-1 + i * 1.6, 0, -0.5 - (i % 2) * 1.0], ex)); break;
    case 'smell': out.push(R(T, 'modern', { seed: 85, expr: f > 880 ? 'shock' : 'smile', L: 'hang', R: 'hang', headTilt: q(f > 860 ? -8 : 0, 1), blink: blinkAt(f, 85), ...idle(f, 2) }, [2.0, 0, 0.6], { tint })); break;
  }
  return out;
};
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'hook' || (S.id === 'wave2' && f < 100)) { const t = q(((f % 40) / 40), 2); out.push(FX('jar' + t, (p) => T.fxJar(p, t), [0, 0.2, 0], 1.55, { order: 4 })); }
  if (S.id === 'wave2' && f > 112) { const t = q(ramp(f, 112, 150), 2); out.push(FX('txt21', (p) => T.fxText(p, '21', 260, '#ffe66a'), [0.2, 4.6, -4], 2.0 + t * 0.3, { alpha: t > 0.9 ? 0.95 : t * 1.05 })); }
  if (S.id === 'burst' && f >= 556 && f < 575) { const t = q((f - 556) / 18, 2); out.push(FX('bst' + t, (p) => T.fxBurst(p, t, '#ffffff', 12, 30, 260), [-34, 5, -3], 6)); }
  if (S.id === 'wave9' || S.id === 'flat') { const wx = waveFront(f); for (let i = 0; i < 3; i++) { const t = q(((f * 0.05 + i / 3) % 1), 2); out.push(FX('ws' + t + i, (p) => T.fxWaveSplash(p, t), [wx + 1.2, 6.0, -2 + i * 2.2], 2.6)); } }
  if (S.id === 'clean') { const t = q(ramp(f, 800, 846), 2); out.push(FX('cal' + t, (p) => T.fxCal(p, t), [2.5, 6.0, -4], 3.6, { alpha: 0.95 })); }
  if (S.id === 'smell' && f > 862) { const t = q(((f - 862) / 40) % 1, 2); out.push(FX('ht' + t, (p) => T.fxHeart(p, t), [2.6, 1.7, 0.6], 0.9)); }
  return out;
};
