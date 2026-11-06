import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, M as MO } from './motion.js';
export const FPS = 30, TOTAL = 597, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 31, light: 'golden' }, { id: 'war', a: 32, b: 105, light: 'day' }, { id: 'wheat', a: 106, b: 167, light: 'day' },
  { id: 'guns', a: 168, b: 242, light: 'day' }, { id: 'split', a: 243, b: 321, light: 'day' }, { id: 'truck', a: 322, b: 357, light: 'day' },
  { id: 'miss', a: 358, b: 390, light: 'day' }, { id: 'month', a: 391, b: 448, light: 'dawn' }, { id: 'birds', a: 449, b: 472, light: 'golden' },
  { id: 'today', a: 473, b: 531, light: 'day' }, { id: 'score', a: 532, b: 596, light: 'golden' },
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

// ---------- cameras ----------
const CAMS = {
  hook: [{ f: 0, pos: [0.55, 0.15, 1.5], look: [0.05, 0.05, 0], fov: 38 }, { f: 12, pos: [0.5, 0.2, 1.45], look: [0.05, 0.1, 0], fov: 37 }, { f: 31, pos: [0.4, 1.4, 1.7], look: [0, 1.45, 0], fov: 34 }],
  war: [{ f: 32, pos: [0.2, 1.3, 6.0], look: [0.2, 1.1, -1], fov: 34 }, { f: 92, pos: [0.3, 2.2, 10.5], look: [0.3, 1.1, -1], fov: 46 }, { f: 95, pos: [0.3, 2.2, 10.5], look: [0.3, 1.1, -1], fov: 46 },
    { f: 101, pos: [1.9, 1.55, 3.6], look: [1.9, 1.45, -1.0], fov: 27, ease: 'easeOut' }, { f: 105, pos: [1.9, 1.55, 3.4], look: [1.9, 1.45, -1.0], fov: 25 }],
  wheat: [{ f: 106, pos: [-6, 12, 14], look: [0, 0, -12], fov: 48 }, { f: 167, pos: [-4, 9, 11], look: [-1, 0, -10], fov: 44 }],
  guns: [{ f: 168, pos: [-8, 1.8, 12], look: [-6, 1.5, 3], fov: 40 }, { f: 215, pos: [1, 1.8, 12], look: [3.5, 1.5, 3], fov: 40 }, { f: 242, pos: [2.5, 1.8, 12], look: [4.5, 1.5, 3], fov: 40 }],
  split: [{ f: 243, pos: [0, 6.5, 9.5], look: [0, 0.2, -3], fov: 50 }, { f: 321, pos: [0, 6, 8.5], look: [0, 0.2, -3], fov: 50 }],
  truck: [{ f: 322, pos: [-4, 1.8, 11], look: [-1.8, 1.3, 0], fov: 36 }, { f: 357, pos: [5.5, 1.8, 11], look: [7.2, 1.3, 0], fov: 36 }],
  miss: [{ f: 358, pos: [0.4, 2.2, 11], look: [0.4, 1.2, 0], fov: 44 }, { f: 390, pos: [0.6, 2.2, 10.5], look: [0.5, 1.2, 0], fov: 44 }],
  month: [{ f: 391, pos: [8, 2.4, 9], look: [11, 1.6, 0], fov: 40 }, { f: 448, pos: [8, 3.4, 24], look: [24, 3.5, 0], fov: 48 }],
  birds: [{ f: 449, pos: [0.3, 0.95, 2.9], look: [0, 1.15, 0], fov: 36 }, { f: 472, pos: [0.25, 0.98, 2.4], look: [0, 1.2, 0], fov: 32 }],
  today: [{ f: 473, pos: [-1, 2.2, 10], look: [0.5, 1.0, -5], fov: 44 }, { f: 531, pos: [-1, 2.2, 9], look: [0.5, 1.0, -5], fov: 44 }],
  score: [{ f: 532, pos: [0, 2.3, 12], look: [0, 2.3, -3], fov: 46 }, { f: 596, pos: [0, 2.1, 8], look: [0, 2.1, -3], fov: 36 }],
};
const KICKS = [{ f: 359, a: 0.04 }, { f: 364, a: 0.04 }, { f: 369, a: 0.05 }, { f: 374, a: 0.04 }, { f: 379, a: 0.05 }, { f: 384, a: 0.04 }];
export const camAt = (f) => {
  const S = shotAt(f), c = camFromKeys(CAMS[S.id], f, { creep: 0.0006, kicks: S.id === 'miss' ? KICKS : [] });
  c.flash = (f >= 32 && f < 35) ? 0.5 * (1 - (f - 32) / 3) : (f >= 391 && f < 394) ? 0.4 : 0;
  c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f), cinf = { hook: 12, birds: 10, score: 6, war: f > 95 ? 12 : 0 }[S.id] ?? 0;
  return { focus: dist(C.pos, C.look), cinf, near: 1 };
};

// ---------- world state (truck + cloud) ----------
export const TRUCK_Y0 = 0;
export const worldAt = (f) => {
  const S = shotAt(f); const W = { truck: null, flag: S.id === 'birds', score: S.id === 'score' };
  const T = (x, z, ry = 0, bounce = 0, vis = true) => (W.truck = { x, z, ry, bounce, vis, roll: x * 1.6 });
  if (S.id === 'war') T(-1.5, -4.0, 0.5);
  if (S.id === 'wheat') T(0, 0, 0, 0, false);
  if (S.id === 'guns') { const k = ramp(f, 168, 215); T(lerp(-16, 3.8, MO.easeOut(k)), 3.2, 0, 0.04 * Math.sin(f * 0.9) * (1 - k)); }
  if (S.id === 'split') T(-9, 5);
  if (S.id === 'truck') { T(lerp(-3, 9, ramp(f, 322, 357)) - 4.6, 1.2, 0, 0.05 * Math.sin(f * 1.7)); }
  if (S.id === 'miss') T(-1.6, 2.5);
  if (S.id === 'month') T(lerp(4, 40, MO.easeIn(ramp(f, 391, 448)) * 0.7 + ramp(f, 391, 448) * 0.3), 0, 0, 0.04 * Math.sin(f * 0.8));
  return W;
};

// ---------- actors ----------
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const E = (T, o, pos, extra = {}) => ({ key: 'emu' + JSON.stringify(o), draw: (p) => T.emu(p, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const H = (T, o, pos, s = 4.6, extra = {}) => ({ key: 'herd' + JSON.stringify(o), draw: (p) => T.emuHerd(p, o), x: pos[0], y: pos[1], z: pos[2], s, blob: false, ...extra });
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
const SOLD = ['digger', 'digger2', 'digger3'];

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [], tint = S.light === 'golden' ? '#ffe6cc' : S.light === 'dawn' ? '#f4dede' : '#ffffff';
  const sol = (i, pos, o = {}, extra = {}) => out.push(R(T, SOLD[i % 3], { seed: 5 + i * 3, blink: blinkAt(f, 5 + i), ...idle(f, i), ...o }, pos, { tint, ...extra }));
  switch (S.id) {
    case 'hook': sol(0, [0, 0, 0], { expr: 'stern', step: q((f / 30 * 1.7) % 1, 2), facing: 1, look: 0.4, bob: 0 }); break;
    case 'war': {
      const aim = f >= 62;
      for (let i = 0; i < 6; i++) sol(i, [-2.3 + i * 0.5, 0, -1.2 + (i % 2) * 0.5], { expr: 'stern', facing: 1, look: 0.6, L: aim ? 'point' : 'hang', R: 'hang' });
      const view = f >= 96 ? 'front' : 'side';
      for (let i = 0; i < 5; i++) {
        const x = 0.6 + i * 0.65, isHero = i === 2;
        out.push(E(T, { view: isHero ? view : 'side', neck: 1, eye: isHero && f >= 96 ? 'smug' : (f >= 84 ? 'alert' : 'calm'), blink: q(blinkAt(f, 3 + i), 1), look: 0 }, [x, 0, -1 + (i % 2) * 0.5], { flip: !(isHero && view === 'front'), tint }));
      }
      break;
    }
    case 'wheat': {
      out.push(R(T, 'farmer', { seed: 31, expr: 'desperate', blink: blinkAt(f, 31), L: 'hang', R: 'hang', ...idle(f, 2), headTilt: q(4 * Math.sin(f * 0.2), 1) }, [-4.5, 0, -6], { tint }));
      const t = f / 30;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) out.push(H(T, { n: 6, t: q(t + r + c * 0.4, 1), eat: true }, [-10 + c * 5, 0, -8 - r * 5], 5, { tint }));
      for (let i = 0; i < 3; i++) out.push(FX('chew' + (f % 3), (p) => p.dot(300, 500, 1, '#d9ad45'), [0, -9, 0], 1));
      break;
    }
    case 'guns': {
      const k = ramp(f, 168, 215), x0 = lerp(-16, 3.8, MO.easeOut(k)), jump = ramp(f, 208, 222);
      for (let i = 0; i < 3; i++) {
        const gx = x0 - 1.4 + i * 0.7, hop = Math.sin(Math.PI * clamp((f - 208 - i * 4) / 12)) * 0.5, out_ = ramp(f, 208 + i * 4, 224 + i * 4);
        const px = f < 208 ? gx : lerp(gx, 5.6 + i * 1.0, MO.smooth(out_)), py = f < 208 ? 1.25 : 1.25 * (1 - out_) + hop;
        sol(i, [px, py, 3.2 + (f < 208 ? 0.3 : 1.2)], { expr: 'proud', facing: 1, look: 0.5, L: f < 208 ? 'up' : 'hang', R: 'hang', bob: 0 }, { alpha: 1 });
      }
      if (f >= 190) sol(3, [x0 - 2.4, 1.25 * (1 - ramp(f, 208, 220)), 3.2], { expr: 'proud', facing: 1, L: 'hang' });
      break;
    }
    case 'split': {
      const t = (f - 243) / 30, run = ramp(f, 243, 262);
      const dirs = [[-1, 0.8], [-0.55, 1], [0.1, 1], [0.7, 0.9], [1, 0.3], [0.5, -0.8]];
      dirs.forEach(([dx, dz], i) => {
        const d = MO.easeOut(run) * 6 + Math.max(0, t - 0.6) * 3.5, bx = 0.5 + dx * d + dx * 0.8, bz = -2 + dz * d * 0.8 - 1;
        out.push(H(T, { n: 6, t: q(t * 1.5 + i, 2), run: 1 }, [bx, 0, bz], 3.6, { flip: dx < 0, tint }));
      });
      for (let i = 0; i < 3; i++) sol(i, [-1 + i * 1.5, 0, -2 + (i % 2) * 0.6], { expr: 'nervous', facing: i - 1, look: Math.sin((f + i * 11) * 0.12), L: 'hang', R: 'hang', headTilt: q(10 * Math.sin((f + i * 9) * 0.14), 1) });
      if (f > 262) out.push(FX('sw' + (f % 4), (p) => T.fxDrip(p), [-0.1, 2.0 - ((f % 12) * 0.03), -1.7], 0.18));
      break;
    }
    case 'truck': {
      const ex = lerp(-3, 9, ramp(f, 322, 357)), run = 1;
      out.push(E(T, { view: 'side', run: 1, step: q((f * 0.11) % 1, 2), neck: 0.9, eye: 'smug', look: 0.5 }, [ex, 0, 0.2], { tint }));
      const tx = ex - 4.6;
      for (let i = 0; i < 3; i++) sol(i, [tx - 1.6 + i * 0.7 - 0.2, 1.25 + 0.08 * Math.sin(f * 1.7 + i), 1.2], { expr: 'shock', facing: 1, L: 'up', R: 'up' });
      out.push(FX('hat' + (f % 6), (p) => p.poly([[200, 560], [420, 540], [440, 590], [190, 610]], '#9c8a52', 10), [tx - 0.8, 3.4 + (f - 322) * 0.01, 1.2], 0.35, { roll: (f - 322) * 0.2 }));
      for (let i = 0; i < 4; i++) { const t = q(((f - 322) / 20 + i * 0.25) % 1, 2); out.push(FX('dust' + t, (p) => T.fxDust(p, t, '#e6c89a'), [tx - 2.4 - i * 0.8, 0.4, 0.6], 1.2 + i * 0.4)); }
      break;
    }
    case 'miss': {
      sol(0, [-1.0, 1.25, 2.6], { expr: 'angry', facing: 1, look: 0.6, L: 'point', R: 'point', headTilt: q(f % 2 ? 2 : -2, 1) });
      sol(1, [-2.0, 1.25, 2.4], { expr: 'angry', facing: 1, L: 'hang' });
      const sh = f >= 360;
      for (let i = 0; i < 4; i++) { const zig = Math.sin((f + i * 8) * 0.28) * 3; out.push(E(T, { view: 'side', run: 1, step: q((f * 0.13 + i * 0.3) % 1, 2), neck: 0.9, eye: 'smug', look: 0.4 }, [0.8 + i * 1.0 + Math.sin((f - 358) * 0.07 + i) * 0.5, (f % 17 === 3 + i ? 0.15 : 0), -1.5 - i * 0.8 + zig * 0.3], { flip: false, tint })); }
      if (f % 5 < 2 && f >= 360) out.push(FX('mz' + (f % 5), (p) => T.fxMuzzle(p, (f % 5) / 2), [-0.05, 2.55, 2.9], 0.55));
      for (let i = 0; i < 4; i++) { const k = q(((f - 360 + i * 6) % 18) / 18, 2); out.push(FX('sand' + k, (p) => T.fxDust(p, k, '#d9a870'), [2.5 + i * 1.6, 0.3, -5 - i * 1.2], 1.4)); }
      break;
    }
    case 'month': {
      const tx = lerp(4, 40, MO.easeIn(ramp(f, 391, 448)) * 0.7 + ramp(f, 391, 448) * 0.3);
      for (let i = 0; i < 3; i++) sol(i, [tx - 1.6 + i * 0.7, 1.25 + 0.04 * Math.sin(f * 0.8 + i), 0.2], { expr: 'sad', facing: 1, headTilt: 14, L: 'hang', R: 'hang', bob: 0 }, { s: 0.9 });
      const t = ramp(f, 391, 448);
      out.push(FX('cal' + q(t, 2), (p) => T.fxCal(p, t), [tx - 5 - t * 8, 5.0 - t * 2, -6], 2.5, { alpha: 0.95 }));
      for (let i = 0; i < 5; i++) { const k = ((f - 391) / 40 + i * 0.2) % 1; out.push(FX('page' + i, (p) => p.poly([[220, 500], [380, 480], [400, 640], [230, 650]], '#f7f2e6', 8), [tx - 6 + i * 1.5, 5.5 - k * 7, -5], 0.6, { roll: k * 6 })); }
      break;
    }
    case 'birds':
      out.push(E(T, { view: 'front', neck: 1, eye: 'smug', blink: q(blinkAt(f, 4), 1), look: 0 }, [0, 0, 0], { tint }));
      for (let i = 0; i < 3; i++) out.push(H(T, { n: 6, t: q(f / 30 + i, 1), eat: true }, [-9 + i * 9, 0, -8], 4.6, { tint }));
      break;
    case 'today': {
      const t = f / 30;
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) out.push(H(T, { n: 6, t: q(t + r + c * 0.4, 1), eat: true }, [-8 + c * 5.5 + r * 1.5, 0, -7 - r * 5], 4.6, { tint }));
      out.push(E(T, { view: 'side', neck: 0.35 + 0.3 * Math.sin(f * 0.2), hat: true, eye: 'calm', blink: q(blinkAt(f, 6), 1) }, [1.6, 0, -2.5], { flip: true, tint }));
      break;
    }
    case 'score': {
      const t = ramp(f, 532, 596);
      out.push(E(T, { view: 'front', neck: 1, eye: 'smug', blink: q(blinkAt(f, 9), 1) }, [0.1, 0, -1.2 + t * 0.4], { tint }));
      out.push(FX('board', (p) => T.fxScore(p, 1, 0), [0, 2.4 - 1.069 * 3, -3.2], 3, { order: 1 }));
      break;
    }
  }
  return out;
};

// ---------- 2D effects (extra) ----------
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'score') { const t = q(((f - 532) / 40) % 1, 2); out.push(FX('conf' + t, (p) => T.fxConfetti(p, t), [0, 1.2, -1.0], 4.5)); }
  if (S.id === 'war' && f >= 96 && f < 110) out.push(FX('wow', (p) => T.fxStars && T.fxStars(p, q((f - 96) / 14, 2)), [3.4, 2.6, -0.8], 0.8));
  return out;
};
