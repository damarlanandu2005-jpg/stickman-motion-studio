// Railroad short composition on the bridge-proven Remotion + React Three Fiber stack.
// One authored 3D world is posed deterministically for every frame; characters remain camera-facing 2D cards.
// Post chain: world ink -> thin-lens blur -> emissive bloom -> neutral tone map -> per-light grade.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, continueRender, delayRender, getInputProps, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { RailWorld as World, loadKit } from "./railworld";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur, GrainEffect } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import type { Kit } from "./build";
import { TOTAL, shotAt } from "./rstory";
import { WORDS } from "./captions";

export const RAIL_FRAMES = TOTAL;
type PostToggles = { ink: boolean; lens: boolean; pre: boolean; bloom: boolean; grade: boolean; grain: boolean };
const toggles = (): PostToggles => ({
  ink: true, lens: true, pre: true, bloom: true, grade: true, grain: false,
  ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}),
});
const makeBloom = () => {
  const b = new BloomEffect({
    blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0,
    luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6,
  });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};
const fwd = new THREE.Vector3();
const fpt = new THREE.Vector3();

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("railway Kenney kit"));
  useEffect(() => {
    loadKit().then((k) => { setKit(k); continueRender(handle); });
  }, [handle]);
  return kit;
};

const Inner: React.FC<{ id: number; frame: number; kit: Kit }> = ({ id, frame, kit }) => {
  const f = frame;
  const { camera, scene } = useThree();
  const postSettings = (getInputProps() as { post?: { shadowMapSize?: number; msaa?: number } }).post;
  const shadowMapSize = postSettings?.shadowMapSize ?? 2048;
  const msaa = postSettings?.msaa ?? 2;
  const world = useMemo(() => new World(kit, shadowMapSize), [kit, shadowMapSize]);
  const on = useMemo(toggles, []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: on.lens ? new LensBlur({ maxCoC: 24, nearScale: 1.2 }) : null,
    bloom: on.bloom ? makeBloom() : null,
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
    grain: new GrainEffect({ amount: 0.025, cellPx: 1.5 }),
  }), [camera, scene, on]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const post = useMemo(() => (
    <EffectComposer multisampling={msaa}>
      {on.ink ? <primitive object={fx.ink} dispose={null} /> : null}
      {on.lens && on.pre && fx.lens ? <primitive object={fx.lens.pre} dispose={null} /> : null}
      {on.lens && fx.lens ? <primitive object={fx.lens.main} dispose={null} /> : null}
      {on.bloom && fx.bloom ? <primitive object={fx.bloom} dispose={null} /> : null}
      <primitive object={fx.tone} dispose={null} />
      {on.grade ? <primitive object={fx.grade} dispose={null} /> : null}
      {on.grain ? <primitive object={fx.grain} dispose={null} /> : null}
    </EffectComposer>
  ), [fx, on]);
  const cam = camera as THREE.PerspectiveCamera;
  const target = world.update(id, f, cam, scene);
  noInkFallback(world.root);
  const shot = shotAt(f);
  cam.getWorldDirection(fwd);
  const focus = shot.dof?.focus ? fpt.set(...shot.dof.focus) : fpt.copy(target);
  if (fx.lens) {
    fx.lens.focus = Math.max(0.3, focus.sub(cam.position).dot(fwd));
    fx.lens.cInf = shot.dof?.cInf ?? 0;
  }
  gradeFor(fx.grade, shot.light);
  fx.grain.seed = f;
  return <><primitive object={world.root} dispose={null} />{post}</>;
};

const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;
const ShotView: React.FC<{ id: number; frame: number; kit: Kit }> = ({ id, frame, kit }) => (
  <AbsoluteFill>
    <ThreeCanvas
      width={1080} height={1920}
      {...(dprOverride() ? { dpr: dprOverride() } : {})}
      shadows
      gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.2, far: 1500 }}
    >
      <Inner id={id} frame={frame} kit={kit} />
    </ThreeCanvas>
  </AbsoluteFill>
);

const CaptionOverlay: React.FC<{ frame: number }> = ({ frame }) => {
  const t = frame / 30;
  const word = WORDS.find((w) => t >= w.s && t < w.e);
  if (!word) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 178, pointerEvents: "none" }}>
      <div style={{
        fontFamily: "Arial, sans-serif", fontSize: 66, lineHeight: 1, fontWeight: 900,
        color: "#ffffff", letterSpacing: 1.2, textTransform: "uppercase",
        WebkitTextStroke: "3px #241726", paintOrder: "stroke fill",
        textShadow: "0 5px 0 #241726, 0 9px 18px rgba(0,0,0,0.55)",
      }}>{word.w}</div>
    </AbsoluteFill>
  );
};

export const RailShort: React.FC = () => {
  const f = useCurrentFrame();
  const kit = useKit();
  if (!kit) return null;
  const post = (getInputProps() as { post?: { frameMap?: number[] } }).post;
  const frame = post?.frameMap?.[f] ?? f;
  const shot = shotAt(frame);
  const includeAudio = (getInputProps() as { includeAudio?: boolean }).includeAudio ?? true;\n  return <AbsoluteFill style={{ background: "#cfe3f2" }}><ShotView id={shot.id} frame={frame} kit={kit} /><CaptionOverlay frame={frame} />{includeAudio ? <><Audio src={staticFile("rail/audio/voice.mp3")} /><Audio src={staticFile("rail/audio/mix_raw.wav")} /></> : null}</AbsoluteFill>;
};
