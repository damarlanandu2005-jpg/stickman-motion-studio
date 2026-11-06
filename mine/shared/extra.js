
// ================= extra cast + effects for the three new shorts (our own designs) =================
/** extra head gear drawn on top of the head: slouch (army), straw (farmer), tophat, fire (tall hat) */
const hatx = (p, O, H, hp, cx, hc, u, light, ow, thick, seed, facing) => {
  const k = O.hatx, col = O.hatcol || "#9c8a52", dark = mul(col, [0.68, 0.66, 0.7]), by = hc - H.b * 0.52;
  if (k === "slouch" || k === "straw") {
    const straw = k === "straw", cc = straw ? "#e9c660" : col, dd = mul(cc, [0.7, 0.66, 0.6]);
    const cr = ellPts(cx, by - 4 * u, H.a * (straw ? 0.78 : 0.92), H.b * (straw ? 0.5 : 0.66), 180, 360, 0, 40);
    const br = ellPts(cx, by, H.a * (straw ? 1.75 : 1.38), H.b * (straw ? 0.26 : 0.2), 0, 360, 0, 56);
    p.shadedFill(br, cc, dd, light, H.a, 0.4); p.inkRing(br, ow * 0.85, thick);
    p.shadedFill(cr, cc, dd, light, H.a, 0.4); p.inkRing(cr, ow * 0.85, thick);
    p.band([[cx - H.a * 0.9, by - 2 * u], [cx + H.a * 0.9, by - 2 * u]], straw ? "#b8322f" : "#4a3a22", 6 * u, 1.4 * u);
    if (!straw) p.poly([[cx - H.a * 1.38, by], [cx - H.a * 0.7, by - H.b * 0.7], [cx - H.a * 0.55, by - H.b * 0.04]], mul(col, [0.86, 0.84, 0.86]), ow * 0.8);
    if (straw) for (let i = -4; i <= 4; i++) p.stroke([[cx + i * 12 * u, by + 1 * u], [cx + i * 14 * u, by + 0.2 * H.b]], 1.2 * u, "#b79234");
  } else if (k === "tophat" || k === "fire") {
    hatOn(p, { hat: k === "fire" ? "shako_tall" : "tophat", jacket: O.tunic, pants: O.tunic, buttons: "#e8c45a", belt: null }, hp, H, cx, hc, light, seed, facing, false);
  }
};

Object.assign(FACE, {
  sad: { eye: ["lid", "lid"], brow: [-4, 3], mouth: "frown" }, angry: { eye: ["lid", "lid"], brow: [5, -4], mouth: "teeth" },
  scared: { eye: ["shock", "shock"], brow: [-7, -6], mouth: "wave" }, proud: { eye: ["happy", "happy"], brow: [-1, -2], mouth: "smile" },
  tired: { eye: ["slit", "slit"], brow: [-2, 1], mouth: "dash" }, shout: { eye: ["lid", "lid"], brow: [4, -3], mouth: "O" },
  desperate: { eye: ["small", "small"], brow: [-5, 3], mouth: "wave" },
});
Object.assign(OUTFITS, {
  digger: { tunic: "#b0a066", skin: "#f5c9a0", hatx: "slouch", hatcol: "#9c8a52", moustache: "#5a3b2a", armor: false },
  digger2: { tunic: "#aa9a62", skin: "#ecd0b6", hatx: "slouch", hatcol: "#8f8050" },
  digger3: { tunic: "#b4a46c", skin: "#c99067", hatx: "slouch", hatcol: "#a39058", moustache: "#2a201a" },
  farmer: { tunic: "#e8e0cc", skin: "#f5c9a0", hatx: "straw", apron: "#6d5a3c", moustache: "#7a5a3a" },
  mod: { tunic: "#b0a066", skin: SKIN, hatx: "slouch", hatcol: "#9c8a52" },
  // dancing plague
  troffea: { tunic: "#f3ead6", dress: "#c4302f", skin: "#f5c9a0", cap: "#f4f1ea" },
  peasA: { tunic: "#7a6a52", skin: "#f5c9a0", hair: "#4a3322" },
  peasB: { tunic: "#6f8a5a", skin: "#ecd0b6", cap: "#8a6a3a" },
  peasC: { tunic: "#8a8a8f", skin: "#c99067", hair: "#1e1714", stout: true },
  peasD: { tunic: "#5a7f9a", skin: SKIN, dress: "#a65a6a", cap: "#f1ead8" },
  peasE: { tunic: "#9a6a4a", skin: "#f5c9a0", cap: "#5a4a8a", moustache: "#4a3020" },
  councilman: { tunic: "#6a3c8f", dress: "#6a3c8f", skin: "#f5c9a0", hatx: "tophat", beard: "#d9d6d0", brows: "#d9d6d0", stout: true },
  council2: { tunic: "#3f5a6f", dress: "#3f5a6f", skin: "#ecd0b6", hatx: "tophat", moustache: "#4a3020" },
  musician: { tunic: "#b8322f", skin: "#f5c9a0", cap: "#c0302c", moustache: "#4a3020" },
  musician2: { tunic: "#d9a441", skin: "#ecd0b6", cap: "#b8322f" },
  carpenter: { tunic: "#8a5d3b", skin: "#f5c9a0", cap: "#d8c9a6", apron: "#5a3b2a" },
  // molasses flood
  worker1: { tunic: "#4a4f58", skin: "#f5c9a0", cap: "#6a6a70", moustache: "#4a3020" },
  worker2: { tunic: "#5a4a40", skin: "#ecd0b6", cap: "#3f3f46", moustache: "#2a201a" },
  kid1: { tunic: "#7a5a3a", skin: "#f5c9a0", cap: "#6a6a70", short: true },
  fireman: { tunic: "#2f3e5a", skin: "#f5c9a0", hatx: "fire", moustache: "#4a3020", brows: "#3a2a20" },
  modern: { tunic: "#3f8fbf", skin: "#c99067", hair: "#1e1714" },
  walker: { tunic: "#6a5a4a", skin: "#f5c9a0", cap: "#4a4a50" },
  walkerB: { tunic: "#8c3b4a", skin: "#ecd0b6", dress: "#8c3b4a", cap: "#f1ead8" },
});

/** emu: tall shaggy bird. view "side" (faces right; flip the card to turn) or "front". */
export const emu = (p, o = {}) => {
  const { view = "side", step = 0, neck = 1, look = 0, eye = "calm", blink = 0, bob = 0, run = 0, hat = false, seed = 1 } = o;
  const BR = "#8c705a", BD = "#5d4a3a", NK = "#a8b0b3", LG = "#8a7660", ORANGE = "#f0a020";
  const gy = 975, hipY = gy - 330 - bob * 30, lw = 13;
  const sw = Math.sin(step * Math.PI * 2) * (run ? 90 : 38);
  const leg = (dx, ph, back) => {
    const s = Math.sin((step + ph) * Math.PI * 2) * (run ? 90 : 38), lift = Math.max(0, Math.cos((step + ph) * Math.PI * 2)) * (run ? 80 : 24);
    const hx = 300 + dx, fx = hx + s * 0.7, fy = gy - lift, kx = hx + s * 0.2 + (back ? -36 : 30), ky = hipY + 150;
    p.stroke(curve([hx, hipY + 20], [kx, ky], [fx, fy]), lw + 6, INK); p.stroke(curve([hx, hipY + 20], [kx, ky], [fx, fy]), lw, back ? mul(LG, [0.8, 0.8, 0.8]) : LG);
    for (const d of [-16, 0, 18]) { p.stroke([[fx, fy - 2], [fx + 30 + d * 0.8, fy + d * 0.18 + 3]], 9 + 5, INK); p.stroke([[fx, fy - 2], [fx + 30 + d * 0.8, fy + d * 0.18 + 3]], 9, "#5a4a3a"); }
  };
  if (view === "front") {
    const hy = hipY - 140 - neck * 300, hx = 300 + look * 40;
    for (const s of [-1, 1]) { p.stroke([[300 + s * 40, hipY + 30], [300 + s * 44, gy - 6]], lw + 6, INK); p.stroke([[300 + s * 40, hipY + 30], [300 + s * 44, gy - 6]], lw, LG); p.stroke([[300 + s * 44, gy - 4], [300 + s * 70, gy + 2]], 14, INK); p.stroke([[300 + s * 44, gy - 4], [300 + s * 70, gy + 2]], 9, "#5a4a3a"); }
    p.ell(300, hipY - 40, 140, 150, BR, 12);
    for (let i = 0; i < 26; i++) { const a = i * 2.4, r = 40 + (i * 37) % 90; p.stroke(curve([300 + Math.cos(a) * r * 0.8, hipY - 40 + Math.sin(a) * r], [300 + Math.cos(a) * r * 0.8 + 10, hipY - 40 + Math.sin(a) * r + 14], [300 + Math.cos(a) * r * 0.8 + 6, hipY - 40 + Math.sin(a) * r + 34]), 4, BD); }
    p.stroke([[300, hipY - 150], [hx, hy + 20]], 52, INK); p.stroke([[300, hipY - 150], [hx, hy + 20]], 44, NK);
    p.ell(hx, hy, 46, 38, NK, 11);
    for (const s of [-1, 1]) { p.ell(hx + s * 20, hy - 6, 13, 13, ORANGE, 5); p.dot(hx + s * 20 + look * 3, hy - 6, 5.5, INK); }
    p.poly([[hx - 12, hy + 12], [hx + 12, hy + 12], [hx, hy + 38]], "#d28a2a", 6);
    if (eye === "smug") for (const s of [-1, 1]) p.stroke([[hx + s * 20 - 14, hy - 12], [hx + s * 20 + 14, hy - 10]], 8, NK);
    if (hat) { p.ell(hx, hy - 36, 40, 22, "#6a8a3a", 8); p.poly([[hx - 30, hy - 36], [hx + 30, hy - 36], [hx + 22, hy - 78], [hx - 22, hy - 78]], "#6a8a3a", 8); }
    return;
  }
  // side view, faces right
  leg(-26, 0.5, true);
  const tail = [[160, hipY - 110], [95, hipY - 150], [70, hipY - 60], [120, hipY - 20], [185, hipY - 20]];
  p.poly(tail, BD, 11);
  p.ell(300, hipY - 70, 170, 110, BR, 12);
  p.clip(blobPts(300, hipY - 70, { a: 170, b: 110, nTop: 2, nBot: 2, egg: 0, asym: 0, rot: 0, noise: 0, seed: 1 }), () => {
    for (let i = 0; i < 34; i++) { const x = 160 + (i * 53) % 280, y = hipY - 160 + (i * 37) % 170; p.stroke(curve([x, y], [x + 8, y + 16], [x + 3, y + 36]), 5, i % 3 ? BD : mul(BR, [1.18, 1.14, 1.1])); }
  });
  const nx0 = 420, ny0 = hipY - 110, hx = 470 + look * 25 + (1 - neck) * -6, hy = hipY - 110 - neck * 320 - (1 - neck) * -60;
  const n1 = curve([nx0, ny0], [nx0 + 36 + (1 - neck) * 30, (ny0 + hy) / 2 + 30], [hx - 8, hy + 18]);
  p.stroke(n1, 48, INK); p.stroke(n1, 40, NK);
  for (let i = 1; i < 9; i++) { const q = n1[Math.floor(i / 9 * (n1.length - 1))]; p.stroke([[q[0] - 14, q[1] + 2], [q[0] + 6, q[1] + 8]], 3, "#8a9296"); }
  p.ell(hx, hy, 42, 31, NK, 11);
  p.poly([[hx + 30, hy - 10], [hx + 84, hy + 8], [hx + 74, hy + 18], [hx + 28, hy + 18]], "#d28a2a", 7);
  const ey = hy - 8, ex = hx + 14;
  if (blink > 0.6) p.stroke([[ex - 10, ey], [ex + 10, ey]], 6);
  else {
    const R_ = eye === "alert" ? 16 : 12; p.ell(ex, ey, R_, R_, ORANGE, 5); p.dot(ex + 4 + look * 3, ey, R_ * 0.45, INK);
    if (eye === "smug") { p.poly([[ex - 18, ey - 18], [ex + 18, ey - 18], [ex + 18, ey - 2], [ex - 18, ey - 2]], NK, 0); p.stroke([[ex - 17, ey - 2], [ex + 17, ey - 4]], 6); }
    if (eye === "calm") p.stroke([[ex - 14, ey - 15], [ex + 12, ey - 12]], 5);
  }
  if (hat) { p.ell(hx - 4, hy - 26, 36, 20, "#6a8a3a", 8); p.poly([[hx - 30, hy - 26], [hx + 24, hy - 26], [hx + 18, hy - 66], [hx - 22, hy - 66]], "#6a8a3a", 8); }
  leg(26, 0, false);
};
/** a herd drawn on ONE card (cheap crowd): n emus side by side at small scale */
export const emuHerd = (p, o = {}) => {
  const { n = 6, t = 0, run = 0, face = 1 } = o, g = p.g;
  for (let i = 0; i < n; i++) {
    g.save(); const sc = 0.2 + ((i * 7) % 3) * 0.015, x = 40 + (i % 3) * 190, rowY = 975 - 0.0 - (i < 3 ? 0 : 0) * 0;
    g.translate(x + (i >= 3 ? 90 : 0), (i >= 3 ? -20 : 0)); g.scale(sc, sc);
    g.translate(0, 975 * (1 - 1) / sc * 0);
    g.translate(0, 975 / sc - 975); const pp = new Pen(g);
    emu(pp, { view: "side", step: (t * (run ? 2.2 : 0.9) + i * 0.27) % 1, neck: (i % 2 ? 0.2 : 1) * (o.eat ? (0.35 + 0.35 * Math.sin(t * 6 + i)) : 1), run, seed: i });
    g.restore();
  }
};
export const fxText = (p, txt, size = 150, col = "#ffffff") => {
  const g = p.g; g.save(); g.font = `900 ${size}px Arial Black, Arial`; g.textAlign = "center"; g.lineJoin = "round";
  g.lineWidth = size * 0.14; g.strokeStyle = INK; g.strokeText(txt, 300, 500); g.fillStyle = col; g.fillText(txt, 300, 500); g.restore();
};
export const fxCal = (p, t) => {
  const g = p.g; g.save(); const n = Math.floor(t * 30) + 1, x = 300, y = 450;
  p.poly(rrect(x - 190, y - 230, x + 190, y + 230, 20), "#f7f2e6", 12); p.poly(rrect(x - 190, y - 230, x + 190, y - 130, 20), "#c0302c", 12);
  g.font = "900 220px Arial Black, Arial"; g.textAlign = "center"; g.fillStyle = INK; g.fillText(String(n), x, y + 110);
  g.font = "900 60px Arial Black, Arial"; g.fillStyle = "#fff"; g.fillText("DAY", x, y - 158); g.restore();
};
export const fxConfetti = (p, t) => {
  const cols = ["#e84a3c", "#f2c230", "#3fa1e8", "#58c25a", "#c85ae0"];
  for (let i = 0; i < 40; i++) { const x = 40 + (i * 97) % 520, y = ((t * 900 + i * 61) % 1000), a = i + t * 8; p.poly([[x, y], [x + 22 * Math.cos(a), y + 10], [x + 18, y + 22 * Math.sin(a)], [x - 6, y + 14]], cols[i % 5], 3); }
};
export const fxMuzzle = (p, t) => {
  const k = 1 - t; p.poly([[300, 500], [300 + 150 * k, 470], [300 + 90 * k, 500], [300 + 170 * k, 540], [300, 520]], "#ffd34a", 8); p.poly([[300, 500], [300 + 90 * k, 490], [300 + 50 * k, 510]], "#ffffff", 0);
};
export const fxQuestion = (p, t) => {
  const g = p.g; g.save(); g.font = "900 520px Arial Black, Arial"; g.textAlign = "center"; g.lineJoin = "round"; g.globalAlpha = 0.9 * Math.min(1, t * 3);
  g.lineWidth = 60; g.strokeStyle = INK; g.strokeText("?", 300, 700); g.fillStyle = "#ffe66a"; g.fillText("?", 300, 700); g.restore();
};
export const fxNoteHeart = (p, t) => {
  const g = p.g; g.save(); g.globalAlpha = Math.min(1, (1 - t) * 3);
  for (let i = 0; i < 3; i++) { const y = 800 - t * 380 - i * 60, x = 250 + i * 50 + Math.sin(t * 7 + i) * 24; p.poly([[x, y], [x + 40, y - 40], [x + 80, y], [x, y + 70], [x - 80, y], [x - 40, y - 40]].map(([a, b]) => [a * 0.55 + x * 0.45, b * 0.55 + y * 0.45]), "#ff8aa8", 6); }
  g.restore();
};
export const fxRivet = (p) => { p.ell(300, 500, 30, 30, "#6a6a72", 8); p.stroke([[285, 485], [305, 480]], 6, "#cfcfd6"); };
export const fxCoin = (p) => { p.ell(300, 500, 40, 40, "#f0c040", 8); };
export const fxScore = (p, a, b) => {
  const g = p.g; p.poly(rrect(20, 300, 580, 700, 24), "#2c3a2c", 14);
  g.save(); g.textAlign = "center"; g.font = "900 64px Arial Black, Arial"; g.fillStyle = "#fff"; g.fillText("BIRDS", 150, 420); g.fillText("ARMY", 450, 420);
  g.font = "900 260px Arial Black, Arial"; g.fillStyle = "#ffe66a"; g.fillText(String(a), 150, 650); g.fillText(String(b), 450, 650);
  g.font = "900 120px Arial Black, Arial"; g.fillStyle = "#fff"; g.fillText("-", 300, 600); g.restore();
};
export const fxCalSky = fxCal;

/** a row of n small people on ONE card (cheap crowd). mode: dance | stand | fall | sit. t = time in seconds */
const CROWD_WHO = ["peasA", "peasB", "peasC", "peasD", "peasE", "troffea", "worker1", "worker2", "walker", "walkerB"];
export const crowd = (p, o = {}) => {
  const { n = 5, t = 0, seed = 0, mode = "dance", who = CROWD_WHO, fall = 0, speed = 1 } = o, g = p.g, sc = 0.52;
  for (let i = 0; i < n; i++) {
    const xc = 70 + i * (460 / Math.max(1, n - 1)), k = (i * 7 + seed * 3) % 10, ph = (t * speed * 1.4 + i * 0.37 + seed * 0.21) % 1;
    const up = Math.sin(ph * Math.PI * 2) > 0;
    const pose = mode === "dance" ? { L: up ? "up" : "hang", R: up ? "hang" : "wave", wv: ph * 12, tilt: 7 * Math.sin(ph * Math.PI * 2), headTilt: 6 * Math.cos(ph * Math.PI * 2), step: ph, bob: 0.012 * Math.sin(ph * Math.PI * 4), expr: o.expr || "neutral" }
      : mode === "sit" ? { L: "hang", R: "hang", expr: "tired", headTilt: 16, tilt: 3 } : { L: "hang", R: "hang", expr: o.expr || "tired", tilt: 2 };
    const fallK = mode === "fall" ? Math.min(1, Math.max(0, fall * 1.6 - (i % 5) * 0.12)) : 0;
    g.save(); const tx = xc - 300 * sc, ty = 975 - 975 * sc - (i % 2) * 28;
    g.translate(tx, ty); g.scale(sc, sc);
    if (fallK > 0) { g.translate(300, 975); g.rotate((i % 2 ? 1 : -1) * fallK * 1.45); g.translate(-300, -975); }
    romanFront(new Pen(g), CROWD_WHO[k % CROWD_WHO.length], { seed: 3 + k, facing: (i % 3) - 1, blink: 0, ...pose });
    g.restore();
  }
};
export const fxBlood = (p, t) => { for (let i = 0; i < 4; i++) { const y = 500 + t * 300 + i * 50; p.ell(200 + i * 70, y, 14, 22, "#b3262b", 5); } };

/** horse pulling a small cart, side view, faces right. step 0..1, fear = wide eye + rear */
export const horseCart = (p, o = {}) => {
  const { step = 0, fear = 0 } = o, BR = "#7a4a2a", gy = 975, bx = 400, by = 700 - fear * 30;
  // cart (behind, left)
  p.poly(rrect(20, 640, 250, 760, 10), "#8a6a3a", 9); p.poly(rrect(10, 610, 260, 650, 8), "#6a4a2a", 8);
  p.ell(110, 800, 62, 62, "#3a2a1c", 10); p.ell(110, 800, 18, 18, "#b08a4a", 6); p.stroke([[250, 720], [330, by + 30]], 12, "#5a3a22");
  const leg = (dx, ph) => { const s = Math.sin((step + ph) * 6.283) * 60, lift = Math.max(0, Math.cos((step + ph) * 6.283)) * 40; const hx = bx + dx, fx = hx + s, fy = gy - lift; p.stroke(curve([hx, by + 60], [hx + s * 0.5 + 8, by + 190], [fx, fy]), 30, INK); p.stroke(curve([hx, by + 60], [hx + s * 0.5 + 8, by + 190], [fx, fy]), 22, BR); p.ell(fx + 6, fy, 20, 11, "#2a1c14", 6); };
  leg(-70, 0.5); leg(60, 0.5);
  p.ell(bx, by, 150, 85, BR, 11);
  p.stroke([[bx + 100, by - 30], [bx + 150, by - 120], [bx + 190, by - 150]], 62, INK); p.stroke([[bx + 100, by - 30], [bx + 150, by - 120], [bx + 190, by - 150]], 54, BR);
  p.ell(bx + 215, by - 150, 52, 34, BR, 10, 0, 360, 0.25); p.ell(bx + 250, by - 138, 12, 10, "#2a1c14", 4);
  const ew = fear ? 14 : 9; p.ell(bx + 200, by - 164, ew, ew, "#fff", 5); p.dot(bx + 203, by - 164, ew * 0.5, INK);
  p.poly([[bx + 170, by - 190], [bx + 192, by - 232], [bx + 205, by - 184]], BR, 7);
  p.stroke([[bx + 120, by - 130], [bx + 100, by - 70], [bx + 120, by - 30]], 22, "#2a1c14");
  p.stroke(curve([bx - 150, by - 30], [bx - 195, by + 10 + Math.sin(step * 6.283) * 14], [bx - 175, by + 110]), 20, "#2a1c14");
  leg(-40, 0); leg(90, 0);
};
export const fxJar = (p, t) => {
  const g = p.g; p.poly(rrect(170, 300, 430, 760, 40), "#e8f2f0", 10); p.poly(rrect(190, 520, 410, 750, 30), "#8a4a1a", 0); p.poly(rrect(210, 270, 390, 320, 12), "#c0302c", 9);
  p.poly([[250, 330], [350, 330], [346, 380], [254, 380]], "#fff7", 0);
  const y = 800 + t * 380; p.stroke([[300, 760], [300, y]], 24, INK); p.stroke([[300, 760], [300, y]], 16, "#8a4a1a"); p.ell(300, y + 8, 22, 28, "#8a4a1a", 8);
};
export const fxWaveSplash = (p, t) => { for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI, r = 80 + t * 240; p.ell(300 + Math.cos(a) * r, 700 - Math.sin(a) * r * 1.1, 46 - t * 14, 40, "#7a4220", 9); } };
export const fxHeart = (p, t) => { const g = p.g; g.save(); g.globalAlpha = Math.min(1, (1 - t) * 3); for (let i = 0; i < 4; i++) { const y = 760 - t * 420 - i * 70, x = 220 + i * 55 + Math.sin(t * 7 + i) * 24; p.poly([[x, y + 50], [x - 50, y - 6], [x - 36, y - 38], [x, y - 14], [x + 36, y - 38], [x + 50, y - 6]], "#ff7a9a", 7); } g.restore(); };
