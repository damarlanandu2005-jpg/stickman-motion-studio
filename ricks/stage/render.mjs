// render.mjs - render a short.json headless to MP4, or check it with stills first.
//
//   node render.mjs short.json out.mp4              full render: video + captions + voice + music
//   node render.mjs short.json out.mp4 --stills     3 stills per shot + sanity checks, no video
//   options: --scale 0.5   render smaller (fast preview)      --from 3 --to 9   only this time range (s)
//            --no-audio    picture only                       --chrome          use the installed Chrome
//
// The stage (stage.js) runs in headless Chromium; this script resolves the
// timeline (say:/w: times, shot lengths, captions), serves the files, pulls the
// frames out and pipes them into ffmpeg together with the audio.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFileSync, spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const die = (msg) => { console.error('error: ' + msg); process.exit(1); };

// ------------------------------------------------------------ arguments
const argv = process.argv.slice(2), pos = [], opt = { scale: null, from: null, to: null, stills: false, audio: true, chrome: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--stills') opt.stills = true; else if (a === '--no-audio') opt.audio = false; else if (a === '--chrome') opt.chrome = true;
  else if (a === '--scale' || a === '--from' || a === '--to') { const v = Number(argv[++i]); if (!Number.isFinite(v)) die(a + ' needs a number'); opt[a.slice(2)] = v; }
  else if (a.startsWith('--')) die('unknown option ' + a); else pos.push(a);
}
if (!pos[0]) { console.log('usage: node render.mjs short.json out.mp4 [--stills] [--scale 0.5] [--from s --to s] [--no-audio] [--chrome]'); process.exit(1); }
const scenePath = path.resolve(pos[0]), outPath = path.resolve(pos[1] || 'out.mp4'), root = path.dirname(scenePath);
if (!fs.existsSync(scenePath)) die('no such file: ' + scenePath);
if (opt.scale !== null && !(opt.scale > 0.1 && opt.scale <= 1)) die('--scale must be between 0.1 and 1');
let spec; try { spec = JSON.parse(fs.readFileSync(scenePath, 'utf8')); } catch (e) { die('short.json is not valid JSON: ' + e.message); }

// ------------------------------------------------------------ validation (the scene file is input: check it before use)
const inProject = (p) => { const f = path.resolve(root, String(p)); return (f === root || f.startsWith(root + path.sep)) ? f : null; };
// ------------------------------------------------------------ motion presets (angles in degrees; positive = clockwise on screen)
const MOTIONS = {
  punch: { len: 0.56, keys: [{ dt: 0, pose: { armR: -95, body: 8 }, ease: 0.08 }, { dt: 0.14, pose: { armR: -20, body: -3 }, ease: 0.12 }, { dt: 0.28, pose: { armL: 95, body: -8 }, ease: 0.08 }, { dt: 0.42, pose: { armL: 20, body: 3 }, ease: 0.12 }] },
  kick: { len: 0.6, keys: [{ dt: 0, pose: { legR: -75, body: -12, armL: 40, armR: -40 }, ease: 0.1 }, { dt: 0.3, pose: { legR: 0, body: 0, armL: 0, armR: 0 }, ease: 0.2 }] },
  run: { len: 0.36, keys: [{ dt: 0, pose: { legL: 42, legR: -42, armL: -50, armR: 50, body: 10 }, ease: 0.16 }, { dt: 0.18, pose: { legL: -42, legR: 42, armL: 50, armR: -50, body: 10 }, ease: 0.16 }] },
  swim: { len: 0.9, start: { pose: { spin: 78 }, ease: 0.4 }, keys: [{ dt: 0, pose: { armL: -160, armR: 20, legL: 22, legR: -22 }, ease: 0.4 }, { dt: 0.45, pose: { armL: 20, armR: -160, legL: -22, legR: 22 }, ease: 0.4 }] },
  wave: { len: 0.5, keys: [{ dt: 0, pose: { armR: -150 }, ease: 0.15 }, { dt: 0.25, pose: { armR: -115 }, ease: 0.15 }] },
  cheer: { len: 0.6, keys: [{ dt: 0, pose: { armL: 150, armR: -150 }, hop: 0.14, ease: 0.12 }, { dt: 0.3, pose: { armL: 120, armR: -120 }, ease: 0.15 }] },
  shrug: { len: 0.8, keys: [{ dt: 0, pose: { armL: 55, armR: -55, head: 8 }, ease: 0.2 }, { dt: 0.5, pose: { armL: 0, armR: 0, head: 0 }, ease: 0.25 }] },
  point: { len: 1.0, keys: [{ dt: 0, pose: { armR: -85, body: 4 }, ease: 0.15 }] },
  fall: { len: 0.8, keys: [{ dt: 0, pose: { spin: 88, armL: 60, armR: -60 }, ease: 0.45 }] },
  dance: { len: 0.8, keys: [{ dt: 0, pose: { armL: 140, armR: -40, legL: 30, legR: -12, body: 9, head: 8 }, hop: 0.12, ease: 0.18 }, { dt: 0.4, pose: { armL: 40, armR: -140, legL: -12, legR: 30, body: -9, head: -8 }, hop: 0.12, ease: 0.18 }] },
  bow: { len: 1.2, keys: [{ dt: 0, pose: { body: 32, head: 14, armL: 20, armR: -20 }, ease: 0.3 }, { dt: 0.8, pose: { body: 0, head: 0, armL: 0, armR: 0 }, ease: 0.3 }] },
  give: { len: 1.2, keys: [{ dt: 0, pose: { armR: -78, body: 5 }, ease: 0.25 }] },
  take: { len: 1.2, keys: [{ dt: 0, pose: { armL: 78, body: -5 }, ease: 0.25 }] },
  nod: { len: 0.6, keys: [{ dt: 0, pose: { head: 12 }, ease: 0.12 }, { dt: 0.3, pose: { head: -4 }, ease: 0.15 }] },
  play: { len: 0.5, keys: [{ dt: 0, pose: { armL: 95, armR: -95, head: 6, body: 3 }, ease: 0.15 }, { dt: 0.25, pose: { armL: 80, armR: -80, head: -6, body: -3 }, ease: 0.15 }] },
  cower: { len: 0.8, keys: [{ dt: 0, pose: { armL: 150, armR: -150, body: -6, head: -8 }, shake: 0.7, ease: 0.15 }] },
};

function validate(s) {
  const errs = [], isNum = (v) => typeof v === 'number' && Number.isFinite(v), isVec = (v, n) => Array.isArray(v) && v.length === n && v.every(isNum);
  const isTime = (v) => isNum(v) || (typeof v === 'string' && /^(w:\d+|say:.+)$/.test(v));
  const file = (p, what) => { if (typeof p !== 'string' || !p) return errs.push(what + ': expected a file path'); const f = inProject(p); if (!f) errs.push(what + ': "' + p + '" is outside the project folder'); else if (!fs.existsSync(f)) errs.push(what + ': file not found: ' + p); };
  if (typeof s !== 'object' || s === null || Array.isArray(s)) return ['short.json must be an object'];
  if (!Array.isArray(s.shots) || !s.shots.length) errs.push('"shots" must be a non-empty list');
  const ids = new Set();
  for (const [i, c] of (Array.isArray(s.characters) ? s.characters : []).entries()) {
    if (!c || typeof c.id !== 'string') { errs.push(`characters[${i}]: needs an "id"`); continue; }
    if (ids.has(c.id)) errs.push(`characters[${i}]: duplicate id "${c.id}"`); ids.add(c.id);
    if (c.pos !== undefined && !isVec(c.pos, 3)) errs.push(`character ${c.id}: "pos" must be [x, y, z]`);
    if (c.puppet !== undefined) file(String(c.puppet).replace(/\/+$/, '') + '/rig.json', `character ${c.id} puppet`);
  }
  const types = new Set(['house', 'box', 'crate', 'barrel', 'wall', 'tree', 'post', 'plane', 'model', 'eiffel', 'desk']);
  for (const [i, p] of (Array.isArray(s.props) ? s.props : []).entries()) {
    if (!p || !types.has(p.type)) { errs.push(`props[${i}]: unknown type "${p && p.type}"`); continue; }
    if (p.pos !== undefined && !isVec(p.pos, 3)) errs.push(`props[${i}]: "pos" must be [x, y, z]`);
    for (const k of ['texture', 'wall', 'roofTexture', 'image', 'file']) if (p[k] !== undefined) file(p[k], `props[${i}].${k}`);
    if (p.type === 'model' && !p.file) errs.push(`props[${i}]: a model needs "file"`);
    if (p.type === 'plane' && !p.image) errs.push(`props[${i}]: a plane needs "image"`);
  }
  for (const [i, sh] of (Array.isArray(s.shots) ? s.shots : []).entries()) {
    if (!sh || typeof sh !== 'object') { errs.push(`shots[${i}]: must be an object`); continue; }
    if (sh.anchor !== undefined ? !isVec(sh.anchor, 3) : !ids.has(sh.target)) errs.push(`shots[${i}]: "target" must be a character id (or give "anchor": [x, y, z])`);
    if (sh.start !== undefined && !isTime(sh.start)) errs.push(`shots[${i}]: bad "start"`);
    if (sh.dur !== undefined && !(isNum(sh.dur) && sh.dur > 0)) errs.push(`shots[${i}]: "dur" must be a positive number`);
    if (sh.out !== undefined && !['glide', 'dissolve', 'cut', 'whip'].includes(sh.out)) errs.push(`shots[${i}]: "out" must be glide, dissolve or cut`);
    for (const [j, a] of (Array.isArray(sh.actions) ? sh.actions : []).entries()) if (!a || !ids.has(a.who)) errs.push(`shots[${i}].actions[${j}]: "who" must be a character id`);
  }
  for (const k of ['words', 'font']) if (s[k] !== undefined && (k !== 'font' || inProject(s[k]) && fs.existsSync(inProject(s[k])))) file(s[k], k);
  if (s.audio) for (const k of ['voice', 'music']) if (s.audio[k] !== undefined) file(s.audio[k], 'audio.' + k);
  if (s.ground && s.ground.texture) file(s.ground.texture, 'ground.texture');
  if (s.backdrop && s.backdrop.image) file(s.backdrop.image, 'backdrop.image');
  for (const [i, k] of (Array.isArray(s.lighting) ? s.lighting : []).entries()) { if (!k || !isTime(k.t)) errs.push(`lighting[${i}]: bad "t"`); if (!k || !s.moods || !s.moods[k.mood]) errs.push(`lighting[${i}]: mood "${k && k.mood}" is not in "moods"`); }
  return errs;
}
const problems = validate(spec);
if (problems.length) { console.error('short.json has problems:'); problems.forEach(p => console.error('  - ' + p)); process.exit(1); }
if (spec.font && !(inProject(spec.font) && fs.existsSync(inProject(spec.font)))) delete spec.font;   // optional: fall back to a system face

// ------------------------------------------------------------ timeline
const probeDuration = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
function resolveTimeline(s) {
  const fps = s.fps || 30;
  const words = s.words ? JSON.parse(fs.readFileSync(inProject(s.words), 'utf8')) : null;
  const tok = (x) => String(x).toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const wn = words ? words.words.map(w => tok(w.w).join('')) : [];
  const timeOf = (v, what) => {
    if (typeof v === 'number') return v;
    if (!words) die(`${what}: "${v}" needs a words.json (set "words" in short.json)`);
    let m = /^w:(\d+)$/.exec(v);
    if (m) { const w = words.words[Number(m[1])]; if (!w) die(`${what}: there is no word ${m[1]}`); return w.t0; }
    m = /^say:(.+?)(?:#(\d+))?$/.exec(v);
    const want = tok(m[1]), nth = Number(m[2] || 1); let seen = 0;
    for (let i = 0; i + want.length <= wn.length; i++) if (want.every((t, j) => wn[i + j] === t) && ++seen === nth) return words.words[i].t0;
    die(`${what}: the phrase "${m[1]}" ${seen ? 'appears only ' + seen + ' time(s)' : 'is not in the script'}`);
  };
  const starts = [];
  s.shots.forEach((sh, k) => { starts.push(sh.start !== undefined ? timeOf(sh.start, `shots[${k}].start`) : (k ? starts[k - 1] + (s.shots[k - 1].dur ?? 1.2) : 0)); });
  starts.forEach((t, k) => { if (k && t <= starts[k - 1] + 0.05) die(`shots[${k}] starts at ${t.toFixed(2)} s, not after shots[${k - 1}] (${starts[k - 1].toFixed(2)} s)`); });
  const last = s.shots.length - 1;
  let end = starts[last] + (s.shots[last].dur ?? 1.5);
  if (s.end === 'audio') end = (words && words.duration) || (s.audio && s.audio.voice ? probeDuration(inProject(s.audio.voice)) : end);
  else if (typeof s.end === 'number') end = s.end;
  if (end <= starts[last] + 0.1) die('the video would end before the last shot starts');
  s._shots = s.shots.map((sh, k) => ({ ...sh, start: starts[k], dur: (k < last ? starts[k + 1] : end) - starts[k] }));
  // motion presets: {"motion": "punch", "repeat": 2} expands into timed pose keys (see MOTIONS)
  const expand = (list) => (list || []).flatMap(a => {
    if (!a.motion) return [a];
    const M = MOTIONS[a.motion]; if (!M) throw new Error('unknown motion "' + a.motion + '" (have: ' + Object.keys(M ? {} : MOTIONS).join(', ') + ')');
    const sp = a.speed || 1, out = [], base = a.at ?? a.t ?? 0, rest = { ...a }; delete rest.motion; delete rest.repeat; delete rest.speed; delete rest.hold;
    if (Object.keys(rest).some(k => !['at', 't', 'who'].includes(k))) out.push(rest);
    if (M.start) out.push({ who: a.who, at: base, t: base, ...M.start });
    for (let r = 0; r < (a.repeat || 1); r++) for (const kf of M.keys) { const tt = base + (r * M.len + kf.dt) / sp, o = { who: a.who, at: tt, t: tt, ...kf, ease: (kf.ease ?? 0.15) / sp }; delete o.dt; out.push(o); }
    if (!a.hold) { const tt = base + (a.repeat || 1) * M.len / sp; out.push({ who: a.who, at: tt, t: tt, pose: { armL: 0, armR: 0, legL: 0, legR: 0, body: 0, head: 0, spin: 0 }, ease: 0.25 }); }
    return out;
  });
  s.shots.forEach(sh => { sh.actions = expand(sh.actions); });
  if (s.actions && s.actions.some(a => a.motion)) throw new Error('use "motion" inside a shot\'s actions, not in the global actions list');
  s._actions = [];
  s.shots.forEach((sh, k) => (sh.actions || []).forEach(a => s._actions.push({ ...a, t: starts[k] + (a.at || 0) })));
  (s.actions || []).forEach((a, i) => s._actions.push({ ...a, t: timeOf(a.t ?? 0, `actions[${i}].t`) }));
  s._lighting = (s.lighting || []).map((k, i) => ({ ...k, t: timeOf(k.t, `lighting[${i}].t`) })).sort((a, b) => a.t - b.t);
  if (s._lighting.length && s._lighting[0].t > 0) s._lighting.unshift({ t: 0, mood: s._lighting[0].mood });
  // captions: 1-2 words, changing on the word
  const cap = s.captions; s._captions = [];
  const clean = (w) => w.replace(/^["'\u201c\u2018(]+/, '').replace(/["'\u201d\u2019).,;:\u2026]+$/, '');
  if (cap !== false && words) {
    const per = (cap && cap.wordsPer) || s.words_per_caption || 1, W = words.words;
    for (let i = 0; i < W.length; i += per) {
      const g = W.slice(i, i + per), nxt = W[i + per], lastEnd = g[g.length - 1].t1;
      s._captions.push({ t0: g[0].t0, t1: nxt ? Math.min(nxt.t0, lastEnd + 0.6) : lastEnd + 0.4, text: g.map(w => clean(w.w)).join(' ') });
    }
  } else if (cap !== false && (typeof cap === 'string' || (cap && cap.text))) {
    const text = typeof cap === 'string' ? cap : cap.text, per = (cap && cap.wordsPer) || s.words_per_caption || 1, every = ((cap && cap.framesPer) || s.frames_per_caption || 10) / fps, ws = text.split(/\s+/).filter(Boolean);
    for (let i = 0, n = 0; i < ws.length; i += per, n++) s._captions.push({ t0: n * every, t1: i + per >= ws.length ? end : (n + 1) * every, text: ws.slice(i, i + per).map(clean).join(' ') });
  }
  s._frames = Math.max(1, Math.round(end * fps)); s._end = end;
  return s;
}
resolveTimeline(spec);
const fps = spec.fps || 30;
spec._scale = opt.scale ?? (opt.stills ? 0.5 : 1);

// ------------------------------------------------------------ local file server (stage files + project files, this machine only)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let rel; try { rel = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  const base = rel.startsWith('/project/') ? root : here, f = path.resolve(base, '.' + (rel.startsWith('/project/') ? rel.slice('/project'.length) : rel));
  if (req.method !== 'GET' || !(f === base || f.startsWith(base + path.sep)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// ------------------------------------------------------------ browser
let pw; try { pw = require('playwright'); } catch { try { pw = require(execFileSync('npm', ['root', '-g']).toString().trim() + '/playwright'); } catch { die('playwright is not installed: run "npm install" in ' + here); } }
const soft = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], hard = ['--ignore-gpu-blocklist', '--enable-gpu'];
const tries = opt.chrome ? [{ channel: 'chrome', args: hard }, { channel: 'chrome', args: soft }]
  : [{ args: soft }, { channel: 'chrome', args: process.platform === 'darwin' ? hard : soft }, { channel: 'chrome', args: soft }, { channel: 'msedge', args: soft }];
// Kaggle / GPU box: RICKS_GL=t4 tries the NVIDIA GPU first (the flags that reached the T4 in kaggle/gpu-webgl-test:
// new headless Chromium + --use-angle=gl-egl). RICKS_REQUIRE_GPU=1 stops the job if it still ends up on a software renderer.
if (process.env.RICKS_GL === 't4') tries.unshift({ channel: 'chromium', args: ['--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu'] });
let browser, lastErr;
for (const t of tries) { try { browser = await pw.chromium.launch(t); break; } catch (e) { lastErr = e; } }
if (!browser) die('could not start a browser. Run "npx playwright install chromium" in ' + here + ' (or install Chrome and pass --chrome).\n' + String(lastErr && lastErr.message).split('\n')[0]);
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
{ // report which GL renderer the browser really uses
  const gl = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl'); if (!c) return 'no webgl'; const e = c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER); });
  console.log('GL_RENDERER ' + gl);
  if (process.env.RICKS_REQUIRE_GPU === '1' && /swiftshader|llvmpipe|software|no webgl/i.test(gl)) { console.error('error: RICKS_REQUIRE_GPU=1 but the renderer is ' + gl); await browser.close(); server.close(); process.exit(3); }
}
const fail = async (msg) => { console.error('error: ' + msg); await browser.close(); server.close(); process.exit(2); };
page.on('pageerror', e => fail('stage: ' + e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
let info; try { info = await page.evaluate(s => window.setup(s), spec); } catch (e) { await fail(String(e.message).split('\n')[0].replace(/^page\.evaluate: /, '')); }
const frames = info.frames;
console.log(`${spec._shots.length} shots, ${(frames / fps).toFixed(2)} s, ${frames} frames at ${Math.round(1080 * spec._scale)}x${Math.round(1920 * spec._scale)}`);

// ------------------------------------------------------------ stills + checks
if (opt.stills) {
  const dir = outPath.replace(/\.mp4$/i, '') + '_stills'; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const cells = [], report = []; let bad = 0;
  for (const [k, sh] of spec._shots.entries()) {
    const edge = Math.min(0.45, sh.dur * 0.2), times = [sh.start + edge, sh.start + sh.dur / 2, sh.start + sh.dur - edge];
    for (const [j, t] of times.entries()) {
      if ((opt.from !== null && t < opt.from) || (opt.to !== null && t > opt.to)) continue;
      const i = Math.min(frames - 1, Math.max(0, Math.round(t * fps))), r = await page.evaluate(n => window.probeFrame(n), i);
      const name = `shot${String(k).padStart(2, '0')}_${'abc'[j]}.jpg`; fs.writeFileSync(path.join(dir, name), Buffer.from(r.image.split(',')[1], 'base64'));
      const flags = r.flags.join(' '); if (flags) bad++;
      console.log(`shot ${String(k).padStart(2, '0')} ${'abc'[j]}  t=${r.t.toFixed(2).padStart(6)}s  luma ${String(r.luma).padStart(5)}  contrast ${String(r.contrast).padStart(4)}  ${flags || 'ok'}${r.inside.length ? '  (inside ' + r.inside.join(' ') + ')' : ''}`);
      cells.push({ image: r.image, label: `shot ${k} ${'abc'[j]}  ${r.t.toFixed(1)}s${flags ? '  ' + flags : ''}`, bad: !!flags });
      const { image, ...rest } = r; report.push({ file: name, ...rest });
    }
  }
  const sheet = await page.evaluate(c => window.makeSheet(c), cells);
  fs.writeFileSync(path.join(dir, 'sheet.jpg'), Buffer.from(sheet.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 1));
  console.log(`${cells.length} stills -> ${path.join(dir, 'sheet.jpg')}`);
  console.log(bad ? `${bad} still(s) flagged: fix them in short.json and run --stills again before the full render` : 'no problems found: safe to run the full render');
  await browser.close(); server.close(); process.exit(0);
}

// ------------------------------------------------------------ full render -> ffmpeg
const f0 = opt.from !== null ? Math.max(0, Math.round(opt.from * fps)) : 0, f1 = opt.to !== null ? Math.min(frames, Math.round(opt.to * fps)) : frames;
if (f1 <= f0) await fail('--from/--to select no frames');
const dur = (f1 - f0) / fps, au = (opt.audio && spec.audio) || {}, ff = ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-'];
const ain = []; for (const k of ['voice', 'music']) if (au[k]) { ff.push('-ss', String(f0 / fps), '-t', String(dur), '-i', inProject(au[k])); ain.push(k); }
const vf = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
if (ain.length) {
  const mdb = Number.isFinite(au.musicDb) ? au.musicDb : -18, fade = `afade=t=out:st=${Math.max(0, dur - 1.5).toFixed(2)}:d=1.5`, mi = ain.indexOf('music') + 1, vi = ain.indexOf('voice') + 1;
  const fc = mi && vi ? `[${mi}:a]volume=${mdb}dB,${fade}[m];[${vi}:a][m]amix=inputs=2:duration=longest:normalize=0[a]` : mi ? `[${mi}:a]volume=${mdb}dB,${fade}[a]` : `[${vi}:a]anull[a]`;
  ff.push('-filter_complex', `[0:v]${vf}[v];${fc}`, '-map', '[v]', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k');
} else ff.push('-vf', vf);
ff.push('-t', String(dur), '-c:v', 'libx264', '-preset', process.env.RICKS_PRESET || 'veryfast', '-crf', process.env.RICKS_CRF || '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outPath);
const enc = spawn('ffmpeg', ff, { stdio: ['pipe', 'inherit', 'inherit'] });
enc.on('error', () => fail('ffmpeg is not on PATH'));
const done = new Promise(r => enc.on('close', r));
const t0 = Date.now();
for (let i = f0; i < f1; i++) {
  const url = await page.evaluate(n => window.renderFrame(n), i);
  if (!enc.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await new Promise(r => enc.stdin.once('drain', r));
  const n = i - f0 + 1;
  if (n % 30 === 0 || i === f1 - 1) { const per = (Date.now() - t0) / n; console.log(`${n}/${f1 - f0} frames, ${per.toFixed(0)} ms/frame, ${((f1 - i - 1) * per / 1000).toFixed(0)} s left`); }
}
enc.stdin.end();
const code = await done;
await browser.close(); server.close();
if (code) die('ffmpeg failed');
console.log(`wrote ${outPath}: ${f1 - f0} frames, ${dur.toFixed(2)} s`);
