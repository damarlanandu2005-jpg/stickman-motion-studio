// Checks on the motion functions (pure numbers, no browser): smoothness, limits, jump height, blending between actions.
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const dir = mkdtempSync(join(tmpdir(), "motion-"));
const out = join(dir, "motion.mjs");
await build({ entryPoints: ["src/motion.ts"], bundle: true, format: "esm", outfile: out, logLevel: "error", external: ["three", "*/rig"] , plugins: [{ name: "rig-stub", setup(b) { b.onResolve({ filter: /\.\/rig$/ }, () => ({ path: "rig", namespace: "stub" })); b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export {}", loader: "js" })); } }] });
const M = await import(out);

const maxStep = (a, b) => Math.max(...[...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => Math.abs((a[k] ?? 0) - (b[k] ?? 0))));

// 1. gait: limits and smoothness at walking and running speed
for (const speed of [1.0, 3.6]) {
  let prev = null, worst = 0;
  for (let i = 0; i < 300; i++) {
    const phase = (2 * Math.PI * speed * (i / 30)) / M.strideFor(speed), p = M.gait(phase, speed);
    for (const k of ["LHip", "RHip"]) assert.ok(Math.abs(p[k]) < 1.0, `${k} ${p[k]} beyond limit at speed ${speed}`);
    for (const k of ["LKnee", "RKnee"]) assert.ok(p[k] >= 0 && p[k] < 1.9, `${k} ${p[k]} out of range at speed ${speed}`);
    if (prev) worst = Math.max(worst, maxStep(prev, p));
    prev = p;
  }
  assert.ok(worst < 0.4, `gait jumps ${worst} rad in one frame at speed ${speed}`);
}
assert.ok(M.strideFor(3.6) > 1.8 * M.strideFor(1.0) - 0.5, "run stride must be longer than walk stride");

// 2. jump: starts and ends on the ground, peaks at the requested height
const jump = { at_s: 0, do: "jump", dur_s: 1, height_m: 0.9 };
let peak = 0;
for (let t = 0; t <= 1.0001; t += 1 / 60) peak = Math.max(peak, M.actionPose(jump, t, { time: t, speed: 0, phase: 0 }).lift);
assert.ok(Math.abs(peak - 0.9) < 0.03, `jump peak ${peak}`);
assert.equal(M.actionPose(jump, 0, { time: 0, speed: 0, phase: 0 }).lift, 0);
assert.ok(M.actionPose(jump, 1, { time: 1, speed: 0, phase: 0 }).lift < 0.01);

// 3. a change of action never pops: poses just before and after agree within a small step
const acts = [{ at_s: 0, do: "stand" }, { at_s: 1, do: "wave" }, { at_s: 2, do: "fall", dur_s: 1 }, { at_s: 3.2, do: "getup", dur_s: 1.5 }, { at_s: 5, do: "stand" }, { at_s: 6, do: "jump", dur_s: 1, height_m: 1 }, { at_s: 7, do: "float" }];
for (const a of acts.slice(1)) {
  const before = M.poseAtTime(acts, { time: a.at_s - 1 / 120, speed: 0, phase: 0 }), after = M.poseAtTime(acts, { time: a.at_s + 1 / 120, speed: 0, phase: 0 });
  assert.ok(maxStep(before.pose, after.pose) < 0.12, `${a.do}: pose pops by ${maxStep(before.pose, after.pose)} rad at the switch`);
}
// 4. frame-to-frame smoothness through the whole timeline
let prev = null, worst = 0;
for (let i = 0; i < 8 * 60; i++) { const t = i / 60, p = M.poseAtTime(acts, { time: t, speed: 0, phase: 0 }).pose; if (prev) { const d = maxStep(prev, p); if (d > 0.5) console.log("big step at t=" + t.toFixed(3), d.toFixed(2), Object.keys(p).filter((k) => Math.abs((p[k] ?? 0) - (prev[k] ?? 0)) > 0.5)); worst = Math.max(worst, d); } prev = p; }
assert.ok(worst < 0.6, `timeline jumps ${worst} rad between frames`);
console.log("motion checks passed: gait limits, jump height, blends, smoothness (worst frame step", worst.toFixed(3), "rad)");
