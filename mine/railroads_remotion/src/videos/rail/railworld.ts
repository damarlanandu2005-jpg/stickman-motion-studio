// The railroad world on his stack: Kenney Nature + Train kits (CC0) through his Batch/toLambert/twoTone path,
// his sky/sun/fog/two-tone light rig, his card characters. Original layout: ledge track beside a strata canyon wall.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, V, lam, toLambert, RECOLOR } from "./build";
import { ctex, rng, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, person, blob, railStage, Place, Who as CWho } from "./cast";
import { Outfit } from "./toon";
import { SHOTS, RShot, Guy, FPS, stateAt } from "./rstory";

const NATURE = ["cliff_block_rock", "cliff_blockHalf_rock", "cliff_rock", "cliff_large_rock", "rock_largeA", "rock_largeB", "rock_largeC", "rock_smallA", "rock_smallB", "rock_tallA", "rock_tallB", "cactus_tall", "cactus_short", "tree_oak", "plant_bush", "stone_largeA", "stone_tallA"];
const TRAIN = ["railroad-straight", "train-locomotive-a", "train-carriage-box", "train-carriage-tank", "train-carriage-lumber", "track", "railroad-rail-straight"];
type Kit = Record<string, THREE.Object3D>;
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

// canyon palette: warm rock, not the kit's green/teal
Object.assign(RECOLOR, { grass: "#d9803f", dirt: "#b4502e", stone: "#c9774d", leafsDark: "#4a9142" });

const OUTFITS: Record<string, Outfit> = {
  eng: { jacket: "#2a9a8a", pants: "#3b3f52", boots: "#2b211c", hat: "cap", cap: "#35476b", skin: "#f6efe4", belt: null, buttons: "#e8c45a" },
  boss: { jacket: "#c9a02a", pants: "#4a3a2a", boots: "#2b211c", hat: "tophat", skin: "#f6efe4", moustache: "#3a2a20", buttons: "#fff2b0" },
  cond: { jacket: "#2d4670", pants: "#2a3350", boots: "#1d1a1a", hat: "shako", skin: "#f6efe4", buttons: "#e8c45a" },
  tourist: { jacket: "#b5653f", pants: "#3b3f52", boots: "#4a3426", hat: "bonnet", dress: "#c25a7a", skin: "#f6efe4" },
};
const RAIL_LIGHT: LightPreset = {
  ...LIGHTS.day, az: 70, el: 42,
  lit: [1.62, 1.42, 1.15], shade: [0.34, 0.3, 0.44], lift: [0.09, 0.06, 0.13],
  fog: "#d9c4c0", fogNear: 70, fogFar: 620, sunCol: "#ffe2c0", sunI: 2.8,
};
const RAIL_GOLDEN_LIGHT: LightPreset = {
  ...LIGHTS.golden, az: 6, el: 9,
  lit: [1.52, 0.82, 0.43], shade: [0.20, 0.18, 0.34], lift: [0.05, 0.06, 0.16],
  fog: "#efb18d", fogNear: 34, fogFar: 360, sunCol: "#ffb36b", sunI: 4.2,
};

const stripTex = (key: string) => ctex(key, 1024, 1024, (g, r) => {
  // storybook strata: horizontal wavy bands in rust / orange / ochre / plum, thin dark crevices (his reference: a painted wall)
  const cols = ["#c8482f", "#e0743a", "#f19a4a", "#b83a3c", "#9c3d4e", "#d95f38", "#f0a85c", "#a93f3a"];
  let y = 0;
  while (y < 1024) {
    const h = 14 + r() * 46, c = cols[Math.floor(r() * cols.length)];
    g.fillStyle = c; g.beginPath(); g.moveTo(0, y);
    const a = 3 + r() * 9, p = r() * 6, f = 1 + Math.floor(r() * 3);
    for (let x = 0; x <= 1024; x += 16) g.lineTo(x, y + a * Math.sin((x / 1024) * Math.PI * 2 * f + p));
    g.lineTo(1024, y + h + 20); g.lineTo(0, y + h + 20); g.closePath(); g.fill();
    g.strokeStyle = "rgba(70,20,30,0.45)"; g.lineWidth = 1.5 + r() * 2; g.beginPath();
    for (let x = 0; x <= 1024; x += 16) { const yy = y + a * Math.sin((x / 1024) * Math.PI * 2 * f + p); x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
    g.stroke();
    y += h;
  }
});
const gravelTex = () => ctex("gravel", 512, 512, (g, r) => {
  g.fillStyle = "#a9755a"; g.fillRect(0, 0, 512, 512);
  const cols = ["#c98f72", "#8a5a4a", "#d6a284", "#6f4a42", "#b98068", "#e0b090"];
  for (let i = 0; i < 2600; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.beginPath(); g.ellipse(r() * 512, r() * 512, 3 + r() * 6, 2 + r() * 4, r() * 3, 0, 7); g.fill(); g.strokeStyle = "rgba(60,30,30,0.5)"; g.lineWidth = 1; g.stroke(); }
});
const dirtTex = () => ctex("dirtR", 512, 512, (g, r) => {
  g.fillStyle = "#d1763c"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 400; i++) { g.fillStyle = r() > 0.5 ? "#e08a4a" : "#bd6232"; g.beginPath(); g.ellipse(r() * 512, r() * 512, 10 + r() * 30, 4 + r() * 10, 0, 0, 7); g.fill(); }
});
const rep = (t: THREE.Texture, x: number, y: number) => { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(x, y); c.anisotropy = 8; c.needsUpdate = true; return c; };

const skyTex = () => null;
export class RailWorld {
  root = new THREE.Group();
  private pool = new Pool(); private actors: Actor[] = []; private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private skyMat: THREE.ShaderMaterial; private sky: THREE.Mesh;
  private fog = new THREE.Fog("#d9c4c0", 70, 620);
  private clouds: THREE.Mesh[] = []; private cloudMap: THREE.Texture[];
  private trainsL: THREE.Group; private trainsR: THREE.Group; private smokeG: THREE.Mesh[] = [];
  private office: THREE.Group; private jointL: THREE.Mesh[] = []; private jointR: THREE.Mesh[] = []; private buckleMeshes: THREE.Mesh[] = [];
  private frustum = new THREE.Frustum(); private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();
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
    this.cloudMap = [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud));
    [[-60, 80, 260, 140], [90, 110, 300, 170], [-140, 95, 340, 150], [30, 140, 380, 190], [200, 120, 330, 160]].forEach(([x, y, z, w], i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), new THREE.MeshBasicMaterial({ map: this.cloudMap[i % 4], transparent: true, depthWrite: false, fog: false }));
      m.position.set(x, y, z); m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    });
    this.build(kit);
  }

  private build(kit: Kit) {
    const R = this.root, B = new Batch(), r = rng(7);
    const strata = rep(stripTex("strata"), 3, 2), gravel = rep(gravelTex(), 1, 70), dirt = rep(dirtTex(), 40, 40);
    const mk = (map: THREE.Texture, col = "#ffffff") => twoTone(new THREE.MeshLambertMaterial({ map, color: col }));
    const wallM = mk(strata), gravM = mk(gravel), dirtM = mk(dirt);
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, cast = true) => {
      const g = new THREE.BoxGeometry(w, h, d); const me = new THREE.Mesh(g, m); me.position.set(x, y + h / 2, z); me.castShadow = cast; me.receiveShadow = true; R.add(me); return me;
    };
    // ---- ground: ledge with the track on it, canyon wall on +x, a drop on -x ----
    box(26, 3, 520, dirtM, -2, -3, 150); // ledge slab (top at y=0), x -15..11
    // gravel box removed: the kit tile carries its own ballast
    // ---- canyon wall: three stepped tiers, tall, strata textured ----
    const tiers = [[8, 14, 0], [7, 14, 5], [9, 20, 9], [12, 40, 16]];
    let xo = 4.5, yo = 0;
    for (const [w, h, d] of tiers) { box(w + 40, h, 560, wallM, xo + (w + 40) / 2, yo - 3, 150); xo += w * 0.5; yo += h * 0.55; }
    // buttresses / hoodoos from the Kenney cliff blocks, recoloured warm (his build.ts recolours by material name)
    const place = (name: string, x: number, y: number, z: number, s: number, ry = 0, sy = s) => {
      const o = kit[name]; if (!o) return;
      B.addObject(o.clone(true), new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, sy, s)));
    };
    for (let i = 0; i < 70; i++) {
      const z = -6 + i * 4.5 + r() * 3, left = r() > 0.4;
      const nm = ["rock_largeA", "rock_largeB", "rock_smallA", "rock_tallA", "stone_largeA", "rock_smallB"][Math.floor(r() * 6)];
      place(nm, left ? 2.6 + r() * 1.6 : -2.6 - r() * 2.4, 0, z, 0.9 + r() * 1.6, r() * 6.3);
    }
    for (let i = 0; i < 24; i++) place(r() > 0.5 ? "cactus_tall" : "cactus_short", 2.8 + r() * 1.6, 0, 2 + i * 7 + r() * 5, 1.4 + r() * 0.8, r() * 6);
    // ---- track: Kenney railroad tiles, 4 m long, scaled 1.6 for a person-scaled gauge ----
    const S = 1.6;
    for (const lane of [-4.5, 4.5]) for (let z = -12; z < 300; z += 4 * S) place("railroad-straight", lane, S * 1.0, z, S);
    // far mesas on the -x side beyond the drop, banded by the same strata
    for (let i = 0; i < 9; i++) {
      const x = -70 - i * 38 - r() * 20, w = 60 + r() * 60, h = 14 + r() * 22, z = 120 + r() * 380;
      box(w, h, 70, wallM, x, -60, z); box(w * 0.6, h * 0.5, 50, wallM, x + 4, -60 + h, z);
    }
    box(2000, 2, 2000, mk(rep(stripTex("floor"), 20, 20)), -400, -62, 500, false);
    B.build(R, true);
    // ---- two independent trains, one per competing line ----
    const makeTrain = () => {
      const group = new THREE.Group();
      const tb = new Batch();
      const add = (name: string, z: number) => {
        const o = kit[name]; if (!o) return;
        tb.addObject(o.clone(true), new THREE.Matrix4().compose(
          new THREE.Vector3(0, -0.06, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)),
          new THREE.Vector3(S, S, S),
        ));
      };
      add("train-locomotive-a", 0); add("train-carriage-box", 4.4); add("train-carriage-tank", 8.2);
      tb.build(group, true); R.add(group); return group;
    };
    this.trainsL = makeTrain(); this.trainsR = makeTrain();

    // Scene office: a compact, enclosed boardroom set for the two narration beats.
    this.office = new THREE.Group(); R.add(this.office);
    const officeWall = twoTone(new THREE.MeshLambertMaterial({ color: "#e8ddc9" }));
    const officeTrim = twoTone(new THREE.MeshLambertMaterial({ color: "#9a6e4d" }));
    const officeGlass = new THREE.MeshLambertMaterial({ color: "#7fa9c7", emissive: "#182c3a" });
    const officeBox = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; this.office.add(m); return m;
    };
    officeBox(18, 0.25, 18, 0, -0.25, 0, officeTrim);
    officeBox(0.3, 7, 18, -9, 0, 0, officeWall); officeBox(0.3, 7, 18, 9, 0, 0, officeWall);
    officeBox(18, 7, 0.3, 0, 0, -9, officeWall); officeBox(18, 7, 0.3, 0, 0, 9, officeWall);
    officeBox(18, 0.25, 18, 0, 7, 0, officeWall);
    officeBox(6.0, 0.16, 2.2, 0, 0.92, -0.2, officeTrim);
    officeBox(5.7, 0.08, 1.9, 0, 1.08, -0.2, officeWall);
    officeBox(0.12, 2.3, 4.8, -4.8, 2.1, -8.78, officeTrim);
    officeBox(0.12, 2.3, 4.8, 4.8, 2.1, -8.78, officeTrim);
    officeBox(9.6, 0.12, 0.12, 0, 4.35, -8.78, officeTrim);
    officeBox(9.6, 0.12, 0.12, 0, 2.0, -8.78, officeTrim);
    officeBox(9.3, 2.2, 0.05, 0, 2.12, -8.72, officeGlass);
    officeBox(0.1, 2.2, 0.1, 0, 2.12, -8.62, officeTrim);
    officeBox(1.2, 0.1, 0.8, -2.2, 1.18, -0.2, officeTrim);
    officeBox(0.9, 0.08, 0.6, 2.2, 1.18, -0.2, officeTrim);

    // Expansion-joint inserts: each rail has two steel ends with a controllable gap.
    const railSteel = twoTone(new THREE.MeshLambertMaterial({ color: "#56616d" }));
    const makeJoint = (lane: number, target: THREE.Mesh[]) => {
      for (const railOffset of [-0.72, 0.72]) for (const side of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 4.0), railSteel);
        m.position.set(lane + railOffset, 1.85, 32 + side * 2.1);
        m.castShadow = true; m.receiveShadow = true; R.add(m); target.push(m);
      }
    };
    makeJoint(-4.5, this.jointL); makeJoint(4.5, this.jointR);

    // Ten articulated rail sections per rail create a readable thermal buckle on the rival line.
    for (const railOffset of [-0.72, 0.72]) for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 3.0), railSteel);
      m.position.set(-4.5 + railOffset, 1.85, -18 + i * 3.0);
      m.castShadow = true; m.receiveShadow = true; R.add(m); this.buckleMeshes.push(m);
    }

    // Smoke puffs (flat soft discs, no-ink), eight per train.
    const sm = ctex("smokeR", 128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 60);
      gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    for (let k = 0; k < 16; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ map: sm, transparent: true, depthWrite: false, color: "#d8d2d0" }));
      m.layers.set(NOINK); this.smokeG.push(m); R.add(m);
    }
  }

  private shotSun(s: RShot, L: LightPreset) {
    let v = this.sunCache.get(s.id); if (v) return v;
    const c = s.cam(0.5), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1, fx = x / n, fz = z / n;
    const az = THREE.MathUtils.degToRad(L.az), el = THREE.MathUtils.degToRad(L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize(); this.sunCache.set(s.id, v); return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const s = SHOTS[id - 1], u = Math.max(0, Math.min(1, (f - s.a) / (s.b - s.a))), t = f / FPS;
    const L = s.light === "golden" ? RAIL_GOLDEN_LIGHT : RAIL_LIGHT, K = LOOK[s.light];
    const story = stateAt(f);
    const c = s.cam(u);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const sunDir = this.shotSun(s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 9, 14, 95);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera; sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(0.05, 0.02, 0); TONE.uSat.value = 1.12;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad; CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    const su = this.skyMat.uniforms; K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((d) => THREE.MathUtils.degToRad(d)); su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar; scene.fog = this.fog; scene.background = null;
    for (const m of this.clouds) m.lookAt(cam.position.x, m.position.y, cam.position.z);
    // train
    this.trainsL.visible = story.trainL !== null; this.trainsR.visible = story.trainR !== null;
    this.trainsL.position.set(-4.5, 0, story.trainL ?? 0); this.trainsR.position.set(4.5, 0, story.trainR ?? 0);
    const moveJoint = (pieces: THREE.Mesh[], lane: number, gap: number) => {
      let i = 0;
      for (const railOffset of [-0.72, 0.72]) for (const side of [-1, 1]) {
        const m = pieces[i++]; m.position.set(lane + railOffset, 1.85, 32 + side * (2.0 + gap / 2));
      }
    };
    moveJoint(this.jointL, -4.5, story.gapL); moveJoint(this.jointR, 4.5, story.gapR);
    this.buckleMeshes.forEach((m, i) => {
      const section = i % 10, wave = Math.sin((section / 9) * Math.PI);
      const amount = story.buckle * wave;
      m.position.y = 1.85 + amount * 1.15;
      m.position.x = -4.5 + (i < 10 ? -0.72 : 0.72) + amount * 0.22 * Math.cos(section * 0.7);
      m.rotation.x = story.buckle * 0.12 * Math.cos((section / 9) * Math.PI);
    });
    this.office.visible = s.place === "OFFICE";
    this.smokeG.forEach((m, k) => {
      const left = k < 8, local = k % 8, train = left ? story.trainL : story.trainR;
      m.visible = train !== null;
      if (train === null) return;
      const q = (t * 0.12 + local / 8) % 1, lane = left ? -4.5 : 4.5;
      m.position.set(lane + 0.3 - q * 1.2, 4.2 + q * 11, train + 0.2 + q * 8);
      const sz = 2 + q * 7; m.scale.set(sz, sz, 1); m.quaternion.copy(cam.quaternion);
      (m.material as THREE.MeshLambertMaterial).opacity = 0.85 * (1 - q) ** 1.2;
    });
    // cast
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const info = { pos: cam.position, right };
    const st = railStage(s.light, info);
    for (const g of s.cast) {
      const who: CWho = { i: g.who.length + (g.x > 0 ? 1 : 0), o: OUTFITS[g.who], okey: g.who };
      const p = person(info, who, g.x, g.y ?? 0, g.z, { side: false, mirror: false }, { expr: (g.expr as never) ?? "neutral", mode: g.mode ?? "stand", look: g.look ?? 0, blink: false, facing: 0 }, {} as never, g.scale ?? 1);
      st.places.push(p);
      blob(st, g.x, g.y ?? 0, g.z, g.scale ?? 1);
    }
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0; const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1; const a = this.actor(ai++); const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw); a.mesh.visible = true; a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, Math.atan2(cam.position.x - p.x, cam.position.z - p.z), 0); a.mesh.scale.set(sc2, sc2, sc2);
      if (a.mat.emissiveMap) a.mat.emissive.set("#ffffff"); a.mesh.castShadow = false; used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0; const fused: Fx[] = [];
    for (const p of st.fx) {
      const ee = this.fx(fi++); ee.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw); ee.use(!!p.soft); ee.mesh.visible = true; ee.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) ee.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0); else { ee.mesh.quaternion.copy(cam.quaternion); ee.mesh.rotateZ(p.rot ?? 0); }
      ee.mesh.scale.set(p.w, p.h, 1); fused.push(ee);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush(); for (const a of used) a.bind(); for (const ee of fused) ee.bind();
    return focus;
  }
}
