import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";

const browserExecutable = process.env.CHROME;
const chromiumOptions = { gl: process.env.REMOTION_GL || "swangle" };
const inputProps = {
  post: {
    dpr: 0.6667,
    shadowMapSize: 1024,
    msaa: 0,
    lens: false,
    pre: false,
    bloom: false,
  },
};
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  publicDir: path.resolve("public"),
});
const composition = await selectComposition({
  serveUrl,
  id: "RailShort",
  inputProps,
  browserExecutable,
  chromiumOptions,
});
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  outputLocation: "out/railroad-full-v1.mp4",
  inputProps,
  scale: 1,
  concurrency: 1,
  browserExecutable,
  chromiumOptions,
  crf: 18,
  x264Preset: "veryfast",
  pixelFormat: "yuv420p",
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 100);
    if (pct % 5 === 0) process.stdout.write(`FULL_RENDER_PROGRESS ${pct}%\\n`);
  },
});
console.log("FULL_RENDER_COMPLETE out/railroad-full-v1.mp4");
