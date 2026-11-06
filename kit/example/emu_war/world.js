// ---------- world ----------
const DECK = 0;
const world = new THREE.Group(); scene.add(world);
// ASSETS: one builder per PLACE and per NEW object of the script (key = the exact name used in the script).
// A builder returns a THREE.Group in real meters, origin on the ground at the centre, parts added with add(geo, mat, x, y, z, group).
// The tool renders each builder alone (3 views + a person card for scale) and you fix it before the shots are checked. Put every world object under `world` (never directly in scene).
const ASSETS = {
  'signpost': () => { const g = new THREE.Group(); add(new THREE.CylinderGeometry(0.06, 0.07, 2.2, 8), M.wood, 0, 1.1, 0, g); add(tbox(1.2, 0.5, 0.08, 1), M.wood, 0, 2.0, 0, g); return g; },
};
const waterU = { t: { value: 0 }, deep: { value: new THREE.Color('#2f6f8f') }, shal: { value: new THREE.Color('#5fa8bf') }, glint: { value: new THREE.Color('#e9f6ff') } };
const clouds = cloudsInit();
// ground: red outback dirt everywhere, golden wheat behind the fence
const dirtTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#c98a55'; g.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { g.fillStyle = `hsla(${22 + rnd() * 10},${45 + rnd() * 15}%,${40 + rnd() * 18}%,.45)`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 2 + rnd() * 7, 1 + rnd() * 4, rnd() * 3, 0, 7); g.fill(); } }, 90, 90);
const wheatTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#d9ae48'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const x = rnd() * w, y = rnd() * h; g.strokeStyle = `hsla(${38 + rnd() * 10},${70}%,${40 + rnd() * 25}%,.8)`; g.lineWidth = 1 + rnd() * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd() * 6 - 3, y - 10 - rnd() * 14); g.stroke(); } }, 40, 40);
const ground = add(new THREE.PlaneGeometry(1600, 1600), toon({ map: dirtTex }), 0, -0.02, 0, world, { cast: false }); ground.rotation.x = -Math.PI / 2;
const field = add(new THREE.PlaneGeometry(900, 520), toon({ map: wheatTex }), 0, 0.0, -264.2, world, { cast: false }); field.rotation.x = -Math.PI / 2;
const road = add(new THREE.PlaneGeometry(900, 10), toon({ color: '#b8794a' }), 0, 0.01, 1.0, world, { cast: false }); road.rotation.x = -Math.PI / 2;
// wheat clumps (one merged mesh, near the action only)
{ const cone = new THREE.ConeGeometry(0.12, 0.6, 5), r = P.rng(5);
  for (const [n, col, hy] of [[2600, '#e0b64a', 0.3], [1700, '#c99a38', 0.27]]) { const list = [];
    for (let i = 0; i < n; i++) { const x = (r() - 0.5) * 80, z = -4.4 - Math.pow(r(), 1.1) * 40; list.push(placed(cone, x, hy, z, r() * 3, 0.8 + r() * 0.9, 0.8 + r() * 0.8, 0.8 + r() * 0.9)); }
    const cm = add(mergeGeos(list), toon({ color: col }), 0, 0, 0, world, { cast: false }); cm.userData.ndSkip = true; } }
// fence along the road edge
{ const posts = [], wire = [];
  for (let x = -60; x <= 60; x += 3) posts.push(placed(box(0.16, 1.15, 0.16), x, 0.57, -4.2));
  for (const y of [0.45, 0.8, 1.05]) wire.push(placed(box(120, 0.03, 0.03), 0, y, -4.2));
  add(mergeGeos(posts), M.wood, 0, 0, 0, world); add(mergeGeos(wire), M.iron, 0, 0, 0, world, { cast: false }); }
// dead tree
{ const t = new THREE.Group(); t.position.set(-13, 0, -7); world.add(t); const tm = toon({ color: '#5a4636' });
  add(new THREE.CylinderGeometry(0.22, 0.4, 4.2, 7), tm, 0, 2.1, 0, t);
  [[0.9, 3.4, 0.5, 1.0], [-0.8, 3.8, -0.4, -0.9], [0.4, 4.4, -0.7, 0.4], [-0.5, 2.9, 0.7, -1.3]].forEach(([x, y, z, rz]) => { const b = add(new THREE.CylinderGeometry(0.06, 0.14, 2.2, 5), tm, x, y, z, t); b.rotation.z = -rz; b.rotation.x = z * 0.3; }); }
// farmhouse + tin shed far behind the wheat
{ const h = new THREE.Group(); h.position.set(-24, 0, -22); world.add(h);
  add(tbox(8, 3.4, 5.5, 2), M.plaster, 0, 1.7, 0, h); const rf = add(new THREE.CylinderGeometry(0.1, 5.2, 2.2, 4), M.roof, 0, 4.5, 0, h); rf.rotation.y = Math.PI / 4; rf.scale.set(1.15, 1, 0.8);
  add(box(1, 2, 0.1), M.door, -1.5, 1, 2.78, h, { cast: false }); add(box(1.3, 1.0, 0.1), M.window, 1.8, 1.9, 2.78, h, { cast: false }); add(tbox(1.4, 2.4, 1.4, 1), M.iron, 6, 1.2, 1, h);
  const s = new THREE.Group(); s.position.set(26, 0, -30); world.add(s); add(tbox(10, 3, 6, 2), toon({ color: '#9c9a94' }), 0, 1.5, 0, s); add(box(10.4, 0.3, 6.6), toon({ color: '#6a6862' }), 0, 3.1, 0, s); }
// tractor, far
{ const g = new THREE.Group(); g.position.set(30, 0, -46); g.rotation.y = 0.4; world.add(g); const gm = toon({ color: '#2f7a3a' }), bk = toon({ color: '#222226' });
  add(tbox(3, 1.2, 1.6, 1), gm, 0, 1.2, 0, g); add(tbox(1.2, 1.2, 1.4, 1), gm, 0.9, 2.2, 0, g); for (const [x, r, z] of [[-1, 0.95, 0.95], [-1, 0.95, -0.95], [1.2, 0.55, 0.8], [1.2, 0.55, -0.8]]) { const w = add(new THREE.CylinderGeometry(r, r, 0.45, 14), bk, x, r, z, g); w.rotation.x = Math.PI / 2; } }
// far hills + mesa
{ const r = P.rng(3); for (let i = 0; i < 14; i++) { const a = -0.2 - r() * 2.7, d = 330 + r() * 160; const hh = add(new THREE.SphereGeometry(50 + r() * 60, 18, 10), toon({ color: i % 2 ? '#c27a50' : '#b56d49' }), Math.cos(a) * d, -14, Math.sin(a) * d - 40, world, { cast: false }); hh.scale.y = 0.45 + r() * 0.3; }
  add(tbox(90, 38, 40, 4), toon({ color: '#b3643f' }), 120, 12, -380, world, { cast: false }); }
// ---------- truck (faces +x) ----------
const truck = new THREE.Group(); world.add(truck); const wheels = [];
{ const body = toon({ color: '#6b7a4a' }), dark = toon({ color: '#4e5a36' }), tyre = toon({ color: '#1f1f22' });
  add(tbox(4.6, 0.5, 2.1, 2), dark, 0, 0.95, 0, truck); add(tbox(1.6, 1.3, 2.05, 2), body, 1.4, 1.85, 0, truck); add(tbox(0.15, 0.7, 1.7, 2), toon({ color: '#9ec4d8' }), 2.22, 2.05, 0, truck);
  for (const z of [-1.0, 1.0]) add(tbox(2.7, 0.7, 0.12, 2), body, -1.0, 1.55, z, truck); add(tbox(0.12, 0.7, 2.1, 2), body, -2.3, 1.55, 0, truck);
  add(tbox(0.4, 0.6, 2.1, 1), dark, 2.4, 1.0, 0, truck);
  for (const [x, z] of [[1.5, 1.05], [1.5, -1.05], [-1.4, 1.05], [-1.4, -1.05]]) { const w = new THREE.Group(); w.position.set(x, 0.58, z); truck.add(w); const t = add(new THREE.CylinderGeometry(0.62, 0.62, 0.45, 16), tyre, 0, 0, 0, w); t.rotation.x = Math.PI / 2; const hub = add(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8), toon({ color: '#b8b8c0' }), 0, 0, 0, w); hub.rotation.x = Math.PI / 2; add(box(0.1, 0.55, 0.5), tyre, 0, 0, 0, w); wheels.push(w); }
  add(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 6), M.iron, -0.9, 1.7, 0, truck); const gun = add(tbox(1.3, 0.12, 0.12, 1), M.iron, -0.4, 2.2, 0, truck); add(tbox(0.4, 0.28, 0.3, 1), M.iron, -0.95, 2.18, 0, truck); }
// ---------- flag pole (end shots) ----------
const flagG = new THREE.Group(); flagG.position.set(-4, 0, -4); world.add(flagG); add(new THREE.CylinderGeometry(0.06, 0.07, 5.2, 8), M.wood, 0, 2.6, 0, flagG);
const flagCloth = add(new THREE.PlaneGeometry(1.6, 0.9, 6, 4), toon({ color: '#c0302c', side: THREE.DoubleSide }), 0.85, 4.6, 0, flagG); flagCloth.userData.base = flagCloth.geometry.attributes.position.array.slice();
// scoreboard post
const postG = new THREE.Group(); postG.position.set(0, 0, -3.4); world.add(postG); for (const x of [-1.3, 1.3]) add(new THREE.CylinderGeometry(0.09, 0.1, 2.4, 8), M.wood, x, 1.2, 0, postG);
// per-frame world state: story.js worldAt(f) -> S.  MUST also set waterU.t.value (water/animation clock).
function worldState(S, f) {
  const t = S.truck;
  truck.visible = !!(t && t.vis);
  if (t) { truck.position.set(t.x, t.bounce || 0, t.z); truck.rotation.y = t.ry || 0; wheels.forEach((w) => { w.rotation.z = -t.roll; }); }
  flagG.visible = !!S.flag; postG.visible = !!S.score;
  const pa = flagCloth.geometry.attributes.position, base = flagCloth.userData.base;
  for (let i = 0; i < pa.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; pa.setZ(i, Math.sin(f * 0.2 + x * 3 + y * 2) * 0.1 * (x + 0.8)); if (S.flag) pa.setY(i, y - Math.max(0, x) * 0.25); }
  pa.needsUpdate = true; waterU.t.value = f / 30;
}

