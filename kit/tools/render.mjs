// usage: node render.mjs <outdir> <frames: "a-b" or "1,2,3"> [step] [quality]
import { chromium } from 'playwright'; import http from 'http'; import fs from 'fs'; import path from 'path';
const [,, outdir, spec, step = '1', qual = '0.96'] = process.argv;
fs.mkdirSync(outdir, { recursive: true });
let frames = [];
for (const part of spec.split(',')) { if (part.includes('-')) { const [a, b] = part.split('-').map(Number); for (let f = a; f <= b; f += +step) frames.push(f); } else frames.push(+part); }
const root = process.env.WEB || path.resolve('web');
const srv = http.createServer((q, s) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p)) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : 'text/html' }); fs.createReadStream(p).pipe(s); }).listen(0);
await new Promise(r => srv.on('listening', r));
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
pg.on('console', m => console.log('PAGE', m.text())); pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto(`http://localhost:${srv.address().port}/index.html${process.env.HASH||""}`);
await pg.waitForFunction(() => window.ready || window.err, null, { timeout: 180000 });
if (await pg.evaluate(() => window.err)) { console.log('page error'); process.exit(1); }
if (process.env.TESTJSON) {   // asset test mode: node render.mjs <outdir> 0 ; env TESTJSON=<file with [{name,kind,view,light}, ...]>
  const specs = JSON.parse(fs.readFileSync(process.env.TESTJSON, 'utf8')); let i = 0;
  for (const s of specs) {
    const info = await pg.evaluate((sp) => window.setupTest(sp), s); console.log('TESTINFO ' + JSON.stringify(info));
    if (info.ok) { const d = await pg.evaluate(() => { window.renderFrame(0); return document.getElementById('c').toDataURL('image/jpeg', 0.9); }); fs.writeFileSync(path.join(outdir, `t${String(i).padStart(3, '0')}.jpg`), Buffer.from(d.split(',')[1], 'base64')); }
    i++;
  }
  await b.close(); srv.close(); process.exit(0);
}
const t0 = Date.now();
for (const f of frames) {
  if (process.env.RESUME && fs.existsSync(path.join(outdir, `f${String(f).padStart(4, '0')}.jpg`))) continue;
  const d = await pg.evaluate(([f, q]) => { if (window.location.hash==="#nd") window.DEBUG_ND=1; if (window.location.hash==="#e") window.DEBUG_E=1; window.renderFrame(f); return document.getElementById('c').toDataURL('image/jpeg', q); }, [f, +qual]);
  fs.writeFileSync(path.join(outdir, `f${String(f).padStart(4, '0')}.jpg`), Buffer.from(d.split(',')[1], 'base64'));
}
console.log(`done ${frames.length} frames, ${((Date.now() - t0) / frames.length / 1000).toFixed(2)} s/frame`);
await b.close(); srv.close();
