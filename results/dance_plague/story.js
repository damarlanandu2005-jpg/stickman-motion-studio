export const FPS = 30, TOTAL = 866, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 44, light: 'dawn' },
  { id: 'dance', a: 45, b: 139, light: 'day' },
  { id: 'days', a: 140, b: 198, light: 'cycle' },
  { id: 'join', a: 199, b: 275, light: 'day' },
  { id: 'four', a: 276, b: 325, light: 'golden' },
  { id: 'nobody', a: 326, b: 365, light: 'indoor' },
  { id: 'cure', a: 366, b: 453, light: 'indoor' },
  { id: 'stage', a: 454, b: 530, light: 'day' },
  { id: 'worse', a: 531, b: 585, light: 'dusk' },
  { id: 'feet', a: 586, b: 635, light: 'dusk' },
  { id: 'collapse', a: 636, b: 709, light: 'night' },
  { id: 'stop', a: 710, b: 761, light: 'dawn' },
  { id: 'quiet', a: 762, b: 808, light: 'dawn' },
  { id: 'end', a: 809, b: 866, light: 'golden' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const ramp = (f, a, b) => clamp((f - a) / (b - a));

export const LIGHTS = {
  day: { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 70, fogFar: 900, skyTop: '#3f80d4', skyHor: '#c3daf2', sat: 1.1, vig: 0.2, shadowExt: 25 },
  golden: { az: 10, el: 12, sky: '#9a90c8', ground: '#6a4c40', hemi: 1.0, sun: '#ffb46c', sunI: 2.9, fog: '#f0b88c', fogNear: 60, fogFar: 760, skyTop: '#6f6eb0', skyHor: '#ffc27e', sunDisc: '#fff0c8', sunSize: 0.0035, sat: 1.12, gain: '#fff2e2', vig: 0.26, shadowExt: 35 },
  dawn: { az: 80, el: 5, sky: '#b0a0c0', ground: '#5a5a6a', hemi: 0.9, sun: '#ffccaa', sunI: 1.5, fog: '#d0c0d0', fogNear: 40, fogFar: 600, skyTop: '#506080', skyHor: '#e0d0c0', sat: 0.9, vig: 0.3, shadowExt: 20 },
  dusk: { az: 200, el: 5, sky: '#604050', ground: '#403030', hemi: 0.8, sun: '#ff5533', sunI: 2.0, fog: '#905050', fogNear: 30, fogFar: 500, skyTop: '#302040', skyHor: '#a04030', sat: 1.2, vig: 0.4, shadowExt: 25 },
  night: { az: 200, el: 30, sky: '#101525', ground: '#101520', hemi: 0.4, sun: '#406090', sunI: 1.0, fog: '#152030', fogNear: 20, fogFar: 400, skyTop: '#050a15', skyHor: '#152035', sat: 0.7, vig: 0.5, shadowExt: 30 },
  indoor: { az: 180, el: 30, sky: '#201510', ground: '#302015', hemi: 0.6, sun: '#ffaa55', sunI: 2.5, fog: '#302015', fogNear: 10, fogFar: 100, skyTop: '#100500', skyHor: '#201005', sat: 1.1, vig: 0.4, shadowExt: 10 },
  cycle: { az: 140, el: 46, sky: '#c4d6f2', ground: '#8a8262', hemi: 1.15, sun: '#fff1dc', sunI: 2.5, fog: '#cadcf0', fogNear: 70, fogFar: 900, skyTop: '#3f80d4', skyHor: '#c3daf2', sat: 1.1, vig: 0.2, shadowExt: 25 }
};
export const lightFor = (S, f) => {
  if (S.light === 'cycle') {
    const p = ((f - 140) / 59) * 3; // 3 cycles
    const phase = p % 1;
    const isDay = phase < 0.5;
    const tDay = Math.sin(phase * Math.PI * 2) * 0.5 + 0.5;
    const L = { ...LIGHTS.day };
    L.az = phase * 360;
    L.el = isDay ? 10 + 40 * Math.sin(phase * 2 * Math.PI) : -10;
    L.hemi = lerp(0.4, 1.15, tDay);
    L.sunI = lerp(1.0, 2.5, tDay);
    L.sun = isDay ? '#fff1dc' : '#406090';
    L.fog = isDay ? '#cadcf0' : '#152030';
    L.skyTop = isDay ? '#3f80d4' : '#050a15';
    L.skyHor = isDay ? '#c3daf2' : '#152035';
    L.sat = lerp(0.7, 1.1, tDay);
    return L;
  }
  const L = { ...LIGHTS[S.light] };
  if (S.id === 'worse') { L.shadowExt = 35; }
  return L;
};

const CAMS = {
  hook: [
    { f: 0, pos: [0, 0.4, 4], look: [0, 0.1, 0], fov: 36 },
    { f: 30, pos: [0, 1.6, 5], look: [0, 1.5, 0], fov: 33 },
    { f: 44, pos: [0, 1.7, 5.2], look: [0, 1.6, 0], fov: 32 }
  ],
  dance: [
    { f: 45, pos: [0, 1.7, 5.2], look: [0, 1.6, 0], fov: 32 },
    { f: 139, pos: [-1, 2.5, 9], look: [0, 1.2, 0], fov: 42 }
  ],
  days: [
    { f: 140, pos: [-1, 2.5, 9], look: [0, 1.2, 0], fov: 42 },
    { f: 198, pos: [-1.2, 2.6, 9.2], look: [0, 1.2, 0], fov: 42 }
  ],
  join: [
    { f: 199, pos: [4, 4, 7], look: [0, 1, 0], fov: 46 },
    { f: 275, pos: [6, 4.2, 6], look: [0, 1, 0], fov: 46 }
  ],
  four: [
    { f: 276, pos: [0, 8, -4], look: [0, 0, -2], fov: 40 },
    { f: 325, pos: [0, 10, -2], look: [0, 0, -2], fov: 54 }
  ],
  nobody: [
    { f: 326, pos: [0, 6, -11], look: [0, 6, -14], fov: 32 },
    { f: 365, pos: [0.2, 6.1, -11.2], look: [0, 6, -14], fov: 32 }
  ],
  cure: [
    { f: 366, pos: [0, 5.5, -24], look: [0, 4.8, -28], fov: 44 },
    { f: 410, pos: [0, 5.5, -24], look: [0, 4.8, -28], fov: 44 },
    { f: 415, pos: [-0.3, 4.8, -26], look: [0, 4.6, -28], fov: 30 },
    { f: 453, pos: [-0.4, 4.8, -26.1], look: [0, 4.6, -28], fov: 30 }
  ],
  stage: [
    { f: 454, pos: [0, 2.5, 9], look: [0, 1.5, 0], fov: 40 },
    { f: 530, pos: [0, 3, 7], look: [0, 1.5, 0], fov: 48 }
  ],
  worse: [
    { f: 531, pos: [0, 3, 10], look: [0, 1.5, 0], fov: 44 },
    { f: 585, pos: [0, 3.2, 10.2], look: [0, 1.5, 0], fov: 44 }
  ],
  feet: [
    { f: 586, pos: [-1, 0.4, 1.5], look: [0, 0.1, 0], fov: 34 },
    { f: 635, pos: [1, 0.4, 1.5], look: [0, 0.1, 0], fov: 34 }
  ],
  collapse: [
    { f: 636, pos: [0, 4, 10], look: [0, 0.5, 0], fov: 46 },
    { f: 709, pos: [0, 3, 7], look: [0, 0.5, 0], fov: 40 }
  ],
  stop: [
    { f: 710, pos: [1, 1.8, 1.5], look: [0, 1.8, 0], fov: 30 },
    { f: 761, pos: [1, 1.8, 1.3], look: [0, 1.8, 0], fov: 30 }
  ],
  quiet: [
    { f: 762, pos: [0, 1.5, 4], look: [0, 0.2, 0], fov: 34 },
    { f: 808, pos: [0, 3, 9], look: [0, 0.2, 0], fov: 46 }
  ],
  end: [
    { f: 809, pos: [0, 3, 8], look: [0, 0, 0], fov: 46 },
    { f: 866, pos: [0, 1, 2.5], look: [0, 0, 0], fov: 30 }
  ]
};
const KICKS = [{ f: 415, a: 0.04 }];
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
  if (S.id === 'worse') {
    const shake = Math.min(1, (f - 531)/54) * 0.05;
    c.look[0] += (Math.random()-0.5)*shake;
    c.look[1] += (Math.random()-0.5)*shake;
  }
  c.flash = 0;
  if (S.id === 'nobody' && f < 330) c.flash = (1 - (f - 326) / 4) * 0.8;
  if (S.id === 'cure' && f < 370) c.flash = (1 - (f - 366) / 4) * 0.8;
  if (S.id === 'stage' && f < 458) c.flash = (1 - (f - 454) / 4) * 0.8;
  c.shadowAt = c.look;
  return c;
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  switch (S.id) {
    case 'hook': return { focus: dist(C.pos, [0, 1.5, 0]), cinf: lerp(12, 6, smooth(ramp(f, 0, 30))) };
    case 'nobody': return { focus: dist(C.pos, [0, 6, -14]), cinf: 12 };
    case 'cure': return { focus: dist(C.pos, [0, 4.6, -28]), cinf: f < 415 ? 8 : 14 };
    case 'feet': return { focus: dist(C.pos, [0, 0.1, 0]), cinf: 14 };
    case 'stop': return { focus: dist(C.pos, [0, 2, 0]), cinf: 12 };
    case 'end': return { focus: dist(C.pos, [0, 0.1, 0]), cinf: lerp(4, 12, smooth(ramp(f, 809, 866))) };
  }
  return { focus: 10, cinf: 0 };
};

export const worldAt = (f) => {
  const S = shotAt(f);
  return {
    stage: f >= 454,
    qmark: f >= 809 ? clamp((f - 809) / 30) : 0,
    doorOpen: f >= 45 ? 1 : 0
  };
};

const blinkAt = (f, seed) => { const per = 38 + (seed * 17) % 31, ph = (f + seed * 13) % per; return ph < 2 ? 0.5 : ph < 4 ? 1 : 0; };
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const q = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = (S.light === 'golden' || S.light === 'dusk') ? '#ffe2c8' : (S.light === 'night' ? '#c0d0f0' : '#ffffff');
  
  if (S.id === 'hook' || S.id === 'dance' || S.id === 'days') {
    const isDancing = f >= 45;
    const wStep = isDancing ? q(f * 0.05) : 0;
    out.push(R(T, 'woman', { expr: isDancing ? (S.id === 'days' ? 'squint' : 'neutral') : 'neutral', seed: 1, step: wStep, arms: isDancing ? 'dance' : 'hang', wv: f * 0.2, blink: blinkAt(f, 1) }, [0, 0, 0], { tint }));
    if (isDancing) {
      out.push(R(T, 'workA', { seed: 11, expr: 'nervous' }, [-3, 2.5, -4], { tint }));
      out.push(R(T, 'workB', { seed: 12, expr: 'nervous' }, [3, 2.5, -3], { tint }));
    }
  } else if (S.id === 'nobody' || S.id === 'cure') {
    if (S.id === 'nobody') {
      out.push(R(T, 'council', { seed: 3, expr: 'nervous', arms: 'head', blink: blinkAt(f, 3) }, [0, 5, -14], { tint }));
    } else {
      out.push(R(T, 'council', { seed: 3, expr: 'stern', arms: f > 415 ? 'bang' : 'hang', blink: blinkAt(f, 3) }, [0, 4.6, -28], { tint }));
      out.push(R(T, 'councilB', { seed: 4, expr: 'neutral', arms: 'hang' }, [-2.5, 4.6, -27], { tint }));
      out.push(R(T, 'councilC', { seed: 5, expr: 'neutral', arms: 'hang' }, [2.5, 4.6, -27], { tint }));
    }
  } else if (S.id === 'stage' || S.id === 'worse' || S.id === 'feet' || S.id === 'stop') {
    if (S.id !== 'feet') {
      const mStep = S.id === 'stop' ? 0 : q(f * 0.1);
      out.push(R(T, 'musicD', { seed: 6, expr: S.id === 'stop' ? 'squint' : 'neutral', arms: S.id === 'stop' ? 'hang' : 'drum', step: mStep }, [0, 1.8, 0], { tint }));
      out.push(R(T, 'musicF', { seed: 7, expr: S.id === 'stop' ? 'squint' : 'neutral', arms: S.id === 'stop' ? 'hang' : 'flute', step: mStep }, [-1.5, 1.8, -0.5], { tint }));
      out.push(R(T, 'musicH', { seed: 8, expr: S.id === 'stop' ? 'squint' : 'neutral', arms: S.id === 'stop' ? 'hang' : 'horn', step: mStep }, [1.5, 1.8, -0.5], { tint }));
    }
    if (S.id !== 'stop') {
      const speed = S.id === 'worse' ? 0.08 : 0.05;
      for (let i = 0; i < 20; i++) {
        const a = i * 137.5;
        const r = 3 + (i % 5) * 1.2;
        const sx = Math.cos(a) * r, sz = Math.sin(a) * r;
        const dStep = q(f * speed + i);
        out.push(R(T, i % 2 ? 'workA' : 'workB', { seed: 20 + i, step: dStep, arms: 'dance', expr: S.id === 'worse' ? 'shock' : 'neutral' }, [sx, 0, sz], { tint }));
      }
    }
  } else if (S.id === 'join' || S.id === 'four' || S.id === 'collapse' || S.id === 'quiet') {
    const num = S.id === 'four' ? 80 : (S.id === 'join' ? 30 : 20);
    for (let i = 0; i < num; i++) {
      const a = i * 137.5;
      const r = 2 + (i % 8) * 1.5;
      const sx = Math.cos(a) * r, sz = Math.sin(a) * r;
      let dStep = q(f * 0.05 + i);
      let arms = 'dance';
      let y = 0;
      let expr = 'neutral';
      if (S.id === 'collapse') {
        const fallT = clamp((f - 636 - i * 5) / 10);
        if (fallT > 0) { y = -0.5 * fallT; arms = 'hang'; dStep = 0; expr = 'squint'; }
        else { expr = 'shock'; }
      }
      if (S.id === 'quiet') { y = -0.5; arms = 'hang'; dStep = 0; expr = 'squint'; }
      if (S.id !== 'quiet' || i % 3 === 0) {
        out.push(R(T, i % 2 ? 'workA' : (i % 3 ? 'workB' : 'woman'), { seed: 30 + i, step: dStep, arms, expr }, [sx, y, sz], { tint }));
      }
    }
  } else if (S.id === 'end') {
    out.push(R(T, 'shoe', { seed: 99 }, [0, 0, 0], { tint }));
  }
  return out;
};


export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'hook' || S.id === 'quiet') {
    out.push({ key: 'mist'+(f%10), draw: (p) => T.fxCloud(p, 1), x: 0, y: 0.5, z: 0, s: 10, alpha: 0.5, blob: false });
  }
  if (S.id === 'dance' || S.id === 'join' || S.id === 'four' || S.id === 'worse' || S.id === 'feet') {
    for (let i = 0; i < 5; i++) {
      const lf = f - (f % 5) + i * 5;
      out.push({ key: 'dust'+i+(f%5), draw: (p) => T.fxCloud(p, i+2), x: (Math.random() - 0.5) * 4, y: (f - lf) * 0.05, z: (Math.random() - 0.5) * 4, s: 1 + (f - lf) * 0.1, alpha: 1 - (f - lf) / 20, blob: false });
    }
  }
  if (S.id === 'stage' && f < 480) {
    out.push({ key: 'duststage'+(f%10), draw: (p) => T.fxCloud(p, 3), x: 0, y: 1, z: 0, s: 3, alpha: 0.8, blob: false });
  }
  if (S.id === 'feet') {
    if (f % 10 === 0) out.push({ key: 'drop'+(f%10), draw: (p) => { p.g.fillStyle='#b8282b'; p.g.beginPath(); p.g.arc(300, 500, 50, 0, Math.PI*2); p.g.fill(); }, x: 0, y: 0, z: 0, s: 0.2, alpha: 1, blob: false });
  }
  return out;
};

