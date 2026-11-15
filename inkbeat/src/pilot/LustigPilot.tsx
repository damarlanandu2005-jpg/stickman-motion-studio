// Pilot: the first ~8s of the "sold the Eiffel Tower twice" story, in the inkbeat look, to compare against ours.
// One continuous beat-driven shot: the tower behind, Lustig in front, a slow push with a small orbit. Captions on words.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Character3D, headOf } from "../inkbeat/char/Character3D";
import { Captions, makeChunks } from "../inkbeat/core/captions";
import type { Word } from "../inkbeat/core/captions";
import { CastLight } from "../inkbeat/core/castLight";
import { boxG, Label, M } from "../inkbeat/core/kit";
import { subFrame, useFonts } from "../inkbeat/core/frame";
import { moodOf } from "../inkbeat/core/moods";
import { aim, poseAt, withShake } from "../inkbeat/core/rig";
import type { Beat } from "../inkbeat/core/rig";
import { View } from "../inkbeat/core/View";
import type { V3 } from "../inkbeat/types";
import { House } from "../demo/Street";
import { Eiffel } from "./Eiffel";

const LUSTIG: V3 = [0.5, 0.0, -1.6];
const H = 1.74;
const HEAD: V3 = headOf(LUSTIG, H, { torso: "block", torsoWidth: 1.04 });
export const PILOT_FRAMES = 240; // 8 s @ 30

// Lustig: navy suit, grey flat cap, a thin dark moustache (closest the family allows without new hats)
const LUSTIG_SPEC = {
  height: H,
  build: { torso: "block" as const, torsoWidth: 1.04 },
  look: {
    skin: "#f1d9c2",
    colors: { top: "#2b3350", inner: "#e9e2d2", bottom: "#222634", shoes: "#3a2420", accent: "#c9b24a" },
    hair: "swoop" as const,
    hairColor: "#2a211c",
    hat: "flat" as const,
    hatColor: "#8a8790",
    mustache: "#2a211c",
    face: { nose: "hook" as const, brow: 1.1 },
  },
};

const WORDS: Word[] = [
  ["A", 0.03, 0.1], ["man", 0.1, 0.3], ["sold", 0.3, 0.54], ["the", 0.54, 0.66], ["Eiffel", 0.66, 1.03], ["Tower.", 1.03, 1.6],
  ["Twice.", 1.82, 2.4], ["Built", 2.6, 2.8], ["for", 2.8, 2.9], ["1889", 2.99, 3.6], ["World's", 3.79, 4.05], ["Fair,", 4.05, 4.5],
  ["only", 4.51, 4.77], ["meant", 4.77, 4.97], ["to", 4.97, 5.05], ["stand", 5.05, 5.28], ["twenty", 5.28, 5.62], ["years,", 5.62, 6.1],
  ["many", 5.93, 6.19], ["already", 6.65, 7.05], ["hated", 7.05, 7.34], ["it.", 7.34, 7.9],
];
const CHUNKS = makeChunks(WORDS, 2);

const BEATS: Beat[] = [
  { t: 0.3, move: "PUSH", dur: 3.0, word: "sold" },
  { t: 1.82, move: "PUNCH", dur: 0.22, word: "Twice" },
  { t: 2.9, move: "ORBIT_L", dur: 3.6, word: "Built" },
];

export const LustigPilot: React.FC<{ sub?: boolean }> = ({ sub = false }) => {
  const ready = useFonts();
  const g = useCurrentFrame();
  if (!ready) return <AbsoluteFill style={{ background: "#141a26" }} />;
  const { n, fp } = sub ? subFrame(g) : { n: g, fp: g };
  const t = fp / 30;
  const base = aim([3.2, 1.35, 4.2], [0.1, 2.6, -4.2], 54, 0.42);
  const p = poseAt(base, BEATS, 0, t, [{ frac: 0.16 }, { frac: 0.06 }, { deg: 10 }]);
  const cam = withShake(p, p.shake);
  const m = moodOf("day");
  return (
    <AbsoluteFill style={{ background: "#141a26" }}>
      <View mood={m} cam={cam} t={t} focus={HEAD} blur={0.7}>
        {/* cobbled ground */}
        <M g={boxG(60, 0.1, 60)} c="#b9b2a6" tex="stone" p={[0, -0.05, -8]} />
        <Eiffel p={[0, 0, -8]} h={15} />
        {/* a couple of Paris facades to the sides so the horizon is not empty */}
        <House p={[-7.5, 0, -7]} w={5} h={5.2} d={4} wall="#e7dcc6" tex="plaster" roof="#6a5a66" yaw={0.5} windows={2} />
        <House p={[7.8, 0, -8]} w={5.5} h={5.8} d={4} wall="#e3d6be" tex="plaster" roof="#5e5060" yaw={-0.5} windows={2} />
        {/* sound-off tags painted on posts at the tower base */}
        <Label text="1889" p={[-2.1, 1.1, -5.2]} w={1.5} h={0.75} fg="#f4ead6" bg="#2b3350" font={0.6} />
        <Label text="20 YEARS" p={[2.2, 1.1, -5.2]} w={1.9} h={0.75} fg="#1a1416" bg="#e8c24a" font={0.5} />
        <Character3D
          {...LUSTIG_SPEC}
          position={LUSTIG}
          yaw={0.5}
          t={t}
          face={{ eyes: "open", mouth: "smile", brows: "raised", look: 0.1 }}
          pose={{ armL: [8, 8], armR: [18, 20], headTilt: -3, bob: Math.sin(t * 3) * 2 }}
          faceCamera={cam.pos}
        />
        <CastLight at={HEAD} cam={cam.pos} mood={m} />
      </View>
      <Captions chunks={CHUNKS} t={n / 30} accent={new Set(["Twice.", "1889"])} />
    </AbsoluteFill>
  );
};
