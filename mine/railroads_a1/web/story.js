import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, M as MO } from './motion.js';
// Railroad story (v2): Gemini v1 polished by hand with the 17-video rules.
//  - one continuous camera flight per scene, fixed lens (CAM-03, CUT-03), scene changes mixed: hard cut / dissolve / fly-through (TRN-06)
//  - one-word captions (CAP-02, drawn in main.js), a few impact kicks (FX-05), painted surfaces + grain (COL-02/03)
export const FPS = 30, TOTAL = 1701, DECK = 0;
const SC = [
  ['c1', 0, 89, 'OUTDOOR', 'day'], ['c2', 90, 218, 'OUTDOOR', 'day'], ['c3', 219, 297, 'OFFICE', 'indoor'], ['c4', 298, 352, 'OUTDOOR', 'day'],
  ['c5', 353, 484, 'OUTDOOR', 'day'], ['c6', 485, 524, 'OUTDOOR', 'day'], ['c7', 525, 576, 'OUTDOOR', 'day'], ['c8', 577, 691, 'OUTDOOR', 'day'],
  ['c9', 692, 823, 'OUTDOOR', 'day'], ['c10', 824, 955, 'OFFICE', 'indoor'], ['c11', 956, 1023, 'OUTDOOR', 'golden'], ['c12', 1024, 1076, 'OUTDOOR', 'golden'],
  ['c13', 1077, 1138, 'OUTDOOR', 'golden'], ['c14', 1139, 1208, 'OUTDOOR', 'golden'], ['c15', 1209, 1263, 'OUTDOOR', 'golden'], ['c16', 1264, 1418, 'OUTDOOR', 'golden'],
  ['c17', 1419, 1473, 'OUTDOOR', 'golden'], ['c18', 1474, 1548, 'OUTDOOR', 'golden'], ['c19', 1549, 1700, 'OUTDOOR', 'golden']
];
export const FORCE = { shot: null, scene: null };   // set by main.js while it renders the OUTGOING picture of a dissolve
// one camera flight per scene: fl(a, b, from-pos, from-look, from-fov, to-pos, to-look, to-fov, [via points], ease)
const fl = (a, b, p0, l0, f0, p1, l1, f1, via = null, ease = 'easeOut') => [{ f: a, pos: p0, look: l0, fov: f0 }, { f: b, pos: p1, look: l1, fov: f1, ease, ...(via ? { path: via } : {}) }];
const RX = 4.5, LX = -4.5, G = 0.72, JZ = 32;      // right (his) track x, left (perfect) track x, half gauge, the joint the close-ups look at
const CAM = {
  c1: fl(0, 89, [6.4, 0.75, 34.2], [5.22, 0.45, 32], 36, [7.2, 1.6, 35.8], [5.0, 0.5, 31.6], 34, [[6.6, 1.0, 35.0]]),
  c2: fl(90, 218, [-4.5, 4.2, 14], [3.0, -3.5, -22], 52, [-2.0, 6.5, 9], [4.2, -6, -30], 54, [[-3.5, 5.0, 11.5]]),
  c3: fl(219, 297, [0, 1.5, 5], [0, 1.25, -1], 46, [0.3, 1.45, 3.2], [0, 1.4, -1], 40),
  c4: fl(298, 352, [3.0, 1.3, 26], [4.5, 1.35, 22], 38, [6.2, 1.45, 25.2], [4.5, 1.4, 22], 36, [[4.6, 1.3, 26.8]]),
  c5: fl(353, 484, [4.9, 0.55, 26.0], [3.4, 1.25, 20.8], 36, [4.3, 0.7, 25.2], [3.4, 1.3, 20.8], 36, [[4.6, 0.6, 25.6]]),
  c6: fl(485, 524, [4.5, 0.6, 27.0], [4.5, 1.2, 19.5], 36, [4.5, 0.7, 26.2], [4.5, 1.25, 19.5], 36),
  c7: fl(525, 576, [4.7, 0.55, 25.2], [5.9, 1.2, 19.5], 36, [5.1, 0.7, 24.5], [5.9, 1.25, 19.5], 36),
  c8: fl(577, 691, [-3.8, 0.5, 34], [-4.5, 0.35, 24], 40, [-4.4, 0.9, 6], [-4.5, 0.3, -10], 42, [[-4.0, 0.55, 20]]),
  c9: fl(692, 823, [0.5, 7.5, 31], [-4.5, 1, -12], 48, [3.5, 10.5, 25], [-2.5, 0, -30], 50, [[2.0, 9.0, 28]]),
  c10: fl(824, 955, [0.7, 1.45, 1.8], [-0.1, 1.3, -3.6], 40, [0.1, 1.5, 0.6], [-0.1, 1.3, -3.6], 36),
  c11: fl(956, 1023, [5.4, 1.2, 30], [4.7, 1.5, 23], 44, [8.5, 5.5, 38], [4.5, 1.0, 10], 50, [[7.2, 2.5, 34]]),
  c12: fl(1024, 1076, [6.6, 0.7, 34.2], [5.22, 0.42, 32], 36, [6.0, 0.62, 33.0], [5.22, 0.42, 32], 30),
  c13: fl(1077, 1138, [3.9, 0.9, 33.6], [5.22, 0.55, 32], 30, [4.2, 0.75, 33.0], [5.22, 0.55, 32], 28),
  c14: fl(1139, 1208, [6.8, 0.95, 33.8], [5.22, 0.55, 32], 30, [6.4, 0.8, 33.2], [5.22, 0.55, 32], 28),
  c15: fl(1209, 1263, [3.4, 1.5, 30], [4.6, 1.35, 24], 42, [6.4, 1.6, 29], [4.6, 1.35, 24], 38),
  c16: fl(1264, 1418, [-3.5, 0.55, 12], [-4.6, 0.35, -6], 40, [-3.9, 0.75, -4], [-4.6, 0.35, -22], 36, [[-3.7, 0.6, 4]]),
  c17: fl(1419, 1473, [-1.0, 3.5, 26], [-4.0, 0.5, -20], 50, [-6.5, 2.0, 14], [-4.5, 0.3, -26], 48),
  c18: fl(1474, 1548, [6.4, 0.6, 34.0], [5.22, 0.42, 32], 30, [5.9, 0.5, 32.9], [5.22, 0.42, 32], 24),
  c19: fl(1549, 1700, [-9, 11, 16], [-4.5, 0, -6], 48, [-8, 9, -8], [-4.5, 0, -27], 42, [[-10, 10, 6]])
};
export const SHOTS = SC.map(([id, a, b, place, light]) => ({ id, a, b, place, light, k: CAM[id] }));
export const shotAt = (f) => (FORCE.shot ? SHOTS.find((s) => s.id === FORCE.shot) : null) || SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;
export const worldAt = (f) => { const S = shotAt(f); return { place: S.place, id: S.id, a: S.a, b: S.b }; };

// ---- scene changes (rule TRN-06: about 45 % dissolve, 20 % fly-through, 25 % hard cut, 10 % in-place). n = blend length in frames, centred on the boundary b.
export const TRANS = [
  { b: 90, kind: 'dissolve', n: 8, from: 'c1', to: 'c2', fromShot: 'c1' }, { b: 219, kind: 'dissolve', n: 8, from: 'c2', to: 'c3', fromShot: 'c2' },
  { b: 298, kind: 'fly', n: 10, from: 'c3', to: 'c4', fromShot: 'c3' }, { b: 353, kind: 'cut' }, { b: 485, kind: 'dissolve', n: 8, from: 'c5', to: 'c6', fromShot: 'c5' },
  { b: 525, kind: 'cut' }, { b: 577, kind: 'cut' }, { b: 692, kind: 'dissolve', n: 8, from: 'c8', to: 'c9', fromShot: 'c8' },
  { b: 824, kind: 'dissolve', n: 8, from: 'c9', to: 'c10', fromShot: 'c9' }, { b: 956, kind: 'fly', n: 10, from: 'c10', to: 'c11', fromShot: 'c10' },
  { b: 1024, kind: 'dissolve', n: 8, from: 'c11', to: 'c12', fromShot: 'c11' }, { b: 1077, kind: 'cut' }, { b: 1139, kind: 'dissolve', n: 8, from: 'c13', to: 'c14', fromShot: 'c13' },
  { b: 1209, kind: 'cut' }, { b: 1264, kind: 'dissolve', n: 8, from: 'c15', to: 'c16', fromShot: 'c15' }, { b: 1419, kind: 'fly', n: 10, from: 'c16', to: 'c17', fromShot: 'c16' },
  { b: 1474, kind: 'dissolve', n: 8, from: 'c17', to: 'c18', fromShot: 'c17' }, { b: 1549, kind: 'fly', n: 10, from: 'c18', to: 'c19', fromShot: 'c18' }
];
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
  day: { lit: [1.25, 1.18, 1.05], shade: [0.46, 0.46, 0.64], lift: [0.03, 0.05, 0.1], az: 120, el: 52, sky: '#bcd6f0', ground: '#c99a62', hemi: 1.1, sun: '#fff0d8', sunI: 2.5, fog: '#d8c0b8', fogNear: 60, fogFar: 700, skyTop: '#2a62cc', skyHor: '#a8cdf4', sat: 1.12, vig: 0.2, shadowExt: 30 },
  golden: { lit: [1.4, 0.82, 0.42], shade: [0.3, 0.3, 0.52], lift: [0.04, 0.05, 0.14], az: 60, el: 11, sky: '#e3a07c', ground: '#9a5c3a', hemi: 0.95, sun: '#ffb050', sunI: 3.1, fog: '#f0a070', fogNear: 28, fogFar: 240, skyTop: '#6e5aa8', skyHor: '#ffa860', sunDisc: '#fff0c8', sunSize: 0.012, sat: 1.18, gain: '#fff0dc', vig: 0.28, shadowExt: 30 },
  indoor: { lit: [1.1, 1.05, 0.95], shade: [0.5, 0.5, 0.6], lift: [0.04, 0.04, 0.06], az: 160, el: 35, sky: '#5a5a5a', ground: '#4a4a4a', hemi: 0.9, sun: '#ffeedd', sunI: 1.6, fog: '#2a2a2a', fogNear: 20, fogFar: 100, skyTop: '#222222', skyHor: '#333333', sat: 1.1, vig: 0.4, shadowExt: 15 }
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
  if (id === 'c2') o.trainR = 30 - (f - 90) * 0.55;
  if (id === 'c9') { if (f >= 692) o.trainL = 40 - (f - 692) * 0.66; if (f >= 770) o.trainR = 52 - (f - 770) * 0.52; }
  if (id === 'c19') o.trainL = 36 - (f - 1549) * 0.42;
  return o;
};

// ---- characters
// ov = outfit overrides (colours, beard...): the kit only reads these from the outfit object, so the outfit is copied and changed
const R = (T, who, o, pos, extra = {}) => { const { ov = {}, ...op } = o; return { key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, { ...T.OUTFITS[who], ...ov }, op), x: pos[0], y: pos[1], z: pos[2], ...extra }; };
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
const ENG = { who: 'worker1', o: { ov: { moustache: undefined, cap: '#c2733a', tunic: '#2a9a8a' } } };
const BOSS = { who: 'councilman', o: { ov: { tunic: '#c9a02a', dress: null } } };
const RIVAL = { who: 'council2', o: { ov: { skin: '#8c5a35', beard: '#111111', brows: '#111111', moustache: undefined, tunic: '#2c5a4a', dress: undefined } } };
const mix = (a, b, t) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)), A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); };
const purple = (t) => mix('#f5c9a0', '#8d54c8', Math.round(clamp(t) * 6) / 6);   // face turns purple in 6 steps (cards are cached per step)

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [], id = S.id;
  if (id === 'c1') out.push(R(T, ENG.who, { ...ENG.o, expr: 'determined', L: 'hip', R: 'hang', facing: 0, look: 0.3, blink: blinkAt(f, 1), ...idle(f, 1) }, [6.9, 0, 29.4]));
  if (id === 'c3') out.push(R(T, BOSS.who, { ...BOSS.o, expr: 'proud', L: 'point', R: 'hang', facing: 1, blink: blinkAt(f, 2), ...idle(f, 2) }, [0, 0, -1]));
  if (id === 'c4') out.push(R(T, ENG.who, { ...ENG.o, expr: 'proud', L: 'hip', R: 'hang', facing: 0, blink: blinkAt(f, 1), ...idle(f, 1) }, [RX, 0, 22]));
  if (id === 'c5') out.push(R(T, BOSS.who, { ...BOSS.o, ov: { ...BOSS.o.ov, skin: purple(ss(430, 484, f)) }, expr: f < 430 ? 'shock' : 'angry+vein', L: 'point', R: 'hang', facing: 0, look: 0.4, blink: blinkAt(f, 2), ...idle(f, 2) }, [3.3, 0, 20.8]));
  if (id === 'c6') {
    out.push(R(T, BOSS.who, { ...BOSS.o, ov: { ...BOSS.o.ov, skin: purple(1) }, expr: 'angry+vein', L: 'point', R: 'hang', facing: 1, blink: blinkAt(f, 2), ...idle(f, 2) }, [3.9, 0, 19.5]));
    out.push(R(T, ENG.who, { ...ENG.o, expr: 'neutral', L: 'hang', R: 'hang', facing: -1, blink: blinkAt(f, 1), ...idle(f, 1) }, [5.1, 0, 19.5]));
  }
  if (id === 'c7') out.push(R(T, ENG.who, { ...ENG.o, expr: 'stubborn', L: 'cross', R: 'cross', facing: 0, blink: blinkAt(f, 1), ...idle(f, 1) }, [5.9, 0, 19.5]));
  if (id === 'c8') out.push(R(T, RIVAL.who, { ...RIVAL.o, expr: 'proud', L: 'point', R: 'hang', facing: 0, look: 0.3, blink: blinkAt(f, 3), ...idle(f, 3) }, [-2.7, 0, 20]));
  if (id === 'c10') out.push(R(T, BOSS.who, { ...BOSS.o, expr: 'sad+sweat', L: 'temple', R: 'hang', facing: 0, blink: blinkAt(f, 2), ...idle(f, 2) }, [0, 0, -4.4]));
  if (id === 'c11') out.push(R(T, ENG.who, { ...ENG.o, expr: 'neutral', L: 'point', R: 'hang', facing: 0, blink: blinkAt(f, 1), ...idle(f, 1) }, [RX + 0.4, 0, 23.5]));
  if (id === 'c13') out.push(R(T, ENG.who, { ...ENG.o, expr: 'neutral', L: 'reach', R: 'hang', facing: 0, look: 0.4, blink: blinkAt(f, 1), ...idle(f, 1) }, [6.8, 0, 29.5]));
  if (id === 'c14') out.push(R(T, BOSS.who, { ...BOSS.o, expr: 'grin', L: 'reach', R: 'hang', facing: 0, look: 0.4, blink: blinkAt(f, 2), ...idle(f, 2) }, [3.3, 0, 29.8]));
  if (id === 'c15') {
    out.push(R(T, BOSS.who, { ...BOSS.o, expr: 'laugh', L: 'hip', R: 'hang', facing: 1, blink: blinkAt(f, 2), ...idle(f, 2) }, [3.2, 0, 24]));
    out.push(R(T, ENG.who, { ...ENG.o, expr: 'neutral', L: 'cross', R: 'cross', facing: -1, blink: blinkAt(f, 1), ...idle(f, 1) }, [5.9, 0, 24]));
  }
  return out;
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [], id = S.id, st = STATE(f, S);
  if (id === 'c2') out.push(FX('crowd', (p) => T.crowd(p, { n: 10, mode: 'stand' }), [1.0, 0, 18.5], 1));
  if (id === 'c1' && st.saw !== null && f > 20) out.push(FX('sp', (p) => T.fxDebris(p, ((f % 9) / 9)), [RX + G + 0.1, 0.65, JZ], 0.25));
  if (id === 'c2' && st.trainR !== null) out.push(FX('smokeA', (p) => T.fxSmoke(p, (f % 33) / 33), [RX, 4.6 + ((f % 33) / 33) * 1.4, st.trainR - 3.2], 2.4));
  if (id === 'c9' && st.trainL !== null) out.push(FX('smoke', (p) => T.fxSmoke(p, (f % 40) / 40), [LX, 4.6 + ((f % 40) / 40) * 1.5, st.trainL - 3.2], 2.2));
  if (id === 'c9' && st.trainR !== null) out.push(FX('smoke2', (p) => T.fxSmoke(p, (f % 33) / 33), [RX, 4.6 + ((f % 33) / 33) * 1.4, st.trainR - 3.2], 2.0));
  if (id === 'c16') out.push(FX('glow', (p) => T.fxGlow(p, (f % 30) / 30, '#ffaa55'), [LX, 0.5, -10 - (f - 1264) * 0.06], 1.6));
  if (id === 'c17') out.push(FX('motes', (p) => T.fxMotes(p, (f % 60) / 60), [LX, 3, -6], 3));
  if (id === 'c18') out.push(FX('glow2', (p) => T.fxGlow(p, (f % 30) / 30, '#ffaa55'), [RX + G, 0.6, JZ], 0.9));
  if (id === 'c19') {
    if (f > 1630) out.push(FX('debris', (p) => T.fxDebris(p, Math.min(1, (f - 1630) / 70)), [LX + 0.6, 1.0, -22], 2.4));
    out.push(FX('smoke', (p) => T.fxSmoke(p, (f % 36) / 36), [LX, 4.6 + ((f % 36) / 36) * 1.5, (st.trainL ?? 0) - 3.2], 2.4));
    if (f > 1625) out.push(FX('dust', (p) => T.fxSmoke(p, ((f - 1625) % 50) / 50), [LX - 0.5, 0.8, -26], 3.2));
  }
  return out;
};
export const LOOK = { sat: 1.0, vibr: 0.35, drift: 0.5, push: 0, ink: 3.2, grain: 0.09, grad: 0.10 };   // no automatic push-in zoom (rule CAM-03)
