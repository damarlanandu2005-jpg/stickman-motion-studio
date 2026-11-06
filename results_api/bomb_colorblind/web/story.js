import { camFromKeys, idle, blinkAt, q, ramp, clamp, lerp, M as MO } from './motion.js';
export const FPS = 30, TOTAL = 1083, DECK = 0;
export const SHOTS = [
    { id: 's1', a: 0, b: 42, light: 'indoor', place: 'POLICE-OFFICE' },
    { id: 's2', a: 43, b: 143, light: 'day', place: 'CITY-STREET' },
    { id: 's3', a: 144, b: 249, light: 'day', place: 'CITY-STREET' },
    { id: 's4', a: 250, b: 338, light: 'indoor', place: 'BOMB-ROOM' },
    { id: 's5', a: 339, b: 435, light: 'indoor', place: 'CIRCUIT-VIEW' },
    { id: 's6', a: 436, b: 498, light: 'indoor', place: 'BOMB-ROOM' },
    { id: 's7', a: 499, b: 546, light: 'indoor', place: 'BOMB-ROOM' },
    { id: 's8', a: 547, b: 615, light: 'indoor', place: 'CIRCUIT-VIEW' },
    { id: 's9', a: 616, b: 695, light: 'indoor', place: 'CIRCUIT-VIEW' },
    { id: 's10', a: 696, b: 771, light: 'indoor', place: 'CIRCUIT-VIEW' },
    { id: 's11', a: 772, b: 796, light: 'indoor', place: 'BOMB-ROOM' },
    { id: 's12', a: 797, b: 857, light: 'indoor', place: 'CONTROL-ROOM' },
    { id: 's13', a: 858, b: 917, light: 'indoor', place: 'BOMB-ROOM' },
    { id: 's14', a: 918, b: 990, light: 'indoor', place: 'BOMB-ROOM' },
    { id: 's15', a: 991, b: 1082, light: 'indoor', place: 'CONTROL-ROOM' }
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];
export const smooth = MO.smooth;

export const LIGHTS = {
    day: { az: 130, el: 55, sky: '#bcd6f0', ground: '#b88a58', hemi: 1.15, sun: '#fff3dc', sunI: 2.6, fog: '#e8d9c0', fogNear: 90, fogFar: 700,
        skyTop: '#3f86d8', skyHor: '#d6e6f0', sat: 1.12, waterDeep: '#2c6c8c', waterShal: '#5aaec4', glint: '#effaff', vig: 0.2, shadowExt: 26 },
    indoor: { az: 45, el: 45, sky: '#000000', ground: '#222222', hemi: 0.8, sun: '#ffffff', sunI: 1.5, fog: '#111111', fogNear: 20, fogFar: 100,
        skyTop: '#111111', skyHor: '#222222', sat: 1.0, waterDeep: '#111111', waterShal: '#222222', glint: '#ffffff', vig: 0.4, shadowExt: 15 }
};
export const lightFor = (S, f) => ({ ...LIGHTS[S.light] });

const CAMS = {
    s1: [{f:0, pos:[0, 1.4, 2.0], look:[0, 1.4, 0], fov:45}, {f:42, pos:[0, 1.4, 1.5], look:[0, 1.4, 0], fov:45}],
    s2: [{f:43, pos:[0, 1.2, 6.0], look:[0, 1.2, 0], fov:50}, {f:143, pos:[0, 1.2, 4.5], look:[0, 1.2, 0], fov:50}],
    s3: [{f:144, pos:[0, 4.0, 15.0], look:[0, 1.0, 0], fov:55}, {f:249, pos:[0, 6.0, 15.0], look:[0, 1.0, 0], fov:55}],
    s4: [{f:250, pos:[-0.5, 1.2, 1.5], look:[0.5, 0.8, -0.5], fov:50}, {f:338, pos:[-0.4, 1.15, 1.3], look:[0.5, 0.8, -0.5], fov:50}],
    s5: [{f:339, pos:[0, 0.8, 0.1], look:[0, 0, 0], fov:45}, {f:435, pos:[0, 0.7, 0.05], look:[0, 0, 0], fov:45}],
    s6: [{f:436, pos:[0, 1.3, 0.8], look:[0, 1.4, -1.5], fov:45}, {f:498, pos:[0, 1.3, 0.8], look:[0, 1.4, -1.5], fov:45}],
    s7: [{f:499, pos:[0, 1.4, 2.5], look:[0, 1.0, -0.5], fov:45}, {f:546, pos:[0, 1.3, 2.0], look:[0, 1.0, -0.5], fov:45}],
    s8: [{f:547, pos:[0, 0.7, 0.1], look:[0, 0, 0], fov:45}, {f:615, pos:[0, 0.6, 0.05], look:[0, 0, 0], fov:45}],
    s9: [{f:616, pos:[0.1, 0.4, 0.1], look:[0, 0, 0], fov:40}, {f:695, pos:[0.15, 0.35, 0.1], look:[0, 0, 0], fov:40}],
    s10: [{f:696, pos:[0, 0.4, 0.15], look:[0, 0, 0], fov:40}, {f:771, pos:[0, 0.4, 0.15], look:[0, 0, 0], fov:40}],
    s11: [{f:772, pos:[0, 1.1, 0.5], look:[0, 1.0, 0], fov:35}, {f:796, pos:[0, 1.05, 0.3], look:[0, 1.0, 0], fov:35, ease:'easeOut'}],
    s12: [{f:797, pos:[0, 1.2, 6.0], look:[0, 1.2, 0], fov:50}, {f:857, pos:[0, 1.2, 4.5], look:[0, 1.2, 0], fov:50}],
    s13: [{f:858, pos:[0, 1.5, -0.3], look:[0, 1.4, -1.5], fov:40}, {f:917, pos:[0, 1.5, -0.5], look:[0, 1.4, -1.5], fov:40}],
    s14: [{f:918, pos:[0, 1.2, 3.0], look:[0.5, 1.0, -0.5], fov:50}, {f:990, pos:[0, 1.2, 4.0], look:[0.5, 1.0, -0.5], fov:50}],
    s15: [{f:991, pos:[1, 1.2, 5.0], look:[0.5, 1.2, 0], fov:50}, {f:1082, pos:[1, 1.2, 3.5], look:[0.5, 1.2, 0], fov:50}]
};

export const camAt = (f) => {
    const S = shotAt(f), c = camFromKeys(CAMS[S.id], f, { creep: 0.001 });
    c.shadowAt = [c.look[0], 0, c.look[2]];
    return c;
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
    const S = shotAt(f), C = camAt(f);
    const cinf = (S.id === 's6' || S.id === 's13') ? 12 : 0;
    return { focus: dist(C.pos, C.look), cinf, near: 1 };
};

export const worldAt = (f) => {
    const S = shotAt(f);
    return { place: S.place, id: S.id };
};

export const actorsAt = (f, T) => {
    const S = shotAt(f);
    const out = [];
    const R = (key, draw, pos, extra={}) => ({ key, draw, x:pos[0], y:pos[1], z:pos[2], ...extra });
    
    if (S.id === 's1') {
        out.push(R('ARTHUR', (p)=>T.drawArthur(p, {expr:'neutral', L:'hang', R:'hang', ...idle(f,1)}), [0,0,0]));
    }
    if (S.id === 's2') {
        out.push(R('ARTHUR-BOMB-SUIT', (p)=>T.drawArthurSuit(p, {expr:'stern', L:'hang', R:'hang', ...idle(f,1)}), [0,0,0]));
        out.push(R('POLICE-OFFICER', (p)=>T.drawPolice(p, {expr:'stern', L:'hang', R:'hang', facing:-1, ...idle(f,2)}), [2,0,0]));
    }
    if (S.id === 's3') {
        out.push(R('ARTHUR-BOMB-SUIT', (p)=>T.drawArthurSuit(p, {expr:'stern', L:'hang', R:'hang', ...idle(f,1)}), [0,0,0]));
        out.push(R('POLICE-OFFICER', (p)=>T.drawPolice(p, {expr:'stern', L:'point', R:'hang', facing:1, ...idle(f,2)}), [-3,0,0]));
        out.push({ key:'crowd', draw:(p)=>T.crowd(p, {n:12, t:f/30, mode:'stand'}), x:0, y:0, z:-10, s:2 });
    }
    if (S.id === 's4') {
        out.push(R('ARTHUR-BOMB-SUIT', (p)=>T.drawArthurSuit(p, {expr:'nervous', L:'hang', R:'hang', facing:-1, ...idle(f,1)}), [1.5,0,-1.5]));
    }
    if (S.id === 's6') {
        out.push(R('ARTHUR-BOMB-SUIT', (p)=>T.drawArthurSuit(p, {expr:'nervous', L:'temple', R:'hang', headTilt:10, ...idle(f,1)}), [0,0,-1.5]));
    }
    if (S.id === 's7') {
        out.push(R('ARTHUR-BOMB-SUIT', (p)=>T.drawArthurSuit(p, {expr:'stern', L:'temple', R:'hang', headTilt:15, ...idle(f,1)}), [0,0,-1.5]));
    }
    if (S.id === 's12') {
        out.push(R('COMMANDER', (p)=>T.drawCommander(p, {expr:'stern', L:'cross', R:'cross', ...idle(f,1)}), [0,0,0]));
        out.push(R('POLICE-OFFICER', (p)=>T.drawPolice(p, {expr:'nervous', L:'hang', R:'hang', facing:1, ...idle(f,2)}), [-2,0,0]));
        out.push(R('BOMB-TECHNICIAN', (p)=>T.drawTech(p, {expr:'nervous', L:'temple', R:'hang', facing:-1, ...idle(f,3)}), [2,0,0]));
    }
    if (S.id === 's13') {
        out.push(R('ARTHUR-BOMB-SUIT', (p)=>T.drawArthurSuit(p, {expr:'squint', L:'temple', R:'hang', headTilt:10, ...idle(f,1)}), [0,0,-1.5]));
    }
    if (S.id === 's14') {
        out.push(R('ARTHUR-BOMB-SUIT', (p)=>T.drawArthurSuit(p, {expr:'relief', L:'up', R:'up', ...idle(f,1)}), [1.5,0,-1.0]));
    }
    if (S.id === 's15') {
        out.push(R('ARTHUR', (p)=>T.drawArthur(p, {expr:'proud', L:'hang', R:'hang', ...idle(f,1)}), [0,0,0]));
        out.push(R('COMMANDER', (p)=>T.drawCommander(p, {expr:'relief', L:'hang', R:'hang', facing:-1, ...idle(f,2)}), [2,0,0]));
    }
    return out;
};

export const fxAt = (f, T) => {
    return [];
};
export const LOOK = { sat: 1.00, vibr: 0.25, drift: 1, push: 1 };
