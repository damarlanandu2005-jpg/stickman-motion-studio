// Browser entry used by render_frames.py: __setup(scene, w, h) then __render(frame) for each frame.
import { Engine } from "./engine";
import { Scene, validateScene } from "./scene";

let engine: Engine | null = null;

(window as any).__setup = async (sceneUrl: string, width: number, height: number) => {
  const scene = (await (await fetch(sceneUrl)).json()) as Scene;
  const problems = validateScene(scene);
  if (problems.length) return { ok: false, problems };
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height; canvas.style.display = "block";
  document.body.style.margin = "0"; document.body.appendChild(canvas);
  engine = await Engine.create(scene, canvas, width, height, "./");
  return { ok: true, problems, warnings: engine.warnings, frames: Math.round(scene.duration_s * scene.fps), fps: scene.fps, gl: engine.rendererInfo };
};

(window as any).__render = (frame: number) => { engine!.render(frame); return true; };
