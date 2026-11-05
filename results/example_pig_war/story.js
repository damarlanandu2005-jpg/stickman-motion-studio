export const FPS = 30, TOTAL = 1030, DECK = 6;
export const SHOTS = [
  { id: 'pighead', a: 0, b: 38, light: 'dawn' },
  { id: 'armies', a: 39, b: 121, light: 'day' },
  { id: 'aerial', a: 122, b: 177, light: 'day' },
  { id: 'claim', a: 178, b: 253, light: 'day' },
  { id: 'porch', a: 254, b: 375, light: 'dawn' },
  { id: 'again', a: 376, b: 393, light: 'dawn' },
  { id: 'shot', a: 394, b: 425, light: 'dawn' },
  { id: 'owner', a: 426, b: 518, light: 'day' },
  { id: 'offer', a: 519, b: 561, light: 'day' },
  { id: 'threat', a: 562, b: 607, light: 'day' },
  { id: 'march', a: 608, b: 623, light: 'day' },
  { id: 'ship', a: 624, b: 657, light: 'day' },
  { id: 'campUS', a: 658, b: 690, light: 'day' },
  { id: 'campUK', a: 691, b: 735, light: 'day' },
  { id: 'stare', a: 736, b: 785, light: 'day' },
  { id: 'wait', a: 786, b: 828, light: 'cycle' },
  { id: 'throne', a: 829, b: 900, light: 'indoor' },
  { id: 'stamp', a: 901, b: 945, light: 'indoor' },
  { id: 'park', a: 946, b: 1030, light: 'golden' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const ramp = (f, a, b) => clamp((f - a) / (b - a));

export const LIGHTS = {
  day: { az: 140, el: 46, sky: '#6db0f2', ground: '#4c7a36', hemi: 1.15, sun: '#fffdf5', sunI: 2.5, fog: '#9ac5f0', fogNear: 70, fogFar: 900, skyTop: '#3f80d4', skyHor: '#a8d3f7', sat: 1.1, waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff', vig: 0.15, shadowExt: 18 },
  dawn: { az: -40, el: 12, sky: '#f2a89d', ground: '#6a5448', hemi: 1.0, sun: '#ffb58c', sunI: 2.2, fog: '#eebbb4', fogNear: 60, fogFar: 700, skyTop: '#9c6f8f', skyHor: '#f5ccb5', sunDisc: '#ffddc8', sunSize: 0.005, sat: 1.12, gain: '#fffcf5', waterDeep: '#3d5a86', waterShal: '#c48f70', glint: '#ffd8c8', vig: 0.26, shadowExt: 18 },
  golden: { az: -160, el: 8, sky: '#e8a964', ground: '#5e4832', hemi: 0.9, sun: '#ffa754', sunI: 2.8, fog: '#f0b88c', fogNear: 50, fogFar: 600, skyTop: '#8c607a', skyHor: '#ffc27e', sunDisc: '#fff0c8', sunSize: 0.006, sat: 1.15, gain: '#fffcf0', waterDeep: '#2a3b5c', waterShal: '#b56d40', glint: '#ffc8a0', vig: 0.3, shadowExt: 24 },
  indoor: { az: 30, el: 60, sky: '#333333', ground: '#222222', hemi: 1.5, sun: '#ffead9', sunI: 2.0, fog: '#443322', fogNear: 20, fogFar: 150, skyTop: '#111111', skyHor: '#222222', sat: 1.0, vig: 0.3, shadowExt: 10 },
  night: { az: 180, el: 40, sky: '#0a1526', ground: '#101621', hemi: 0.6, sun: '#88aaff', sunI: 0.8, fog: '#121f33', fogNear: 40, fogFar: 400, skyTop: '#040914', skyHor: '#112244', sat: 0.8, vig: 0.4, shadowExt: 18 }
};

export const lightFor = (S, f) => {
  if (S.id === 'wait') {
    const cycle = [LIGHTS.day, LIGHTS.golden, LIGHTS.night, LIGHTS.dawn];
    const t = ((f - 786) / 42) * 3; // 3 cycles
    const i = Math.floor(t) % 4, j = (i + 1) % 4, k = t % 1;
    const l1 = cycle[i], l2 = cycle[j];
    const L = { ...l1 };
    ['az', 'el', 'hemi', 'sunI', 'fogNear', 'fogFar', 'sat', 'vig', 'shadowExt'].forEach(p => L[p] = lerp(l1[p] || 0, l2[p] || 0, k));
    return L;
  }
  return { ...LIGHTS[S.light] };
};

const CAMS = {
  pighead: [
    { f: 0, pos: [2.5, 7.5, 1.5], look: [0, 7.3, 0], fov: 34 },
    { f: 38, pos: [2.7, 7.5, 1.7], look: [0, 7.3, 0], fov: 33 }
  ],
  armies: [
    { f: 39, pos: [3.5, 8.5, 8], look: [0, 7.3, 0], fov: 33 },
    { f: 121, pos: [1.5, 9.5, 12], look: [0, 7.3, 0], fov: 40 }
  ],
  aerial: [
    { f: 122, pos: [-150, 62, 150], look: [0, 0, 0], fov: 44 },
    { f: 177, pos: [-92, 44, 112], look: [0, 0, 0], fov: 42 }
  ],
  claim: [
    { f: 178, pos: [0, 7.5, 16], look: [0, 7.5, 0], fov: 46 },
    { f: 253, pos: [0, 7.5, 14], look: [0, 7.5, 0], fov: 44 }
  ],
  porch: [
    { f: 254, pos: [-4, 7.6, -14], look: [-5, 7.5, -20], fov: 34 },
    { f: 310, pos: [-4, 7.6, -14], look: [-5, 7.5, -20], fov: 34 },
    { f: 311, pos: [-2, 7.8, -12], look: [-1, 7.3, -20], fov: 44 },
    { f: 375, pos: [-4, 7.8, -12], look: [-2, 7.3, -20], fov: 44 }
  ],
  again: [
    { f: 376, pos: [-5, 7.5, -18], look: [-5, 7.5, -20], fov: 24 },
    { f: 386, pos: [-5, 7.5, -18], look: [-5, 7.5, -20], fov: 22 },
    { f: 387, pos: [-5, 7.5, -14], look: [-5, 7.5, -20], fov: 42 },
    { f: 393, pos: [-5, 7.5, -14], look: [-5, 7.5, -20], fov: 42 }
  ],
  shot: [
    { f: 394, pos: [-4, 8, -12], look: [-4, 7.5, -20], fov: 44 },
    { f: 425, pos: [-4, 8, -13], look: [-4, 7.5, -20], fov: 42 }
  ],
  owner: [
    { f: 426, pos: [-4, 8, -14], look: [-4, 7.5, -20], fov: 50 },
    { f: 518, pos: [-4, 8, -16], look: [-4, 7.5, -20], fov: 48 }
  ],
  offer: [
    { f: 519, pos: [-6, 8, -16], look: [-7, 7.5, -20], fov: 48 },
    { f: 561, pos: [-6, 8, -17], look: [-7, 7.5, -20], fov: 46 }
  ],
  threat: [
    { f: 562, pos: [-4, 8, -14], look: [-4, 7.5, -20], fov: 48 },
    { f: 607, pos: [-4, 8, -15], look: [-4, 7.5, -20], fov: 44, roll: 2 }
  ],
  march: [
    { f: 608, pos: [0, 7, 12], look: [0, 7.5, 0], fov: 38 },
    { f: 623, pos: [0, 7, 12], look: [0, 7.5, 0], fov: 38 }
  ],
  ship: [
    { f: 624, pos: [-20, 1.5, -40], look: [-20, 3, -60], fov: 46 },
    { f: 657, pos: [-20, 1.5, -40], look: [-20, 3, -60], fov: 44 }
  ],
  campUS: [
    { f: 658, pos: [-60, 8, 15], look: [-60, 7.5, 0], fov: 46 },
    { f: 690, pos: [-62, 8, 14], look: [-62, 7.5, 0], fov: 44 }
  ],
  campUK: [
    { f: 691, pos: [60, 8, 15], look: [60, 7.5, 0], fov: 46 },
    { f: 735, pos: [62, 8, 14], look: [62, 7.5, 0], fov: 44 }
  ],
  stare: [
    { f: 736, pos: [0, 8, 12], look: [0, 7.5, 0], fov: 40 },
    { f: 785, pos: [0, 8, 9], look: [0, 7.5, 0], fov: 34, roll: 3 }
  ],
  wait: [
    { f: 786, pos: [0, 8, 9], look: [0, 7.5, 0], fov: 34 },
    { f: 828, pos: [0, 9, 14], look: [0, 7.5, 0], fov: 40 }
  ],
  throne: [
    { f: 829, pos: [0, 15, 312], look: [0, 9, 290], fov: 40 },
    { f: 900, pos: [0, 12, 302], look: [0, 9, 290], fov: 36 }
  ],
  stamp: [
    { f: 901, pos: [0, 12, 302], look: [0, 9, 290], fov: 36 },
    { f: 945, pos: [0, 11, 298], look: [0, 9, 290], fov: 30 }
  ],
  park: [
    { f: 946, pos: [0, 8, -40], look: [0, 8, -60], fov: 46 },
    { f: 1000, pos: [0, 8, -44], look: [0, 8, -60], fov: 38 },
    { f: 1030, pos: [0, 8, -52], look: [0, 9, -60], fov: 31, roll: 2 }
  ]
};

const KICKS = [{ f: 404, a: 0.05 }, { f: 410, a: 0.03 }, { f: 640, a: 0.04 }, { f: 920, a: 0.05 }];

export const camAt = (f) => {
  const S = shotAt(f), K = CAMS[S.id];
  let c;
  if (f <= K[0].f) c = { ...K[0] };
  else if (f >= K[K.length - 1].f) c = { ...K[K.length - 1] };
  else for (let i = 0; i < K.length - 1; i++) if (f >= K[i].f && f <= K[i + 1].f) {
    const t = smooth((f - K[i].f) / (K[i + 1].f - K[i].f)), a = K[i], b = K[i + 1];
    c = { pos: lerp3(a.pos, b.pos, t), look: lerp3(a.look, b.look, t), fov: lerp(a.fov, b.fov, t), roll: lerp(a.roll || 0, b.roll || 0, t) };
  }
  for (const k of KICKS) { const d = f - k.f; if (d >= 0 && d < 7) { const s = (d % 2 ? -1 : 1) * k.a * (1 - d / 7); c.look = [c.look[0], c.look[1] + s * 3, c.look[2] + s * 2]; c.roll = (c.roll || 0) + s * 20; } }
  c.flash = f >= 178 && f < 181 ? (1 - (f - 178) / 3) * 0.85 : 
            f >= 394 && f < 397 ? (1 - (f - 394) / 3) * 0.85 : 
            f >= 829 && f < 832 ? (1 - (f - 829) / 3) * 0.85 : 
            f >= 946 && f < 949 ? (1 - (f - 946) / 3) * 0.85 : 0;
  return c;
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'pighead': return { focus: dist(C.pos, [0, 7.3, 0]), cinf: 12 };
    case 'armies': return { focus: dist(C.pos, [0, 7.3, 0]), cinf: 4 };
    case 'porch': return { focus: dist(C.pos, f < 311 ? [-5, 7.5, -20] : [-1, 7.3, -20]), cinf: 10 };
    case 'again': return { focus: dist(C.pos, [-5, 7.5, -20]), cinf: 14 };
    case 'shot': return { focus: dist(C.pos, [-5, 7.5, -20]), cinf: 8 };
    case 'owner': return { focus: dist(C.pos, [-4, 7.5, -20]), cinf: 10 };
    case 'offer': return { focus: dist(C.pos, [-5, 7.5, -20]), cinf: 10 };
    case 'threat': return { focus: dist(C.pos, [-2, 7.5, -20]), cinf: 10 };
    case 'stare': return { focus: dist(C.pos, [0, 7.5, 0]), cinf: 14 };
    case 'wait': return { focus: dist(C.pos, [0, 7.5, 0]), cinf: 12 };
    case 'stamp': return { focus: dist(C.pos, [0, 9, 290]), cinf: 10 };
    case 'park': return { focus: dist(C.pos, [0, 9, -60]), cinf: lerp(4, 14, smooth(ramp(f, 946, 1000))) };
  }
  return { focus: 10, cinf: 0 };
};

export const worldAt = (f) => {
  return {};
};

const blinkAt = (f, seed) => { const per = 38 + (seed * 17) % 31, ph = (f + seed * 13) % per; return ph < 2 ? 0.5 : ph < 4 ? 1 : 0; };
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const q = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = '#ffffff';
  
  if (['pighead', 'armies', 'porch', 'again', 'shot', 'owner', 'offer', 'threat'].includes(S.id)) {
    const chew = f < 404 ? f / 30 : 0;
    const ko = f >= 425;
    const spin = f >= 404 && f < 415 ? (f - 404) * 32 : (ko ? 180 : 0);
    const hop = f >= 404 && f < 415 ? Math.sin((f - 404)/11 * Math.PI) * 1.15 : 0;
    const eye = f >= 404 ? 'guilty' : (f > 120 ? 'alert' : 'guilty');
    if (S.id !== 'again') {
      out.push({ key: 'pig' + chew + ko + hop + spin, draw: (p) => T.drawPig(p, { chew, ko, spin, hop, eye }), x: 0, y: DECK, z: 0, order: 2, shadow: true });
    }
  }

  switch (S.id) {
    case 'armies': {
      for (let i = 0; i < 3; i++) {
        out.push(R(T, 'usSoldier', { L: f > 100 ? 'reach' : 'hang', R: f > 100 ? 'spear' : 'hang', expr: 'stern', facing: 1, seed: i }, [-4 - i * 1.5, DECK, i * 0.5], { tint }));
        out.push(R(T, 'ukSoldier', { L: f > 100 ? 'reach' : 'hang', R: f > 100 ? 'spear' : 'hang', expr: 'stern', facing: -1, seed: i + 5 }, [4 + i * 1.5, DECK, i * 0.5], { tint }));
      }
      break;
    }
    case 'claim': {
      const bV = f >= 180 && f < 250;
      out.push(R(T, 'farmer', { expr: 'stubborn', L: 'hip', R: 'reach', facing: 1, bob: bV ? 0.02 : 0, seed: 10 }, [-2, DECK, 0]));
      out.push(R(T, 'brit', { expr: 'stubborn', L: 'reach', R: 'hang', facing: -1, bob: bV ? 0.02 : 0, flush: 0.5, seed: 11 }, [2, DECK, 0]));
      break;
    }
    case 'porch': {
      out.push(R(T, 'farmer', { expr: f > 310 ? 'nervous' : 'smile', L: 'hip', R: 'reach', facing: 1, seed: 10 }, [-5, DECK, -20]));
      break;
    }
    case 'again': {
      const tw = f % 6 < 3 ? 0.5 : 0;
      out.push(R(T, 'farmer', { expr: 'stubborn', L: 'hip', R: f > 386 ? 'spear' : 'hip', headTilt: tw, facing: 1, seed: 10 }, [-5, DECK, -20]));
      break;
    }
    case 'shot': {
      out.push(R(T, 'farmer', { expr: f > 413 ? 'shock' : 'stern', L: 'reach', R: 'spear', tilt: f > 404 && f < 411 ? -3 : 0, facing: 1, seed: 10 }, [-5, DECK, -20]));
      break;
    }
    case 'owner': case 'offer': case 'threat': {
      const flush = S.id === 'owner' ? clamp((f - 426) / 50, 0.1, 0.5) : 0.5;
      const bV = S.id === 'owner' ? f > 450 : (S.id === 'threat' ? true : false);
      const bx = S.id === 'owner' ? clamp(2 + (460 - f) * 0.1, 2, 8) : 2;
      out.push(R(T, 'farmer', { expr: 'nervous', L: 'hang', R: 'hang', facing: 1, seed: 10 }, [-5, DECK, -20]));
      out.push(R(T, 'brit', { expr: 'stubborn', L: 'reach', R: 'hang', facing: -1, bob: bV ? 0.02 : 0, flush, seed: 11 }, [-2, DECK, -20]));
      break;
    }
    case 'march': {
      for (let i = 0; i < 7; i++) {
        const x = -8 + ((f - 608) * 0.1) + i * 2;
        const type = i % 2 ? 'ukSoldier' : 'usSoldier';
        out.push(R(T, type, { L: 'hang', R: 'spear', expr: 'stern', facing: 1, step: q((f - 608) / 10), seed: i }, [x, DECK, 0]));
      }
      break;
    }
    case 'campUS': {
      for (let i = 0; i < 4; i++) {
        out.push(R(T, 'usSoldier', { L: 'hang', R: 'spear', expr: i%2 ? 'smile' : 'neutral', facing: -1, seed: i }, [-60 + i * 1.5, DECK, -3 + i * 0.5]));
      }
      break;
    }
    case 'campUK': {
      for (let i = 0; i < 4; i++) {
        out.push(R(T, 'ukSoldier', { L: 'hang', R: 'spear', expr: i%2 ? 'smile' : 'neutral', facing: 1, seed: i+5 }, [60 - i * 1.5, DECK, -3 + i * 0.5]));
      }
      break;
    }
    case 'stare': {
      const e = f > 770 ? 'nervous' : (f > 750 ? 'stubborn' : 'stern');
      const tw = f > 770 && f % 8 < 4 ? 0.5 : 0;
      out.push(R(T, 'usSoldier', { L: 'reach', R: 'spear', expr: e, headTilt: tw, facing: 1, seed: 0 }, [-1.5, DECK, 0]));
      out.push(R(T, 'ukSoldier', { L: 'reach', R: 'spear', expr: e, headTilt: tw, facing: -1, seed: 1 }, [1.5, DECK, 0]));
      break;
    }
    case 'wait': {
      const e = f > 800 ? 'snore' : 'dazed';
      const r = f > 800 ? 5 : 0;
      const typeUS = f > 794 ? 'oldUS' : 'usSoldier';
      const typeUK = f > 794 ? 'oldUK' : 'ukSoldier';
      out.push(R(T, typeUS, { L: 'reach', R: 'spear', expr: e, tilt: -r, facing: 1, seed: 0 }, [-1.5, DECK, 0]));
      out.push(R(T, typeUK, { L: 'reach', R: 'spear', expr: e, tilt: r, facing: -1, seed: 1 }, [1.5, DECK, 0]));
      break;
    }
    case 'throne': case 'stamp': {
      out.push(R(T, 'emperor', { expr: f > 930 ? 'grin' : 'smile', L: 'belly', R: f > 930 ? 'up' : 'point', facing: 0, seed: 20 }, [0, 9, 288]));
      out.push(R(T, 'guard', { expr: 'stern', L: 'hang', R: 'spear', facing: 1, seed: 21 }, [-3, 9, 286]));
      out.push(R(T, 'guard', { expr: 'stern', L: 'hang', R: 'spear', facing: -1, seed: 22 }, [3, 9, 286]));
      break;
    }
    case 'park': {
      out.push({ key: 'pigStatue', draw: (p) => T.drawPigStatue(p, {}), x: 0, y: DECK + 2, z: -60, order: 2, shadow: true });
      out.push(R(T, 'usSoldier', { expr: 'pained', L: 'cross', R: 'cross', facing: 1, seed: 0 }, [-3, DECK, -58]));
      out.push(R(T, 'ukSoldier', { expr: 'pained', L: 'cross', R: 'cross', facing: -1, seed: 1 }, [3, DECK, -58]));
      out.push(R(T, 'farmer', { expr: 'pained', L: 'cross', R: 'cross', facing: 1, seed: 10 }, [-1.5, DECK, -56]));
      out.push(R(T, 'brit', { expr: 'pained', L: 'cross', R: 'cross', facing: -1, seed: 11 }, [1.5, DECK, -56]));
      break;
    }
  }
  return out;
};

const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  
  if (S.id === 'pighead') {
    for (let i = 0; i < 9; i++) {
      const t = ((f) * 0.012 + i / 9) % 1, cols = ['#d9822b', '#c4452c', '#e6b13a'];
      const x = -4 + t * 7 + Math.sin(i * 3.1) * 0.6, y = DECK + 3.2 - t * 3.4 + Math.sin(t * 9 + i) * 0.25, z = -1.5 + i * 0.45;
      out.push(FX('leaf' + i % 3, (p) => T.fxLeaf(p, cols[i % 3]), [x, y, z], 0.12, { roll: q(t * 8 + i, 1) }));
    }
  }
  if (S.id === 'porch') {
    if (f < 330) {
      const t = q(((f - 254) / 50) % 1, 2);
      out.push(FX('steam' + t, (p) => T.fxSteam(p, t), [-4.8, DECK + 1, -19.5], 0.4));
    }
  }
  if (S.id === 'shot') {
    if (f >= 404 && f < 410) {
      out.push(FX('sparkle', (p) => T.fxSparkle(p, f), [-4.5, DECK + 1.2, -19.5], 0.8));
    }
    if (f >= 406 && f < 439) {
      const t = q((f - 406)/33, 2);
      out.push(FX('dust', (p) => T.fxDust(p, t, '#cccccc'), [-4.5, DECK + 1.5, -19.5], 1.2));
    }
    if (f >= 415) {
      out.push(FX('stars', (p) => T.fxStars(p, f), [0, DECK + 1, 0], 0.5));
    }
  }
  if (['owner', 'offer', 'threat'].includes(S.id)) {
    if (f > 426) {
      out.push(FX('stars', (p) => T.fxStars(p, f), [0, DECK + 1, 0], 0.5));
      out.push(FX('halo', (p) => T.fxHalo(p, f), [0, DECK + 1.5, 0], 0.5));
    }
    if (S.id === 'owner' && f > 476) {
      out.push(FX('bubble100', (p) => T.fxBubble(p, "$100"), [-2, DECK + 2, -20], 1.0));
      const t = q(((f - 476) / 50) % 1, 2);
      out.push(FX('steam' + t, (p) => T.fxSteam(p, t), [-2.5, DECK + 1.5, -20], 0.4));
    }
    if (S.id === 'offer') {
      out.push(FX('bubble10', (p) => T.fxBubbleSmall(p, "$10"), [-5, DECK + 2, -20], 1.0));
      out.push(FX('coin', (p) => T.fxCoin(p, f), [-4.5, DECK + 1, -20], 0.5));
    }
    if (S.id === 'threat' && f > 562) {
      out.push(FX('cuffs', (p) => T.fxCuffs(p, f), [-3.5, DECK + 1, -20], 0.6));
      out.push(FX('drip', (p) => T.fxDrip(p), [-5.5, DECK + 1.62 - (f - 562) * 0.01, -19.5], 0.18));
    }
  }
  if (S.id === 'stare') {
    out.push(FX('drip1', (p) => T.fxDrip(p), [-1.8, DECK + 1.62 - (f % 30) * 0.02, 0], 0.18));
    out.push(FX('drip2', (p) => T.fxDrip(p), [1.8, DECK + 1.62 - (f % 30) * 0.02, 0], 0.18));
  }
  if (S.id === 'wait') {
    out.push(FX('calendar', (p) => T.fxCalendar(p, f), [0, DECK + 1, 5], 1.0));
    for (let i = 0; i < 9; i++) {
      const t = ((f) * 0.012 + i / 9) % 1, cols = ['#d9822b', '#c4452c', '#e6b13a'];
      const x = -4 + t * 7 + Math.sin(i * 3.1) * 0.6, y = DECK + 3.2 - t * 3.4 + Math.sin(t * 9 + i) * 0.25, z = 5;
      out.push(FX('leaf' + i % 3, (p) => T.fxLeaf(p, cols[i % 3]), [x, y, z], 0.12, { roll: q(t * 8 + i, 1) }));
    }
  }
  if (S.id === 'stamp') {
    if (f >= 908 && f < 918) {
      out.push(FX('stampCard', (p) => T.fxStamp(p), [0, 9 + (918-f)*0.1, 290], 1.5));
    }
    if (f >= 918 && f < 930) {
      const t = q((f - 918)/12, 2);
      out.push(FX('dust', (p) => T.fxDust(p, t, '#e8dcc4'), [0, 9.2, 290], 1.5));
    }
    if (f >= 930) {
      out.push(FX('sparkle', (p) => T.fxSparkle(p, f), [0, 10, 290], 1.0));
    }
  }
  if (S.id === 'park') {
    for (let i = 0; i < 9; i++) {
      const t = ((f) * 0.005 + i / 9) % 1;
      const x = -6 + t * 12 + Math.sin(i * 3.1) * 0.6, y = DECK + 5.2 - t * 5.4 + Math.sin(t * 9 + i) * 0.25, z = -58 + i * 0.45;
      out.push(FX('leaf' + i % 3, (p) => T.fxLeaf(p, '#ffb6c1'), [x, y, z], 0.08, { roll: q(t * 8 + i, 1) }));
    }
    if (f > 1020) {
      out.push(FX('halo', (p) => T.fxHalo(p, f), [0, DECK + 4, -60], 0.8));
      out.push(FX('sparkle', (p) => T.fxSparkle(p, f), [0, DECK + 4.5, -60], 0.5));
    }
  }
  
  return out;
};
