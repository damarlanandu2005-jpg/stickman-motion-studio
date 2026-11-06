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
  { id: 's12_smell', a: 847, b: 946, light: 'golden' },
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
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

const CAMS = {
  s1_hook: [{ f: 0, pos: [4, 1.5, 5], look: [0, 1.5, -5], fov: 30 }, { f: 68, pos: [4, 1.5, 5], look: [0, 1.5, -5], fov: 30 }],
  s2_wave: [{ f: 69, pos: [4, 1.5, 5], look: [0, 1.5, -5], fov: 30 }, { f: 120, pos: [0, 2, 15], look: [0, 1.5, -5], fov: 44, ease: 'easeOut' }, { f: 158, pos: [0, 2, 16], look: [0, 1.5, -5], fov: 44 }],
  s3_tank: [{ f: 159, pos: [0, 1, 10], look: [0, 8, -20], fov: 46 }, { f: 264, pos: [0, 1, 10], look: [0, 12, -20], fov: 46 }],
  s4_neighborhood: [{ f: 265, pos: [-25, 20, 10], look: [0, 5, -20], fov: 50 }, { f: 327, pos: [15, 20, 10], look: [0, 5, -20], fov: 50 }],
  s5_built: [{ f: 328, pos: [0, 5, 5], look: [0, 5, -20], fov: 40 }, { f: 404, pos: [0, 5, 5], look: [0, 5, -20], fov: 40 }],
  s6_groan: [{ f: 405, pos: [0, 1, -2], look: [0, 3, -20], fov: 36 }, { f: 501, pos: [0, 1, -2], look: [0, 3, -20], fov: 36 }],
  s7_rivets: [{ f: 502, pos: [0, 3, -5], look: [0, 3, -20], fov: 28 }, { f: 555, pos: [0, 3, -5], look: [0, 3, -20], fov: 28 }],
  s8_burst: [{ f: 556, pos: [0, 3, -5], look: [0, 3, -20], fov: 28 }, { f: 566, pos: [0, 3, 5], look: [0, 3, -20], fov: 54, ease: 'easeOut' }, { f: 588, pos: [0, 3, 5], look: [0, 3, -20], fov: 54 }],
  s9_wave: [{ f: 589, pos: [0, 2, -5], look: [0, 2, -15], fov: 40 }, { f: 721, pos: [0, 2, 25], look: [0, 2, 10], fov: 40 }],
  s10_flatten: [{ f: 722, pos: [10, 4, 20], look: [-10, 2, 20], fov: 48 }, { f: 799, pos: [10, 4, 20], look: [-10, 2, 20], fov: 48 }],
  s11_clean: [{ f: 800, pos: [0, 2, 30], look: [0, 1, 10], fov: 40 }, { f: 846, pos: [0, 4, 35], look: [0, 1, 10], fov: 48 }],
  s12_smell: [{ f: 847, pos: [0, 1.5, 25], look: [0, 1.5, 10], fov: 46 }, { f: 946, pos: [0, 1.5, 18], look: [0, 1.5, 10], fov: 30 }],
};

const KICKS = [
  { f: 450, a: 0.02 }, { f: 470, a: 0.02 },
  { f: 510, a: 0.03 }, { f: 530, a: 0.03 }, { f: 550, a: 0.03 },
  { f: 556, a: 0.08 },
  { f: 730, a: 0.05 }, { f: 750, a: 0.05 }
];

export const camAt = (f) => {
  const S = shotAt(f), c = camFromKeys(CAMS[S.id], f, { creep: 0.0006, kicks: KICKS });
  c.flash = (f >= 556 && f < 559) ? 0.8 * (1 - (f - 556) / 3) : 0;
  c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), cinf = { s1_hook: 12, s7_rivets: 10, s12_smell: 8 }[S.id] ?? 0;
  return { focus: dist(C.pos, C.look), cinf, near: 1 };
};

export const worldAt = (f) => {
  return {};
};

const R = (who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => p.romanFront ? p.romanFront(p, who, o) : null, x: pos[0], y: pos[1], z: pos[2], ...extra });
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [], tint = S.light === 'golden' ? '#ffe6cc' : S.light === 'dawn' ? '#f4dede' : '#ffffff';
  const R = (who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });

  if (S.id === 's1_hook' || S.id === 's2_wave') {
    out.push({ key: 'horse', draw: (p) => T.horseCart(p, { step: 0, fear: 0 }), x: -5, y: 0, z: -5, s: 1.0, blob: false });
  }
  if (S.id === 's2_wave') {
    for(let i=0; i<5; i++) out.push(R('worker1', { seed: i, expr: 'neutral', step: q((f/30*1.1 + i*0.2)%1, 2), facing: i%2 ? 1 : -1 }, [-4 + i*2, 0, 2 - i]));
  }
  if (S.id === 's3_tank') {
    out.push(R('worker1', { seed: 1, expr: 'neutral', look: 0.5, headTilt: -10 }, [-2, 0, -9]));
    out.push(R('worker2', { seed: 2, expr: 'neutral', look: -0.5, headTilt: -10 }, [2, 0, -9]));
  }
  if (S.id === 's4_neighborhood') {
    for(let i=0; i<10; i++) out.push(R('walker', { seed: i, step: q((f/30 + i*0.3)%1, 2) }, [-10 + i*2, 0, -10 + (i%3)*5], { s: 0.5 }));
  }
  if (S.id === 's5_built') {
    out.push(R('worker1', { seed: 1, expr: 'neutral', R: 'up', L: 'hang', bob: Math.sin(f*0.5)*0.05 }, [-2, 5, -9]));
    out.push(R('worker2', { seed: 2, expr: 'proud', R: 'wave', wv: f*0.2 }, [2, 5, -9]));
  }
  if (S.id === 's6_groan') {
    const lookUp = f > 450;
    out.push(R('kid1', { seed: 1, expr: lookUp ? 'scared' : 'proud', headTilt: lookUp ? -20 : 0, R: lookUp ? 'hang' : 'up' }, [-2, 0, -8], { s: 0.7 }));
    out.push(R('kid2', { seed: 2, expr: lookUp ? 'scared' : 'proud', headTilt: lookUp ? -20 : 0, L: lookUp ? 'hang' : 'up' }, [2, 0, -8], { s: 0.7 }));
  }
  if (S.id === 's8_burst') {
    for(let i=0; i<5; i++) out.push(R('worker1', { seed: i, expr: 'scared', step: q((f/30*2 + i*0.2)%1, 2), facing: 1, L: 'up', R: 'up' }, [-4 + i*2 + (f-556)*0.1, 0, -2 + i]));
  }
  if (S.id === 's9_wave') {
    const wz = -20 + (f - 556) * 0.24;
    out.push({ key: 'horse', draw: (p) => T.horseCart(p, { step: q((f/30*2)%1, 2), fear: 1 }), x: 0, y: 0, z: wz + 10, s: 1.5, blob: false });
    out.push(R('worker1', { seed: 1, expr: 'scared', step: q((f/30*2)%1, 2), facing: 1, L: 'up', R: 'up' }, [3, 0, wz + 8]));
  }
  if (S.id === 's10_flatten') {
    const lift = Math.max(0, (f - 722) * 0.1);
    out.push(R('fireman', { seed: 1, expr: 'scared', L: 'up', R: 'up' }, [0, lift, 20]));
  }
  if (S.id === 's11_clean') {
    out.push(R('worker1', { seed: 1, expr: 'tired', R: 'spear', headTilt: 10, bob: Math.sin(f*0.2)*0.05 }, [-2, 0, 15]));
    out.push(R('worker2', { seed: 2, expr: 'tired', R: 'spear', headTilt: 10, bob: Math.sin(f*0.2 + 1)*0.05 }, [2, 0, 13]));
  }
  if (S.id === 's12_smell') {
    out.push(R('modern', { seed: 1, expr: 'proud', headTilt: -10, L: 'hip' }, [0, 0, 15]));
  }

  return out;
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 's1_hook' || (S.id === 's2_wave' && f < 100)) {
    out.push(FX('jar', (p) => T.fxJar(p, (f%60)/60), [3.2, 1.5, 3.1], 0.2));
    out.push(FX('drip', (p) => T.fxDrip(p), [3.2, 1.5 - (f%30)*0.05, 3.1], 0.2));
  }
  if (S.id === 's2_wave' && f > 120) {
    out.push(FX('text', (p) => T.fxText(p, "21", 200, "#c0302c"), [0, 4, 0], 1.5));
  }
  if (S.id === 's3_tank') {
    out.push(FX('steam', (p) => T.fxSteam(p, (f%60)/60), [0, 15, -20], 3));
  }
  if (S.id === 's5_built') {
    if (f % 10 < 5) out.push(FX('sparks', (p) => T.fxSparks(p, (f%10)/5), [-2, 6, -9], 1));
    out.push(FX('rivet', (p) => T.fxRivet(p), [0, 5, -9], 0.5));
    out.push(FX('drip', (p) => T.fxDrip(p), [0, 5 - (f%20)*0.1, -9], 0.2));
  }
  if (S.id === 's6_groan') {
    out.push(FX('therm', (p) => T.fxThermometer(p, Math.min(1, (f-405)/96)), [-1, 2, -9], 1));
  }
  if (S.id === 's7_rivets') {
    for(let i=0; i<3; i++) {
      const t = ((f + i*15) % 45) / 45;
      out.push(FX('rivet'+i, (p) => T.fxRivet(p), [(i-1)*1, 3, -10 + t*4], 0.5 + t));
      out.push(FX('splash'+i, (p) => T.fxMolassesSplash(p, t), [(i-1)*1, 3, -10 + t*4], 0.5 + t));
    }
  }
  if (S.id === 's8_burst') {
    out.push(FX('splash', (p) => T.fxMolassesSplash(p, (f-556)/32), [0, 3, -10], 3));
  }
  if (S.id === 's9_wave') {
    const wz = -20 + (f - 556) * 0.24;
    out.push(FX('splash', (p) => T.fxMolassesSplash(p, (f%20)/20), [0, 2, wz + 5], 2));
  }
  if (S.id === 's10_flatten') {
    out.push(FX('splash', (p) => T.fxMolassesSplash(p, (f%20)/20), [0, 2, -20 + (f-556)*0.24 + 5], 2));
  }
  if (S.id === 's11_clean') {
    out.push(FX('cal', (p) => T.fxCalSky(p, (f-800)/46), [0, 3, 15], 1.5));
  }
  if (S.id === 's12_smell') {
    out.push(FX('plaque', (p) => T.fxPlaque(p), [-1.5, 1.5, 15.5], 0.4));
    out.push(FX('heart', (p) => T.fxHeart(p, (f%60)/60), [0, 2.0, 15], 0.3));
  }
  return out;
};
