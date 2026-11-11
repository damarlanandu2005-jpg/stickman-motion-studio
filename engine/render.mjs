// Generic Remotion render, copied into the project folder by the Kaggle kernel / workflows and run from there.
//   node engine_render.mjs stills "40,150" out/prefix_ [scale]      (one fresh browser per frame)
//   node engine_render.mjs part A B out/part_XX.mp4                  (frames A..B inclusive)
// Env: COMP (composition id, required), GL (default swiftshader), CHROME, CONC (default 1), CRF (default 16)
import { bundle } from "@remotion/bundler"; import { renderStill, renderMedia, selectComposition } from "@remotion/renderer"; import path from "node:path"; import fs from "node:fs";
const [mode, a, b, c] = process.argv.slice(2);
if (!process.env.COMP) throw new Error("set COMP to the composition id");
const chromiumOptions = { gl: process.env.GL || "swiftshader" };
const browserExecutable = process.env.CHROME || undefined;
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: process.env.COMP, chromiumOptions, browserExecutable });
fs.mkdirSync("out", { recursive: true });
if (mode === "stills") {
  for (const f of a.split(",").map(Number)) await renderStill({ composition, serveUrl, frame: f, output: `${b}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 92, scale: Number(c || 0.5), chromiumOptions, browserExecutable });
} else {
  await renderMedia({ composition, serveUrl, codec: "h264", crf: Number(process.env.CRF || 16), frameRange: [Number(a), Number(b)], outputLocation: c, chromiumOptions, browserExecutable, concurrency: Number(process.env.CONC || 1), timeoutInMilliseconds: 600000, onProgress: (p) => { if (p.renderedFrames % 20 === 0) console.log("frames", p.renderedFrames); } });
}
console.log("done");
