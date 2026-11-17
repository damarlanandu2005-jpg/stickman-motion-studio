// builds scripts/bounds.tsx with esbuild and writes scene/bounds.json
const { execSync } = require("child_process"); const fs = require("fs"); const path = require("path");
const out = path.join(__dirname, ".bounds.cjs");
execSync(`npx esbuild ${path.join(__dirname, "bounds.tsx")} --bundle --platform=node --format=cjs --outfile=${out} --log-level=error`, { stdio: "inherit" });
const json = execSync(`node ${out}`, { maxBuffer: 1 << 26 }).toString();
fs.writeFileSync(path.join(__dirname, "../../scene/bounds.json"), json); fs.unlinkSync(out);
const d = JSON.parse(json); console.log("pieces measured:", Object.keys(d.pieces).length, "| head height per m:", d.character.head_y_per_height.toFixed(3), d.character.drop_per_height);
