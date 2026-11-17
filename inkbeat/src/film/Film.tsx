// The generic film composition (Blueprint v2.1, stage 6, picture half). It mounts whatever a compiled film
// describes: the kit for each scene, library pieces at their positions, the cast in their slots doing their
// actions, the crowd, and a camera worked out from the shot type and its subject. Nothing here is specific to
// one film; all film-specific data comes from src/film/data/<name>.ts.
import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { Character3D, headOf, legDrop } from "../inkbeat/char/Character3D";
import { Captions, makeChunks } from "../inkbeat/core/captions";
import type { Word } from "../inkbeat/core/captions";
import { CastLight } from "../inkbeat/core/castLight";
import { Label } from "../inkbeat/core/kit";
import { useFonts } from "../inkbeat/core/frame";
import { moodOf } from "../inkbeat/core/moods";
import { View } from "../inkbeat/core/View";
import type { V3 } from "../inkbeat/types";
import { Cabin } from "../cooper/Cabin";
import { BombCase, MoneyBag, Parachute, Plane, Rain } from "../cooper/props";
import { Ground, Room, SkyStage, WaterEdge } from "../lib/kits";
import { Piece } from "../lib/pieces";
import type { CharData, FilmData, LookData, SceneData, ShotData } from "./types";
import { v3 } from "./types";

const BLOCK = { torso: "block" as const, torsoWidth: 1.05 };
const ease = (u: number) => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };
const CROWD: LookData[] = [["#6a5a3a", "#3b3a44", "#3a2a22", "#ecccae"], ["#4a5240", "#2f3540", "#5a4535", "#d49a6a"], ["#45384f", "#2c2f38", "#141216", "#f1d6bd"], ["#394a63", "#2a3550", "#2a211c", "#e7b48e"], ["#6a3b3b", "#3b3a44", "#8a5a2a", "#f1d6bd"]]
  .map(([top, bottom, hairColor, skin]) => ({ skin, outfit: "jacket", top, bottom, hair: "swoop", hairColor }));

/* eslint-disable @typescript-eslint/no-explicit-any */
const spec = (l: LookData): any => ({
  height: l.height ?? 1.72, build: BLOCK,
  look: { skin: l.skin, outfit: l.outfit, colors: { top: l.top, inner: "#e9e6de", bottom: l.bottom, shoes: "#20171a", accent: "#15161a" }, hair: l.hair, hairColor: l.hairColor,
    ...(l.hat ? { hat: l.hat } : {}), ...(l.glasses ? { glasses: l.glasses } : {}), ...(l.mustache ? { mustache: l.mustache } : {}), face: { nose: l.nose ?? "button", brow: 1.05 } },
});
const FACES: Record<string, any> = {
  neutral: { eyes: "open", mouth: "flat", brows: "neutral" }, calm: { eyes: "open", mouth: "smirk", brows: "neutral" }, polite_smile: { eyes: "open", mouth: "smile", brows: "raised" },
  shock: { eyes: "wide", mouth: "o", brows: "raised" }, worried: { eyes: "open", mouth: "frown", brows: "worried" }, stern: { eyes: "half", mouth: "flat", brows: "angry" },
  frown: { eyes: "squint", mouth: "frown", brows: "worried" }, wonder: { eyes: "wide", mouth: "grin", brows: "raised" }, yell: { eyes: "wide", mouth: "yell", brows: "raised" },
  focused: { eyes: "squint", mouth: "flat", brows: "neutral" }, relief: { eyes: "half", mouth: "smile", brows: "raised" }, pain: { eyes: "closed", mouth: "frown", brows: "worried" },
};
// what each vocabulary action does to the body: [leg pose, arm pose, walking?, head nod]
const UP = new Set(["hand_over", "receive", "hold_up", "open_case", "lift", "count_fingers", "push_lever", "point"]); // keep in step with scene/gate.py
const pose = (c: CharData, t: number): any => {
  const a = c.action;
  const legs = c.legs ?? (a === "sit" ? "sit" : a === "kneel" || a === "dig" ? "kneel" : a === "crouch" ? "crouch" : "stand");
  const walk = ["walk", "run", "climb_stairs", "descend_stairs", "sweep_search", "carry"].includes(a) && legs === "stand" ? t * 7 : undefined;
  let armL: [number, number] = [10, 12], armR: [number, number] = [12, 16];
  if (a === "hang_parachute" || a === "fall" || a === "step_off") armL = armR = [150, 10];
  else if (a === "react_shock" || a === "flinch") armL = armR = [35, 70];
  else if (a === "point") armR = [75, 15];
  else if (a === "wave") armR = [130, 20];
  else if (a === "pocket" || a === "adjust_tie") armR = [25, 95];
  else if (a === "lower_prop") armR = [25, 30];
  else if (a === "shrug") armL = armR = [30, 40];
  else if (UP.has(a) || c.holds.length) armR = [UP.has(a) ? 62 : 28, UP.has(a) ? 78 : 40];
  return { legs, walk, armL, armR, headNod: a === "nod" ? Math.sin(t * 6) * 8 : a === "look_up" ? -16 : a === "dig" || a === "write" ? 12 : 0, headTilt: Math.sin(t * 1.3 + c.p[0]) * 1.5 };
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const charPos = (c: CharData, sh: ShotData, t: number): V3 => {
  const p = v3(c.p);
  if (c.action === "step_off" || c.action === "fall") {
    const dt = Math.max(0, t - (sh.t0 + (sh.t1 - sh.t0) * (c.action === "fall" ? 0 : 0.5)));
    return [p[0] + Math.sin(c.yaw) * dt * 2.4, p[1] + dt * 1.4 - dt * dt * 7.5, p[2] + Math.cos(c.yaw) * dt * 2.4];
  }
  if (c.action === "hang_parachute") return [p[0], p[1] - (t - sh.t0) * 0.35, p[2]];
  return p;
};
const headPoint = (c: CharData, sh: ShotData, t: number, h: number): V3 => {
  const p = charPos(c, sh, t); const hd = headOf(p, h, BLOCK);
  const legs = pose(c, t).legs as "stand" | "sit" | "kneel" | "crouch";
  return [hd[0], hd[1] - legDrop(legs, h, BLOCK), hd[2]];
};
const handPoint = (c: CharData, sh: ShotData, t: number, h: number, left = false): V3 => {
  const p = charPos(c, sh, t); const ps = pose(c, t);
  const y = (UP.has(c.action) && !left ? 1.22 : 0.92) * (h / 1.72) - legDrop(ps.legs, h, BLOCK);
  const fx = left ? -0.3 : 0.3, fz = UP.has(c.action) && !left ? 0.42 : 0.2;
  return [p[0] + Math.cos(c.yaw) * fx + Math.sin(c.yaw) * fz, p[1] + y, p[2] - Math.sin(c.yaw) * fx + Math.cos(c.yaw) * fz];
};

const Held: React.FC<{ token: string; at: V3; c: CharData }> = ({ token, at, c }) => {
  const [kind, label] = token.split(":");
  if (kind === "briefcase") return c.action === "open_case" ? <BombCase p={at} /> : <Piece kind="suitcase" p={[at[0], at[1] - 0.3, at[2]]} yaw={c.yaw + 1.57} s={0.6} c="#2b2224" />;
  if (kind === "money_bag") return <MoneyBag p={[at[0], at[1] - 0.25, at[2]]} s={0.7} />;
  if (kind === "pack") return c.action === "hang_parachute" || c.action === "step_off" || c.action === "fall" ? null : <Piece kind="pack" p={[at[0], at[1] - 0.3, at[2]]} yaw={c.yaw} />;
  if (label) return <Label text={label} p={at} w={Math.min(0.52, 0.1 + label.length * 0.03)} h={0.15} fg="#1a1416" bg="#f3ead6" font={0.55} />;
  return <group position={at} rotation={[1.25, 0, 0]}><Piece kind={kind} p={[0, 0, 0]} /></group>;
};


const Kit: React.FC<{ sc: SceneData }> = ({ sc }) => {
  const o = sc.options as Record<string, never>;
  if (sc.kit === "room") return <Room {...o} windowsLit={sc.night} />;
  if (sc.kit === "ground") return <Ground {...o} />;
  if (sc.kit === "water_edge") return <WaterEdge {...o} />;
  if (sc.kit === "sky") return <SkyStage {...o} />;
  if (sc.kit === "airliner_cabin") return <Cabin p={[0, 0, 0]} len={18} />;
  throw new Error(`no kit '${sc.kit}'`);
};

export const Film: React.FC<{ film: FilmData }> = ({ film }) => {
  const ready = useFonts();
  const g = useCurrentFrame();
  const chunks = React.useMemo(() => makeChunks(film.words as unknown as Word[], film.frames / film.fps), [film]);
  if (!ready) return <AbsoluteFill style={{ background: "#0c0e14" }} />;
  const t = g / film.fps;
  const si = Math.max(0, film.scenes.findIndex((s, i) => t < s.t1 || i === film.scenes.length - 1));
  const sc = film.scenes[si];
  const hi = Math.max(0, sc.shots.findIndex((s, i) => t < s.t1 || i === sc.shots.length - 1));
  const sh = sc.shots[hi];
  const H = (id: string) => film.cast[id]?.height ?? 1.72;
  const by = (id: string | null | undefined) => sh.chars.find((c) => c.id === id);

  // ---- subject point ----
  let S: V3;
  const sub = sh.subject; const sc1 = by(sub.char), held = by(sub.held);
  if (sc1) S = headPoint(sc1, sh, t, H(sc1.id));
  else if (held) S = handPoint(held, sh, t, H(held.id));
  else { const p = v3(sub.point ?? [0, 1, -4]); S = [p[0], p[1] + (p[1] < 0.3 && sh.type !== "wide" ? 0.45 : p[1] < 0.3 ? 1.2 : 0), p[2]]; }
  if (sh.focus) S = v3(sh.focus);   // set by scene/gate.py: the centre of the piece the shot is about
  const two = sh.type === "two_shot" ? by(sh.second) : undefined;
  if (two && sc1) { const b = headPoint(two, sh, t, H(two.id)); S = [(S[0] + b[0]) / 2, (S[1] + b[1]) / 2, (S[2] + b[2]) / 2]; }

  // ---- camera: chosen and checked by scene/gate.py, baked as five keys across the shot ----
  const u = ease((t - sh.t0) / Math.max(0.01, sh.t1 - sh.t0));
  const K = sh.cam.keys; const x = u * (K.length - 1); const k0 = Math.min(K.length - 2, Math.floor(x)); const f = x - k0;
  const mixv = (a: number[], b: number[]): V3 => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  const from = mixv(K[k0].from, K[k0 + 1].from);
  const cam = { pos: from, look: mixv(K[k0].look, K[k0 + 1].look), fov: sh.cam.fov, roll: 0 };
  const dist = Math.hypot(S[0] - from[0], S[1] - from[1], S[2] - from[2]);
  const m = moodOf(sc.mood);

  return (
    <AbsoluteFill style={{ background: "#0c0e14" }}>
      <Audio src={staticFile(film.voice)} />
      <Audio src={staticFile(film.music)} volume={0.14} />
      <View mood={m} cam={cam} t={t} focus={S} blur={1.2} sky={sc.sky}>
        <Kit sc={sc} />
        {sc.pieces.map((p, i) => <Piece key={i} kind={p.kind} p={v3(p.p)} yaw={p.yaw} s={p.s} {...(p.opts as object)} />)}
        {sc.planes.map((p, i) => <Plane key={i} p={v3(p.p)} yaw={p.yaw ?? 0} gear={!!p.gear} stairs={!!p.stairs && t >= (p.stairs_from ?? 0)} />)}
        {sc.rain ? <Rain t={t} c={[S[0], S[1], S[2] + 2]} /> : null}
        {sc.crowd.map((c, i) => { const dt = t - sc.t0; const cx = c.p[0] + c.vel[0] * dt, cz = c.p[2] + c.vel[1] * dt; if (Math.hypot(cx - from[0], cz - from[2]) < 2.4) return null; /* never let a walker cross the lens */ return <Character3D key={"cr" + i} {...spec(CROWD[c.look])} position={[c.p[0] + c.vel[0] * dt, c.p[1], c.p[2] + c.vel[1] * dt]} yaw={c.yaw} t={t} face={FACES.neutral} pose={{ walk: c.walk ? t * 6 + i * 1.7 : undefined }} />; })}
        {sh.chars.map((c) => {
          const look = film.cast[c.id]; if (!look) throw new Error(`no look for cast '${c.id}'`);
          const p = charPos(c, sh, t); const hp = handPoint(c, sh, t, H(c.id)); const hl = handPoint(c, sh, t, H(c.id), true);
          return (
            <React.Fragment key={c.id}>
              <Character3D {...spec(look)} position={p} yaw={c.yaw} t={t} face={{ ...FACES[c.face], look: 0 }} pose={pose(c, t)} faceCamera={cam.pos} />
              {c.action === "hang_parachute" ? <Parachute p={p} /> : null}
              {/* the newest thing in the right hand, anything else in the left */}
              {c.holds.map((tok, k) => <Held key={k} token={tok} at={k === c.holds.length - 1 ? hp : hl} c={{ ...c, action: k === c.holds.length - 1 ? c.action : "stand" }} />)}
            </React.Fragment>
          );
        })}
        {sh.labels.map((txt, i) => { const k = dist / 4.4; return <Label key={i} text={txt} p={[S[0], S[1] + (0.5 + i * 0.26) * k, S[2] + 0.05]} w={Math.min(1.5, 0.25 + txt.length * 0.055) * k} h={0.2 * k} fg="#1a1416" bg="#e8c24a" font={0.6} />; })}
        <CastLight at={S} cam={cam.pos} mood={m} />
      </View>
      {sc.tag && t - sc.t0 < 2.6 ? (
        <div style={{ position: "absolute", top: 210, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: Math.min(1, (t - sc.t0) / 0.25) * Math.min(1, (2.6 - (t - sc.t0)) / 0.3) }}>
          <div style={{ fontFamily: "Poppins", fontWeight: 800, fontSize: 40, letterSpacing: 2, color: "#f3ead6", background: "rgba(20,22,30,0.82)", padding: "14px 30px", borderRadius: 12, border: "3px solid #e8c24a" }}>{sc.tag}</div>
        </div>
      ) : null}
      <AbsoluteFill style={{ background: "#0c0e14", opacity: Math.max(0, ...film.scenes.slice(1).map((s) => 1 - Math.abs(t - s.t0) / 0.16)) }} />
      <Captions chunks={chunks} t={t} />
    </AbsoluteFill>
  );
};
