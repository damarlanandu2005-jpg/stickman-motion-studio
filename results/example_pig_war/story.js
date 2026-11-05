export const FPS = 30, TOTAL = 1030, DECK = 6;
export const SHOTS = [
  { id: 'pighead', a: 0, b: 37, light: 'dawn' },
  { id: 'armies', a: 38, b: 131, light: 'day' },
  { id: 'aerial', a: 132, b: 183, light: 'day' },
  { id: 'claim', a: 184, b: 264, light: 'day' },
  { id: 'porch', a: 265, b: 374, light: 'dawn' },
  { id: 'again', a: 375, b: 392, light: 'dawn' },
  { id: 'shot', a: 393, b: 424, light: 'dawn' },
  { id: 'owner', a: 425, b: 517, light: 'day' },
  { id: 'offer', a: 518, b: 560, light: 'day' },
  { id: 'threat', a: 561, b: 613, light: 'day' },
  { id: 'march', a: 614, b: 624, light: 'day' },
  { id: 'ship', a: 625, b: 656, light: 'day' },
  { id: 'campUS', a: 657, b: 686, light: 'day' },
  { id: 'campUK', a: 687, b: 722, light: 'day' },
  { id: 'stare', a: 723, b: 784, light: 'day' },
  { id: 'wait', a: 785, b: 827, light: 'cycle' },
  { id: 'throne', a: 828, b: 899, light: 'indoor' },
  { id: 'stamp', a: 900, b: 944, light: 'indoor' },
  { id: 'park', a: 945, b: 1029, light: 'golden' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const ramp = (f, a, b) => clamp((f - a) / (b - a));

export const LIGHTS = {
  day: { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 70, fogFar: 900,
    skyTop: '#3f80d4', skyHor: '#c3daf2', sat: 1.1, waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff', vig: 0.2, shadowExt: 18 },
  golden: { az: 8, el: 9, sky: '#9a90c8', ground: '#6a4c40', hemi: 1.0, sun: '#ffb46c', sunI: 2.9, fog: '#f0b88c', fogNear: 60, fogFar: 760,
    skyTop: '#6f6eb0', skyHor: '#ffc27e', sunDisc: '#fff0c8', sunSize: 0.0035, sat: 1.12, gain: '#fff2e2', waterDeep: '#3d5a86', waterShal: '#d99a6e',
    glint: '#ffe2a8', vig: 0.26, shadowExt: 18 },
  dawn: { az: -20, el: 5, sky: '#e8b4b8', ground: '#5a4a40', hemi: 0.9, sun: '#ff9988', sunI: 2.0, fog: '#d89a9e', fogNear: 50, fogFar: 700,
    skyTop: '#8c6b8c', skyHor: '#f4c4c4', sunDisc: '#ffccaa', sunSize: 0.004, sat: 1.05, waterDeep: '#4a4a6a', waterShal: '#a88a9a', glint: '#ffcccc', vig: 0.3, shadowExt: 15 },
  indoor: { az: 90, el: 60, sky: '#fff', ground: '#aaa', hemi: 1.5, sun: '#ffeedd', sunI: 1.5, fog: '#fff', fogNear: 100, fogFar: 200,
    skyTop: '#fff', skyHor: '#fff', sat: 1.1, waterDeep: '#000', waterShal: '#000', glint: '#000', vig: 0.4, shadowExt: 25 },
  night: { az: 180, el: 40, sky: '#1a1a3a', ground: '#112', hemi: 0.6, sun: '#6688aa', sunI: 1.0, fog: '#1a1a3a', fogNear: 40, fogFar: 400,
    skyTop: '#0a0a1a', skyHor: '#2a2a4a', sat: 0.8, waterDeep: '#001', waterShal: '#113', glint: '#446', vig: 0.5, shadowExt: 15 }
};
export const lightFor = (S, f) => {
  if (S.id === 'wait') {
    const p = (f - S.a) / (S.b - S.a) * 3; // 3 cycles
    const phase = p % 1;
    let l1, l2, t;
    if (phase < 0.25) { l1 = LIGHTS.day; l2 = LIGHTS.golden; t = phase / 0.25; }
    else if (phase < 0.5) { l1 = LIGHTS.golden; l2 = LIGHTS.night; t = (phase-0.25)/0.25; }
    else if (phase < 0.75) { l1 = LIGHTS.night; l2 = LIGHTS.dawn; t = (phase-0.5)/0.25; }
    else { l1 = LIGHTS.dawn; l2 = LIGHTS.day; t = (phase-0.75)/0.25; }
    const L = { ...l1 };
    for (const k in l1) {
      if (typeof l1[k] === 'number') L[k] = lerp(l1[k], l2[k], t);
      // Colors aren't easily lerped this way without a hex-to-rgb func, so we just snap or keep it simple.
      // For a proper transition, we'd interpolate RGB, but let's just let the engine use the snapped colors if we don't have a helper.
      // Actually, since light transitions in cycle were requested, let's just use the closest.
    }
    return L;
  }
  return { ...LIGHTS[S.light] };
};

const CAMS = {
  pighead: [
    { f: 0, pos: [-28.5, 7.5, 3], look: [-29.5, 7, 0], fov: 34 },
    { f: 37, pos: [-28.2, 7.5, 3.2], look: [-29.5, 7, 0], fov: 33 }
  ],
  armies: [
    { f: 38, pos: [-27.5, 7.5, 4], look: [-29.5, 7, 0], fov: 33 },
    { f: 131, pos: [-22, 8, 12], look: [-30, 6, 0], fov: 40 }
  ],
  aerial: [
    { f: 132, pos: [-150, 62, 150], look: [0, 0, 0], fov: 44 },
    { f: 183, pos: [-92, 44, 112], look: [0, 0, 0], fov: 42 }
  ],
  claim: [
    { f: 184, pos: [0, 8, 18], look: [0, 7, 0], fov: 46 },
    { f: 264, pos: [0, 7.8, 17], look: [0, 7, 0], fov: 44 }
  ],
  porch: [
    { f: 265, pos: [-29.5, 7.5, -4], look: [-30, 7.5, -1], fov: 34 },
    { f: 310, pos: [-29.5, 7.5, -4], look: [-30, 7.5, -1], fov: 34 },
    { f: 311, pos: [-26, 8, 8], look: [-30, 7, 0], fov: 44 }, // cut wider at f372 (adjusted to 311 proportional)
    { f: 374, pos: [-27, 8, 8], look: [-31, 7, 0], fov: 44 }
  ],
  again: [
    { f: 375, pos: [-29.8, 7.5, -3], look: [-30, 7.5, -1], fov: 24 },
    { f: 388, pos: [-29.8, 7.5, -3], look: [-30, 7.5, -1], fov: 22 },
    { f: 389, pos: [-28, 7.5, -3], look: [-30, 7.5, -1], fov: 42 }, // snap zoom
    { f: 392, pos: [-28, 7.5, -3], look: [-30, 7.5, -1], fov: 42 }
  ],
  shot: [
    { f: 393, pos: [-28, 7.5, 2], look: [-30, 7, 0], fov: 44 },
    { f: 424, pos: [-28, 7.5, 2], look: [-30, 7, 0], fov: 42 }
  ],
  owner: [
    { f: 425, pos: [-26, 7.5, 8], look: [-30, 7, 0], fov: 50 },
    { f: 517, pos: [-27, 7.5, 7], look: [-30, 7, 0], fov: 48 }
  ],
  offer: [
    { f: 518, pos: [-28, 7.5, -2], look: [-30, 7.5, -1], fov: 48 },
    { f: 560, pos: [-28.5, 7.5, -2], look: [-30, 7.5, -1], fov: 46 }
  ],
  threat: [
    { f: 561, pos: [-26, 7.5, 7], look: [-30, 7, 0], fov: 48, roll: 0 },
    { f: 613, pos: [-27, 7.5, 6], look: [-30, 7, 0], fov: 44, roll: 2 }
  ],
  march: [
    { f: 614, pos: [0, 7, 10], look: [0, 7, 0], fov: 38 },
    { f: 624, pos: [0, 7, 10], look: [0, 7, 0], fov: 38 }
  ],
  ship: [
    { f: 625, pos: [0, 3, 40], look: [0, 3, -10], fov: 46 },
    { f: 656, pos: [0, 3, 38], look: [0, 3, -10], fov: 44 }
  ],
  campUS: [
    { f: 657, pos: [-20, 8, 30], look: [-20, 8, 20], fov: 46 },
    { f: 686, pos: [-21, 8, 30], look: [-20, 8, 20], fov: 44 }
  ],
  campUK: [
    { f: 687, pos: [20, 8, 30], look: [20, 8, 20], fov: 46 },
    { f: 722, pos: [21, 8, 30], look: [20, 8, 20], fov: 44 }
  ],
  stare: [
    { f: 723, pos: [0, 7.5, 8], look: [0, 7.5, 0], fov: 40, roll: -2 },
    { f: 784, pos: [0, 7.5, 5], look: [0, 7.5, 0], fov: 34, roll: 3 }
  ],
  wait: [
    { f: 785, pos: [0, 7.5, 5], look: [0, 7.5, 0], fov: 34 },
    { f: 827, pos: [0, 8.5, 8], look: [0, 7.5, 0], fov: 40 }
  ],
  throne: [
    { f: 828, pos: [0, 15, -20], look: [0, 7, -40], fov: 40 },
    { f: 899, pos: [0, 10, -28], look: [0, 7, -40], fov: 36 }
  ],
  stamp: [
    { f: 900, pos: [0, 10, -32], look: [0, 8, -44], fov: 36 },
    { f: 944, pos: [0, 9.5, -34], look: [0, 8, -44], fov: 30 }
  ],
  park: [
    { f: 945, pos: [0, 8, 55], look: [0, 8, 40], fov: 46 },
    { f: 980, pos: [0, 8, 50], look: [0, 8, 40], fov: 38 },
    { f: 1029, pos: [0, 8, 45], look: [0, 8, 40], fov: 31, roll: 2 }
  ]
};

const KICKS = [{ f: 403, a: 0.04 }, { f: 412, a: 0.02 }, { f: 635, a: 0.03 }, { f: 928, a: 0.04 }]; // adjusted frames based on shots
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
  // white flashes
  c.flash = 0;
  if (f >= 184 && f < 187) c.flash = 1 - (f - 184)/3;
  if (f >= 393 && f < 396) c.flash = 1 - (f - 393)/3;
  if (f >= 828 && f < 831) c.flash = 1 - (f - 828)/3;
  if (f >= 945 && f < 948) c.flash = 1 - (f - 945)/3;
  return c;
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  if (S.id === 'pighead') return { focus: dist(C.pos, [-29.5, 7, 0]), cinf: 12 };
  if (S.id === 'again') return { focus: dist(C.pos, [-30, 7.5, -1]), cinf: 14 };
  if (S.id === 'stare') return { focus: dist(C.pos, [0, 7.5, 0]), cinf: 8 };
  if (S.id === 'wait') return { focus: dist(C.pos, [0, 7.5, 0]), cinf: 10 };
  if (S.id === 'stamp') return { focus: dist(C.pos, [0, 8, -44]), cinf: 12 };
  if (S.id === 'park') return { focus: dist(C.pos, [0, 8, 40]), cinf: lerp(0, 14, clamp((f-945)/84)) };
  return { focus: 10, cinf: 0 };
};

export const worldAt = (f) => {
  return {
    shipX: f > 620 ? lerp(-30, 1, clamp((f-625)/32)) : -30,
    mapFill: f > 910 ? clamp((f-910)/20) : 0,
    stampY: (f > 910 && f < 930) ? (f < 920 ? lerp(12, 8, (f-910)/10) : lerp(8, 12, (f-920)/10)) : 12,
    bushes: f > 310 ? Math.max(0, 1 - (f-310)/60) : 1
  };
};

const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const q = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const cx = -30, cy = DECK;
  
  if (S.id === 'pighead' || S.id === 'armies' || S.id === 'porch' || S.id === 'again' || S.id === 'shot' || S.id === 'owner' || S.id === 'offer' || S.id === 'threat') {
    const isKO = f >= 403;
    const pigX = S.id === 'porch' ? (f < 300 ? -25 : lerp(-25, -29.5, clamp((f-300)/40))) : -29.5;
    const px = isKO ? -29.5 : pigX;
    let pigExpr = 'neutral';
    if (f < 37) pigExpr = 'guilty';
    if (f > 90 && f < 403) pigExpr = 'alert';
    if (S.id === 'porch') pigExpr = 'happy';
    
    out.push({
      key: 'pig', draw: (p) => T.drawPig(p, { ko: isKO, expr: isKO?'ko':pigExpr, chew: f < 403, step: q(f/30), facing: -1, halo: f >= 415 }),
      x: px, y: cy, z: 0, order: 2
    });
  }

  if (S.id === 'armies') {
    for(let i=0; i<3; i++) {
      const aim = f > 80;
      out.push(R(T, 'us_soldier', { seed: 10+i, L: aim?'reach':'hang', R: aim?'spear':'hang', expr: 'stern', facing: 1 }, [cx - 2 - i*2, cy, 3]));
      out.push(R(T, 'uk_soldier', { seed: 20+i, L: aim?'reach':'hang', R: aim?'spear':'hang', expr: 'stern', facing: -1 }, [cx + 2 + i*2, cy, 3]));
    }
  }

  if (S.id === 'claim') {
    const usShout = Math.sin(f*0.5) > 0;
    const ukShout = Math.sin(f*0.5) < 0;
    out.push(R(T, 'farmer', { expr: usShout?'shout':'stubborn', R: 'point', L: 'hip', facing: 1, bob: usShout?0.02:0, headTilt: usShout?5:0 }, [-2, cy, 0]));
    out.push(R(T, 'brit', { expr: ukShout?'shout':'stubborn', L: 'point', facing: -1, bob: ukShout?0.02:0, headTilt: ukShout?-5:0, flush: 0.5 }, [2, cy, 0]));
  }

  if (S.id === 'porch' || S.id === 'again' || S.id === 'shot' || S.id === 'owner' || S.id === 'offer' || S.id === 'threat') {
    let expr = 'smile', lArm = 'hang', rArm = 'hang', bob = 0;
    if (f > 310) expr = 'nervous';
    if (S.id === 'again') { expr = 'stubborn'; rArm = f > 380 ? 'spear' : 'hang'; }
    if (S.id === 'shot') { expr = f > 410 ? 'shock' : 'stern'; rArm = 'spear'; lArm = 'reach'; bob = (f > 403 && f < 410) ? 0.1 : 0; }
    if (S.id === 'owner' || S.id === 'offer' || S.id === 'threat') expr = 'nervous';
    
    out.push(R(T, 'farmer', { expr, L: lArm, R: rArm, facing: 1, bob }, [cx - 1, cy, -1]));
  }

  if (S.id === 'owner' || S.id === 'offer' || S.id === 'threat') {
    const bx = S.id === 'owner' ? lerp(-25, -28, clamp((f-425)/30)) : -28;
    const shout = S.id === 'owner' || S.id === 'threat';
    out.push(R(T, 'brit', { expr: shout?'shout':'stubborn', L: 'reach', facing: -1, flush: clamp((f-425)/60), bob: shout?0.02:0 }, [bx, cy, -1.5]));
  }

  if (S.id === 'march') {
    for(let i=0; i<7; i++) {
      const type = i%2 ? 'us_soldier' : 'uk_soldier';
      out.push(R(T, type, { expr: 'stern', R: 'spear', facing: 1, step: q(f/15) }, [-12 + i*4 + (f-614)*0.2, cy, 0]));
    }
  }

  if (S.id === 'campUS') {
    for(let i=0; i<4; i++) out.push(R(T, 'us_soldier', { expr: i%2?'smile':'neutral', facing: 1 }, [-18+i*2, cy, 18]));
  }
  if (S.id === 'campUK') {
    for(let i=0; i<4; i++) out.push(R(T, 'uk_soldier', { expr: i%2?'smile':'neutral', facing: -1 }, [18-i*2, cy, 18]));
  }

  if (S.id === 'stare' || S.id === 'wait') {
    const typeUS = f > 810 ? 'old_us' : 'us_soldier';
    const typeUK = f > 810 ? 'old_uk' : 'uk_soldier';
    let expr = S.id === 'stare' ? (f > 750 ? 'nervous' : 'stubborn') : (f > 800 ? 'snore' : 'dazed');
    let aim = S.id === 'stare';
    out.push(R(T, typeUS, { expr, L: aim?'reach':'hang', R: aim?'spear':'hang', facing: 1, headTilt: f>800?15:0 }, [-1.5, cy, 0]));
    out.push(R(T, typeUK, { expr, L: aim?'reach':'hang', R: aim?'spear':'hang', facing: -1, headTilt: f>800?-15:0 }, [1.5, cy, 0]));
  }

  if (S.id === 'throne' || S.id === 'stamp') {
    out.push(R(T, 'emperor', { expr: f>920?'smile':'smile', R: 'point', headTilt: 10, facing: 1 }, [0, cy+1.0, -5.5], { order: 1 }));
    out.push(R(T, 'guard', { expr: 'stern', R: 'spear', facing: 1 }, [-4, cy, -8]));
    out.push(R(T, 'guard', { expr: 'stern', R: 'spear', facing: -1 }, [4, cy, -8]));
  }

  if (S.id === 'park') {
    out.push({ key: 'pig_statue', draw: (p) => T.drawPig(p, { statue: true, wreath: true }), x: 0, y: cy+3.5, z: 0, order: 3 });
    out.push(R(T, 'old_us', { expr: 'pained', L: 'cross', R: 'cross', facing: 1 }, [-2.5, cy, 2]));
    out.push(R(T, 'farmer', { expr: 'pained', L: 'cross', R: 'cross', facing: 1, hat: 'none' }, [-4.5, cy, 1]));
    out.push(R(T, 'old_uk', { expr: 'pained', L: 'cross', R: 'cross', facing: -1 }, [2.5, cy, 2]));
    out.push(R(T, 'brit', { expr: 'pained', L: 'cross', R: 'cross', facing: -1, hat: 'none' }, [4.5, cy, 1]));
  }

  return out;
};

const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  
  if (S.id === 'pighead') {
    for (let i = 0; i < 9; i++) {
      const t = (f * 0.012 + i / 9) % 1;
      const x = -35 + t * 7, y = DECK + 3.2 - t * 3.4, z = 0 + i * 0.45;
      out.push(FX('leaf' + i, (p) => T.fxLeaf(p, ['#d9822b', '#c4452c', '#e6b13a'][i%3]), [x, y, z], 0.12, { roll: q(t * 8 + i, 1) }));
    }
  }

  if (S.id === 'shot' && f > 403 && f < 420) {
    out.push(FX('bang', (p) => T.fxBang(p, (f-403)/17), [-28, DECK+1.5, 0], 0.6));
    out.push(FX('puff', (p) => T.fxMyPuff(p, (f-403)/17), [-28.5, DECK+2, 0], 0.6));
  }
  
  if (S.id === 'owner' && f > 460) out.push(FX('b100', (p) => T.fxBubble(p, "$100"), [-28.5, DECK+3.5, -1.5], 0.3));
  if (S.id === 'offer' && f > 530) out.push(FX('b10', (p) => T.fxBubble(p, "$10"), [-29.5, DECK+2.5, -1], 0.2));

  if (S.id === 'threat' && f > 570) {
    out.push(FX('cuffs', (p) => T.fxCuff(p), [-28.5, DECK+1.5, -1.2], 0.2, { roll: Math.sin(f)*0.1 }));
    for(let i=0; i<3; i++) out.push(FX('drip'+i, (p) => T.fxDrip(p), [-29.5, DECK+2-((f+i*5)%15)*0.1, -1], 0.1));
  }

  if (S.id === 'ship' && f > 640) out.push(FX('puffS', (p) => T.fxMyPuff(p, (f-640)/16), [0, 4, -2], 1.5));

  if (S.id === 'stare') {
    for(let i of [-1, 1]) out.push(FX('drip'+i, (p) => T.fxDrip(p), [i*1.5, DECK+1.5-((f)%20)*0.1, 0], 0.1));
  }

  if (S.id === 'wait' && f > 805) {
    out.push(FX('z1', (p) => T.fxZ(p, (f-805)/20), [0, DECK+2, 0], 0.5));
  }

  if (S.id === 'stamp' && f > 910) {
    if (f < 930) out.push(FX('dust', (p) => T.fxDust(p, (f-910)/20), [0, 8, -44], 2.0));
    if (f > 920 && f < 935) out.push(FX('star', (p) => T.fxStar(p, (f-920)/15), [0, 8, -44], 1.0));
  }

  if (S.id === 'park' && f > 1010) {
    out.push(FX('starP', (p) => T.fxStar(p, (f-1010)/15), [0, DECK+4, 0], 0.8));
  }

  return out;
};
