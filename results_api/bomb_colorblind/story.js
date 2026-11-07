import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, M as MO } from './motion.js';

export const FPS = 30, TOTAL = 1083, DECK = 0;
export const SHOTS = [
  { id: 's1', a: 0, b: 143, light: 'day' },
  { id: 's2', a: 144, b: 249, light: 'indoor' },
  { id: 's3', a: 250, b: 338, light: 'indoor' },
  { id: 's4', a: 339, b: 435, light: 'indoor' },
  { id: 's5', a: 436, b: 546, light: 'indoor' },
  { id: 's6', a: 547, b: 615, light: 'indoor' },
  { id: 's7', a: 616, b: 695, light: 'indoor' },
  { id: 's8', a: 696, b: 771, light: 'indoor' },
  { id: 's9', a: 772, b: 796, light: 'indoor' },
  { id: 's10', a: 797, b: 857, light: 'indoor' },
  { id: 's11', a: 858, b: 950, light: 'indoor' },
  { id: 's12', a: 951, b: 1025, light: 'indoor' },
  { id: 's13', a: 1026, b: 1082, light: 'golden' }
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;

export const LIGHTS = {
  day: { az: 130, el: 55, sky: '#bcd6f0', ground: '#b88a58', hemi: 1.15, sun: '#fff3dc', sunI: 2.6, fog: '#e8d9c0', fogNear: 90, fogFar: 700,
    skyTop: '#3f86d8', skyHor: '#d6e6f0', sat: 1.12, waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff', vig: 0.2, shadowExt: 26 },
  golden: { az: 20, el: 12, sky: '#d9a888', ground: '#9a5c3a', hemi: 1.0, sun: '#ffb050', sunI: 3.0, fog: '#f0b480', fogNear: 50, fogFar: 520,
    skyTop: '#7c6ab0', skyHor: '#ffb46a', sunDisc: '#fff0c8', sunSize: 0.004, sat: 1.15, gain: '#fff0dc', waterDeep: '#3d5a86', waterShal: '#d99a6e', glint: '#ffe2a8', vig: 0.28, shadowExt: 26 },
  indoor: { az: 130, el: 45, sky: '#222222', ground: '#222222', hemi: 1.0, sun: '#ffffff', sunI: 1.8, fog: '#111111', fogNear: 20, fogFar: 100,
    skyTop: '#111111', skyHor: '#222222', sat: 1.0, waterDeep: '#111111', waterShal: '#222222', glint: '#ffffff', vig: 0.4, shadowExt: 10 }
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

const CAMS = {
  s1: [
    { f: 0, pos: [0, 1.5, 6], look: [0, 1.2, 0], fov: 50 },
    { f: 143, pos: [0, 1.5, 4], look: [0, 1.2, 0], fov: 50 }
  ],
  s2: [
    { f: 144, pos: [101.5, 1.4, 1.5], look: [100, 0.9, 0], fov: 45 },
    { f: 249, pos: [100, 1.4, 2.0], look: [100, 0.9, 0], fov: 45 }
  ],
  s3: [
    { f: 250, pos: [100, 1.05, 1.8], look: [100, 1.1, 0], fov: 45 },
    { f: 338, pos: [100, 1.05, 1.2], look: [100, 1.1, 0], fov: 45 }
  ],
  s4: [
    { f: 339, pos: [100, 1.6, -0.05], look: [100, 1.17, -0.05], fov: 40 },
    { f: 435, pos: [100, 1.6, -0.05], look: [100, 1.17, -0.05], fov: 40 }
  ],
  s5: [
    { f: 436, pos: [100, 1.5, 1.5], look: [100, 1.4, 0.5], fov: 40 },
    { f: 546, pos: [100, 1.5, 2.0], look: [100, 1.4, 0.5], fov: 40 }
  ],
  s6: [
    { f: 547, pos: [101.5, 1.6, 2.0], look: [100, 1.0, 0], fov: 45 },
    { f: 615, pos: [101.2, 1.5, 1.5], look: [100, 1.0, 0], fov: 45 }
  ],
  s7: [
    { f: 616, pos: [100.3, 1.4, 0.3], look: [100, 1.17, -0.05], fov: 35 },
    { f: 695, pos: [100.3, 1.4, -0.1], look: [100, 1.17, -0.05], fov: 35 }
  ],
  s8: [
    { f: 696, pos: [100.2, 1.4, 0.5], look: [100.1, 1.1, 0.1], fov: 35 },
    { f: 771, pos: [100.2, 1.4, 0.5], look: [100.1, 1.1, 0.1], fov: 35 }
  ],
  s9: [
    { f: 772, pos: [100, 1.4, 0.6], look: [100, 1.15, 0.1], fov: 30 },
    { f: 796, pos: [100, 1.4, 0.6], look: [100, 1.15, 0.1], fov: 30 }
  ],
  s10: [
    { f: 797, pos: [200, 1.5, 6], look: [200, 1.2, -2], fov: 50 },
    { f: 857, pos: [200, 1.5, 4.5], look: [200, 1.2, -2], fov: 50 }
  ],
  s11: [
    { f: 858, pos: [100, 1.5, 1.5], look: [100, 1.4, -0.8], fov: 40, ease: 'easeOut' },
    { f: 950, pos: [100, 1.5, 0.5], look: [100, 1.4, -0.8], fov: 40 }
  ],
  s12: [
    { f: 951, pos: [100, 1.4, 0.6], look: [100, 1.15, 0], fov: 40 },
    { f: 1025, pos: [100, 1.4, 0.6], look: [100, 1.15, 0], fov: 40 }
  ],
  s13: [
    { f: 1026, pos: [0, 1.5, 4], look: [0, 1.2, 0], fov: 50 },
    { f: 1082, pos: [0, 1.5, 6], look: [0, 1.2, 0], fov: 50 }
  ]
};

export const camAt = (f) => {
  const S = shotAt(f), c = camFromKeys(CAMS[S.id], f, { creep: 0.0012 });
  c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};

export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const cinf = ['s2', 's3', 's4', 's7', 's8', 's9', 's12'].includes(S.id) ? 12 : 0;
  return { focus: Math.hypot(C.pos[0] - C.look[0], C.pos[1] - C.look[1], C.pos[2] - C.look[2]), cinf, near: 1 };
};

export const worldAt = (f) => {
  return { shotId: shotAt(f).id };
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const arthur = (pos, o) => out.push({ key: 'arthur'+JSON.stringify(o), draw: (p) => T.drawArthur(p, o), x: pos[0], y: pos[1], z: pos[2] });
  const officer = (pos, o) => out.push({ key: 'officer'+JSON.stringify(o), draw: (p) => T.drawOfficer(p, o), x: pos[0], y: pos[1], z: pos[2] });
  
  if (S.id === 's1') {
    arthur([0, 0, 0], { expr: 'determined', facing: 0, L: 'hang', R: 'hang', ...idle(f) });
  }
  if (S.id === 's3') {
    arthur([100, 0, -0.8], { expr: 'determined', facing: 0, L: 'reach', R: 'hang', ...idle(f) });
  }
  if (S.id === 's5') {
    arthur([100, 0, 0.5], { expr: 'nervous+sweat', facing: 0, L: 'temple', R: 'hang', ...idle(f) });
  }
  if (S.id === 's6') {
    arthur([100.8, 0, 0.8], { expr: 'determined', facing: -1, L: 'point', R: 'hang', ...idle(f) });
  }
  if (S.id === 's10') {
    officer([201, 0, -1], { expr: 'nervous+sweat', facing: -1, L: 'temple', R: 'hang', ...idle(f) });
    out.push({ key: 'crowd', draw: (p) => T.crowd(p, { n: 10, t: f/30, mode: 'stand', expr: 'nervous' }), x: 200, y: 0, z: -2, s: 4.0 });
  }
  if (S.id === 's11') {
    arthur([100, 0, -0.8], { expr: 'shock+sparkle', facing: 0, L: 'reach', R: 'hang', ...idle(f) });
  }
  if (S.id === 's13') {
    arthur([0, 0, 0], { expr: 'proud', facing: 0, L: 'hip', R: 'hip', ...idle(f) });
  }
  return out;
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
  
  if (['s2', 's3', 's4', 's6', 's7', 's8', 's9', 's12'].includes(S.id)) {
    const timeLeft = Math.max(0, 15 - Math.floor(f/30));
    const timeStr = `00:${timeLeft.toString().padStart(2, '0')}`;
    out.push(FX('timer', (p) => T.fxTimerText(p, timeStr), [100, 1.192, 0.095], 0.0003));
  }
  
  if (S.id === 's1') out.push(FX('dust', (p) => T.fxDust(p, (f%30)/30, '#cccccc'), [0, 0.5, 1], 2.0));
  if (S.id === 's12' && f > 951) out.push(FX('sparks', (p) => T.fxSparkle(p, (f%30)/30, '#ffff00'), [100, 1.17, -0.05], 0.2));
  if (S.id === 's13') out.push(FX('smoke', (p) => T.fxSmoke(p, (f%60)/60, '#cccccc'), [0, 1.0, -2], 3.0));
  
  return out;
};
export const LOOK = { sat: 1.18, vibr: 0.25, drift: 1, push: 1 };
