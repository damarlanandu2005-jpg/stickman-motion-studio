import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, M as MO } from './motion.js';
// Railroad story (v2): Gemini v1 polished by hand with the 17-video rules.
//  - one continuous camera flight per scene, fixed lens (CAM-03, CUT-03), scene changes mixed: hard cut / dissolve / fly-through (TRN-06)
//  - one-word captions (CAP-02, drawn in main.js), a few impact kicks (FX-05), painted surfaces + grain (COL-02/03)
export const FPS = 30, TOTAL = 180, DECK = 0;
const SC = [['a1', 0, 89, 'OUTDOOR', 'day'], ['a2', 90, 179, 'OUTDOOR', 'day']];
export const FORCE = { shot: null, scene: null };   // set by main.js while it renders the OUTGOING picture of a dissolve
// one camera flight per scene: fl(a, b, from-pos, from-look, from-fov, to-pos, to-look, to-fov, [via points], ease)
const fl = (a, b, p0, l0, f0, p1, l1, f1, via = null, ease = 'easeOut') => [{ f: a, pos: p0, look: l0, fov: f0 }, { f: b, pos: p1, look: l1, fov: f1, ease, ...(via ? { path: via } : {}) }];
const RX = 4.5, LX = -4.5, G = 0.72, JZ = 32;      // right (his) track x, left (perfect) track x, half gauge, the joint the close-ups look at
const CAM = {
  a1: fl(0, 89, [3.4, 0.7, 9.2], [0.4, -0.3, 1.5], 44, [4.4, 3.6, 15], [0.2, -6, -18], 58, [[3.8, 1.8, 11.5]]),
  a2: fl(90, 179, [4.7, 0.95, 33.5], [4.6, 1.9, 22], 40, [4.5, 1.1, 32], [4.6, 1.9, 22], 38)
};
export const SHOTS = SC.map(([id, a, b, place, light]) => ({ id, a, b, place, light, k: CAM[id] }));
export const shotAt = (f) => (FORCE.shot ? SHOTS.find((s) => s.id === FORCE.shot) : null) || SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;
export const worldAt = (f) => { const S = shotAt(f); return { place: S.place, id: S.id, a: S.a, b: S.b }; };

// ---- scene changes (rule TRN-06: about 45 % dissolve, 20 % fly-through, 25 % hard cut, 10 % in-place). n = blend length in frames, centred on the boundary b.
export const TRANS = [];
const KICKS = [{ f: 353, a: 0.03 }, { f: 1650, a: 0.05 }, { f: 1688, a: 0.06 }];   // rule FX-05: a few impact kicks, not constant shake
export const camAt = (f) => {
  const S = shotAt(f), c = camFromKeys(S.k, f, { creep: 0, kicks: KICKS });
  c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {   // soft foreground / background on the close-ups (rule: reference videos blur 24-61 % of the frame edges)
  const S = shotAt(f), C = camAt(f);
  const cinf = { c1: 11, c5: 9, c12: 12, c13: 12, c14: 12, c16: 5, c18: 12, c8: 5, c7: 6, c4: 6, c6: 6, c10: 7 }[S.id] || 0;
  return { focus: dist(C.pos, C.look), cinf, near: 1 };
};

// ---- lights
export const LIGHTS = {
  day: { az: 120, el: 52, sky: '#bcd6f0', ground: '#c99a62', hemi: 1.1, sun: '#fff0d8', sunI: 2.5, fog: '#d8c0b8', fogNear: 60, fogFar: 700, skyTop: '#2a62cc', skyHor: '#a8cdf4', sat: 1.12, vig: 0.2, shadowExt: 30 },
  golden: { az: 60, el: 11, sky: '#e3a07c', ground: '#9a5c3a', hemi: 0.95, sun: '#ffb050', sunI: 3.1, fog: '#f0a070', fogNear: 28, fogFar: 240, skyTop: '#6e5aa8', skyHor: '#ffa860', sunDisc: '#fff0c8', sunSize: 0.004, sat: 1.18, gain: '#fff0dc', vig: 0.28, shadowExt: 30 },
  indoor: { az: 160, el: 35, sky: '#5a5a5a', ground: '#4a4a4a', hemi: 0.9, sun: '#ffeedd', sunI: 1.6, fog: '#2a2a2a', fogNear: 20, fogFar: 100, skyTop: '#222222', skyHor: '#333333', sat: 1.1, vig: 0.4, shadowExt: 15 }
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

// ---- story state (the world reads this every frame): rail gap, heat, buckle, trains, props
const ss = (a, b, f) => { const t = clamp((f - a) / (b - a)); return t * t * (3 - 2 * t); };
export const STATE = (f, S) => {
  const id = S.id, o = { gapR: 0.2, heatR: 0, heatL: 0, buckle: 0, trainL: null, trainR: null, saw: null, coin: false, paper: false };
  if (id === 'c1') { o.gapR = 0.2 * ss(28, 84, f); o.saw = f < 86 ? f / 30 : null; }
  if (id === 'c12') o.gapR = lerp(0.2, 0.1, ss(1024, 1076, f));
  if (id === 'c13') { o.gapR = lerp(0.1, 0.07, ss(1077, 1138, f)); o.coin = true; }
  if (id === 'c14') { o.gapR = lerp(0.07, 0.02, ss(1139, 1170, f)); o.paper = true; }
  if (id === 'c15') o.gapR = 0.02;
  if (id === 'c16' || id === 'c17') o.gapR = lerp(0.02, 0.012, ss(1264, 1473, f));
  if (id === 'c18') o.gapR = lerp(0.012, 0, ss(1474, 1530, f));
  if (id === 'c19') o.gapR = 0;
  // the sun heats the rails after the time jump
  const h = f < 1024 ? 0 : f < 1264 ? lerp(0, 0.12, ss(1024, 1264, f)) : lerp(0.12, 0.38, ss(1264, 1548, f));
  o.heatR = h;
  o.heatL = f < 1264 ? 0 : f < 1419 ? lerp(0.18, 0.72, ss(1264, 1418, f)) : lerp(0.72, 1, ss(1419, 1700, f));
  o.buckle = f < 1300 ? 0 : f < 1549 ? 0.1 * ss(1300, 1548, f) : lerp(0.1, 1, Math.pow(ss(1549, 1660, f), 1.5));
  if (id === 'c9') { if (f >= 692) o.trainL = 40 - (f - 692) * 0.66; if (f >= 770) o.trainR = 52 - (f - 770) * 0.52; }
  if (id === 'c19') o.trainL = 36 - (f - 1549) * 0.42;
  return o;
};

// ---- characters
// ov = outfit overrides (colours, beard...): the kit only reads these from the outfit object, so the outfit is copied and changed
const R = (T, who, o, pos, extra = {}) => { const { ov = {}, ...op } = o; return { key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, { ...T.OUTFITS[who], ...ov }, op), x: pos[0], y: pos[1], z: pos[2], ...extra }; };
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
const ENG = { who: 'worker1', o: { ov: { moustache: undefined, cap: '#c2733a' } } };
const BOSS = { who: 'councilman', o: { ov: { tunic: '#7a2a2a', dress: '#7a2a2a' } } };
const RIVAL = { who: 'council2', o: { ov: { skin: '#8c5a35', beard: '#111111', brows: '#111111', moustache: undefined, tunic: '#2c5a4a', dress: undefined } } };
const mix = (a, b, t) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); };
const purple = (t) => mix('#f5c9a0', '#8d54c8', Math.round(clamp(t) * 6) / 6);   // face turns purple in 6 steps (cards are cached per step)

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [], id = S.id;
  if (id === 'a1') out.push(R(T, ENG.who, { ...ENG.o, expr: 'proud', L: 'hip', R: 'hang', facing: -1, look: -0.3, blink: blinkAt(f, 1), ...idle(f, 1) }, [5.5, 0, 9.0]));
  if (id === 'a2') {
    out.push(R(T, BOSS.who, { ...BOSS.o, expr: 'angry', L: 'point', R: 'hang', facing: 1, blink: blinkAt(f, 2), ...idle(f, 2) }, [3.4, 0, 22]));
    out.push(R(T, ENG.who, { ...ENG.o, expr: 'stubborn', L: 'cross', R: 'cross', facing: -1, blink: blinkAt(f, 1), ...idle(f, 1) }, [5.7, 0, 22]));
  }
  return out;
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'a1') out.push(FX('crowd', (p) => T.crowd(p, { n: 4, mode: 'sit' }), [0.4, -0.05, 3.5], 1.5));
  return out;
};
export const LOOK = { sat: 1.0, vibr: 0.35, drift: 0.5, push: 0, ink: 3.2, grain: 0.09, grad: 0.10 };   // no automatic push-in zoom (rule CAM-03)
