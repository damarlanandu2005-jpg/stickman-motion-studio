/**
 * Adapter from topic-neutral scene data to the shot/timing concepts used by the
 * upstream Claude Animated Shorts template (story.ts: SHOTS, XFADE, CAMS, DOF).
 *
 * This is an adapter, not a replacement renderer. Rendering stays with the
 * reference Remotion + Three.js + toon/cast + post-processing stack.
 */
import { compileTopic, TopicStory, CompiledTopic, EnvironmentKind } from "./topic-story";

export interface ReferenceShot {
  id: number;
  sceneId: string;
  a: number;
  b: number;
  environment: EnvironmentKind;
  camera: TopicStory["scenes"][number]["camera"];
  subjects: TopicStory["scenes"][number]["subjects"];
  actions: TopicStory["scenes"][number]["actions"];
  light: string;
  atmosphere: string;
  narration: string;
  transition: "cut" | "glide" | "crossfade";
}

export interface ReferenceShotPlan {
  fps: number;
  totalFrames: number;
  shots: ReferenceShot[];
  crossfades: Record<number, number>;
}

/** Environment renderers are modules plugged into the reference world/cast pipeline. */
export type EnvironmentModule = {
  kind: EnvironmentKind;
  createWorld: (description: string) => unknown;
  updateWorld?: (frame: number, durationFrames: number) => void;
};

/**
 * Convert a story into the reference template's frame-based shot plan.
 * The scene/world implementation is deliberately supplied by environment modules;
 * no bridge-specific assumptions or bridge physics are introduced here.
 */
export function toReferenceShotPlan(story: TopicStory): { topic: CompiledTopic; plan: ReferenceShotPlan } {
  const topic = compileTopic(story);
  const shots: ReferenceShot[] = topic.compiledScenes.map((scene, index) => ({
    id: index + 1,
    sceneId: scene.id,
    a: scene.startFrame,
    b: scene.endFrame,
    environment: scene.environment,
    camera: scene.camera,
    subjects: scene.subjects,
    actions: scene.actions,
    light: scene.lighting ?? "neutral cinematic light",
    atmosphere: scene.atmosphere ?? "",
    narration: scene.narration ?? "",
    transition: scene.camera.transition ?? "glide",
  }));
  const crossfades: Record<number, number> = {};
  shots.forEach((shot, index) => {
    if (index > 0 && shot.transition === "crossfade") crossfades[shot.id] = Math.min(12, Math.floor((shot.b - shot.a) / 4));
  });
  return { topic, plan: { fps: topic.fps, totalFrames: topic.totalFrames, shots, crossfades } };
}

/**
 * A story may use any environment kind, but an environment must have a renderer
 * registered before final rendering. Fail clearly rather than silently showing
 * the wrong world.
 */
export function assertEnvironmentModules(
  plan: ReferenceShotPlan,
  modules: Partial<Record<EnvironmentKind, EnvironmentModule>>,
): void {
  const missing = [...new Set(plan.shots.map((shot) => shot.environment))].filter((kind) => !modules[kind]);
  if (missing.length) throw new Error(`Missing environment modules: ${missing.join(", ")}`);
}
