import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, walk, M as MO } from './motion.js';
export const FPS = 30, TOTAL = 866, DECK = 0;
export const SHOTS = [
  { id: 'hook', a: 0, b: 31, light: 'dawn' },
  { id: 'dance', a: 32, b: 140, light: 'day' },
  { id: 'days', a: 141, b: 198, light: 'day' },
  { id: 'join', a: 199, b: 275, light: 'day' },
  { id: 'fourhundred', a: 276, b: 326, light: 'golden' },
  { id: 'nobody', a: 327, b: 356, light: 'indoor' },
  { id: 'cure', a: 357, b: 454, light: 'indoor' },
  { id: 'stage', a: 455, b: 530, light: 'day' },
  { id: 'worse', a: 531, b: 586, light: 'dusk' },
  { id: 'feet', a: 587, b: 644, light: 'dusk' },
  { id: 'collapse', a: 645, b: 710, light: 'night' },
  { id: 'stop', a: 711, b: 760, light: 'dawn' },
  { id: 'quiet', a: 761, b: 808, light: 'dawn' },
  { id: 'end', a: 809, b: 865, light: 'golden' }
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;

export const LIGHTS = {
  dawn: { az: 110, el: 5, sky: '#d4c4b4', ground: '#8a7a6a', hemi: 0.9, sun: '#ffb080', sunI: 2.0, fog: '#d4c4b4', fogNear: 20, fogFar: 300, skyTop: '#7a8a9a', skyHor: '#d4c4b4', sat: 1.0, vig: 0.3 },
  day: { az: 140, el: 45, sky: '#a0c0e0', ground: '#9a8a7a', hemi: 1.1, sun: '#ffeedd', sunI: 2.5, fog: '#c0d0e0', fogNear: 40, fogFar: 400, skyTop: '#4070a0', skyHor: '#a0c0e0', sat: 1.1, vig: 0.2 },
  golden: { az: 160, el: 10, sky: '#e0a070', ground: '#8a6a5a', hemi: 1.0, sun: '#ffaa55', sunI: 2.8, fog: '#e0a070', fogNear: 30, fogFar: 350, skyTop: '#605080', skyHor: '#e0a070', sat: 1.2, vig: 0.3 },
  dusk: { az: 180, el: 0, sky: '#a05050', ground: '#5a4a4a', hemi: 0.8, sun: '#ff5522', sunI: 2.0, fog: '#a05050', fogNear: 20, fogFar: 300, skyTop: '#302040', skyHor: '#a05050', sat: 1.1, vig: 0.4 },
  night: { az: 200, el: 30, sky: '#102030', ground: '#2a3a4a', hemi: 0.4, sun: '#88aaff', sunI: 1.0, fog: '#102030', fogNear: 10, fogFar: 200, skyTop: '#051015', skyHor: '#102030', sat: 0.8, vig: 0.5 },
  indoor: { az: 0, el: 45, sky: '#000000', ground: '#4a3a2a', hemi: 0.6, sun: '#ffcc88', sunI: 1.5, fog: '#2a1a0a', fogNear: 10, fogFar: 100, skyTop: '#000000', skyHor: '#000000', sat: 1.1, vig: 0.6 },
};

export const lightFor = (S, f) => {
  if (S.id === 'days') {
    const t = (f - S.a) / (S.b - S.a);
    const p = Math.sin(t * Math.PI * 4) * 0.5 + 0.5;
    const L1 = LIGHTS.day, L2 = LIGHTS.night;
    const mixC = (c1, c2, m) => {
      const hex2rgb = c => [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)];
      const rgb2hex = rgb => '#' + rgb.map(x => Math.round(x).toString(16).padStart(2,'0')).join('');
      const r1 = hex2rgb(c1), r2 = hex2rgb(c2);
      return rgb2hex(r1.map((v,i) => v + (r2[i]-v)*m));
    };
    return {
      az: lerp(L1.az, L2.az, p), el: lerp(L1.el, L2.el, p),
      sky: mixC(L1.sky, L2.sky, p), ground: mixC(L1.ground, L2.ground, p),
      hemi: lerp(L1.hemi, L2.hemi, p), sun: mixC(L1.sun, L2.sun, p), sunI: lerp(L1.sunI, L2.sunI, p),
      fog: mixC(L1.fog, L2.fog, p), fogNear: lerp(L1.fogNear, L2.fogNear, p), fogFar: lerp(L1.fogFar, L2.fogFar, p),
      skyTop: mixC(L1.skyTop, L2.skyTop, p), skyHor: mixC(L1.skyHor, L2.skyHor, p),
      sat: lerp(L1.sat, L2.sat, p), vig: lerp(L1.vig, L2.vig, p)
    };
  }
  return { ...LIGHTS[S.light] };
};

const CAMS = {
  hook: [{ f: 0, pos: [0, 0.2, 34], look: [0, 0.2, 30], fov: 36 }, { f: 31, pos: [0, 1.4, 34], look: [0, 1.4, 30], fov: 32 }],
  dance: [{ f: 32, pos: [0, 1.4, 38], look: [0, 1.2, 30], fov: 32 }, { f: 140, pos: [0, 1.5, 40], look: [0, 1.2, 30], fov: 42 }],
  days: [{ f: 141, pos: [0, 1.5, 40], look: [0, 1.2, 30], fov: 42 }, { f: 198, pos: [0, 1.5, 40], look: [0, 1.2, 30], fov: 42 }],
  join: [{ f: 199, pos: [2, 4, 32], look: [0, 1, 20], fov: 46 }, { f: 275, pos: [4, 4, 30], look: [0, 1, 20], fov: 46 }],
  fourhundred: [{ f: 276, pos: [0, 25, 15], look: [0, 0, 0], fov: 40 }, { f: 326, pos: [0, 30, 20], look: [0, 0, 0], fov: 54 }],
  nobody: [{ f: 327, pos: [100, 1.6, 10], look: [100, 1.6, 5], fov: 32 }, { f: 356, pos: [100, 1.6, 9], look: [100, 1.6, 5], fov: 32 }],
  cure: [{ f: 357, pos: [100, 1.5, 8], look: [100, 1.2, 0], fov: 44 }, { f: 410, pos: [100, 1.5, 5], look: [100, 1.2, 0], fov: 30, ease: 'easeOut' }, { f: 454, pos: [100, 1.5, 4.5], look: [100, 1.2, 0], fov: 30 }],
  stage: [{ f: 455, pos: [0, 3, 15], look: [0, 1.5, -2], fov: 40 }, { f: 530, pos: [0, 3.5, 18], look: [0, 1.5, -2], fov: 48 }],
  worse: [{ f: 531, pos: [0, 3.5, 18], look: [0, 1.5, -2], fov: 44 }, { f: 586, pos: [0, 3.5, 18], look: [0, 1.5, -2], fov: 44 }],
  feet: [{ f: 587, pos: [-2, 0.2, 2], look: [0, 0.1, 0], fov: 34 }, { f: 644, pos: [2, 0.2, 2], look: [0, 0.1, 0], fov: 34 }],
  collapse: [{ f: 645, pos: [0, 3, 18], look: [0, 0.5, 0], fov: 46 }, { f: 710, pos: [0, 2.5, 14], look: [0, 0.5, 0], fov: 40 }],
  stop: [{ f: 711, pos: [-0.5, 1.7, 4], look: [-1, 1.5, -0.5], fov: 30 }, { f: 760, pos: [-0.5, 1.7, 3.5], look: [-1, 1.5, -0.5], fov: 30 }],
  quiet: [{ f: 761, pos: [0, 1.5, 12], look: [0, 0.5, 0], fov: 34 }, { f: 808, pos: [0, 2, 15], look: [0, 0.5, 0], fov: 46 }],
  end: [{ f: 809, pos: [0, 1.5, 8], look: [0, 0.1, 0], fov: 46 }, { f: 865, pos: [0, 0.5, 4], look: [0, 0.1, 0], fov: 30 }]
};

export const camAt = (f) => {
  const S = shotAt(f), c = camFromKeys(CAMS[S.id], f, { creep: 0.001 });
  if (S.id === 'worse') {
    const shake = (f - S.a) / (S.b - S.a) * 0.1;
    c.look[0] += Math.sin(f * 2) * shake;
    c.look[1] += Math.cos(f * 3) * shake;
    c.roll = Math.sin(f * 4) * shake * 10;
  }
  c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};

export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const cinf = { hook: 10, nobody: 8, cure: 8, feet: 12, stop: 10, end: 12 }[S.id] ?? 0;
  return { focus: Math.hypot(C.pos[0]-C.look[0], C.pos[1]-C.look[1], C.pos[2]-C.look[2]), cinf, near: 1 };
};

export const worldAt = (f) => ({});

const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [], t = f/30;
  const troffeaDance = { L: 'up', R: 'wave', tilt: Math.sin(t*6)*10, headTilt: Math.cos(t*6)*10, bob: Math.sin(t*12)*0.05, expr: 'tired' };

  if (S.id === 'hook') {
    out.push(R(T, 'troffea', { expr: 'scared', L: 'hang', R: 'hang' }, [0, 0, 30]));
  }
  if (S.id === 'dance' || S.id === 'days') {
    out.push(R(T, 'troffea', troffeaDance, [0, 0, 30]));
    if (S.id === 'dance') {
      out.push(R(T, 'peasA', { expr: 'confused', L: 'hang', R: 'hang' }, [-6.5, 4.5, 26]));
      out.push(R(T, 'peasB', { expr: 'confused', L: 'hang', R: 'hang' }, [6.5, 4.5, 26]));
    }
  }
  if (S.id === 'join') {
    out.push(R(T, 'troffea', troffeaDance, [0, 0, 20]));
    for(let i=0; i<4; i++) out.push(FX('cr'+i, p => T.crowd(p, { n: 5, t, seed: i, mode: 'dance' }), [Math.cos(i)*3, 0, 20 + Math.sin(i)*3 - 2], 4.5));
  }
  if (S.id === 'fourhundred') {
    for(let i=0; i<25; i++) {
      const r = 2 + (i%5)*2.5;
      const a = i * 2.4;
      out.push(FX('cr'+i, p => T.crowd(p, { n: 6, t, seed: i, mode: 'dance' }), [Math.cos(a)*r, 0, Math.sin(a)*r], 4.5));
    }
  }
  if (S.id === 'nobody') {
    out.push(R(T, 'councilman', { expr: 'confused', L: 'temple', R: 'hang', headTilt: 5 }, [100, 0, 5.5]));
  }
  if (S.id === 'cure') {
    out.push(R(T, 'councilman', { expr: 'proud', L: 'point', R: 'hip', headTilt: -5 }, [100, 0, -0.5]));
    out.push(R(T, 'council2', { expr: 'neutral', L: 'hang', R: 'hang', facing: 1 }, [98, 0, 1.5]));
    out.push(R(T, 'council2', { expr: 'neutral', L: 'hang', R: 'hang', facing: -1 }, [102, 0, 1.5]));
  }
  if (S.id === 'stage' || S.id === 'worse') {
    const speed = S.id === 'worse' ? 1.5 : 1;
    const expr = S.id === 'worse' ? 'scared' : 'tired';
    out.push(R(T, 'musician', { expr: 'shout', L: 'up', R: 'belly', bob: Math.sin(t*10)*0.05 }, [-1, 0.5, -0.5]));
    out.push(R(T, 'musician2', { expr: 'proud', L: 'temple', R: 'wave', bob: Math.sin(t*10)*0.05 }, [1, 0.5, -0.5]));
    out.push(R(T, 'musician', { expr: 'proud', L: 'up', R: 'up', bob: Math.sin(t*10)*0.05 }, [0, 0.5, -1]));
    if (S.id === 'stage') {
      out.push(R(T, 'carpenter', { expr: 'neutral', L: 'up', R: 'hang', bob: Math.sin(t*15)*0.1 }, [2, 0, 1]));
      out.push(R(T, 'carpenter', { expr: 'neutral', L: 'hang', R: 'up', bob: Math.cos(t*15)*0.1 }, [-2, 0, 1]));
    }
    for(let i=0; i<8; i++) {
      const r = 3 + (i%4)*1.5;
      const a = i * 2.4;
      out.push(FX('cr'+i, p => T.crowd(p, { n: 5, t, seed: i, mode: 'dance', speed, expr }), [Math.cos(a)*r, 0, Math.sin(a)*r], 4.5));
    }
  }
  if (S.id === 'feet') {
    out.push(R(T, 'troffea', { ...troffeaDance, expr: 'scared', speed: 1.5 }, [0, 0, 0]));
    out.push(R(T, 'peasA', { ...troffeaDance, expr: 'scared', speed: 1.5 }, [1, 0, 0.5]));
    out.push(R(T, 'peasB', { ...troffeaDance, expr: 'scared', speed: 1.5 }, [-1, 0, 0.5]));
  }
  if (S.id === 'collapse') {
    for(let i=0; i<8; i++) {
      const r = 3 + (i%4)*1.5;
      const a = i * 2.4;
      const fall = clamp((f - S.a - i*5) / 10);
      out.push(FX('cr'+i, p => T.crowd(p, { n: 5, t, seed: i, mode: fall > 0 ? 'fall' : 'dance', fall, expr: 'scared' }), [Math.cos(a)*r, 0, Math.sin(a)*r], 4.5));
    }
  }
  if (S.id === 'stop') {
    out.push(R(T, 'musician', { expr: 'tired', L: 'hang', R: 'hang' }, [-1, 0.5, -0.5]));
    out.push(R(T, 'musician2', { expr: 'tired', L: 'hang', R: 'hang' }, [1, 0.5, -0.5]));
    out.push(R(T, 'musician', { expr: 'tired', L: 'hang', R: 'hang' }, [0, 0.5, -1]));
  }
  if (S.id === 'quiet') {
    for(let i=0; i<6; i++) {
      const r = 3 + (i%3)*2;
      const a = i * 2.4;
      out.push(FX('cr'+i, p => T.crowd(p, { n: 4, t, seed: i, mode: 'sit' }), [Math.cos(a)*r, 0, Math.sin(a)*r], 4.5));
    }
    const w = walk(f, S.a, 0.5, 0.8);
    out.push(R(T, 'walker', { expr: 'tired', L: 'hang', R: 'hang', step: w.phase, facing: 1 }, [lerp(0, 5, (f-S.a)/(S.b-S.a)), 0, -3]));
    out.push(FX('shoe', p => T.fxShoe(p), [0, 0, 0], 1));
  }
  if (S.id === 'end') {
    out.push(FX('shoe', p => T.fxShoe(p), [0, 0, 0], 1));
  }
  return out;
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'hook') out.push(FX('mist', p => T.fxMist(p, f/30), [0, -1, 31], 3));
  if (['dance', 'days', 'join', 'fourhundred', 'stage', 'worse', 'collapse'].includes(S.id)) {
    out.push(FX('dust', p => T.fxDust(p, (f%30)/30), [0, 0, 1], 4));
  }
  if (S.id === 'days') {
    const p = Math.sin(((f - S.a) / (S.b - S.a)) * Math.PI * 4) * 0.5 + 0.5;
    if (p > 0.5) out.push(FX('stars', p => T.fxNightStars(p, f/30), [0, 20, 0], 40, { alpha: (p-0.5)*2 }));
  }
  if (S.id === 'nobody') out.push(FX('sweat', p => T.fxDrip(p), [100.2, 1.5, 5.6], 0.15));
  if (S.id === 'feet') out.push(FX('blood', p => T.fxBlood(p, (f%30)/30), [0, 0, 0.5], 1));
  if (S.id === 'end') out.push(FX('q', p => T.fxQuestion(p, clamp((f-S.a)/30)), [0, 0, -1], 4));
  return out;
};
