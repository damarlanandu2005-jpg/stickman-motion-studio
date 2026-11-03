// Motion for the 3D stickman. Everything is a pure function of time, so any frame can be rendered alone.
//  - walking and running come from the distance travelled (the feet keep step with the ground, stride from leg length)
//  - other actions (wave, point, surprised, jump, fall, sit, get up, float, ride) are short clips of joint angles
//  - consecutive actions are blended, so there are no pops between them
// Angles in radians, see rig.ts for the sign conventions.
import { Pose } from "./rig";

export type Action = {
  at_s: number;
  do: "stand" | "wave" | "point" | "surprised" | "jump" | "fall" | "sit" | "getup" | "float" | "ride" | "look";
  dur_s?: number;            // jump / fall / sit / getup length
  height_m?: number;         // jump height, float height
  arm?: "L" | "R";           // wave / point arm
  vehicle?: string; seat?: [number, number, number]; to_s?: number; enter_s?: number; exit_s?: number; exit_to?: [number, number];
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
  const o = { ...KEY.stand };
  o.spineX = 0.015 * Math.sin(t * 2.1); o.headY = 0.05 * Math.sin(t * 0.7);
  o.LShX = 0.02 * Math.sin(t * 2.1 + 1); o.RShX = 0.02 * Math.sin(t * 2.1 + 2);
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
      return { pose: keyed([[0, KEY.stand], [0.5 * d, KEY.crouch], [d, KEY.sitFloor]], ta), lock: true, lift: 0 };
    }
    case "float": {
      const t = c.time, o: Pose = {
        pitch: 0.25 * Math.sin(t * 0.9), roll: 0.18 * Math.sin(t * 0.7 + 1), LAbd: 0.85 + 0.12 * Math.sin(t * 1.3), RAbd: 0.85 + 0.12 * Math.sin(t * 1.1 + 1),
        LShX: 0.35 + 0.15 * Math.sin(t * 1.0), RShX: 0.25 + 0.15 * Math.sin(t * 1.2), LEl: 0.4, REl: 0.4, LHip: 0.35 + 0.2 * Math.sin(t * 1.1), RHip: 0.1 + 0.2 * Math.sin(t * 0.9 + 2),
        LKnee: 0.5 + 0.15 * Math.sin(t * 1.0), RKnee: 0.35 + 0.15 * Math.sin(t * 1.3), LHipAbd: 0.15, RHipAbd: 0.15, headX: -0.1 * Math.sin(t * 0.8) };
      return { pose: mixPose(idle(c.time), o, sm(ta / 0.6)), lock: false, lift: (a.height_m ?? 0.9) * sm(ta / 1.2) };
    }
    case "ride": {
      return { pose: mixPose(idle(c.time), KEY.seated, sm(ta / (a.enter_s ?? 0.9))), lock: false, lift: 0 };
    }
  }
}

/** pose at a time from the action timeline, blending from the previous action for 0.25 s after a change */
export function poseAtTime(actions: Action[], c: Ctx, blend = 0.25): Out & { index: number } {
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
