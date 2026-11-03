// Motion for the 3D stickman. Everything is a pure function of time, so any frame can be rendered alone.
//  - walking and running come from the distance travelled (the feet keep step with the ground, stride from leg length)
//  - other actions (wave, point, surprised, jump, fall, sit, get up, float, ride) are short clips of joint angles
//  - consecutive actions are blended, so there are no pops between them
// Angles in radians, see rig.ts for the sign conventions.
import { Pose } from "./rig";

export type Action = {
  at_s: number;
  do: "stand" | "wave" | "point" | "surprised" | "jump" | "fall" | "sit" | "getup" | "float" | "ride" | "look" | "kneel" | "thumbsup" | "operate" | "climb" | "peek" | "threaten";
  dur_s?: number;            // jump / fall / sit / getup length
  height_m?: number;         // jump height, float height
  arm?: "L" | "R";           // wave / point arm
  vehicle?: string; seat?: [number, number, number]; to_s?: number; enter_s?: number; exit_s?: number; exit_m?: number; exit_to?: [number, number];
  start_m?: number;          // climb: height at the start (climbing down: start_m high, up_m = 0)
  up_m?: number;             // climb: how high (metres) the climber goes between at_s and to_s
  shake?: number;            // operate: how hard the craft shakes (0 = calm); the astronaut leans into the controls
  chair?: boolean;           // sit: on a chair/seat (seated pose, lowered to seat height) instead of on the floor
  face_deg?: number; face_camera?: boolean; face_toward?: string;   // heading while standing still
  expression?: string;
};

export type Ctx = { time: number; speed: number; phase: number };
export type Out = { pose: Pose; lock: boolean; lift: number };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const sm = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const mixPose = (a: Pose, b: Pose, t: number): Pose => {
  const o: Pose = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = (a[k] ?? 0) * (1 - t) + (b[k] ?? 0) * t;
  return o;
};
const sym = (o: Pose, k: string, v: number) => { o["L" + k] = v; o["R" + k] = v; };

// ---------------------------------------------------------------- key poses
export const KEY: Record<string, Pose> = {
  stand: { LAbd: 0.07, RAbd: 0.07, LEl: 0.12, REl: 0.12 },
  crouch: { LHip: 1.25, RHip: 1.25, LKnee: 2.3, RKnee: 2.3, LAnk: 0.7, RAnk: 0.7, spineX: 0.55, LShX: 0.5, RShX: 0.5, LEl: 0.5, REl: 0.5, headX: -0.3 },
  tuck: { LHip: 0.9, RHip: 0.7, LKnee: 1.3, RKnee: 1.0, spineX: 0.2, LAbd: 2.5, RAbd: 2.5, LShX: 0.2, RShX: 0.2, LEl: 0.3, REl: 0.3, headX: -0.2 },
  stretch: { LHip: -0.1, RHip: -0.1, LAbd: 2.7, RAbd: 2.7, LEl: 0.1, REl: 0.1, spineX: -0.1, LAnk: -0.5, RAnk: -0.5 },
  sitFloor: { LHip: 1.5, RHip: 1.5, LKnee: 0.15, RKnee: 0.15, LHipAbd: 0.12, RHipAbd: 0.12, spineX: 0.05, LShX: 0.35, RShX: 0.35, LEl: 0.5, REl: 0.5, LAbd: 0.25, RAbd: 0.25, LAnk: -0.2, RAnk: -0.2 },
  lying: { pitch: -1.5, LHip: 0.25, RHip: 0.1, LKnee: 0.45, RKnee: 0.25, LAbd: 0.9, RAbd: 0.9, LShX: -0.3, RShX: -0.2, LEl: 0.2, REl: 0.2, headX: 0.3 },
  sitUp: { pitch: -0.55, spineX: 0.5, LHip: 1.2, RHip: 1.2, LKnee: 0.6, RKnee: 0.6, LShX: 0.9, RShX: 0.9, LEl: 0.4, REl: 0.4, LAbd: 0.2, RAbd: 0.2 },
  seated: { LHip: 1.38, RHip: 1.38, LKnee: 1.38, RKnee: 1.38, LShX: 0.95, RShX: 0.95, LEl: 0.55, REl: 0.55, LAbd: 0.12, RAbd: 0.12, LAnk: 0.2, RAnk: 0.2 },
};

/** lerp through a list of [time, pose] keys */
const keyed = (keys: [number, Pose][], t: number): Pose => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) return mixPose(keys[i - 1][1], keys[i][1], sm((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0])));
  return keys[keys.length - 1][1];
};

// ---------------------------------------------------------------- walking and running from the ground speed
/** run weight 0 = walk, 1 = run, from the speed in m/s */
export const runWeight = (speed: number) => sm((speed - 1.7) / 1.3);
/** gait cycle length in metres: walk ~1.55, run ~3.1 (a step is kept in time with the ground under the foot) */
export const strideFor = (speed: number) => 1.55 + (3.1 - 1.55) * runWeight(speed);

export function gait(phase: number, speed: number): Pose {
  const w = runWeight(speed), amp = sm(speed / 0.9), o: Pose = {};
  const hipA = (0.42 + 0.45 * w) * amp, kneeA = (0.3 + 1.15 * w) * amp, armA = (0.5 + 0.55 * w) * amp;
  for (const [s, ph] of [["L", phase], ["R", phase + Math.PI]] as [string, number][]) {
    const swing = Math.max(0, Math.cos(ph));                        // leg moving forward = knee bent
    o[s + "Hip"] = hipA * Math.sin(ph);
    o[s + "Knee"] = kneeA * swing + 0.1 * amp + 0.18 * w * amp * (1 - swing);
    o[s + "Ank"] = -0.35 * o[s + "Hip"] + 0.25 * o[s + "Knee"] * 0.4;
    o[s + "ShX"] = -armA * Math.sin(ph);                            // arm swings against the same-side leg
    o[s + "El"] = (0.18 + 1.15 * w) * amp + 0.25 * armA * Math.max(0, Math.cos(ph));
    o[s + "Abd"] = 0.06 + 0.08 * w * amp;
  }
  o.spineX = (0.04 + 0.3 * w) * amp;
  o.spineY = 0.2 * Math.sin(phase) * amp * (0.6 + 0.6 * w);        // shoulders twist against the hips
  o.turn = -0.1 * Math.sin(phase) * amp;
  o.roll = 0.035 * Math.cos(phase) * amp;
  o.headX = -0.04 - 0.12 * w * amp;
  return o;
}

function idle(t: number): Pose {
  // a living stand: slow breathing, weight shifting from foot to foot, loose swinging arms, a head that looks around a little
  const o = { ...KEY.stand };
  const br = Math.sin(t * 2.3), sh = Math.sin(t * 0.55), sw = Math.sin(t * 0.9 + 1);
  o.hipsY = -0.006 + 0.006 * br - 0.004 * Math.abs(sh);
  o.roll = 0.035 * sh; o.turn = 0.05 * Math.sin(t * 0.4);
  o.spineX = 0.02 + 0.02 * br; o.spineZ = -0.045 * sh; o.spineY = 0.05 * Math.sin(t * 0.4 + 2);
  o.headY = 0.2 * Math.sin(t * 0.45) + 0.08 * Math.sin(t * 1.3); o.headX = 0.03 * Math.sin(t * 0.8 + 1); o.headZ = 0.04 * Math.sin(t * 0.6);
  o.LShX = 0.1 + 0.09 * sw + 0.02 * br; o.RShX = 0.1 - 0.09 * sw + 0.02 * br;
  o.LAbd = 0.13 + 0.05 * sh; o.RAbd = 0.13 - 0.05 * sh;
  o.LEl = 0.28 + 0.1 * Math.sin(t * 0.9 + 2); o.REl = 0.28 + 0.1 * Math.sin(t * 0.9 + 4);
  o.LKnee = 0.06 + 0.05 * Math.max(0, sh); o.RKnee = 0.06 + 0.05 * Math.max(0, -sh);
  return o;
}

// ---------------------------------------------------------------- one action at its own clock ta (seconds since it started)
export function actionPose(a: Action, ta: number, c: Ctx): Out {
  const walkW = sm(c.speed / 0.35);              // any action that is "standing" also walks if the character is moving
  switch (a.do) {
    case "stand": case "look": {
      return { pose: mixPose(idle(c.time), gait(c.phase, c.speed), walkW), lock: true, lift: 0 };
    }
    case "wave": {
      const o = { ...idle(c.time) }, arm = a.arm ?? "R";
      o[arm + "Abd"] = 2.55; o[arm + "ShX"] = 0.15; o[arm + "El"] = 0.5 + 0.55 * Math.sin(ta * 13);
      o.headZ = (arm === "R" ? 1 : -1) * 0.08; o.spineZ = (arm === "R" ? -1 : 1) * 0.04;
      return { pose: mixPose(idle(c.time), o, sm(ta / 0.35)), lock: true, lift: 0 };
    }
    case "point": {
      const o = { ...idle(c.time) }, arm = a.arm ?? "L", other = arm === "L" ? "R" : "L";
      o[arm + "ShX"] = 1.5; o[arm + "Abd"] = 0.05; o[arm + "El"] = 0.05; o[other + "Abd"] = 0.12; o.headX = -0.05; o.spineX = 0.05;
      return { pose: mixPose(idle(c.time), o, sm(ta / 0.3)), lock: true, lift: 0 };
    }
    case "surprised": {
      const o: Pose = { ...idle(c.time), LAbd: 0.9, RAbd: 0.9, LShX: 0.5, RShX: 0.5, LEl: 1.35, REl: 1.35, spineX: -0.12, headX: -0.15, LKnee: 0.25, RKnee: 0.25, LHip: 0.12, RHip: 0.12 };
      const jit = 0.04 * Math.sin(ta * 35) * Math.exp(-ta * 2.5);
      o.LShX += jit; o.RShX -= jit;
      return { pose: mixPose(idle(c.time), o, sm(ta / 0.14)), lock: true, lift: 0 };
    }
    case "jump": {
      const d = a.dur_s ?? 1.0, u = clamp01(ta / d), h = a.height_m ?? 1.0;
      let lift = 0;
      if (u >= 0.24 && u < 0.84) { const v = (u - 0.24) / 0.6; lift = h * 4 * v * (1 - v); }
      const pose = keyed([[0, KEY.stand], [0.24, KEY.crouch], [0.42, KEY.stretch], [0.62, KEY.tuck], [0.76, mixPose(KEY.tuck, KEY.stand, 0.75)],
        [0.9, mixPose(KEY.crouch, KEY.stand, 0.4)], [1, KEY.stand]], u);
      return { pose, lock: true, lift };
    }
    case "fall": {
      const d = a.dur_s ?? 1.1, t = Math.min(ta, d), k = ta / d;
      const flail = Math.exp(-Math.max(0, ta - 0.3) * 2.2) * Math.min(1, ta / 0.12);
      const pose = { ...keyed([
        [0, KEY.stand],
        [0.2 * d, { ...KEY.stand, pitch: -0.2, spineX: -0.1, LShX: -0.9, RShX: -0.9, LAbd: 1.1, RAbd: 1.1, LEl: 0.2, REl: 0.2, headX: -0.4, LKnee: 0.2, RKnee: 0.2 }],
        [0.6 * d, { ...KEY.stand, pitch: -0.95, LHip: 0.7, RHip: 0.5, LKnee: 0.5, RKnee: 0.3, LAbd: 1.3, RAbd: 1.3, LShX: -0.2, RShX: -0.2, headX: -0.3 }],
        [d, KEY.lying]], t) };
      if (k < 1.2) { pose.LShX = (pose.LShX ?? 0) + 0.5 * Math.sin(ta * 17) * flail; pose.RShX = (pose.RShX ?? 0) - 0.5 * Math.sin(ta * 17) * flail; pose.LAbd = (pose.LAbd ?? 0) + 0.2 * Math.sin(ta * 21) * flail; }
      return { pose, lock: true, lift: 0 };
    }
    case "getup": {
      const d = a.dur_s ?? 1.5;
      return { pose: keyed([[0, KEY.lying], [0.32 * d, KEY.sitUp], [0.55 * d, KEY.sitFloor], [0.82 * d, KEY.crouch], [d, idle(c.time)]], ta), lock: true, lift: 0 };
    }
    case "sit": {
      const d = a.dur_s ?? 1.0;
      if (a.chair) { const k = sm(ta / d); return { pose: mixPose(idle(c.time), KEY.seated, k), lock: true, lift: -0.35 * k }; }
      return { pose: keyed([[0, KEY.stand], [0.5 * d, KEY.crouch], [d, KEY.sitFloor]], ta), lock: true, lift: 0 };
    }
    case "float": {
      const t = c.time, o: Pose = {
        pitch: 0.25 * Math.sin(t * 0.9), roll: 0.18 * Math.sin(t * 0.7 + 1), LAbd: 0.85 + 0.12 * Math.sin(t * 1.3), RAbd: 0.85 + 0.12 * Math.sin(t * 1.1 + 1),
        LShX: 0.35 + 0.15 * Math.sin(t * 1.0), RShX: 0.25 + 0.15 * Math.sin(t * 1.2), LEl: 0.4, REl: 0.4, LHip: 0.35 + 0.2 * Math.sin(t * 1.1), RHip: 0.1 + 0.2 * Math.sin(t * 0.9 + 2),
        LKnee: 0.5 + 0.15 * Math.sin(t * 1.0), RKnee: 0.35 + 0.15 * Math.sin(t * 1.3), LHipAbd: 0.15, RHipAbd: 0.15, headX: -0.1 * Math.sin(t * 0.8) };
      return { pose: mixPose(idle(c.time), o, sm(ta / 0.6)), lock: false, lift: (a.height_m ?? 0.9) * sm(ta / 1.2) };
    }
    case "kneel": {
      // one knee on the ground, leaning forward, one hand reaching out (examining something low)
      const o: Pose = { ...idle(c.time), LHip: 1.45, LKnee: 1.5, LAnk: 0.3, RHip: -0.25, RKnee: 2.5, RAnk: 0.6, spineX: 0.4, headX: -0.35, LShX: 1.0, LEl: 0.4, LAbd: 0.2, RShX: 0.35, REl: 0.7,
        spineY: 0.12 * Math.sin(ta * 1.5) };
      return { pose: mixPose(idle(c.time), o, sm(ta / 0.6)), lock: true, lift: 0 };
    }
    case "thumbsup": {
      const base = a.chair ? KEY.seated : idle(c.time);
      const o: Pose = { ...base, RShX: 1.0, RAbd: 0.35, REl: 1.7, headX: 0.12 * Math.sin(ta * 9) * Math.exp(-ta * 1.2), spineX: (base.spineX ?? 0) - 0.03 };
      return { pose: mixPose(idle(c.time), o, sm(ta / 0.3)), lock: true, lift: a.chair ? -0.35 * sm(ta / 0.3) : 0 };
    }
    case "operate": {
      // seated, hands on the controls; with shake > 0 the whole body is thrown about and he fights the controls
      const k = sm(ta / 0.6), sh = a.shake ?? 0, o: Pose = { ...KEY.seated,
        LShX: 1.25 + 0.15 * Math.sin(ta * 3.1) + 0.1 * sh * Math.sin(ta * 31), RShX: 1.25 + 0.15 * Math.sin(ta * 2.3 + 1) - 0.1 * sh * Math.sin(ta * 29),
        LEl: 0.6, REl: 0.6, LAbd: 0.2, RAbd: 0.2, spineX: 0.18 + 0.1 * sh, headX: -0.1,
        roll: 0.08 * sh * Math.sin(ta * 23), pitch: 0.05 * sh * Math.sin(ta * 19 + 1), headZ: 0.1 * sh * Math.sin(ta * 17) };
      return { pose: mixPose(idle(c.time), o, k), lock: true, lift: -0.35 * k };
    }
    case "climb": {
      // hand over hand, up a ladder or gantry: arms and legs alternate; he rises up_m between at_s and to_s
      const d = Math.max(0.1, (a.to_s ?? a.at_s + 1) - a.at_s), u = clamp01(ta / d), end = a.up_m ?? 2, start = a.start_m ?? 0, up = Math.abs(end - start), dirn = end >= start ? 1 : -1, ph = dirn * u * (up / 0.3) * Math.PI;
      const o: Pose = { ...idle(c.time), spineX: 0.12, headX: -0.25, pitch: 0.08 };
      for (const [side, p0] of [["L", ph], ["R", ph + Math.PI]] as [string, number][]) {
        const m = Math.sin(p0), n = Math.max(0, Math.cos(p0));
        o[side + "ShX"] = 2.45 + 0.35 * m; o[side + "El"] = 0.5 + 0.5 * (1 - m) * 0.5; o[side + "Abd"] = 0.15;
        o[side + "Hip"] = 0.75 + 0.55 * Math.max(0, -m); o[side + "Knee"] = 1.0 + 0.7 * n; o[side + "Ank"] = 0.3;
      }
      return { pose: mixPose(idle(c.time), o, sm(ta / 0.3)), lock: false, lift: start + (end - start) * sm(u) };
    }
    case "peek": {
      // crouched behind cover, head up, watching
      const o: Pose = { ...KEY.crouch, LShX: 0.2, RShX: 0.2, LEl: 0.9, REl: 0.9, headX: 0.25, headY: 0.3 * Math.sin(ta * 1.3), spineX: 0.35 };
      return { pose: mixPose(idle(c.time), o, sm(ta / 0.35)), lock: true, lift: 0 };
    }
    case "threaten": {
      // angry: arms thrown up and shaken, body leaning in
      const sh = Math.sin(ta * 17), o: Pose = { ...idle(c.time), LAbd: 2.2 + 0.15 * sh, RAbd: 2.2 - 0.15 * sh, LShX: 0.2, RShX: 0.2, LEl: 0.9, REl: 0.9, spineX: 0.18, headX: 0.1, roll: 0.04 * sh };
      return { pose: mixPose(idle(c.time), o, sm(ta / 0.25)), lock: true, lift: 0 };
    }
    case "ride": {
      return { pose: mixPose(idle(c.time), KEY.seated, sm(ta / (a.enter_s ?? 0.9))), lock: false, lift: 0 };
    }
  }
}

/** pose at a time from the action timeline, blending from the previous action for 0.25 s after a change */
export function poseAtTime(actions: Action[], c: Ctx, blend = 0.4): Out & { index: number } {
  let i = 0;
  for (let k = 0; k < actions.length; k++) if (c.time >= actions[k].at_s) i = k;
  const cur = actionPose(actions[i], c.time - actions[i].at_s, c);
  if (i > 0) {
    const u = (c.time - actions[i].at_s) / blend;
    if (u < 1) {
      const prev = actionPose(actions[i - 1], c.time - actions[i - 1].at_s, c), w = sm(u);
      return { pose: mixPose(prev.pose, cur.pose, w), lock: cur.lock, lift: prev.lift * (1 - w) + cur.lift * w, index: i };
    }
  }
  return { ...cur, index: i };
}
