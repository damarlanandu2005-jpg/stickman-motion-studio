import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const [prefix, frames, scale = "0.5"] = process.argv.slice(2);
if (!prefix || !frames) {
  throw new Error("Usage: COMP=RailShort CHROME=<chromium> node still.mjs out/r_ 0,45,90 0.5");
}
const browserExecutable = process.env.CHROME;
const chromiumOptions = { gl: "angle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({
  serveUrl, id: process.env.COMP || "RailShort", browserExecutable, chromiumOptions,
});
for (const frame of frames.split(",").map(Number)) {
  if (frame < 0 || frame >= composition.durationInFrames) throw new Error("Frame out of range: " + frame);
  const started = Date.now();
  await renderStill({
    composition, serveUrl, frame, output: prefix + frame + ".jpg",
    imageFormat: "jpeg", jpegQuality: 92, scale: Number(scale),
    browserExecutable, chromiumOptions, timeoutInMilliseconds: 300000,
    onBrowserLog: (entry) => { if (entry.type === "error") console.log("[browser]", entry.text.slice(0, 240)); },
  });
  console.log("still", frame, ((Date.now() - started) / 1000).toFixed(1) + "s");
}
