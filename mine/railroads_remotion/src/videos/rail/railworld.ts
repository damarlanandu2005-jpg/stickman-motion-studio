// The railroad world on his stack: Kenney Nature + Train kits (CC0) through his Batch/toLambert/twoTone path,
// his sky/sun/fog/two-tone light rig, his card characters. Original layout: ledge track beside a strata canyon wall.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { V } from "./build";
import { ctex, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, person, blob, railStage, Place, Who as CWho } from "./cast";
import { Outfit } from "./toon";
import { shotById, camAt, FPS, RShot, STATE, JZ } from "./rstory";
import { castAt, trainsAt, coinAt, drawGuy, fxAt, Guy } from "./railcast";

import * as P from "./railprops";
import { Kit } from "./railprops";

const NATURE = ["rock_largeA", "rock_largeB", "rock_smallA", "rock_smallB", "rock_tallA", "rock_tallB", "cactus_tall", "cactus_short", "stone_largeA", "stone_smallA"];
const TRAIN = ["railroad-straight", "train-locomotive-a", "train-carriage-box", "train-carriage-tank", "train-carriage-coal", "train-carriage-lumber", "train-carriage-flatbed-wood"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    const one = (dir: string, n: string) => loader.loadAsync(staticFile(`rail/${dir}/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const);
    kitP = Promise.all([...NATURE.map((n) => one("nature", n)), ...TRAIN.map((n) => one("train", n))])
      .then((l) => { console.error("KITMISS", l.filter((e) => !e[1]).map((e) => e[0]).join(",")); return l; }).then((l) => Object.fromEntries(l.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

const OUTFITS: Record<string, Outfit> = {
  rival: { jacket: "#2c5a4a", pants: "#2a3350", boots: "#1d1a1a", hat: "tophat", skin: "#8c5a35", moustache: "#111111" },
  eng: { jacket: "#2a9a8a", pants: "#3b3f52", boots: "#2b211c", hat: "cap", cap: "#35476b", skin: "#f6efe4", belt: null, buttons: "#e8c45a" },
  boss: { jacket: "#c9a02a", pants: "#4a3a2a", boots: "#2b211c", hat: "tophat", skin: "#f6efe4", moustache: "#3a2a20", buttons: "#fff2b0" },
  cond: { jacket: "#2d4670", pants: "#2a3350", boots: "#1d1a1a", hat: "shako", skin: "#f6efe4", buttons: "#e8c45a" },
  tourist: { jacket: "#b5653f", pants: "#3b3f52", boots: "#4a3426", hat: "bonnet", dress: "#c25a7a", skin: "#f6efe4" },
};
const mix = (a: LightPreset, o: Partial<LightPreset>): LightPreset => ({ ...a, ...o });
const PRES: Record<"day" | "golden" | "indoor", LightPreset> = {
  day: mix(LIGHTS.day, { az: 70, el: 42, lit: [1.62, 1.42, 1.15], shade: [0.44, 0.42, 0.62], lift: [0.05, 0.05, 0.11], fog: "#b8cce8", fogNear: 70, fogFar: 650, sunCol: "#ffe2c0", sunI: 2.8 }),
  golden: mix(LIGHTS.golden, { shade: [0.3, 0.28, 0.6], lift: [0.05, 0.05, 0.13], fog: "#dca08e", fogNear: 50, fogFar: 450 }),
  indoor: mix(LIGHTS.day, { az: 60, el: 50, lit: [1.5, 1.3, 1.05], shade: [0.62, 0.46, 0.42], lift: [0.08, 0.05, 0.06], fog: "#3a2418", fogNear: 200, fogFar: 900, sunCol: "#ffe0b0", sunI: 2.2 }),
};
const SMOKE = { day: "#d2cacc", golden: "#8a6a68", indoor: "#d2cacc" };
export class RailWorld {
  root = new THREE.Group();
  private pool = new Pool(); private actors: Actor[] = []; private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private skyMat: THREE.ShaderMaterial; private sky: THREE.Mesh;
  private fog = new THREE.Fog("#e6c4a8", 35, 330);
  private clouds: THREE.Mesh[] = []; private cloudMaps: Record<string, THREE.Texture[]>;
  private out = new THREE.Group(); private office!: THREE.Group;
  private trk!: { R: P.Track; L: P.Track }; private trainR!: THREE.Group; private trainL!: THREE.Group;
  private smoke: THREE.Mesh[][] = [[], []]; private smokeTex: THREE.Texture; private glow: THREE.Mesh;
  private M!: P.Mats; private disc!: THREE.Mesh; private saw = P.handsaw(); private coin = P.coin(); private sheet = P.paper(); private news = P.newspaper();
  private frustum = new THREE.Frustum(); private m4 = new THREE.Matrix4(); private v = new THREE.Vector3();
  private sunCache = new Map<number, THREE.Vector3>();

  constructor(kit: Kit) {
    const R = this.root;
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el)); gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK); R.add(this.sky);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6); this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    ([[-80, 95, -380, 220], [120, 130, -450, 260], [-260, 110, -330, 200], [20, 170, -560, 300], [300, 120, -300, 220], [-420, 140, -90, 240], [440, 150, -120, 260]] as number[][]).forEach(([x, y, z, w], i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], transparent: true, depthWrite: false, fog: false }));
      m.position.set(x, y, z); m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    });
    const gl = ctex("sunGlow", 256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 2, 128, 128, 126); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.12, "rgba(255,255,255,0.9)"); gr.addColorStop(0.3, "rgba(255,255,255,0.28)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: gl, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.glow.layers.set(NOINK); R.add(this.glow);
    this.smokeTex = ctex("smokeR2", 128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 6, 64, 64, 60); gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(0.45, "rgba(255,255,255,0.3)"); gr.addColorStop(0.8, "rgba(255,255,255,0.06)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
    R.add(this.out);
    const M = P.makeMats(); this.M = M;
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 1.1), fog: false })); this.disc.layers.set(NOINK); R.add(this.disc);
    P.buildCanyon(this.out, kit, M); P.buildBridges(this.out, M); P.buildDressing(this.out, M, kit); P.gravelBeds(this.out, M);
    this.trk = { R: new P.Track(kit, P.RX, true, false), L: new P.Track(kit, P.LX, false, true) };
    this.out.add(this.trk.R.group, this.trk.L.group);
    this.trainR = P.buildTrain(kit, M, ["train-carriage-box", "train-carriage-tank"], "#c8282b"); this.trainL = P.buildTrain(kit, M, ["train-carriage-coal", "train-carriage-box", "train-carriage-lumber"]);
    this.out.add(this.trainR, this.trainL, this.saw, this.coin, this.sheet);
    this.office = P.buildOffice(R, M); this.office.add(this.news); this.news.position.set(-0.2, 1.55, -2.7); this.news.rotation.set(-0.3, 0, 0.04); this.news.scale.setScalar(0.62);
    for (let t = 0; t < 2; t++) for (let k = 0; k < 16; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.smokeTex, transparent: true, depthWrite: false, color: "#d8d0d2", fog: true, alphaTest: 0 }));
      m.layers.set(NOINK); this.smoke[t].push(m); R.add(m);
    }
  }

  private shotSun(s: RShot, L: LightPreset) {
    let v = this.sunCache.get(s.n); if (v) return v;
    const c = camAt((s.a + s.b) >> 1, s.id), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1, fx = x / n, fz = z / n;
    const az = THREE.MathUtils.degToRad(L.az), el = THREE.MathUtils.degToRad(L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize(); this.sunCache.set(s.n, v); return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: string, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const s = shotById(id), t = f / FPS, lt = s.light, L = PRES[lt], K = lt === "golden" ? LOOK.golden : LOOK.day, office = s.place === "OFFICE";
    const c = camAt(f, id), st = STATE(f, id);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    this.out.visible = !office; this.office.visible = office;
    const sunDir = this.shotSun(s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 9, 14, 95);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera; sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...(lt === "golden" ? [0.03, 0.03, 0.06] as [number, number, number] : [0.04, 0.015, 0] as [number, number, number])); TONE.uSat.value = lt === "golden" ? 0.95 : 1.12;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad; CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    const su = this.skyMat.uniforms; K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((d) => THREE.MathUtils.degToRad(d)); su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar; scene.fog = this.fog; scene.background = office ? new THREE.Color("#2a1810") : null;
    const cm = this.cloudMaps[lt === "golden" ? "golden" : "day"];
    this.clouds.forEach((m, i) => { (m.material as THREE.MeshBasicMaterial).map = cm[i % 4]; m.visible = !office; m.lookAt(cam.position.x, m.position.y, cam.position.z); });
    // sun glow: soft halo in the sky in the sun direction (golden = low setting sun)
    this.glow.visible = !office; this.glow.position.copy(cam.position).addScaledVector(sunDir, 900); this.glow.quaternion.copy(cam.quaternion);
    const gs = lt === "golden" ? 1100 : 300;
    this.disc.visible = lt === "golden" && !office; this.disc.position.copy(cam.position).addScaledVector(sunDir, 900); this.disc.quaternion.copy(cam.quaternion); this.disc.scale.setScalar(48);
    (this.M.blueS as THREE.MeshLambertMaterial).color.set(lt === "golden" ? "#6f93d0" : "#8fb0d4"); (this.M.rustS as THREE.MeshLambertMaterial).color.set(lt === "golden" ? "#c8783c" : "#c4602c"); this.glow.scale.set(gs, gs, 1);
    (this.glow.material as THREE.MeshBasicMaterial).color.set(lt === "golden" ? "#ffcf9e" : "#fff4dc").multiplyScalar(lt === "golden" ? 3.2 : 0.9);
    // track + trains from STATE
    this.trk.R.set(st.gapR, st.heatR, 0); this.trk.L.set(0, st.heatL, st.buckle);
    const A = 2.0 * st.buckle;
    const place = (g: THREE.Group, z: number | null, x: number, bend: boolean, k: number) => {
      g.visible = z !== null && !office;
      for (const m of this.smoke[k]) m.visible = g.visible;
      if (z === null) return;
      const dx = bend ? P.buckleDx(z, A) : 0, da = bend ? P.buckleDx(z - 1, A) : 0, db = bend ? P.buckleDx(z + 1, A) : 0;
      const ph = ((z - JZ) / P.TL) % 1, bump = bend ? 0 : 0.03 * Math.pow(Math.abs(Math.sin(Math.PI * ph * 2)), 8);
      g.position.set(x + dx, bump + (bend ? P.buckleLift(z, A) : 0), z); g.rotation.y = bend ? Math.atan2(da - db, 2) : 0;
      const z1 = z === null ? 0 : z, vel = (k === 0 ? (trainsAt(f + 1).R ?? z1 - 0.55) : (trainsAt(f + 1).L ?? z1 - 0.5)) - z1; // m per frame (negative)
      const spd = Math.abs(vel) > 0.01 ? vel : -0.55, fr = f + 0;
      const col = new THREE.Color(SMOKE[lt]);
      this.smoke[k].forEach((m, i) => {
        const q = (((t * 0.55 + i / 16) % 1) + 1) % 1, age = q * 2.2 * FPS; // frames since emission
        m.position.set(x + dx + 0.5 * q * 3, 5.9 + q * 10, z - 3.7 - spd * age + 2.5 * q);
        const sz = 2.2 + q * 9; m.scale.set(sz, sz, 1); m.quaternion.copy(cam.quaternion);
        const mm = m.material as THREE.MeshBasicMaterial; mm.opacity = 0.55 * (1 - q) ** 1.3 * Math.min(1, q * 8); mm.color.copy(col);
      });
      void fr;
    };
    const tr = trainsAt(f); place(this.trainR, tr.R, P.RX, false, 0); place(this.trainL, tr.L, P.LX, true, 1);
    this.saw.visible = st.saw !== null && !office; this.saw.position.set(P.RX + P.G + 0.35 + Math.sin((st.saw ?? 0) * 40) * 0.12, P.TOPY + 0.36, JZ); this.saw.rotation.set(0, Math.PI / 2, 0);
    this.coin.visible = st.coin; const cn = coinAt(f); this.coin.position.set(P.RX + P.G + cn.dx, P.TOPY + 0.33 + cn.dy, JZ); this.coin.rotation.set(cn.rx, 0.6, 0); this.coin.scale.setScalar(0.25);
    this.sheet.visible = st.paper; this.sheet.position.set(P.RX + P.G, P.TOPY + 0.2, JZ); this.sheet.rotation.set(0, 0.6, 0);
    // cast
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const info = { pos: cam.position, right };
    const stg = railStage(lt === "golden" ? "golden" : "day", info);
    for (const g of castAt(f)) {
      const p = drawGuy(g, info, f);
      stg.places.push(p);
      blob(stg, g.x, g.y ?? 0, g.z, g.scale ?? 1);
    }
    for (const x of fxAt(f)) stg.fx.push(x);
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0; const used: Actor[] = [];
    for (const p of stg.places) {
      const sc2 = p.scale ?? 1; const a = this.actor(ai++); const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw); a.mesh.visible = true; a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, Math.atan2(cam.position.x - p.x, cam.position.z - p.z), 0); a.mesh.scale.set(sc2, sc2, sc2);
      if (a.mat.emissiveMap) a.mat.emissive.set("#ffffff"); a.mesh.castShadow = false; used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0; const fused: Fx[] = [];
    for (const p of stg.fx) {
      const ee = this.fx(fi++); ee.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw); ee.use(!!p.soft); ee.mesh.visible = true; ee.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) ee.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0); else { ee.mesh.quaternion.copy(cam.quaternion); ee.mesh.rotateZ(p.rot ?? 0); }
      ee.mesh.scale.set(p.w, p.h, 1); fused.push(ee);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush(); for (const a of used) a.bind(); for (const ee of fused) ee.bind();
    return focus;
  }
}
