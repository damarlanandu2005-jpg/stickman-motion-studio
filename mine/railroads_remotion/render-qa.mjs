import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";

const browserExecutable = process.env.CHROME;
const chromiumOptions = { gl: process.env.REMOTION_GL || "swangle" };
const inputProps = { post: { dpr: 0.5, frameMap: [45,154,258,325,419,505,551,634,758,890,990,1050,1108,1174,1236,1340,1445,1511,1625], shadowMapSize: 512, msaa: 0, lens: false, pre: false, bloom: false } };
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  publicDir: path.resolve("public"),
});
const composition = await selectComposition({
  serveUrl,
  id: process.env.COMP || "RailShotQA",
  inputProps,
  browserExecutable,
  chromiumOptions,
});
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  outputLocation: "out/shot-qa.mp4",
  inputProps,
  scale: 0.5,
  concurrency: 1,
  browserExecutable,
  chromiumOptions,
  crf: 20,
  x264Preset: "veryfast",
  pixelFormat: "yuv420p",
});
console.log("Rendered the 19-shot QA strip in one Remotion browser session.");
