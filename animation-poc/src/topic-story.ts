/**
 * Topic-neutral story contract for the reference Remotion/Three.js production template.
 * The reference renderer remains the rendering engine; this file describes content only.
 */
export type EnvironmentKind =
  | "space" | "city" | "village" | "forest" | "ocean" | "mountains"
  | "interior" | "historical-site" | "laboratory" | "cave" | "abstract" | "launchpad" | "alien-world";

export type SubjectKind =
  | "person" | "crowd" | "animal" | "vehicle" | "machine" | "building"
  | "planet" | "weather" | "prop" | "scientific-model";

export type ActionKind =
  | "idle" | "walk" | "run" | "fly" | "travel" | "look" | "point"
  | "talk" | "react" | "interact" | "transform" | "impact" | "custom";

export type Vec3 = [number, number, number];

export interface TopicSubject {
  id: string;
  kind: SubjectKind;
  design: string;
  /** Explicit key into the reusable topic asset registry; avoids guessing geometry from prose. */
  assetKey?: string;
  role?: string;
  outfit?: string;
  startPosition?: Vec3;
  scale?: number;
}

export interface TopicAction {
  subjectId: string;
  kind: ActionKind;
  startSeconds: number;
  endSeconds: number;
  detail?: string;
}

export interface TopicCameraKeyframe {
  atSeconds: number;
  position: Vec3;
  lookAt: Vec3;
  fov?: number;
  roll?: number;
  cut?: boolean;
}

export interface TopicCamera {
  position: Vec3;
  lookAt: Vec3;
  fov?: number;
  dof?: { cInf: number; focusAt?: Vec3 };
  keyframes?: TopicCameraKeyframe[];
  transitionFrames?: number;
  move?: "hold" | "push" | "pull" | "pan" | "orbit" | "follow" | "custom";
  intensity?: number;
  transition?: "cut" | "glide" | "crossfade";
  roll?: number;
}

export interface TopicScene {
  id: string;
  title?: string;
  startSeconds: number;
  durationSeconds: number;
  environment: EnvironmentKind;
  environmentDescription: string;
  subjects: TopicSubject[];
  actions: TopicAction[];
  camera: TopicCamera;
  lighting?: string;
  atmosphere?: string;
  narration?: string;
  soundCues?: { atSeconds: number; description: string }[];
}

export interface TopicStory {
  schemaVersion: 1;
  id: string;
  title: string;
  topic: string;
  fps: number;
  width: number;
  height: number;
  style: {
    visualDirection: string;
    characterSystem: "reference-toon" | "custom";
    postProcessing: "reference-stack";
  };
  scenes: TopicScene[];
}

export interface CompiledScene extends TopicScene {
  startFrame: number;
  endFrame: number;
  actionsInFrames: (TopicAction & { startFrame: number; endFrame: number })[];
}

export interface CompiledTopic extends TopicStory {
  totalFrames: number;
  compiledScenes: CompiledScene[];
}

export function compileTopic(story: TopicStory): CompiledTopic {
  if (story.schemaVersion !== 1) throw new Error("Unsupported topic story schemaVersion");
  if (!story.id || !story.title || !story.topic) throw new Error("Story id, title and topic are required");
  if (!Number.isInteger(story.fps) || story.fps < 1) throw new Error("fps must be a positive integer");
  if (!Number.isInteger(story.width) || !Number.isInteger(story.height) || story.width < 1 || story.height < 1) throw new Error("Video dimensions must be positive integers");
  if (!story.scenes.length) throw new Error("A topic must contain at least one scene");

  const ids = new Set<string>();
  let cursor = 0;
  const compiledScenes = story.scenes.map((scene) => {
    if (!scene.id || ids.has(scene.id)) throw new Error(`Missing or duplicate scene id: ${scene.id}`);
    ids.add(scene.id);
    if (!Number.isFinite(scene.startSeconds) || !Number.isFinite(scene.durationSeconds) || scene.durationSeconds <= 0) {
      throw new Error(`Scene ${scene.id} has invalid timing`);
    }
    if (scene.startSeconds < cursor - 1 / story.fps) {
      throw new Error(`Scene ${scene.id} overlaps the preceding scene`);
    }
    const startFrame = Math.round(scene.startSeconds * story.fps);
    const endFrame = startFrame + Math.round(scene.durationSeconds * story.fps);
    const subjectIds = new Set<string>();
    for (const subject of scene.subjects) {
      if (!subject.id || subjectIds.has(subject.id)) throw new Error("Scene " + scene.id + ": subject ids must be non-empty and unique");
      if (!subject.design) throw new Error("Scene " + scene.id + ": subject " + subject.id + " needs a visual design description");
      if (subject.scale !== undefined && (!Number.isFinite(subject.scale) || subject.scale <= 0)) throw new Error("Scene " + scene.id + ": subject " + subject.id + " has an invalid scale");
      if (subject.startPosition && !subject.startPosition.every(Number.isFinite)) throw new Error("Scene " + scene.id + ": subject " + subject.id + " has an invalid position");
      subjectIds.add(subject.id);
    }
    if (![...scene.camera.position, ...scene.camera.lookAt].every(Number.isFinite)) throw new Error("Scene " + scene.id + ": camera vectors must be finite");
    if (scene.camera.fov !== undefined && (!Number.isFinite(scene.camera.fov) || scene.camera.fov < 1 || scene.camera.fov > 179)) throw new Error("Scene " + scene.id + ": camera fov must be between 1 and 179 degrees");
    if (scene.camera.dof && (!Number.isFinite(scene.camera.dof.cInf) || scene.camera.dof.cInf < 0 || scene.camera.dof.cInf > 24)) {
      throw new Error("Scene " + scene.id + ": DOF cInf must be between 0 and 24 pixels");
    }
    if (scene.camera.dof?.focusAt && !scene.camera.dof.focusAt.every(Number.isFinite)) {
      throw new Error("Scene " + scene.id + ": DOF focusAt must be a finite 3D point");
    }
    if (scene.camera.transitionFrames !== undefined && (!Number.isInteger(scene.camera.transitionFrames) || scene.camera.transitionFrames < 0 || scene.camera.transitionFrames > 30)) {
      throw new Error("Scene " + scene.id + ": transitionFrames must be an integer from 0 to 30");
    }
    if (scene.camera.keyframes) {
      let lastKey = -Infinity;
      for (const key of scene.camera.keyframes) {
        if (!Number.isFinite(key.atSeconds) || key.atSeconds < 0 || key.atSeconds > scene.durationSeconds || key.atSeconds <= lastKey) {
          throw new Error(`Scene ${scene.id}: camera keyframes must be strictly increasing and inside the scene`);
        }
        if (![...key.position, ...key.lookAt].every(Number.isFinite)) throw new Error(`Scene ${scene.id}: camera keyframe contains a non-finite vector`);
        lastKey = key.atSeconds;
      }
    }
    for (const action of scene.actions) {
      if (!subjectIds.has(action.subjectId)) throw new Error(`Scene ${scene.id}: action refers to unknown subject ${action.subjectId}`);
      if (!Number.isFinite(action.startSeconds) || !Number.isFinite(action.endSeconds) || action.startSeconds < scene.startSeconds || action.endSeconds > scene.startSeconds + scene.durationSeconds || action.endSeconds <= action.startSeconds) {
        throw new Error(`Scene ${scene.id}: action timing is outside its scene`);
      }
    }
    cursor = scene.startSeconds + scene.durationSeconds;
    return {
      ...scene, startFrame, endFrame,
      actionsInFrames: scene.actions.map((action) => ({
        ...action,
        startFrame: Math.round(action.startSeconds * story.fps),
        endFrame: Math.round(action.endSeconds * story.fps),
      })),
    };
  });
  const totalFrames = Math.max(...compiledScenes.map((scene) => scene.endFrame));
  return { ...story, totalFrames, compiledScenes };
}
