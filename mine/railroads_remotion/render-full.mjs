import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
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
const chunkCount = 4;
const parallelChunks = 2;
const outputDir = path.resolve("out/railroad-chunks");
await mkdir(outputDir, { recursive: true });

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

const totalFrames = composition.durationInFrames;
const chunkSize = Math.ceil(totalFrames / chunkCount);
const chunks = Array.from({ length: chunkCount }, (_, i) => {
  const start = i * chunkSize;
  const end = Math.min(totalFrames - 1, start + chunkSize - 1);
  return { index: i + 1, start, end, file: path.join(outputDir, `part-${String(i + 1).padStart(2, "0")}.mp4`) };
}).filter((c) => c.start <= c.end);

async function renderChunk(chunk) {
  console.log(`CHUNK_${chunk.index}_START frames=${chunk.start}-${chunk.end}`);
  let lastPct = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: chunk.file,
    inputProps,
    frameRange: [chunk.start, chunk.end],
    scale: 1,
    concurrency: 1,
    browserExecutable,
    chromiumOptions,
    crf: 18,
    x264Preset: "veryfast",
    pixelFormat: "yuv420p",
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct >= lastPct + 10 || pct === 100) {
        lastPct = pct;
        console.log(`CHUNK_${chunk.index}_PROGRESS ${pct}%`);
      }
    },
  });
  console.log(`CHUNK_${chunk.index}_COMPLETE ${chunk.file}`);
}

for (let i = 0; i < chunks.length; i += parallelChunks) {
  const batch = chunks.slice(i, i + parallelChunks);
  await Promise.all(batch.map(renderChunk));
}

const concatList = path.join(outputDir, "concat.txt");
await writeFile(concatList, chunks.map((c) => `file '${c.file.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
execFileSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concatList, "-c", "copy", "out/railroad-full-v1.mp4"], { stdio: "inherit" });
console.log("FULL_RENDER_COMPLETE out/railroad-full-v1.mp4");
