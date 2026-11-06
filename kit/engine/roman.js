FACE.snore = { eye: ["dash", "dash"], brow: [0, -1], mouth: "o" };
FACE.stubborn = { eye: ["lid", "lid"], brow: [4, -3], mouth: "frown" };
FACE.squint = { eye: ["slit", "slit"], brow: [3, -2], mouth: "dash" };

// ---------------- Roman-era cast (our own designs), built on the Pen / blob / face helpers above ----------------
const STEEL = "#aeb6bf", BRASS = "#d9a845", LEATHER = "#7a4a2a";
export const OUTFITS = {
  legion: { tunic: "#b8322f", cape: "#8f2228", skin: SKIN, helmet: true, armor: true, spear: true, shield: true },
  old: { tunic: "#9c4a3c", cape: "#6e3330", skin: "#f3d6bb", helmet: "old", armor: true, spear: true, shield: false, beard: "#f4f1ea", brows: "#f4f1ea" },
  toga: { tunic: "#f1ead8", skin: "#f5c9a0", toga: "#6b3c8f", hair: "#3b2a20", stout: true },
  civA: { tunic: "#4f7fb8", skin: "#f5c9a0", hair: "#5a3b2a" },
  civB: { tunic: "#d9a441", skin: SKIN, hair: "#2b211c", dress: "#c25a7a" },
  civC: { tunic: "#5d8a3a", skin: "#c99067", hair: "#1e1714", stout: true },
  workA: { tunic: "#8a5d3b", skin: "#f5c9a0", cap: "#c2733a", apron: "#d8c9a6" },
  workB: { tunic: "#3f6a6f", skin: "#ecd0b6", cap: "#5b4a8a", moustache: "#4a3020" },
};

/** galea: iron bowl, brass brow band, cheek guards, transverse red crest */
const galea = (p, H, cx, hc, light, thick, ow, old, u) => {
  const crest = old ? "#8d4b3f" : "#d2372f", bowl = old ? "#8f8a7e" : STEEL;
  // crest (behind the bowl top)
  const cy0 = hc - H.b * 0.98;
  const cr = ellPts(cx, cy0, 0.66 * 2 * H.a, 0.42 * 2 * H.b, 180, 360, 0, 40);
  cr.push([cx + 0.66 * 2 * H.a * 0.98, cy0 + 4 * u], [cx - 0.66 * 2 * H.a * 0.98, cy0 + 4 * u]);
  const crP = [...ellPts(cx, cy0 + 2 * u, 0.62 * 2 * H.a, 0.36 * 2 * H.b, 180, 360, 0, 40)];
  p.shadedFill(crP, crest, mul(crest, [0.7, 0.62, 0.7]), light, 0.62 * 2 * H.a, 0.3);
  p.clip(crP, () => { for (let i = -9; i <= 9; i++) p.stroke([[cx + i * 7.4 * u, cy0], [cx + i * 9.4 * u, cy0 - 0.62 * H.b * Math.cos(i / 11)]], 1.4 * u, mul(crest, [0.62, 0.55, 0.62])); });
  if (old) p.clip(crP, () => { for (let i = 0; i < 6; i++) p.ell(cx + (i - 3) * 22 * u, cy0 - 18 * u - (i % 2) * 10 * u, 9 * u, 5 * u, "#6f6a5e", 0); });
  p.inkRing(crP, ow * 0.85, thick);
  p.poly(rrect(cx - 10 * u, cy0 - 6 * u, cx + 10 * u, cy0 + 6 * u, 3 * u), BRASS, 2 * u);
  // bowl: upper head cap
  const bandY = hc - H.b * 0.42;
  const bp = ellPts(cx, bandY, H.a * 1.05, H.b * 0.66, 180, 360, 0, 48);
  p.shadedFill(bp, bowl, mul(bowl, [0.62, 0.64, 0.72]), light, H.a, 0.4);
  p.clip(bp, () => {
    p.stroke(ellPts(cx - 20 * u, bandY - 0.3 * H.b, 0.25 * H.a, 0.18 * H.b, 200, 300, 0, 16), 4 * u, "#ffffff55");
    if (old) for (let i = 0; i < 9; i++) p.ell(cx + Math.sin(i * 2.3) * 0.8 * H.a, bandY - (0.08 + 0.5 * ((i * 0.37) % 1)) * H.b, (3 + (i % 3) * 2) * u, (2 + (i % 2)) * u, "#8a4b22", 0);
  });
  p.inkRing(bp, ow * 0.9, thick);
  p.band([[cx - H.a * 1.04, bandY], [cx + H.a * 1.04, bandY]], old ? "#a88a4a" : BRASS, 7 * u, 1.8 * u, "round");
  for (const s of [-1, 1]) p.dot(cx + s * 0.55 * H.a, bandY, 2.2 * u, "#fff3c4");
};
const cheeks = (p, H, cx, hc, light, ow, old, u) => {
  const bowl = old ? "#8f8a7e" : STEEL;
  for (const s of [-1, 1]) {
    const x0 = cx + s * 0.78 * H.a, x1 = cx + s * 1.07 * H.a, y0 = hc - H.b * 0.42, y1 = hc + H.b * 0.48;
    const pts = [[x0, y0], [x1, y0], [x1 - s * 0.04 * H.a, y1 - 0.1 * H.b], [x0 + s * 0.06 * H.a, y1], [x0 - s * 0.05 * H.a, (y0 + y1) / 2]];
    p.shadedFill(pts, bowl, mul(bowl, [0.62, 0.64, 0.72]), light, 0.2 * H.a, 0.3);
    p.poly(pts, null, ow * 0.8);
    p.dot((x0 + x1) / 2, (y0 + y1) / 2 - 0.05 * H.b, 2.2 * u, BRASS);
  }
};
const cobweb = (p, cx, cy, r, u) => {
  const g = p.g; g.save(); g.globalAlpha = 0.8;
  for (let i = 0; i < 7; i++) { const a = -Math.PI * (0.05 + 0.9 * i / 6); p.stroke([[cx, cy], [cx + Math.cos(a) * r, cy + Math.sin(a) * r]], 1.1 * u, "#f2f2f2"); }
  for (let k = 1; k <= 4; k++) { const rr = r * k / 4.3, pts = []; for (let i = 0; i < 7; i++) { const a = -Math.PI * (0.05 + 0.9 * i / 6); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } p.stroke(pts, 1 * u, "#f2f2f2"); }
  g.restore();
};

/** front-facing Roman-era character. opts: expr, blink, look, facing, seed, L/R arm poses, tilt, headTilt, bob, nohelmet, light */
export const romanFront = (p, key, opts = {}) => {
  const O = typeof key === "string" ? OUTFITS[key] : key;
  const { expr = "neutral", blink = 0, look = 0, facing = 0, seed = 3, L = "hang", R = O.spear ? "spear" : "hang", tilt = 0, headTilt = 0,
    bob = 0, nohelmet = false, light = rad(-120), web = false, step = 0 } = opts;
  const lid = lidOf(blink), skin = O.skin ?? SKIN;
  const H = headBlob(seed, 118, facing), W = 2 * H.a, HH = 2 * H.b, u = W / 100;
  const torsoL = O.stout ? 1.12 : 1.08, legsL = 1.38, sole = 975;
  const torsoBot = sole - legsL * HH - bob * HH, chin = torsoBot - torsoL * HH, hc = chin - H.b, hipY = torsoBot - 0.12 * HH;
  const thick = thickAngle(light), ow = 5 * u, cx = 300;
  const legCol = mix(O.tunic, INK, 0.62), armCol = mix(O.tunic, INK, 0.5);
  const helmet = !!O.helmet && !nohelmet, old = O.helmet === "old";
  p.rot = null;
  // ---- cape behind everything ----
  if (O.cape) {
    const cp = [[cx - 0.48 * W, chin + 0.08 * HH], [cx + 0.48 * W, chin + 0.08 * HH], [cx + 0.62 * W, sole - 0.55 * HH], [cx + 0.2 * W, sole - 0.45 * HH], [cx - 0.2 * W, sole - 0.5 * HH], [cx - 0.62 * W, sole - 0.55 * HH]];
    p.gradFill(cp, O.cape, mul(O.cape, [0.6, 0.6, 0.7]), light); p.inkRing(cp, ow * 0.8, thick);
  }
  // ---- legs ----
  const dress = !!O.dress;
  for (const side of [-1, 1]) {
    const up = Math.max(0, Math.sin(Math.PI * 2 * (step + (side > 0 ? 0.5 : 0)))) * 30 * (step ? 1 : 0);
    const hx = cx + side * 16 * u, fx = cx + side * 22 * u, fy = sole - 4 * u - up;
    p.stroke(curve([hx, hipY], [(hx + fx) / 2 + side * 2 * u, (hipY + fy) / 2], [fx, fy]), 5.8 * u, legCol);
    const sandal = O.helmet ? LEATHER : "#5a3b2a";
    p.stroke([[fx - side * 3 * u, fy], [fx + side * 13 * u, fy + 0.5 * u]], 7.5 * u + 3, INK);
    p.stroke([[fx - side * 3 * u, fy], [fx + side * 13 * u, fy + 0.5 * u]], 7.5 * u, sandal);
    if (O.helmet) for (let k = 1; k <= 3; k++) p.stroke([[fx - 4 * u, fy - k * 0.07 * HH], [fx + 4 * u, fy - k * 0.07 * HH - 2 * u]], 2 * u, LEATHER);
  }
  // ---- upper body ----
  p.rot = tilt ? [rad(tilt), cx, hipY] : null;
  const T = { a: (0.4 * W) / 1.06 * (O.stout ? 1.12 : 1), b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.6, egg: O.stout ? 0.17 : 0.12, asym: 0.04 * facing, rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = cx + 3 * u * facing, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  const S = (side) => [tcx + side * 0.85 * T.a, chin + 0.12 * HH];
  const arm = (side, pose) => {
    const s = S(side), X = (k) => tcx + side * (T.a * 1.1 + k * u);
    switch (pose) {
      case "spear": return { pts: [s, [X(6), s[1] + 0.42 * HH], [X(10), s[1] + 0.2 * HH]], front: false };
      case "point": return { pts: [s, [X(28), s[1] - 0.02 * HH], [X(62), s[1] - 0.1 * HH]], front: false, finger: true };
      case "up": return { pts: [s, [X(14), s[1] - 0.3 * HH], [X(22), s[1] - 0.75 * HH]], front: false };
      case "wave": return { pts: [s, [X(16), s[1] - 0.2 * HH], [X(30 + 10 * Math.sin(opts.wv || 0)), s[1] - 0.62 * HH]], front: false };
      case "hip": return { pts: [s, [X(22), s[1] + 0.3 * HH], [tcx + side * T.a * 0.95, torsoBot - 0.3 * HH]], front: false };
      case "belly": return { pts: [s, [X(8), s[1] + 0.45 * HH], [tcx + side * 0.25 * T.a, torsoBot - 0.35 * HH]], front: true };
      case "temple": return { pts: [s, [X(26), s[1] + 0.05 * HH], [cx + side * (H.a + 16 * u), hc - 0.1 * HH]], front: false, swirl: true };
      case "lift": return { pts: [s, [X(20), s[1] - 0.25 * HH], [X(4), s[1] - 0.82 * HH]], front: false };
      case "shield": return { pts: [s, [X(4), s[1] + 0.4 * HH], [tcx + side * 0.6 * T.a, torsoBot - 0.1 * HH]], front: true };
      case "cross": return { pts: [s, [X(2), s[1] + 0.38 * HH], [tcx - side * 0.45 * T.a, s[1] + 0.32 * HH]], front: true };
      case "reach": { const lf = (opts.lift || 0) * 0.62 * HH; return { pts: [s, [X(42), s[1] - 0.12 * HH - lf * 0.6], [X(82), s[1] - 0.5 * HH - lf]], front: false }; }
      case "cheek": return { pts: [s, [X(16), s[1] + 0.05 * HH], [cx + side * (H.a + 2 * u), hc + 0.25 * H.b]], front: false };
      case "thumb": return { pts: [s, [X(20), s[1] + 0.12 * HH], [X(44), s[1] - 0.12 * HH]], front: false, thumb: true };
      default: return { pts: [s, [X(4), s[1] + 0.48 * HH], [X(3), chin + 1.04 * HH]], front: false };
    }
  };
  const arms = [arm(-1, L), arm(1, R)];
  const drawArm = (a) => {
    p.stroke(curve(a.pts[0], a.pts[1], a.pts[2]), 5.2 * u, armCol);
    const [hx, hy] = a.pts[2];
    p.dot(hx, hy, 5.5 * u);
    if (a.finger) { const dx = a.pts[2][0] - a.pts[1][0], dy = a.pts[2][1] - a.pts[1][1], l = Math.hypot(dx, dy); p.stroke([[hx, hy], [hx + dx / l * 14 * u, hy + dy / l * 14 * u]], 2.6 * u); }
    if (a.thumb) p.stroke([[hx, hy], [hx + Math.sign(hx - cx) * 6 * u, hy - 12 * u]], 2.6 * u);
  };
  // spear behind
  if (O.spear && R === "spear") {
    const [hx, hy] = arms[1].pts[2], s0 = [hx + 2 * u, sole - 2 * u], s1 = [hx - 3 * u, 70];
    p.band([s0, s1], old ? "#6d5236" : "#8a5a34", 4.2 * u, 1.4 * u, "round");
    const tip = [[s1[0] - 7 * u, s1[1] + 6 * u], [s1[0], s1[1] - 34 * u], [s1[0] + 7 * u, s1[1] + 6 * u], [s1[0], s1[1] + 14 * u]];
    p.poly(tip, old ? "#8b7c6a" : "#c9cfd6", 2 * u);
    if (web) cobweb(p, s1[0] - 2 * u, s1[1] + 60 * u, 70 * u, u);
  }
  for (const a of arms) if (!a.front) drawArm(a);
  // torso
  if (dress) {
    const D = { a: 0.5 * W * 0.98, b: 0.5 * ((sole - 0.35 * HH) - (chin - 0.2 * HH)), nTop: 2.0, nBot: 3.0, egg: 0.35, asym: 0, rot: 0, noise: 0.006, seed: seed + 9 };
    const dp = blobPts(cx, sole - 0.35 * HH - D.b, D);
    p.gradFill(dp, O.dress, mul(O.dress, SH_CLOTH), light); p.inkRing(dp, ow, thick);
  }
  // skirt / pteruges below the torso
  if (!dress) {
    const sk = [[tcx - 0.92 * T.a, torsoBot - 0.2 * HH], [tcx + 0.92 * T.a, torsoBot - 0.2 * HH], [tcx + 1.0 * T.a, torsoBot + 0.3 * HH], [tcx - 1.0 * T.a, torsoBot + 0.3 * HH]];
    p.gradFill(sk, O.tunic, mul(O.tunic, SH_CLOTH), light); p.poly(sk, null, ow * 0.8);
    if (O.armor) for (let i = -3; i <= 3; i++) { const x = tcx + i * 0.27 * T.a, st = [[x - 9 * u, torsoBot - 0.05 * HH], [x + 9 * u, torsoBot - 0.05 * HH], [x + 9 * u, torsoBot + 0.22 * HH], [x - 9 * u, torsoBot + 0.22 * HH]]; p.poly(st, old ? "#5e4632" : LEATHER, 1.6 * u); }
  }
  p.gradFill(tp, O.tunic, mul(O.tunic, SH_CLOTH), light);
  p.clip(tp, () => {
    if (O.armor) {
      const top = chin - 0.1 * HH, bot = torsoBot - 0.25 * HH, n = 5;
      for (let i = 0; i < n; i++) {
        const y0 = top + (bot - top) * i / n, y1 = top + (bot - top) * (i + 1) / n;
        const c = old ? (i % 2 ? "#8d8679" : "#9a9384") : (i % 2 ? "#a7b0ba" : "#bcc4cc");
        p.poly([[tcx - 1.5 * T.a, y0], [tcx + 1.5 * T.a, y0 + 3 * u], [tcx + 1.5 * T.a, y1 + 3 * u], [tcx - 1.5 * T.a, y1]], c, 1.8 * u);
      }
      p.band([[tcx - 1.4 * T.a, torsoBot - 0.2 * HH], [tcx + 1.4 * T.a, torsoBot - 0.2 * HH]], LEATHER, 0.08 * HH, 1.5 * u);
      for (let i = -2; i <= 2; i++) p.dot(tcx + i * 0.3 * T.a, torsoBot - 0.2 * HH, 2.4 * u, BRASS);
      if (old) for (let i = 0; i < 5; i++) p.ell(tcx + Math.sin(i * 1.7) * 0.7 * T.a, top + (bot - top) * ((i * 0.31) % 1), 6 * u, 3 * u, "#8a4b22", 0);
    } else {
      p.band([[tcx - 1.4 * T.a, torsoBot - 0.24 * HH], [tcx + 1.4 * T.a, torsoBot - 0.24 * HH]], O.apron ? "#5a3b2a" : "#e2c27a", 0.05 * HH, 1.2 * u);
      if (O.toga) p.band([[tcx - 1.0 * T.a, chin - 0.1 * HH], [tcx + 1.1 * T.a, torsoBot - 0.1 * HH]], O.toga, 0.16 * HH, 1.6 * u);
      if (O.apron) p.poly([[tcx - 0.55 * T.a, torsoBot - 0.2 * HH], [tcx + 0.55 * T.a, torsoBot - 0.2 * HH], [tcx + 0.6 * T.a, torsoBot + 0.2 * HH], [tcx - 0.6 * T.a, torsoBot + 0.2 * HH]], O.apron, 1.6 * u);
      p.stroke([[tcx - 0.2 * T.a, chin + 0.02 * HH], [tcx, chin + 0.16 * HH], [tcx + 0.2 * T.a, chin + 0.02 * HH]], 2 * u);
    }
  });
  p.inkRing(tp, ow, thick);
  if (O.armor) for (const s of [-1, 1]) { // shoulder plates
    const sp = ellPts(tcx + s * 0.72 * T.a, chin + 0.1 * HH, 0.42 * T.a, 0.13 * HH, 180, 360, s * 8, 20);
    p.poly(sp, old ? "#9a9384" : "#c5ccd3", 1.8 * u);
  }
  if (O.moss) {/* reserved */}
  for (const a of arms) if (a.front) drawArm(a);
  // shield in front, held by the left hand
  if (O.shield && L === "shield") {
    const sx = tcx - 0.55 * T.a, sy = torsoBot + 0.05 * HH, sw = 0.36 * W, sh = 0.78 * HH;
    const sp = rrect(sx - sw, sy - sh, sx + sw, sy + sh, 8 * u);
    p.gradFill(sp, "#c0302c", "#7d1d22", light);
    p.clip(sp, () => {
      p.band([[sx - sw, sy], [sx + sw, sy]], BRASS, 6 * u, 1.2 * u);
      p.band([[sx, sy - sh], [sx, sy + sh]], BRASS, 6 * u, 1.2 * u);
      for (const s of [-1, 1]) { p.stroke([[sx + s * 12 * u, sy - 14 * u], [sx + s * 34 * u, sy - 46 * u], [sx + s * 22 * u, sy - 44 * u], [sx + s * 46 * u, sy - 74 * u]], 3.5 * u, BRASS); p.stroke([[sx + s * 12 * u, sy + 14 * u], [sx + s * 34 * u, sy + 46 * u], [sx + s * 22 * u, sy + 44 * u], [sx + s * 46 * u, sy + 74 * u]], 3.5 * u, BRASS); }
      p.stroke(ellPts(sx - sw * 0.5, sy - sh * 0.7, sw * 0.3, sh * 0.1, 200, 320, 0, 10), 3 * u, "#ffffff44");
    });
    p.ell(sx, sy, 13 * u, 13 * u, "#e6c068", 2.2 * u);
    p.inkRing(sp, ow, thick);
  }
  // ---- head ----
  const [cpx, cpy] = rotAbout([cx, chin], rad(tilt), [cx, hipY]);
  const Ah = tilt + headTilt;
  p.rot = Ah ? [rad(Ah), cx, chin, cpx - cx, cpy - chin] : null;
  if (helmet) galea(p, H, cx, hc, light, thick, ow, old, u);
  const hp = blobPts(cx, hc, H);
  if (O.hair && !helmet) { const hb = blobPts(cx, hc - 0.03 * HH, { ...H, a: H.a * 1.04, b: H.b * 1.05 }); p.poly(hb, O.hair, 0); }
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);
  if (helmet) {
    const bandY = hc - H.b * 0.42, bp = ellPts(cx, bandY, H.a * 1.05, H.b * 0.66, 180, 360, 0, 48);
    p.shadedFill(bp, old ? "#8f8a7e" : STEEL, mul(old ? "#8f8a7e" : STEEL, [0.62, 0.64, 0.72]), light, H.a, 0.4);
    p.clip(bp, () => { p.stroke(ellPts(cx - 20 * u, bandY - 0.3 * H.b, 0.25 * H.a, 0.18 * H.b, 200, 300, 0, 16), 5 * u, "#ffffff66");
      if (old) for (let i = 0; i < 9; i++) p.ell(cx + Math.sin(i * 2.3) * 0.8 * H.a, bandY - (0.08 + 0.5 * ((i * 0.37) % 1)) * H.b, (4 + (i % 3) * 2) * u, (2.5 + (i % 2)) * u, "#8a4b22", 0); });
    p.poly(bp, null, ow * 0.9);
    p.band([[cx - H.a * 1.05, bandY], [cx + H.a * 1.05, bandY]], old ? "#a88a4a" : BRASS, 7 * u, 1.8 * u, "round");
    p.poly(rrect(cx - 4 * u, bandY - 0.55 * H.b, cx + 4 * u, bandY - 3 * u, 2 * u), old ? "#a88a4a" : BRASS, 1.5 * u);
    cheeks(p, H, cx, hc, light, ow, old, u);
  } else if (O.hatx) hatx(p, O, H, hp, cx, hc, u, light, ow, thick, seed, facing);
  else if (O.cap) hatOn(p, { hat: "cap", cap: O.cap, jacket: O.tunic }, hp, H, cx, hc, light, seed, facing, false);
  else if (O.hair) hatOn(p, { hat: "hair", hair: O.hair, jacket: O.tunic }, hp, H, cx, hc, light, seed, facing, false);
  else if (O.helmet && nohelmet) { // bald old head with white side tufts
    for (const s of [-1, 1]) p.ell(cx + s * 0.9 * H.a, hc - 0.1 * H.b, 0.22 * H.a, 0.3 * H.b, "#f4f1ea", 3 * u);
  }
  if (O.beard) {
    const bd = blobPts(cx + 6 * u * facing, hc + 0.85 * H.b, { a: 0.62 * H.a, b: 0.75 * H.b, nTop: 2.4, nBot: 1.6, egg: -0.35, asym: 0, rot: 0, noise: 0.02, seed: seed + 4 });
    p.shadedFill(bd, O.beard, mul(O.beard, [0.86, 0.86, 0.92]), light, 0.6 * H.a, 0.3);
    p.clip(bd, () => { for (let i = -3; i <= 3; i++) p.stroke([[cx + i * 9 * u, hc + 0.45 * H.b], [cx + i * 7 * u, hc + 1.35 * H.b]], 1.2 * u, "#c9c4bb"); });
    p.inkRing(bd, ow * 0.8, thick);
  }
  faceFront(p, cx, hc, W, expr, facing, look, lid, helmet, skin, O.beard ? O.beard : O.moustache, !!O.stout);
  if (O.brows) for (const s of [-1, 1]) p.ell(cx + 7 * u * facing + s * 14 * u, hc - 20 * u, 11 * u, 5 * u, O.brows, 2 * u);
  if (O.beard) { // re-draw the mouth over the beard for open mouths
    if (String(expr).split("+")[0] === "shock" || String(expr).split("+")[0] === "snore") p.ell(cx + 8 * u * facing, hc + 22 * u, 6 * u, 7 * u, "#5a1e28", 2 * u);
  }
  p.rot = null;
  if (arms.some((a) => a.swirl)) { // cuckoo swirl next to the temple
    const a = arms.find((x) => x.swirl), [hx, hy] = a.pts[2], ph = opts.swirl || 0, pts = [];
    for (let i = 0; i < 40; i++) { const t = i / 40 * Math.PI * 4 + ph, r = (4 + i * 0.7) * u; pts.push([hx + Math.cos(t) * r, hy - 40 * u + Math.sin(t) * r]); }
    p.stroke(pts, 3 * u, "#ffffff"); p.stroke(pts, 1.4 * u, INK);
  }
};

/** loose helmet prop card (lifted off the old soldier) */
export const helmetCard = (p) => {
  const H = headBlob(3, 118, 0), u = 2 * H.a / 100, hc = 560, light = rad(-120), thick = thickAngle(light), ow = 5 * u;
  galea(p, H, 300, hc, light, thick, ow, true, u);
  const bandY = hc - H.b * 0.42, bp = ellPts(300, bandY, H.a * 1.05, H.b * 0.66, 180, 360, 0, 48);
  // dark inside visible from below
  p.ell(300, bandY, H.a * 1.05, 0.12 * H.b, "#2a221e", 0);
  p.shadedFill(bp, "#8f8a7e", mul("#8f8a7e", [0.62, 0.64, 0.72]), light, H.a, 0.4);
  p.clip(bp, () => { for (let i = 0; i < 9; i++) p.ell(300 + Math.sin(i * 2.3) * 0.8 * H.a, bandY - (0.08 + 0.5 * ((i * 0.37) % 1)) * H.b, (4 + (i % 3) * 2) * u, (2.5 + (i % 2)) * u, "#8a4b22", 0); });
  p.poly(bp, null, ow * 0.9);
  p.band([[300 - H.a * 1.05, bandY], [300 + H.a * 1.05, bandY]], "#a88a4a", 7 * u, 1.8 * u, "round");
  cheeks(p, H, 300, hc, light, ow, true, u);
};

/** ZZZ for the sleeping guard */
export const fxZ = (p, t) => {
  const g = p.g; g.save(); g.font = "900 120px Arial Black, Arial"; g.lineJoin = "round";
  for (let i = 0; i < 3; i++) {
    const k = (t + i / 3) % 1, x = 220 + i * 70 + Math.sin(k * 6) * 20, y = 700 - k * 500, s = 0.5 + k * 0.7;
    g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = Math.min(1, (1 - k) * 2.5);
    g.lineWidth = 16; g.strokeStyle = INK; g.strokeText("Z", 0, 0); g.fillStyle = "#ffffff"; g.fillText("Z", 0, 0); g.restore();
  }
  g.restore();
};
/** falling leaf */
export const fxLeaf = (p, col) => { p.poly([[300, 380], [420, 470], [300, 620], [180, 470]], col, 14); p.stroke([[300, 400], [300, 600]], 8); };
/** dust cloud puff (k 0..1 growth) */
export const fxDust = (p, k, col = "#e8dcc4") => {
  const g = p.g; g.save(); g.globalAlpha = Math.max(0, 1 - k * k);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, r = 90 + 150 * k; p.ell(300 + Math.cos(a) * r, 520 + Math.sin(a) * r * 0.6, 120 + 60 * k, 100 + 50 * k, col, 12); }
  p.ell(300, 520, 170 + 110 * k, 140 + 80 * k, col, 0);
  g.restore();
};
export const fxDrip = (p) => p.ell(300, 500, 40, 64, "#9fd4ff", 10);
export const fxWood = (p, seed) => { p.poly([[200, 420], [400, 400], [420, 560], [230, 600]], "#5b3d22", 14); p.stroke([[240, 450], [380, 440]], 6, "#3a2614"); p.ell(330, 520, 26, 18, "#4d7a32", 0); };

export const headCenter = (seed = 3) => { const H = headBlob(seed, 118, 0), HH = 2 * H.b; return 975 - 1.38 * HH - 1.08 * HH - H.b; };

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

// aliases so scripts may use these two faces
FACE.determined = { ...(FACE.stubborn || FACE.stern) }; FACE.worried = { ...(FACE.nervous || FACE.neutral) };

// =====================================================================================================================
// KIT ADDITION (backward compatible): FACE EXTRAS and MOVING EFFECTS.
// Face extras: write the expression as "base+extra" or "base+extra+extra", e.g. "shock+sweat", "nervous+sweat2", "sad+tears",
// "angry+vein", "dazed+spiral", "laugh+tears", "smile+blush", "grin+sparkle", "shock+iris", "snore+zzz". Plain names work as before.
// Moving effects (cards, t = 0..1 progress or loop phase; all deterministic, no random per frame): fxBubbles fxSparkle fxRings fxSpeed
// fxDebris fxGlow fxMotes fxSnow fxRain fxSmoke fxSweat fxClock.
// =====================================================================================================================
const _rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const _star = (p, x, y, r, col) => p.poly([[x, y - r], [x + r * 0.28, y - r * 0.28], [x + r, y], [x + r * 0.28, y + r * 0.28], [x, y + r], [x - r * 0.28, y + r * 0.28], [x - r, y], [x - r * 0.28, y - r * 0.28]], col, Math.max(2, r * 0.12));
const _drop = (p, x, y, u, s = 1) => { p.poly([[x - 3.2 * u * s, y - 1 * u * s], [x, y - 10 * u * s], [x + 3.2 * u * s, y - 1 * u * s]], "#9fd4ff", 1.8 * u); p.ell(x, y + 1.5 * u * s, 4.2 * u * s, 4.8 * u * s, "#9fd4ff", 1.8 * u); p.ell(x - 1.2 * u * s, y + 0.5 * u * s, 1.1 * u * s, 1.6 * u * s, "#ffffff", 0); };
const _eyeXs = (cx, cy, W, facing, side) => { const u = W / 100; return side ? [cx + 27 * u] : [cx + 7 * u * facing - 13 * u, cx + 7 * u * facing + 13 * u]; };
Object.assign(FACEX, {
  sweat: (p, cx, cy, W, facing, skin, side) => { const u = W / 100, s = side ? -1 : (facing || 1); _drop(p, cx + 40 * u * s, cy - 24 * u, u, 1.25); },
  sweat2: (p, cx, cy, W, facing, skin, side) => { const u = W / 100, s = side ? -1 : (facing || 1); _drop(p, cx + 40 * u * s, cy - 26 * u, u, 1.2); _drop(p, cx + 47 * u * s, cy - 6 * u, u, 0.8); },
  tears: (p, cx, cy, W, facing, skin, side) => { const u = W / 100; for (const x of _eyeXs(cx, cy, W, facing, side)) { p.ell(x, cy + 12 * u, 3.2 * u, 9 * u, "#9fd4ff", 1.8 * u); p.ell(x + 1.5 * u, cy + 27 * u, 3.4 * u, 5.2 * u, "#9fd4ff", 1.8 * u); } },
  blush: (p, cx, cy, W, facing, skin, side) => { const u = W / 100; for (const x of _eyeXs(cx, cy, W, facing, side)) p.ell(x + (side ? 4 * u : 0), cy + 13 * u, 8.5 * u, 4.6 * u, "#f2a29a", 0); },
  vein: (p, cx, cy, W, facing, skin, side) => { const u = W / 100, s = side ? -1 : (facing || 1), x = cx + 34 * u * s, y = cy - 34 * u; for (const a of [15, 105, 195, 285]) p.arc(x, y, 9 * u, 9 * u, a, a + 60, 3.4 * u, "#d23a3a"); },
  sparkle: (p, cx, cy, W, facing, skin, side) => { const u = W / 100, s = side ? -1 : (facing || 1); _star(p, cx - 34 * u * s, cy - 34 * u, 8 * u, "#ffe27a"); _star(p, cx + 40 * u * s, cy - 18 * u, 5.5 * u, "#fff3b0"); },
  iris: (p, cx, cy, W, facing, skin, side) => { const u = W / 100; for (const x of _eyeXs(cx, cy, W, facing, side)) { p.ell(x, cy, 12 * u, 12.5 * u, "#ffffff", 2.6 * u); p.ell(x, cy + u, 6.6 * u, 6.8 * u, "#4a86c8", 0); p.dot(x, cy + u, 3.2 * u); } },
  spiral: (p, cx, cy, W, facing, skin, side) => { const u = W / 100, s = side ? -1 : (facing || 1), x = cx - 34 * u * s, y = cy - 52 * u, pts = [];
    for (let t = 0; t < 26; t++) pts.push([x + Math.cos(t * 0.7) * t * 0.62 * u, y + Math.sin(t * 0.7) * t * 0.62 * u]);
    p.stroke(pts, 5.2 * u); p.stroke(pts, 2.6 * u, "#f1f1f6"); },
  zzz: (p, cx, cy, W, facing, skin, side) => { const u = W / 100, s = side ? -1 : (facing || 1), g = p.g; g.save(); g.lineJoin = "round"; g.font = `900 ${20 * u}px Arial Black, Arial`;
    [["z", 34, -30, 0.7], ["Z", 44, -46, 1]].forEach(([c, dx, dy, k]) => { g.save(); g.translate(cx + dx * u * s, cy + dy * u); g.scale(k, k); g.lineWidth = 4 * u; g.strokeStyle = INK; g.strokeText(c, 0, 0); g.fillStyle = "#ffffff"; g.fillText(c, 0, 0); g.restore(); }); g.restore(); },
});

/** rising bubbles (loop phase t) */
export const fxBubbles = (p, t, col = "#ffd9a8") => {
  const g = p.g; g.save();
  for (let i = 0; i < 16; i++) {
    const sp = 0.6 + _rnd(i + 1) * 0.8, k = (t * sp + _rnd(i + 40)) % 1, x = 50 + _rnd(i + 80) * 500 + Math.sin(k * 12 + i) * 16, y = 1020 - k * 1080, r = 14 + _rnd(i + 120) * 34;
    g.globalAlpha = 0.55 * Math.min(1, k * 6) * Math.min(1, (1 - k) * 4); p.ell(x, y, r, r, col, 4); g.globalAlpha *= 1.4; p.ell(x - r * 0.35, y - r * 0.35, r * 0.22, r * 0.3, "#ffffff", 0);
  }
  g.restore();
};
/** twinkling 4-point stars (loop phase t) */
export const fxSparkle = (p, t, col = "#fff2a8") => {
  for (let i = 0; i < 10; i++) { const k = Math.max(0, Math.sin((t * (1 + (i % 3) * 0.5) + _rnd(i)) * Math.PI * 2)); const r = (10 + _rnd(i + 20) * 40) * k * k; if (r > 2) _star(p, 60 + _rnd(i + 5) * 480, 80 + _rnd(i + 9) * 800, r, col); }
};
/** expanding shock rings (t 0..1) */
export const fxRings = (p, t, col = "#ffffff") => {
  const g = p.g; g.save();
  for (let i = 0; i < 3; i++) { const k = (t + i / 3) % 1, r = 40 + k * 380; g.globalAlpha = Math.max(0, 1 - k); g.lineWidth = 3 + 18 * (1 - k); g.strokeStyle = col; g.beginPath(); g.ellipse(300, 500, r, r * 0.9, 0, 0, Math.PI * 2); g.stroke(); }
  g.restore();
};
/** radial speed / focus lines (loop phase t) */
export const fxSpeed = (p, t, col = "#ffffff") => {
  const g = p.g; g.save(); g.strokeStyle = col; g.lineCap = "round";
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2 + _rnd(i) * 0.2, k = (t * 3 + _rnd(i + 7)) % 1, r0 = 150 + k * 200, r1 = r0 + 120 + 160 * _rnd(i + 3); g.globalAlpha = 0.9 * (1 - k); g.lineWidth = 4 + 8 * _rnd(i + 11);
    g.beginPath(); g.moveTo(300 + Math.cos(a) * r0, 500 + Math.sin(a) * r0 * 1.1); g.lineTo(300 + Math.cos(a) * r1, 500 + Math.sin(a) * r1 * 1.1); g.stroke(); }
  g.restore();
};
/** flying debris chunks on arcs (t 0..1) */
export const fxDebris = (p, t, col = "#8a6a4a") => {
  const g = p.g; g.save();
  for (let i = 0; i < 14; i++) { const a = -Math.PI * (0.1 + 0.8 * _rnd(i)), v = 380 + 420 * _rnd(i + 30), x = 300 + Math.cos(a) * v * t, y = 560 + Math.sin(a) * v * t + 950 * t * t, s = 12 + 22 * _rnd(i + 60), r = t * (4 + 6 * _rnd(i + 90)) + i;
    g.globalAlpha = Math.min(1, (1 - t) * 3); p.poly([[x + Math.cos(r) * s, y + Math.sin(r) * s], [x + Math.cos(r + 1.9) * s, y + Math.sin(r + 1.9) * s], [x + Math.cos(r + 3.6) * s * 0.8, y + Math.sin(r + 3.6) * s * 0.8]], col, 4); }
  g.restore();
};
/** pulsing soft glow (loop phase t) */
export const fxGlow = (p, t, col = "#ffd36a") => {
  const g = p.g; g.save(); const k = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 2), r = 230 + 50 * k, gr = g.createRadialGradient(300, 500, 10, 300, 500, r);
  gr.addColorStop(0, col); gr.addColorStop(1, "rgba(255,255,255,0)"); g.globalAlpha = 0.45 + 0.35 * k; g.fillStyle = gr; g.beginPath(); g.arc(300, 500, r, 0, Math.PI * 2); g.fill(); g.restore();
};
/** floating dust motes / fireflies (loop phase t) */
export const fxMotes = (p, t, col = "#fff6d8") => {
  const g = p.g; g.save();
  for (let i = 0; i < 26; i++) { const x = 40 + _rnd(i) * 520 + Math.sin(t * 6.28 + i) * 22, y = 40 + _rnd(i + 50) * 900 + Math.cos(t * 6.28 * 2 + i * 1.7) * 16; g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 6.28 + i)); p.dot(x, y, 3 + 4 * _rnd(i + 80), col); }
  g.restore();
};
/** falling snow (loop phase t) */
export const fxSnow = (p, t) => {
  const g = p.g; g.save();
  for (let i = 0; i < 44; i++) { const k = (t * (0.7 + _rnd(i) * 0.6) + _rnd(i + 30)) % 1; g.globalAlpha = 0.9; p.dot(30 + _rnd(i + 60) * 540 + Math.sin(k * 10 + i) * 18, -20 + k * 1040, 4 + 6 * _rnd(i + 90), "#ffffff"); }
  g.restore();
};
/** falling rain streaks (loop phase t) */
export const fxRain = (p, t, col = "#cfe6ff") => {
  const g = p.g; g.save(); g.strokeStyle = col; g.lineCap = "round";
  for (let i = 0; i < 36; i++) { const k = (t * 3 * (0.8 + _rnd(i) * 0.4) + _rnd(i + 30)) % 1, x = 20 + _rnd(i + 60) * 580 + k * -90, y = -60 + k * 1100; g.globalAlpha = 0.75; g.lineWidth = 4 + 3 * _rnd(i + 5); g.beginPath(); g.moveTo(x, y); g.lineTo(x - 22, y + 70); g.stroke(); }
  g.restore();
};
/** rising smoke puffs (loop phase t) */
export const fxSmoke = (p, t, col = "#cfcfd6") => {
  const g = p.g; g.save();
  for (let i = 0; i < 6; i++) { const k = (t + i / 6) % 1; g.globalAlpha = Math.min(1, k * 5) * (1 - k) * 0.95; p.ell(300 + Math.sin(k * 5 + i) * 50, 900 - k * 760, 40 + k * 100, 36 + k * 92, col, 8); }
  g.restore();
};
/** comic sweat drops flying off the head (t 0..1) */
export const fxSweat = (p, t) => {
  const g = p.g; g.save();
  for (let i = 0; i < 4; i++) { const s = i % 2 ? 1 : -1, a = -Math.PI / 2 + s * (0.5 + 0.25 * i), v = 260 + 70 * i, x = 300 + Math.cos(a) * v * t, y = 420 + Math.sin(a) * v * t + 520 * t * t; g.globalAlpha = Math.min(1, (1 - t) * 3); _drop(p, x, y, 3, 2.4); }
  g.restore();
};
/** clock face with moving hands: t 0..1 = `turns` full minute-hand turns (hour hand 1/12 as fast) */
export const fxClock = (p, t, turns = 1) => {
  const g = p.g; g.save(); const cx = 300, cy = 500, R = 270;
  p.ell(cx, cy, R, R, "#f7f2e6", 14);
  g.font = "900 56px Arial Black, Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = INK;
  for (let h = 1; h <= 12; h++) { const a = (h / 12) * Math.PI * 2 - Math.PI / 2; g.fillText(String(h), cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78); }
  const am = t * turns * Math.PI * 2 - Math.PI / 2, ah = (t * turns / 12) * Math.PI * 2 - Math.PI / 3;
  p.stroke([[cx, cy], [cx + Math.cos(ah) * R * 0.5, cy + Math.sin(ah) * R * 0.5]], 18); p.stroke([[cx, cy], [cx + Math.cos(am) * R * 0.74, cy + Math.sin(am) * R * 0.74]], 11);
  p.dot(cx, cy, 16); g.restore();
};
