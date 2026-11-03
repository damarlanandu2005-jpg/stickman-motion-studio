// Browser entry used by render_frames.py: __setup(scene, w, h) then __render(frame) for each frame.
import { Engine } from "./engine";
import { Scene, PhysicsTracks, EffectTracks, validateScene } from "./scene";

let engine: Engine | null = null;

(window as any).__setup = async (sceneUrl: string, width: number, height: number) => {
  const scene = (await (await fetch(sceneUrl)).json()) as Scene;
  const problems = validateScene(scene);
  if (problems.length) return { ok: false, problems };
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height; canvas.style.display = "block";
  document.body.style.margin = "0"; document.body.appendChild(canvas);
  engine = await Engine.create(scene, canvas, width, height, "./");
  if (scene.objects.some((o) => o.physics)) {
    const res = await fetch(sceneUrl.replace(/\.json$/, ".physics.json"));
    if (!res.ok) return { ok: false, problems: ["scene has physics objects but no baked physics file: run bake_physics.py"] };
    engine.setPhysics((await res.json()) as PhysicsTracks);
  }
  if (scene.emitters?.length || scene.cloths?.length) {
    const res = await fetch(sceneUrl.replace(/\.json$/, ".effects.json"));
    if (!res.ok) return { ok: false, problems: ["scene has emitters or cloths but no baked effects file: run bake_effects.py"] };
    engine.setEffects((await res.json()) as EffectTracks);
  }
  return { ok: true, problems, warnings: engine.warnings, events: engine.events, frames: Math.round(scene.duration_s * scene.fps), fps: scene.fps, gl: engine.rendererInfo };
};

(window as any).__render = (frame: number) => { engine!.render(frame); return true; };
