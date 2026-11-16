// db_cooper, inkbeat look — the hijack beat (~8s): mid-flight, Cooper passes the note, shows the bomb,
// makes his demands. One cabin interior, two characters, a slow push down the aisle. Captions on the real
// db_cooper voice words (rebased to 0). A test of our content in the inkbeat engine, not the pilot.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Character3D, headOf } from "../inkbeat/char/Character3D";
import { Captions, makeChunks } from "../inkbeat/core/captions";
import type { Word } from "../inkbeat/core/captions";
import { CastLight } from "../inkbeat/core/castLight";
import { Label } from "../inkbeat/core/kit";
import { useFonts } from "../inkbeat/core/frame";
import { moodOf } from "../inkbeat/core/moods";
import { aim, poseAt, withShake } from "../inkbeat/core/rig";
import type { Beat } from "../inkbeat/core/rig";
import { View } from "../inkbeat/core/View";
import type { V3 } from "../inkbeat/types";
import { Cabin } from "./Cabin";

export const COOPER_FRAMES = 240; // 8 s @ 30

const COOPER: V3 = [-0.62, 0, -2.5];
const ATT: V3 = [0.66, 0, -2.15];
const COOPER_HEAD: V3 = headOf(COOPER, 1.78, { torso: "block", torsoWidth: 1.05 });

// Cooper: dark suit, black tie, dark glasses, dark hair, thin moustache
const COOPER_SPEC = {
  height: 1.78,
  build: { torso: "block" as const, torsoWidth: 1.05 },
  look: {
    skin: "#ecccae",
    outfit: "jacket" as const,
    colors: { top: "#23262e", inner: "#e9e6de", bottom: "#1b1d23", shoes: "#20171a", accent: "#15161a" },
    hair: "swoop" as const,
    hairColor: "#20191a",
    glasses: true,
    mustache: "#20191a",
    face: { nose: "hook" as const, brow: 1.05 },
  },
};

// Flight attendant: burgundy 1971 uniform, swept hair
const ATT_SPEC = {
  height: 1.66,
  build: { torso: "block" as const, torsoWidth: 0.96 },
  look: {
    skin: "#f1d6bd",
    outfit: "jacket" as const,
    colors: { top: "#7a2230", inner: "#efe7d6", bottom: "#5a1a26", shoes: "#2a1418", accent: "#d8b24a" },
    hair: "swoop" as const,
    hairColor: "#3a2820",
    face: { nose: "button" as const, blush: 0.3, brow: 1.1 },
  },
};

const WORDS: Word[] = [
  ["Mid-flight,", 0.0, 0.47], ["he", 0.47, 0.6], ["handed", 0.6, 0.92], ["a", 0.92, 0.98], ["note", 0.98, 1.14], ["to", 1.14, 1.22],
  ["a", 1.22, 1.28], ["flight", 1.28, 1.54], ["attendant.", 1.54, 2.33], ["It", 2.33, 2.41], ["said", 2.41, 2.57], ["he", 2.57, 2.7],
  ["had", 2.7, 2.86], ["a", 2.86, 2.92], ["bomb.", 2.92, 3.21], ["He", 3.21, 3.34], ["showed", 3.34, 3.57], ["her", 3.57, 3.73],
  ["the", 3.73, 3.83], ["wires", 3.83, 4.02], ["in", 4.02, 4.1], ["his", 4.1, 4.26], ["briefcase.", 4.26, 4.88], ["Then", 4.88, 5.08],
  ["he", 5.08, 5.21], ["made", 5.21, 5.37], ["his", 5.37, 5.53], ["demands:", 5.53, 5.94], ["two", 5.94, 6.1], ["hundred", 6.1, 6.36],
  ["thousand", 6.36, 6.72], ["dollars,", 6.72, 7.13], ["and", 7.13, 7.22], ["four", 7.22, 7.39], ["parachutes.", 7.39, 7.97],
];
const CHUNKS = makeChunks(WORDS, COOPER_FRAMES / 30);

const BEATS: Beat[] = [
  { t: 0.0, move: "PUSH", dur: 3.0, word: "Mid-flight" },
  { t: 2.92, move: "PUNCH", dur: 0.22, word: "bomb" },
  { t: 3.3, move: "ORBIT_L", dur: 4.5, word: "showed" },
];

export const CooperCabin: React.FC = () => {
  const ready = useFonts();
  const g = useCurrentFrame();
  if (!ready) return <AbsoluteFill style={{ background: "#0c0e14" }} />;
  const t = g / 30;
  const base = aim([0.05, 1.56, 1.5], [0.05, 1.36, -3.4], 48, 0);
  const p = poseAt(base, BEATS, 0, t, [{ frac: 0.14 }, { frac: 0.05 }, { deg: 8 }]);
  const cam = withShake(p, p.shake);
  const m = moodOf("lamp"); // warm lamp-lit interior
  // attendant reacts: neutral -> shocked when the bomb line lands
  const attFace = t > 2.9 ? { eyes: "wide" as const, mouth: "o" as const, brows: "raised" as const, look: -0.1 }
    : { eyes: "open" as const, mouth: "flat" as const, brows: "neutral" as const, look: -0.15 };

  return (
    <AbsoluteFill style={{ background: "#0c0e14" }}>
      <View mood={m} cam={cam} t={t} focus={COOPER_HEAD} blur={1.6} sky={false}>
        <Cabin p={[0, 0, 0]} len={18} />
        {/* the note, held up between them during the note/bomb line */}
        {t < 3.2 ? <Label text="I HAVE A BOMB" p={[0.02, 1.2, -2.0]} w={1.2} h={0.5} fg="#1a1416" bg="#f3ead6" font={0.42} /> : null}
        {/* the demands, tagged in once he makes them */}
        {t >= 5.4 ? <Label text="$200,000" p={[0.02, 1.35, -2.1]} w={1.3} h={0.55} fg="#1a1416" bg="#e8c24a" font={0.6} /> : null}
        <Character3D
          {...COOPER_SPEC}
          position={COOPER}
          yaw={0.7}
          t={t}
          face={{ eyes: "open", mouth: "flat", brows: "neutral", look: 0.2 }}
          pose={{ armL: [14, 24], armR: [20, 34], headTilt: -2, bob: Math.sin(t * 2.4) * 1.4 }}
          faceCamera={cam.pos}
        />
        <Character3D
          {...ATT_SPEC}
          position={ATT}
          yaw={-0.8}
          t={t}
          face={attFace}
          pose={{ armL: [10, 14], armR: [10, 14], headTilt: 2, bob: Math.sin(t * 2.6 + 1) * 1.2 }}
          faceCamera={cam.pos}
        />
        <CastLight at={COOPER_HEAD} cam={cam.pos} mood={m} />
      </View>
      <Captions chunks={CHUNKS} t={g / 30} accent={new Set(["bomb.", "$200,000", "parachutes."])} />
    </AbsoluteFill>
  );
};
