import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, M as MO } from './motion.js';
export const FPS = 30, TOTAL = 594, DECK = 0;
export const SHOTS = [
  { id: 's1', a: 0, b: 81, light: 'night' },
  { id: 's2', a: 82, b: 158, light: 'night' },
  { id: 's3', a: 159, b: 207, light: 'night' },
  { id: 's4', a: 208, b: 275, light: 'night' },
  { id: 's5', a: 276, b: 337, light: 'night' },
  { id: 's6', a: 338, b: 392, light: 'night' },
  { id: 's7', a: 393, b: 449, light: 'night' },
  { id: 's8', a: 450, b: 481, light: 'dawn' },
  { id: 's9', a: 482, b: 538, light: 'dawn' },
  { id: 's10', a: 539, b: 593, light: 'indoor' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;

export const LIGHTS = {
  night: { az: 200, el: 30, sky: '#152535', ground: '#1a2530', hemi: 1.0, sun: '#8aaacc', sunI: 1.8, fog: '#152535', fogNear: 20, fogFar: 150, skyTop: '#0a1525', skyHor: '#152535', sat: 0.8, vig: 0.5, shadowExt: 20 },
  dawn: { az: 200, el: 7, sky: '#c8a8b8', ground: '#8a6a60', hemi: 0.95, sun: '#ff9a7a', sunI: 2.2, fog: '#e8b0a0', fogNear: 40, fogFar: 460, skyTop: '#6a74b8', skyHor: '#f4a8a0', sunDisc: '#ffe0b0', sunSize: 0.003, sat: 1.05, gain: '#f4e6ee', vig: 0.3, shadowExt: 26 },
  indoor: { az: 90, el: 45, sky: '#000000', ground: '#222222', hemi: 0.8, sun: '#fff0d0', sunI: 1.5, fog: '#111111', fogNear: 10, fogFar: 50, skyTop: '#000000', skyHor: '#000000', sat: 1.0, vig: 0.4, shadowExt: 10 }
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

const CAMS = {
  s1: [{ f: 0, pos: [0, 1.5, 2.5], look: [0, 1.4, 0], fov: 30 }, { f: 81, pos: [0, 1.5, 2.0], look: [0, 1.4, 0], fov: 30 }],
  s2: [{ f: 82, pos: [0, 2, 3], look: [0, 1.5, -12], fov: 50 }, { f: 158, pos: [0, 2, 1], look: [0, 1.5, -12], fov: 50 }],
  s3: [{ f: 159, pos: [0, 1.5, 6], look: [0, 1.4, 0], fov: 40 }, { f: 207, pos: [0, 1.5, 6], look: [0, 1.4, 0], fov: 40 }],
  s4: [{ f: 208, pos: [0, 1.5, 2.5], look: [0, 1.4, 0], fov: 30 }, { f: 275, pos: [0, 1.5, 2.0], look: [0, 1.4, 0], fov: 30 }],
  s5: [{ f: 276, pos: [0, 1.8, 6], look: [0, 1.4, 0], fov: 50 }, { f: 337, pos: [0, 1.8, 6], look: [0, 1.4, 0], fov: 50 }],
  s6: [{ f: 338, pos: [0, 8, 6], look: [0, 0, -4], fov: 55 }, { f: 392, pos: [0, 9, 8], look: [0, 0, -4], fov: 55 }],
  s7: [{ f: 393, pos: [0, 3, 3], look: [0, 1, -12], fov: 55 }, { f: 449, pos: [0, 4, 5], look: [0, 1, -12], fov: 55 }],
  s8: [{ f: 450, pos: [0, 1.5, 6], look: [0, 1.4, 0], fov: 40 }, { f: 481, pos: [0, 1.5, 5.5], look: [0, 1.4, 0], fov: 40 }],
  s9: [{ f: 482, pos: [0, 2, 15], look: [0, 2, 0], fov: 50 }, { f: 538, pos: [0, 2, 14], look: [0, 2, 0], fov: 50 }],
  s10: [{ f: 539, pos: [0, 1.8, 2.5], look: [0, 1.5, -0.5], fov: 30 }, { f: 593, pos: [0, 1.8, 2.0], look: [0, 1.5, -0.5], fov: 30 }],
};

export const camAt = (f) => {
  const S = shotAt(f), c = camFromKeys(CAMS[S.id], f, { creep: 0.001 });
  c.shadowAt = [c.look[0], 0, c.look[2]];
  return c;
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const cinf = S.id.match(/s1|s4|s10/) ? 12 : S.id.match(/s3|s8/) ? 8 : 0;
  return { focus: dist(C.pos, C.look), cinf, near: 1 };
};

export const worldAt = (f) => {
  const S = shotAt(f);
  const W = {
    place: S.id.match(/s1|s2|s3|s4/) ? 'NIGHT-FOREST' : S.id.match(/s5|s6|s7|s8/) ? 'ENEMY-FIELD' : 'HELICOPTER-ZONE',
    explosion: S.id === 's7',
    helicopter: S.id === 's9',
    hospitalBed: S.id === 's10',
    radio: S.id === 's4',
    heliX: S.id === 's9' ? lerp(20, 0, ramp(f, 482, 538)) : 0
  };
  return W;
};

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const seal = (id, pos, o={}) => out.push({ key: id+JSON.stringify(o), draw: p => T.romanFront(p, 'seal', { seed: id==='L'?1:id==='2'?2:3, blink: blinkAt(f, id==='L'?1:2), ...idle(f, id==='L'?1:2), ...o }), x: pos[0], y: pos[1], z: pos[2] });
  const enemy = (id, pos, o={}) => out.push({ key: 'enemy'+id+JSON.stringify(o), draw: p => T.romanFront(p, 'enemy', { seed: 4, blink: blinkAt(f, 4), ...idle(f, 4), ...o }), x: pos[0], y: pos[1], z: pos[2] });

  if (S.id === 's1') {
    seal('L', [0, 0, 0], { expr: 'stern', L: 'hang', R: 'hang', facing: 0 });
  }
  if (S.id === 's2') {
    enemy('1', [0, 0, -12], { expr: 'angry', L: 'hang', R: 'spear', facing: -1 });
  }
  if (S.id === 's3') {
    seal('L', [0, 0, 4], { expr: 'stern', L: 'temple', R: 'hang', facing: 1 });
    seal('2', [-1.5, 0, 0], { expr: 'nervous', L: 'shield', R: 'hang', facing: 1 });
    seal('3', [1.5, 0, 0], { expr: 'stern', L: 'cross', R: 'hang', facing: -1 });
  }
  if (S.id === 's4') {
    seal('L', [0.4, 0, 0], { expr: 'desperate', L: 'reach', R: 'hang', facing: -1 });
  }
  if (S.id === 's5') {
    enemy('1', [0, 0, 0], { expr: 'angry', L: 'hang', R: 'spear', facing: -1 });
    seal('2', [-2, 0, 4], { expr: 'scared', L: 'shield', R: 'hang', facing: 1 });
    seal('3', [2, 0, 0], { expr: 'stern', L: 'hang', R: 'spear', facing: -1 });
  }
  if (S.id === 's6') {
    seal('L', [0, 0, -4], { expr: 'desperate', L: 'shield', R: 'hang', facing: -1 });
    seal('2', [-2, 0, -4], { expr: 'scared', L: 'shield', R: 'hang', facing: 1 });
    seal('3', [2, 0, -4], { expr: 'stern', L: 'shield', R: 'hang', facing: -1 });
  }
  if (S.id === 's7') {
    seal('L', [0, 0, -2], { expr: 'scared', L: 'shield', R: 'hang', facing: 1 });
  }
  if (S.id === 's8') {
    seal('L', [0, 0, 4], { expr: 'dazed', L: 'hang', R: 'hang', facing: 0 });
    seal('2', [-1.5, 0, 0], { expr: 'pained', L: 'hang', R: 'hang', facing: 0 });
    seal('3', [1.5, 0, 0], { expr: 'relief', L: 'hang', R: 'hang', facing: 0 });
  }
  if (S.id === 's9') {
    seal('L', [-1.5, 0, 13], { expr: 'tired', L: 'wave', R: 'hang', facing: 1 });
    seal('2', [0, 0, 13], { expr: 'tired', L: 'hang', R: 'hang', facing: 1 });
    seal('3', [1.5, 0, 13], { expr: 'tired', L: 'hang', R: 'hang', facing: 1 });
  }
  if (S.id === 's10') {
    seal('L', [0, 0.4, -0.2], { expr: 'tired', L: 'hang', R: 'hang', facing: 0 });
  }
  return out;
};

export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
  if (S.id === 's2') {
    out.push(FX('beam', p => {
      p.g.globalAlpha = 0.2;
      p.poly([[500, 450], [0, 100], [0, 800]], '#ffffaa', 0);
    }, [-1.5, 1.3, -11.5], 4));
  }
  if (S.id === 's4') {
    const blink = (f % 10 < 5) ? '#ff0000' : '#330000';
    out.push(FX('radioLight', p => {
      p.ell(0, 0, 6, 6, blink, 0);
    }, [-0.1, 1.2, 0.15], 0.5));
  }
  if (S.id === 's5') {
    if (f % 6 < 3) out.push(FX('mz1', p => T.fxMuzzle(p, (f%6)/3), [-0.5, 1.3, -3.5], 0.5));
    if (f % 8 < 4) out.push(FX('mz2', p => T.fxMuzzle(p, (f%8)/4), [2.5, 1.3, 0.5], 0.5));
  }
  if (S.id === 's6') {
    for(let i=0; i<3; i++) {
      const t = ((f + i*15) % 45) / 45;
      out.push(FX('tracer'+i, p => {
        p.stroke([[-50, 0], [50, 0]], 4, '#ffcc00');
      }, [lerp(-10, 10, t), 1.2, -4 + i], 1));
    }
  }
  if (S.id === 's7') {
    const t = Math.min(1, (f - 393) / 30);
    for(let i=0; i<5; i++) {
      out.push(FX('dust'+i, p => T.fxDust(p, t, '#443322'), [(i-2)*3, 0.5, -10], 2 + t*2));
    }
  }
  if (S.id === 's8') {
    const t = (f % 60) / 60;
    out.push(FX('smoke', p => T.fxDust(p, t, '#555555'), [0, 1, -2], 3));
  }
  if (S.id === 's9') {
    const t = (f % 30) / 30;
    out.push(FX('hdust', p => T.fxDust(p, t, '#665544'), [S.heliX || 0, 0.5, -10], 4));
  }
  return out;
};
