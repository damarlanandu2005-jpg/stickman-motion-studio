// ---- Bomb story cast (rebuilt by Claude: the first run's cast code was not saved) ----
Object.assign(OUTFITS, {
  arthur:    { tunic: "#e0a81e", skin: "#f5c9a0" },
  police:    { tunic: "#1d2c52", skin: "#f1c9a6", cap: "#1d2c52", hair: "#2a1d18" },
  commander: { tunic: "#f4f4f2", skin: "#f1c9a6", cap: "#1d2c52", moustache: "#2a1d18" },
  bombsuit:  { tunic: "#4c8a35", skin: "#f5c9a0", armor: false },
  tech:      { tunic: "#223056", skin: "#f1c9a6", hair: "#3a2a20" },
});
const headGeo = (o = {}) => {
  const { facing = 0, seed = 3, tilt = 0, headTilt = 0, bob = 0 } = o;
  const H = headBlob(seed, 118, facing), HH = 2 * H.b, u = 2 * H.a / 100, cx = 300;
  const torsoBot = 975 - 1.38 * HH - bob * HH, chin = torsoBot - 1.08 * HH, hc = chin - H.b, hipY = torsoBot - 0.12 * HH;
  const [cpx, cpy] = rotAbout([cx, chin], rad(tilt), [cx, hipY]);
  const Ah = tilt + headTilt;
  return { H, HH, u, cx, chin, hc, rot: Ah ? [rad(Ah), cx, chin, cpx - cx, cpy - chin] : null };
};
/** Arthur in the green bomb-disposal suit: green helmet, clear visor, face visible */
export const arthurBombSuit = (p, o = {}) => {
  romanFront(p, "bombsuit", { ...o, nohelmet: true });
  const { H, u, cx, hc, chin, rot } = headGeo(o), light = rad(-120), thick = thickAngle(light), ow = 5 * u;
  const G = "#3f7a2c", Gd = mul(G, [0.55, 0.62, 0.55]);
  p.rot = rot;
  const dome = ellPts(cx, hc - 0.46 * H.b, 1.2 * H.a, 0.72 * H.b, 180, 360, 0, 40);
  p.shadedFill(dome, G, Gd, light, 1.2 * H.a, 0.4); p.inkRing(dome, ow, thick);
  p.stroke(ellPts(cx - 24 * u, hc - 0.8 * H.b, 0.3 * H.a, 0.2 * H.b, 200, 300, 0, 16), 4 * u, "#ffffff77");
  for (const s of [-1, 1]) {            // side guards + chin collar
    const g = rrect(cx + s * 0.9 * H.a - 0.12 * H.a, hc - 0.5 * H.b, cx + s * 0.9 * H.a + 0.12 * H.a, hc + 0.7 * H.b, 6 * u);
    p.shadedFill(g, G, Gd, light, 0.3 * H.a, 0.3); p.inkRing(g, ow * 0.8, thick);
  }
  const col = ellPts(cx, chin - 0.02 * H.b, 0.9 * H.a, 0.2 * H.b, 0, 180, 0, 30);
  p.shadedFill(col, G, Gd, light, 0.9 * H.a, 0.3); p.inkRing(col, ow * 0.8, thick);
  const vis = rrect(cx - 0.9 * H.a, hc - 0.46 * H.b, cx + 0.9 * H.a, hc + 0.72 * H.b, 16 * u);
  p.poly(vis, "#bfe6f633", 0); p.poly(vis, null, ow);
  p.stroke([[cx - 0.7 * H.a, hc - 0.3 * H.b], [cx - 0.5 * H.a, hc - 0.4 * H.b]], 4 * u, "#ffffffaa");
  p.band([[cx - 1.2 * H.a, hc - 0.46 * H.b], [cx + 1.2 * H.a, hc - 0.46 * H.b]], "#e9c13a", 5 * u, 1.6 * u, "round");
  p.rot = null;
};
/** technician: navy uniform, headset with mic */
export const techWithHeadset = (p, o = {}) => {
  romanFront(p, "tech", o);
  const { H, u, cx, hc, rot } = headGeo(o);
  p.rot = rot;
  p.stroke(ellPts(cx, hc - 0.05 * H.b, 1.06 * H.a, 1.02 * H.b, 195, 345, 0, 30), 3.4 * u, "#14141c");
  for (const s of [-1, 1]) p.ell(cx + s * 1.04 * H.a, hc + 0.08 * H.b, 0.16 * H.a, 0.3 * H.b, "#2a2a36", 3 * u);
  p.stroke([[cx + 1.04 * H.a, hc + 0.3 * H.b], [cx + 0.7 * H.a, hc + 0.78 * H.b], [cx + 0.25 * H.a, hc + 0.74 * H.b]], 2.4 * u, "#14141c");
  p.dot(cx + 0.25 * H.a, hc + 0.74 * H.b, 3.4 * u, "#14141c");
  p.rot = null;
};
/** a bright highlight running along a wire: t 0..1 */
export const fxWireTrace = (p, t) => {
  const y = 880 - 700 * t, g = p.g;
  g.save(); g.globalAlpha = 0.9; p.stroke([[300, y + 120], [300, y]], 12, "#ffffff"); g.globalAlpha = 0.35; p.dot(300, y, 40, "#ffffff"); g.restore();
};
