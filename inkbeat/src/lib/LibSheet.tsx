// Library proof sheet: each frame shows one kit dressed with library pieces and characters in the new leg poses.
// Not a film. Render stills of frames 0..6 to check the library by eye.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Character3D } from "../inkbeat/char/Character3D";
import { CastLight } from "../inkbeat/core/castLight";
import { useFonts } from "../inkbeat/core/frame";
import { moodOf } from "../inkbeat/core/moods";
import { aim } from "../inkbeat/core/rig";
import { View } from "../inkbeat/core/View";
import type { V3 } from "../inkbeat/types";
import { Ground, Room, SkyStage, WaterEdge } from "./kits";
import { Piece } from "./pieces";

export const LIB_SHEETS = 7;
const who = (top: string, bottom: string, hair: string) => ({ height: 1.72, build: { torso: "block" as const, torsoWidth: 1.05 }, look: { skin: "#ecccae", outfit: "jacket" as const, colors: { top, inner: "#e9e6de", bottom, shoes: "#20171a", accent: "#15161a" }, hair: "swoop" as const, hairColor: hair } });
const A = who("#2c2f38", "#22252c", "#2a211c"), B = who("#7a2230", "#5a1a26", "#3a2820"), C = who("#d0672f", "#3b5a8a", "#8a5a2a");
const F = { eyes: "open" as const, mouth: "flat" as const, brows: "neutral" as const, look: 0 };

export const LibSheet: React.FC = () => {
  const ready = useFonts();
  const n = useCurrentFrame();
  if (!ready) return <AbsoluteFill style={{ background: "#0c0e14" }} />;
  const sheets: { mood: string; sky: boolean; from: V3; to: V3; fov: number; kids: React.ReactNode }[] = [
    { mood: "lamp", sky: false, from: [0, 1.7, 2.6], to: [0, 1.3, -4], fov: 58, kids: <>
      <Room w={7} d={6} wall="#b9b4a6" floor="#5a5a62" floorTex="stone" />
      <Piece kind="pin_board" p={[-1.2, 0, -5.85]} /><Piece kind="wall_map" p={[1.7, 0, -5.85]} /><Piece kind="cabinet" p={[3.0, 0, -5.4]} /><Piece kind="cabinet" p={[2.45, 0, -5.4]} />
      <Piece kind="desk" p={[0.3, 0, -3.4]} /><Piece kind="lamp" p={[0.8, 0.79, -3.4]} /><Piece kind="papers" p={[0, 0.79, -3.35]} label="UNSOLVED" /><Piece kind="box_file" p={[-2.4, 0, -4.6]} label="CASE 164" /><Piece kind="chair" p={[0.2, 0, -4.2]} />
      <Character3D {...A} position={[0.2, 0, -4.15]} yaw={0} t={0} face={F} pose={{ legs: "sit", armL: [30, 60], armR: [30, 60] }} />
      <Character3D {...B} position={[-1.7, 0, -3.3]} yaw={0.6} t={0} face={F} pose={{ armL: [10, 10], armR: [40, 50] }} /></> },
    { mood: "cold", sky: false, from: [0, 1.6, 2.6], to: [0, 1.2, -4], fov: 58, kids: <>
      <Room w={7} d={6} wall="#c9d0c4" floor="#7b6a58" windows={2} />
      <Piece kind="board" p={[0, 0, -5.86]} label="7 STRIKES" /><Piece kind="shelf" p={[-2.9, 0, -5.6]} /><Piece kind="table" p={[1.6, 0, -3.6]} /><Piece kind="radio" p={[1.6, 0.78, -3.6]} /><Piece kind="jars" p={[1.1, 0.78, -3.6]} />
      <Piece kind="armchair" p={[-1.8, 0, -3.8]} yaw={0.5} /><Piece kind="floor_lamp" p={[-2.8, 0, -3.9]} /><Piece kind="bucket" p={[0.4, 0, -2.6]} /><Piece kind="clock" p={[2.6, 0, -5.86]} />
      <Character3D {...A} position={[-1.8, 0, -3.75]} yaw={0.5} t={0} face={F} pose={{ legs: "sit" }} />
      <Character3D {...B} position={[0, 0, -3.0]} yaw={0} t={0} face={F} pose={{ legs: "kneel", armR: [50, 70] }} />
      <Character3D {...C} position={[2.6, 0, -2.9]} yaw={-0.5} t={0} face={F} pose={{ legs: "crouch", armL: [40, 60], armR: [40, 60] }} /></> },
    { mood: "day", sky: true, from: [0.5, 1.8, 4], to: [0, 1.3, -5], fov: 56, kids: <>
      <Ground surface="lawn" backdrop="houses" />
      <Piece kind="house" p={[-3.5, 0, -9]} /><Piece kind="fence" p={[1.5, 0, -6]} w={7} /><Piece kind="mailbox" p={[3.4, 0, -2.2]} /><Piece kind="washing_line" p={[1.6, 0, -4]} /><Piece kind="pole" p={[4.6, 0, -7]} /><Piece kind="basket" p={[0.5, 0, -3]} /><Piece kind="rocking_chair" p={[-2.2, 0, -5.6]} yaw={0.4} />
      <Character3D {...A} position={[-0.6, 0, -3]} yaw={0.4} t={0} face={F} pose={{}} /><Character3D {...B} position={[1.3, 0, -3.6]} yaw={-0.3} t={0} face={F} pose={{ armL: [120, 20], armR: [120, 20] }} /></> },
    { mood: "day", sky: true, from: [0, 1.5, 3.4], to: [0, 1.5, -5], fov: 58, kids: <>
      <Ground surface="mud" backdrop="jungle" clear={2.4} />
      <Piece kind="log" p={[-1.6, 0, -3.4]} yaw={0.4} /><Piece kind="rock" p={[1.9, 0, -3]} w={1.1} /><Piece kind="fern" p={[-2.4, 0, -2.2]} s={1.4} /><Piece kind="fern" p={[2.6, 0, -4.4]} s={1.6} /><Piece kind="palm" p={[3.2, 0, -6]} /><Piece kind="seat_row" p={[-0.4, 0, -5.4]} yaw={0.5} /><Piece kind="suitcase" p={[1, 0, -4.6]} yaw={0.7} />
      <Character3D {...C} position={[0.3, 0, -3.2]} yaw={0.2} t={0} face={F} pose={{ legs: "crouch", armR: [30, 40] }} /></> },
    { mood: "golden", sky: true, from: [0.6, 1.5, 2.6], to: [0, 1.0, -5], fov: 56, kids: <>
      <WaterEdge bank="sand" far="pines" />
      <Piece kind="boat" p={[2.4, -0.1, -6.2]} yaw={0.3} /><Piece kind="campfire" p={[-1.8, 0, -3.2]} /><Piece kind="blanket" p={[1.8, 0, -2.4]} yaw={0.3} /><Piece kind="log" p={[-2.6, 0, -4.6]} yaw={-0.5} /><Piece kind="hut" p={[-5, 0, -4.5]} yaw={0.6} /><Piece kind="rock" p={[0.9, 0, -4.9]} />
      <Character3D {...C} height={1.2} position={[-0.3, 0, -3.3]} yaw={0.4} t={0} face={F} pose={{ legs: "kneel", armR: [50, 80] }} /><Character3D {...A} position={[1.0, 0, -3.7]} yaw={-0.5} t={0} face={F} pose={{ legs: "crouch" }} /></> },
    { mood: "day", sky: true, from: [0.5, 1.8, 5], to: [0, 2.6, -8], fov: 58, kids: <>
      <Ground surface="grass" backdrop="hills" />
      <Piece kind="tower" p={[-4.5, 0, -12]} /><Piece kind="sign_post" p={[2.6, 0, -4]} label="NATIONAL PARK" /><Piece kind="booth" p={[5, 0, -7]} /><Piece kind="rail_fence" p={[-2.5, 0, -4.5]} w={5} /><Piece kind="flagpole" p={[4, 0, -5]} /><Piece kind="picnic_table" p={[-1.5, 0, -7]} yaw={0.3} /><Piece kind="truck" p={[1, 0, -10]} yaw={0.4} /><Piece kind="car" p={[-5.5, 0, -6]} yaw={1.2} c="#7a2230" /><Piece kind="helicopter" p={[2, 7.5, -14]} yaw={0.5} />
      <Character3D {...A} position={[0.4, 0, -2.6]} yaw={0} t={0} face={F} pose={{ armR: [130, 20] }} /></> },
    { mood: "night", sky: true, from: [0, 3.4, 4], to: [0, 4.4, -10], fov: 60, kids: <>
      <SkyStage below="jungle" clouds={7} cloudColor="#5a6072" />
      <Piece kind="lightning" p={[-3, 12, -16]} s={1.3} /><Piece kind="seat_row" p={[0.4, 3.2, -6]} yaw={0.4} />
      <Character3D {...B} position={[0.4, 3.2, -5.95]} yaw={0.4} t={0} face={{ ...F, eyes: "wide", mouth: "o" }} pose={{ legs: "sit", armL: [60, 30], armR: [60, 30] }} /></> },
  ];
  const s = sheets[Math.min(n, sheets.length - 1)];
  const m = moodOf(s.mood);
  const cam = aim(s.from, s.to, s.fov, 0.5);
  return (
    <AbsoluteFill style={{ background: "#0c0e14" }}>
      <View key={n} mood={m} cam={cam} t={0} focus={s.to} blur={0.6} sky={s.sky}>
        {s.kids}
        <CastLight at={s.to} cam={cam.pos} mood={m} />
      </View>
    </AbsoluteFill>
  );
};
