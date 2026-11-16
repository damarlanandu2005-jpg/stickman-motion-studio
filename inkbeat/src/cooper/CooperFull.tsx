// db_cooper — the full 40 s short in the inkbeat look, on the real voice track. Eight scenes cut on the
// narration: hook (parachute), ticket desk, cabin hijack, ransom on the tarmac, night flight, the leap,
// the search, the cash on the riverbank, unsolved. One <View> at a time, chosen by time.
import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { Character3D, headOf } from "../inkbeat/char/Character3D";
import { Captions, makeChunks } from "../inkbeat/core/captions";
import { CastLight } from "../inkbeat/core/castLight";
import { boxG, Label, M } from "../inkbeat/core/kit";
import { useFonts } from "../inkbeat/core/frame";
import { moodOf } from "../inkbeat/core/moods";
import { aim } from "../inkbeat/core/rig";
import type { Cam } from "../inkbeat/core/rig";
import { View } from "../inkbeat/core/View";
import type { V3 } from "../inkbeat/types";
import { Cabin } from "./Cabin";
import { BombCase, Forest, MoneyBag, Parachute, Pine, Plane, Rain } from "./props";
import { WORDS } from "./words";

export const COOPER_FULL_FRAMES = 1206; // 40.2 s @ 30
const CHUNKS = makeChunks(WORDS, COOPER_FULL_FRAMES / 30);
const ACCENT = new Set(["hijacked", "bomb.", "parachutes.", "leapt", "never", "unsolved", "Cooper."]);

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const ease = (u: number) => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };
const mix = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const BLOCK = { torso: "block" as const, torsoWidth: 1.05 };

const person = (top: string, bottom: string, hairColor: string, skin = "#ecccae", extra: object = {}) => ({
  height: 1.72, build: BLOCK,
  look: { skin, outfit: "jacket" as const, colors: { top, inner: "#e9e6de", bottom, shoes: "#20171a", accent: "#15161a" }, hair: "swoop" as const, hairColor, face: { nose: "button" as const, brow: 1.05 }, ...extra },
});
const COOPER = { ...person("#23262e", "#1b1d23", "#20191a", "#ecccae", { glasses: "#15161a", mustache: "#20191a", face: { nose: "hook" as const, brow: 1.05 } }), height: 1.78 };
const ATT = { ...person("#7a2230", "#5a1a26", "#3a2820", "#f1d6bd", { face: { nose: "button" as const, blush: 0.3, brow: 1.1 } }), height: 1.66 };
const AGENT = person("#3f5d8a", "#2a3550", "#5a4535", "#e7b48e");
const FBI1 = person("#2c2f38", "#22252c", "#2a211c", "#e7b48e", { hat: "flat" as const });
const FBI2 = person("#4a4238", "#2c2f38", "#141216", "#d49a6a", { hat: "flat" as const });
const PAX = [person("#6a5a3a", "#3b3a44", "#3a2a22"), person("#4a5240", "#2f3540", "#5a4535", "#d49a6a"), person("#45384f", "#2c2f38", "#141216", "#f1d6bd")];
const BOY = { height: 1.18, build: { torso: "block" as const, torsoWidth: 0.9 }, look: { skin: "#f1d6bd", outfit: "shirt" as const, colors: { top: "#d0672f", inner: "#e9e6de", bottom: "#3b5a8a", shoes: "#5a4030", accent: "#15161a" }, hair: "swoop" as const, hairColor: "#8a5a2a", face: { nose: "button" as const, blush: 0.4, brow: 1 } } };

type Scene = { mood: string; cam: Cam; focus: V3; sky: boolean; light: V3; kids: React.ReactNode };
const NEUTRAL = { eyes: "open" as const, mouth: "flat" as const, brows: "neutral" as const, look: 0 };
const Ground: React.FC<{ c: string; tex: "stone" | "grass" | "sand"; y?: number }> = ({ c, tex, y = 0 }) => <M g={boxG(240, 0.2, 240)} c={c} tex={tex} ts={6} p={[0, y - 0.1, -40]} />;

const scene = (t: number): Scene => {
  // ---------- A: hook — under the canopy at night (0 – 5.3) ----------
  if (t < 5.3 || t >= 36.5) {
    const end = t >= 36.5;
    const u = end ? (t - 36.5) / 3.6 : t / 5.3;
    const at: V3 = [0, lerp(3.2, 1.6, u), -4];
    const head = headOf(at, 1.78, BLOCK);
    const cam = aim(mix([1.6, 3.4, 3.4], [0.4, 2.6, 2.6], ease(u)), head, 50, 0.44);
    return {
      mood: "night", cam, focus: head, sky: true, light: head,
      kids: (
        <>
          <Ground c="#1c2a24" tex="grass" y={-9} />
          <Forest n={70} x={[-40, 40]} z={[-60, -6]} y={-9} seed={4} s={2.2} dark />
          <Plane p={[lerp(-16, 14, u), 13, -34]} />
          <Parachute p={at} />
          <Character3D {...COOPER} position={at} yaw={0.3} t={t} face={{ eyes: "open", mouth: "smirk", brows: "neutral", look: 0 }} pose={{ armL: [150, 10], armR: [150, 10], headTilt: Math.sin(t * 1.4) * 3 }} faceCamera={cam.pos} />
          <MoneyBag p={[at[0] + 0.42, at[1] + 0.55, at[2] + 0.1]} s={0.9} />
          {end ? (t > 37.4 ? <Label text="UNSOLVED" p={[0, at[1] + 2.95, -3.6]} r={[0, 0, -0.12]} w={2.3} h={0.62} fg="#b4343c" bg="#f3ead6" font={0.7} stamp /> : null)
            : <Label text="1971" p={[-1.5, at[1] + 2.9, -4.4]} w={1.3} h={0.56} fg="#1a1416" bg="#e8c24a" font={0.7} />}
        </>
      ),
    };
  }
  // ---------- B: the ticket desk (5.3 – 9.3) ----------
  if (t < 9.3) {
    const u = (t - 5.3) / 4;
    const c: V3 = [-0.9, 0, -2.0], a: V3 = [0.95, 0, -2.1];
    const head = headOf(c, 1.78, BLOCK);
    const cam = aim(mix([-0.2, 1.62, 2.6], [0.25, 1.6, 1.9], ease(u)), [0, 1.58, -2], 46, 0.38);
    return {
      mood: "lamp", cam, focus: head, sky: false, light: head,
      kids: (
        <>
          <M g={boxG(14, 0.1, 12)} c="#7b6a58" tex="planks" p={[0, -0.05, -2]} />
          <M g={boxG(14, 5, 0.2)} c="#cfc3ae" p={[0, 2.5, -4.6]} />
          <M g={boxG(0.8, 1.06, 2.6)} c="#8a5a3a" tex="wood" p={[0, 0.53, -2.2]} />
          <M g={boxG(0.9, 0.06, 2.7)} c="#5a3a26" p={[0, 1.09, -2.2]} />
          <Label text="TICKETS" p={[0, 3.0, -4.48]} w={2.6} h={0.62} fg="#f3ead6" bg="#2a3550" font={0.66} />
          <Label text="PORTLAND → SEATTLE" p={[0, 2.38, -4.48]} w={2.6} h={0.36} fg="#1a1416" bg="#f3ead6" font={0.5} />
          {t > 6.3 ? <Label text="DAN COOPER" p={[0, 1.5, -1.5]} r={[0, 0, 0.05]} w={0.95} h={0.34} fg="#1a1416" bg="#f3ead6" font={0.5} /> : null}
          <M g={boxG(0.5, 0.36, 0.14)} c="#2b2224" p={[-1.35, 0.5, -1.7]} />
          <Character3D {...COOPER} position={c} yaw={0.85} t={t} face={{ eyes: "open", mouth: "smile", brows: "neutral", look: 0.3 }} pose={{ armL: [10, 10], armR: [40, 50], headTilt: -2 }} faceCamera={cam.pos} />
          <Character3D {...AGENT} position={a} yaw={-0.85} t={t} face={{ eyes: "open", mouth: "smile", brows: "raised", look: -0.3 }} pose={{ armL: [30, 40], armR: [10, 10], headTilt: 2 }} faceCamera={cam.pos} />
        </>
      ),
    };
  }
  // ---------- C: the cabin (9.3 – 17.5) ----------
  if (t < 17.5) {
    const tl = t - 9.31, u = tl / 8.2;
    const c: V3 = [-0.6, 0, -3.1], a: V3 = [0.62, 0, -2.95];
    const head = headOf(c, 1.78, BLOCK);
    const cam = aim(mix([0.02, 1.6, 1.1], [0.3, 1.62, 0.5], ease(u)), [0.02, 1.58, -3.0], 46, 0.36);
    const shocked = tl > 2.9;
    return {
      mood: "cold", cam, focus: head, sky: false, light: head,
      kids: (
        <>
          <Cabin p={[0, 0, 0]} len={18} />
          {tl > 0.6 && tl < 3.2 ? <Label text="I HAVE A BOMB" p={[0.02, 1.02, -2.9]} w={0.66} h={0.3} fg="#1a1416" bg="#f3ead6" font={0.44} /> : null}
          {tl >= 3.2 && tl < 5.5 ? <BombCase p={[0.02, 1.05, -2.9]} /> : null}
          {tl >= 5.9 ? <MoneyBag p={[-0.12, 0.84, -2.85]} s={0.8} /> : null}
          {tl >= 5.9 ? <Label text="$200,000" p={[0.3, 1.34, -2.86]} w={0.62} h={0.26} fg="#1a1416" bg="#e8c24a" font={0.6} /> : null}
          {tl >= 7.2 ? <Label text="4 PARACHUTES" p={[0.3, 0.74, -2.86]} w={0.62} h={0.22} fg="#f3ead6" bg="#b4343c" font={0.5} /> : null}
          <Character3D {...COOPER} position={c} yaw={0.7} t={t} face={{ eyes: "open", mouth: "flat", brows: "neutral", look: 0.2 }} pose={{ armL: [14, 24], armR: [20, 34], headTilt: -2 }} faceCamera={cam.pos} />
          <Character3D {...ATT} position={a} yaw={-0.8} t={t} face={shocked ? { eyes: "wide", mouth: "o", brows: "raised", look: -0.1 } : { ...NEUTRAL, look: -0.15 }} pose={{ armL: [10, 14], armR: [10, 14], headTilt: 2 }} faceCamera={cam.pos} />
        </>
      ),
    };
  }
  // ---------- D: ransom on the tarmac, passengers freed (17.5 – 21.1) ----------
  if (t < 21.1) {
    const u = (t - 17.5) / 3.6;
    const a: V3 = [lerp(-1.5, -0.7, u), 0, lerp(-2.6, -4.0, u)];
    const head = headOf(a, 1.66, BLOCK);
    const cam = aim(mix([0.6, 1.7, 4.6], [-0.2, 1.7, 3.6], ease(u)), [0.3, 1.6, -3.4], 52, 0.4);
    return {
      mood: "dusk", cam, focus: head, sky: true, light: head,
      kids: (
        <>
          <Ground c="#6d6f78" tex="stone" />
          <Plane p={[0.5, 2.45, -17]} gear />
          <M g={boxG(60, 0.02, 0.3)} c="#e8c24a" p={[0, 0.02, -9]} />
          <Character3D {...ATT} position={a} yaw={2.6} t={t} face={{ eyes: "open", mouth: "flat", brows: "worried", look: 0 }} pose={{ armL: [20, 30], armR: [20, 30], walk: t * 7 }} faceCamera={cam.pos} />
          <MoneyBag p={[a[0] + 0.5, 0.5, a[2] + 0.15]} s={0.9} />
          {PAX.map((s, i) => { const p: V3 = [lerp(0.5, 1.3, u) + i * 0.8, 0, -2.4 - i * 1.0]; return <Character3D key={i} {...s} position={p} yaw={1.2} t={t} face={{ eyes: "open", mouth: "smile", brows: "raised", look: 0 }} pose={{ armL: [10, 10], armR: [10, 10], walk: t * 7 + i * 2 }} faceCamera={cam.pos} />; })}
        </>
      ),
    };
  }
  // ---------- E: low and slow toward Mexico (21.1 – 24.9) ----------
  if (t < 24.9) {
    const u = (t - 21.1) / 3.8;
    const pl: V3 = [lerp(-8, 4, u), 7.5, -22];
    const cam = aim([0, 1.4, 6], [pl[0] * 0.7, pl[1], pl[2]], 50, 0.36);
    return {
      mood: "night", cam, focus: pl, sky: true, light: pl,
      kids: (
        <>
          <Ground c="#1c2a24" tex="grass" />
          <Forest n={60} x={[-40, 40]} z={[-70, -30]} seed={8} s={1.5} dark />
          <Plane p={pl} yaw={0} />
          {t > 23.0 ? <Label text="MEXICO →" p={[pl[0] * 0.7, 4.4, -18]} w={3.6} h={0.85} fg="#1a1416" bg="#e8c24a" font={0.66} /> : null}
        </>
      ),
    };
  }
  // ---------- F: the rear stairs, the leap (24.9 – 29.9) ----------
  if (t < 29.9) {
    const u = (t - 24.9) / 5;
    const fall = Math.max(0, t - 28.75);
    const stand: V3 = [-8.15, 2.72, 0];
    const c: V3 = [stand[0] - fall * 2.4, stand[1] + fall * 1.6 - fall * fall * 7.5, 0];
    const head = headOf(fall > 0 ? c : stand, 1.78, BLOCK);
    const cam = aim(mix([-13.5, 3.2, 6.5], [-12.5, 2.4, 5.2], ease(u)), [-7.6, fall > 0 ? Math.max(1.5, head[1]) : 4.1, 0], 52, 0.42);
    return {
      mood: "night", cam, focus: head, sky: true, light: head,
      kids: (
        <>
          <Ground c="#16221d" tex="grass" y={-14} />
          <Forest n={90} x={[-50, 30]} z={[-50, 14]} y={-14} seed={12} s={2.4} dark />
          <Plane p={[0, 5.2, 0]} stairs={t > 27.6} />
          <Rain t={t} c={[-9, 4, 2]} />
          {t > 27.7 ? <Character3D {...COOPER} position={c} yaw={-1.9} t={t} face={{ eyes: "open", mouth: fall > 0 ? "yell" : "flat", brows: "neutral", look: 0 }} pose={fall > 0 ? { armL: [140, 10], armR: [140, 10] } : { armL: [20, 20], armR: [30, 40] }} faceCamera={cam.pos} /> : null}
          {t > 27.7 ? <MoneyBag p={[c[0] - 0.35, c[1] + 0.6, c[2] + 0.2]} s={0.8} /> : null}
        </>
      ),
    };
  }
  // ---------- G1: the search (29.9 – 32.6) ----------
  if (t < 32.6) {
    const u = (t - 29.9) / 2.7;
    const a: V3 = [lerp(-1.3, -0.7, u), 0, -3], b: V3 = [lerp(0.5, 1.1, u), 0, -3.8];
    const head = headOf(a, 1.72, BLOCK);
    const cam = aim(mix([0.4, 1.6, 2.8], [0, 1.6, 2.0], ease(u)), [0, 1.55, -3.3], 48, 0.38);
    return {
      mood: "day", cam, focus: head, sky: true, light: head,
      kids: (
        <>
          <Ground c="#4d7a48" tex="grass" />
          <Forest n={80} x={[-22, 22]} z={[-40, -1]} seed={21} s={1.5} gap={2.6} />
          <Pine p={[-2.9, 0, -4.6]} s={1.5} /><Pine p={[2.9, 0, -5.2]} s={1.7} />
          <Label text="FBI" p={[0.1, 2.75, -3.9]} w={1.0} h={0.46} fg="#f3ead6" bg="#2a3550" font={0.72} />
          <Character3D {...FBI1} position={a} yaw={0.5} t={t} face={{ eyes: "squint", mouth: "frown", brows: "worried", look: 0.4 }} pose={{ armL: [10, 10], armR: [60, 70], walk: t * 5 }} faceCamera={cam.pos} />
          <Character3D {...FBI2} position={b} yaw={-0.4} t={t} face={{ eyes: "squint", mouth: "flat", brows: "worried", look: -0.4 }} pose={{ armL: [50, 60], armR: [10, 10], walk: t * 5 + 2 }} faceCamera={cam.pos} />
        </>
      ),
    };
  }
  // ---------- G2: the cash on the riverbank, 1980 (32.6 – 36.5) ----------
  {
    const u = (t - 32.6) / 3.9;
    const b: V3 = [-0.25, 0, -2.6];
    const head = headOf(b, 1.18, { torso: "block", torsoWidth: 0.9 });
    const cam = aim(mix([0.9, 1.25, 1.9], [0.5, 1.15, 1.2], ease(u)), [0.1, 1.0, -2.6], 46, 0.4);
    return {
      mood: "golden", cam, focus: head, sky: true, light: head,
      kids: (
        <>
          <Ground c="#c9b27c" tex="sand" />
          <M g={boxG(120, 0.06, 9)} c="#3f86c9" e="#2a6aa8" ei={0.5} p={[0, 0.03, -10]} />
          <Ground c="#4d7a48" tex="grass" y={0.04} />
          <M g={boxG(240, 0.3, 30)} c="#c9b27c" tex="sand" p={[0, -0.02, 8]} />
          <M g={boxG(240, 0.34, 6)} c="#c9b27c" tex="sand" p={[0, -0.02, -3.2]} />
          <Forest n={50} x={[-26, 26]} z={[-40, -16]} seed={31} s={1.6} />
          <M g={boxG(0.34, 0.16, 0.2)} c="#5d8a4a" p={[0.12, 0.8, -2.25]} />
          <M g={boxG(0.36, 0.05, 0.22)} c="#e9e6de" p={[0.12, 0.8, -2.25]} />
          <Label text="1980" p={[0.55, 1.85, -3.4]} w={0.9} h={0.42} fg="#1a1416" bg="#e8c24a" font={0.7} />
          <Character3D {...BOY} position={b} yaw={0.5} t={t} face={{ eyes: "wide", mouth: "grin", brows: "raised", look: 0.3 }} pose={{ armL: [10, 10], armR: [55, 80], headTilt: -4, headNod: 6 }} faceCamera={cam.pos} />
        </>
      ),
    };
  }
};

export const CooperFull: React.FC = () => {
  const ready = useFonts();
  const g = useCurrentFrame();
  if (!ready) return <AbsoluteFill style={{ background: "#0c0e14" }} />;
  const t = g / 30;
  const s = scene(t);
  const m = moodOf(s.mood);
  return (
    <AbsoluteFill style={{ background: "#0c0e14" }}>
      <Audio src={staticFile("cooper/voice.mp3")} />
      <Audio src={staticFile("cooper/music.mp3")} volume={0.14} />
      <View key={s.mood + (s.sky ? "s" : "i")} mood={m} cam={s.cam} t={t} focus={s.focus} blur={1.4} sky={s.sky}>
        {s.kids}
        <CastLight at={s.light} cam={s.cam.pos} mood={m} />
      </View>
      <Captions chunks={CHUNKS} t={t} accent={ACCENT} />
    </AbsoluteFill>
  );
};
