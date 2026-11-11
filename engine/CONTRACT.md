# Owner contract (one owner per file)

| owner | files | owns |
|---|---|---|
| cam | `<story>.ts` | scene table, camera keys, cuts, kicks, DOF table, foreground props, STATE (gap/heat/trains), TRANS |
| world | `<world>.ts`, `lights.ts`, `shade.ts`, `grade.ts` | sky, sun, fog, lighting presets, colour grade, placement of props in the world |
| mat | `paint.ts`, `build.ts`, `<props>.ts` | painted textures, buildings, props, set dressing, geometry that must be readable |
| char | `toon.ts`, `cast.ts`, `cardshade.ts`, `<cast>.ts` | characters, poses, expressions, fx cards, who stands where and when |
| post | `ink.ts`, `<Comp>.tsx`, `lensblur.ts` | ink pass, composer, blur, bloom, transitions |

## Rules
- An agent edits only its own files, in its own sandbox: `sandboxes/<owner>/src/videos/<name>/`.
- Contracts between owners are exported constants (`SHOTS/camAt/dofAt/STATE/TRANS/layersAt`, `castAt/trainsAt/fxAt`, `NOINK`, `LIGHTS/LOOK`).
  Changing a contract means telling every owner that reads it, in writing, in the report.
- After every merge: `npx tsc --noEmit`, then re-sync every sandbox from main.
- A fix that needs a file you do not own goes into your report as a request to that owner. Do not edit it.
- Agents report: what changed per item, which stills they looked at, what they could NOT fix, any contract change.
