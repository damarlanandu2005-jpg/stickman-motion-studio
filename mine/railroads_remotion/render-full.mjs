import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const index = Number(process.env.CHUNK_INDEX);
const start = Number(process.env.CHUNK_START);
const end = Number(process.env.CHUNK_END);
if (![index, start, end].every(Number.isInteger) || index < 1 || start < 0 || end < start) {
  throw new Error("Set valid CHUNK_INDEX, CHUNK_START and CHUNK_END environment variables");
}

const browserExecutable = process.env.CHROME;
const chromiumOptions = { gl: process.env.REMOTION_GL || "swangle" };
const inputProps = {
  includeAudio: false,
  post: { dpr: 0.6667, shadowMapSize: 1024, msaa: 0, lens: false, pre: false, bloom: false },
};
const outputDir = path.resolve("out");
await mkdir(outputDir, { recursive: true });
const outputLocation = path.join(outputDir, `railroad-part-${String(index).padStart(2, "0")}.mp4`);

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "RailShort", inputProps, browserExecutable, chromiumOptions });
if (end >= composition.durationInFrames) throw new Error(`Chunk end ${end} exceeds composition frame count ${composition.durationInFrames}`);

console.log(`CHUNK_${index}_START frames=${start}-${end} total=${composition.durationInFrames}`);
let lastPct = -1;
await renderMedia({
  composition, serveUrl, codec: "h264", outputLocation, inputProps,
  frameRange: [start, end], scale: 1, concurrency: 1,
  browserExecutable, chromiumOptions, crf: 18, x264Preset: "veryfast", pixelFormat: "yuv420p",
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 100);
    if (pct >= lastPct + 5 || pct === 100) {
      lastPct = pct;
      console.log(`CHUNK_${index}_PROGRESS ${pct}%`);
    }
  },
});
console.log(`CHUNK_${index}_COMPLETE ${outputLocation}`);
