import { bundle } from "@remotion/bundler"; import { renderStill, selectComposition } from "@remotion/renderer"; import path from "node:path"; import fs from "node:fs";
const [prefix, frames, scale = "0.5"] = process.argv.slice(2);
const browserExecutable = process.env.CHROME;
const chromiumOptions = { gl: "swiftshader" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: process.env.COMP || "BridgeShort", browserExecutable, chromiumOptions });
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 90, scale: Number(scale), browserExecutable, chromiumOptions, timeoutInMilliseconds: 300000, onBrowserLog: (l) => { if (l.type === "error") console.log("[err]", l.text.slice(0, 200)); } });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
