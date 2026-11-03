// Scene engine: turns a Scene (scene.ts) into frames. All look code comes from ../reference (the reference repo's
// own files, unchanged): two-tone world light (shade.ts) set from the light presets (lights.ts), lit character
// cards (cardshade.ts), ink outlines (ink.ts), PBR-Neutral tone map + colour grade (grade.ts), 2D effect drawings
// (toon.ts). Pass order follows the reference Bridge.tsx: render -> ink -> tone map + grade.
// Every frame is a pure function of its time, so any frame can be rendered alone and the result is repeatable.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer, RenderPass, EffectPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { InkPass, NOINK } from "../reference/ink";
import { twoTone, TONE, CHAR, untone } from "../reference/shade";
import { LIGHTS } from "../reference/lights";
import { GradeEffect, GRADES } from "../reference/grade";
import { cardShade, blobMaterial, CARD_K } from "../reference/cardshade";
import { Pen, INK, fxBurst, fxStars, fxPuff } from "../reference/toon";
import { Scene, Move, XZ, XYZ, PhysicsTracks, EffectTracks, EmitterKind, Behavior } from "./scene";
import { Rig, COSTUMES, HEADS, HIP_H, FIGURE_H } from "./rig";
import { makeBody, makeStars, buildRoom, makeProp, makeSkyline, makeRiver, makeHatch, makeLegs, Hatch, SkyBody, MadeProp } from "./set";
import { Action, poseAtTime, strideFor } from "./motion";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smoother = (x: number) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };
const easeIO = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const rad = (d: number) => (d * Math.PI) / 180;
const mixHex = (a: string, b: string, t: number) => {
  const pa = new THREE.Color(a), pb = new THREE.Color(b), c = pa.lerp(pb, clamp01(t));
  return "#" + c.getHexString();
};
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

type PartRt = { id: string; pivot: THREE.Group; hingeRoot: THREE.Vector3; axis: THREE.Vector3; openRad: number; angle: Float32Array };
/** what an object can do (its behavior file), prepared for replay: door angles and crumple for every frame */
type BehRt = { spec: Behavior; crush: THREE.Group; parts: PartRt[]; crumple: Float32Array };
type Crash = { t: number; p: THREE.Vector3; dir: THREE.Vector3; speed: number; other: string };
type Thing = { hatch?: { h: Hatch; open_s: number; close_s?: number }; legs?: { unfold: (k: number) => void; deploy_s: number }; floatProp?: { amp: number; spin: number; y0: number }; thrust?: { from_s: number; to_s: number; smoke?: boolean }; flame?: THREE.Group; smoke?: FxCard[]; appear?: number; until?: number; isProp?: boolean; id: string; root: THREE.Group; base: THREE.Vector3; baseYaw: number; moves: Move[]; radius: number; height: number; forward: number;
  beh?: BehRt; solidR?: number; crash?: Crash };
type Actor = Thing & { cycles: Record<string, { frames: string[]; hz: number }>; cards: Map<string, THREE.Mesh>; pivot: THREE.Group; poses: NonNullable<Scene["characters"][0]["poses"]>; facing: number; blob: THREE.Mesh };
type RigActor = Thing & { rig: Rig; actions: Action[]; expressions: { at_s: number; face: string }[]; face: string;
  speed: Float32Array; phase: Float32Array; yaw: Float32Array };
type FxCard = { mesh: THREE.Mesh; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture };

export class Engine {
  private stars: THREE.Points | null = null; private bodies: SkyBody[] = []; private propMade: { p: MadeProp; def: { id: string } }[] = [];
  readonly warnings: string[] = [];
  private s: Scene; private w: number; private h: number;
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private cam: THREE.PerspectiveCamera;
  private composer!: EffectComposer; private sun!: THREE.DirectionalLight;
  private things = new Map<string, Thing>(); private actors: Actor[] = []; private rigs: RigActor[] = [];
  private fx: { def: NonNullable<Scene["effects"]>[0]; card: FxCard }[] = [];
  private puffs: { card: FxCard; owner: Thing; move: Extract<Move, { type: "move" }> }[] = [];
  /** Blender-baked physics: per frame [x, y, z, qx, qy, qz, qw] of each simulated object's root (bake_physics.py) */
  private tracks: Record<string, number[][]> = {};

  /** baked physics overrides scripted moves for that object; frames past the end hold the last pose */
  setPhysics(t: PhysicsTracks | null) {
    if (!t) return;
    if (t.fps !== this.s.fps) this.warnings.push(`physics was baked at ${t.fps} fps, scene is ${this.s.fps} fps`);
    for (const o of this.s.objects) if (o.physics && !t.objects[o.id]) this.warnings.push(`no baked physics for ${o.id}: run bake_physics.py`);
    this.tracks = t.objects;
  }

  /** Blender-baked particles and cloth (bake_effects.py): the engine only replays them */
  private emitters: { id: string; kind: EmitterKind; color?: string; sprites: THREE.Mesh[]; frames: number[][][] }[] = [];
  private cloths: { id: string; mesh: THREE.Mesh; frames: number[][]; nx: number; ny: number }[] = [];
  private spriteBank = new Map<string, THREE.CanvasTexture[]>();

  setEffects(t: EffectTracks | null) {
    if (!t) return;
    if (t.fps !== this.s.fps) this.warnings.push(`effects were baked at ${t.fps} fps, scene is ${this.s.fps} fps`);
    for (const e of this.s.emitters ?? []) {
      const tr = t.emitters[e.id];
      if (!tr) { this.warnings.push(`no baked effect for emitter ${e.id}: run bake_effects.py`); continue; }
      const sprites: THREE.Mesh[] = [];
      for (let i = 0; i < tr.max; i++) sprites.push(this.makeParticle(e.kind, e.color));
      this.emitters.push({ id: e.id, kind: e.kind, color: e.color, sprites, frames: tr.frames });
    }
    for (const c of this.s.cloths ?? []) {
      const tr = t.cloths[c.id];
      if (!tr) { this.warnings.push(`no baked cloth for ${c.id}: run bake_effects.py`); continue; }
      this.cloths.push(this.makeCloth(c, tr));
    }
  }

  /** the 2D look of each particle kind: ink-outlined cartoon drawings, six frames over the particle's life */
  private bankFor(kind: EmitterKind): THREE.CanvasTexture[] {
    if (this.spriteBank.has(kind)) return this.spriteBank.get(kind)!;
    const bank: THREE.CanvasTexture[] = [];
    for (let b = 0; b < 6; b++) {
      const u = b / 5, c = document.createElement("canvas"); c.width = c.height = 128;
      const g = c.getContext("2d")!, pen = new Pen(g); pen.ol = 5;
      // ink pass first, then a fill-only pass on top, so the puffs read as one outlined cloud (no inner outlines)
      const puff = (col: string, _a: number) => {
        const blobs: [number, number, number, number][] = [[64, 64, 34, 30]];
        for (let i = 0; i < 4; i++) { const an = rad(30 + i * 95); blobs.push([64 + 20 * Math.cos(an), 66 + 14 * Math.sin(an), 30 - 4 * (i % 2), 26]); }
        for (const [x, y, rx, ry] of blobs) pen.ell(x, y, rx + 3, ry + 3, INK, 0);
        for (const [x, y, rx, ry] of blobs) pen.ell(x, y, rx, ry, col, 0);
      };
      if (kind === "smoke") puff(mixHex("#f3eef6", "#8f8798", u), u);
      else if (kind === "dust") puff(mixHex("#eadfc9", "#b8a888", u), u);
      else if (kind === "explosion") puff(u < 0.3 ? mixHex("#fff1a8", "#ffa53a", u / 0.3) : mixHex("#ffa53a", "#6b5a66", (u - 0.3) / 0.7), u);
      else if (kind === "fire") {
        const col = mixHex("#ffe45c", "#e8431f", u);
        pen.poly([[64, 6], [92, 56], [100, 92], [64, 122], [28, 92], [38, 52]], col, 5);
        pen.poly([[64, 50], [80, 84], [64, 112], [48, 84]], mixHex("#fff6b8", "#ffb43a", u), 0);
      } else if (kind === "sparks") pen.poly([[64, 4], [78, 50], [124, 64], [78, 78], [64, 124], [50, 78], [4, 64], [50, 50]], "#ffe86a", 5);
      else if (kind === "splash") { pen.ell(64, 70, 34, 42, "#8fd3ff", 5); pen.ell(52, 54, 8, 12, "#ffffff", 0); }
      else if (kind === "snow") pen.ell(64, 64, 38, 38, "#ffffff", 4);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; bank.push(tex);
    }
    this.spriteBank.set(kind, bank);
    return bank;
  }

  private makeParticle(kind: EmitterKind, color?: string): THREE.Mesh {
    if (kind === "chunks") {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), twoTone(new THREE.MeshLambertMaterial({ color: color ?? "#8d8198", flatShading: true })));
      m.castShadow = true; m.visible = false; this.scene.add(m); return m;
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.bankFor(kind)[0], transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    m.layers.set(NOINK); m.renderOrder = 6; m.visible = false; this.scene.add(m); return m;
  }

  private makeCloth(c: NonNullable<Scene["cloths"]>[0], tr: EffectTracks["cloths"][string]) {
    const nx = tr.nx, ny = tr.ny, n = (nx + 1) * (ny + 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const col = new Float32Array(n * 3), c1 = new THREE.Color(c.color ?? "#e0453a"), c2 = new THREE.Color(c.color2 ?? "#f6f1e6");
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const band = Math.floor((j / ny) * 5.999) % 2 ? c2 : c1; col.set([band.r, band.g, band.b], (j * (nx + 1) + i) * 3); }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const idx: number[] = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, d = a + nx + 1, e = d + 1; idx.push(a, d, b, b, d, e); }
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, twoTone(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    mesh.castShadow = true; mesh.frustumCulled = false; this.scene.add(mesh);
    if (c.pole !== false) {
      const top = c.at[1] + c.size[1] + 0.35;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, top, 10).translate(0, top / 2, 0), twoTone(new THREE.MeshLambertMaterial({ color: "#5b4a3d" })));
      pole.position.set(c.at[0] - 0.03, 0, c.at[2]); pole.castShadow = true; this.scene.add(pole);
    }
    return { id: c.id, mesh, frames: tr.frames, nx, ny };
  }

  private renderBakedEffects(frame: number) {
    for (const e of this.emitters) {
      const row = e.frames[Math.min(frame, e.frames.length - 1)] ?? [], bank = e.kind === "chunks" ? null : this.bankFor(e.kind);
      e.sprites.forEach((m) => (m.visible = false));
      for (const q of row) {
        const m = e.sprites[q[0]]; if (!m) continue;
        const u = q[5], size = q[4] * (e.kind === "chunks" && u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1);
        m.position.set(q[1], Math.max(q[2], e.kind === "chunks" ? size * 0.5 : e.kind === "snow" ? 0 : size), q[3]); m.visible = size > 0.001;
        if (bank) {
          const mat = m.material as THREE.MeshBasicMaterial;
          mat.map = bank[Math.min(5, Math.floor(u * 6))];
          mat.opacity = e.kind === "snow" || e.kind === "sparks" || e.kind === "splash" ? 1 : Math.min(1, 1.6 * (1 - u));
          m.scale.setScalar(size * 2); m.quaternion.copy(this.cam.quaternion);
        } else { m.scale.setScalar(size); m.quaternion.set(q[6], q[7], q[8], q[9]); }
      }
    }
    for (const c of this.cloths) {
      const f = c.frames[Math.min(frame, c.frames.length - 1)], pos = c.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      pos.array.set(f); pos.needsUpdate = true; c.mesh.geometry.computeVertexNormals(); c.mesh.geometry.computeBoundingSphere();
    }
  }

  private constructor(s: Scene, canvas: HTMLCanvasElement, w: number, h: number) {
    this.s = s; this.w = w; this.h = h;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(1); this.renderer.setSize(w, h, false);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.cam = new THREE.PerspectiveCamera(s.camera[0].fov, w / h, 0.1, 900);
  }

  static async create(s: Scene, canvas: HTMLCanvasElement, w: number, h: number, base = "./") {
    const e = new Engine(s, canvas, w, h);
    await e.build(base);
    return e;
  }

  get rendererInfo() {
    const gl = this.renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return { vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
  }

  private async build(base: string) {
    const s = this.s, env = s.environment, L = LIGHTS[env.light];
    // reference light preset -> reference shader uniforms (what world.ts does once per frame)
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    CARD_K.uPx.value = this.h / 1920;

    // sky dome (no ink, no fog), fog = horizon colour as in the reference
    const top = untone(env.sky_top), hor = untone(env.sky_horizon);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: top }, uHor: { value: hor } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 uTop; uniform vec3 uHor; varying vec3 vP; void main(){ float k = pow(clamp(vP.y,0.0,1.0),0.55); gl_FragColor = vec4(mix(uHor,uTop,k),1.0); }",
    }));
    sky.layers.set(NOINK); sky.renderOrder = -10; this.scene.add(sky);
    this.scene.fog = new THREE.Fog(hor.clone(), env.fog_near, env.fog_far);

    this.scene.add(new THREE.HemisphereLight(L.sky, L.ground, L.hemiI));
    this.sun = new THREE.DirectionalLight(L.sunCol, L.sunI);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias;
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -22; sc.right = sc.top = 22; sc.near = 1; sc.far = 120;
    this.scene.add(this.sun, this.sun.target);
    // sun frozen for the shot and camera-relative (az from the camera's forward axis), like world.ts
    const c0 = s.camera[0], l0 = Array.isArray(c0.look) ? c0.look : [0, 0, 0];
    const fwd = c0.pos ? new THREE.Vector3(l0[0] - c0.pos[0], 0, l0[2] - c0.pos[2]).normalize()
      : new THREE.Vector3(-Math.sin(rad(c0.frame?.az_deg ?? 20)), 0, -Math.cos(rad(c0.frame?.az_deg ?? 20)));   // auto-framed: looks from its azimuth towards the subject
    const sd = fwd.applyAxisAngle(new THREE.Vector3(0, 1, 0), -rad(L.az)).multiplyScalar(Math.cos(rad(L.el)));
    sd.y = Math.sin(rad(L.el)); this.sun.position.copy(sd.multiplyScalar(60)); this.sun.target.position.set(0, 0, 0);

    if (env.ground) {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), twoTone(new THREE.MeshLambertMaterial({ color: env.ground })));
      ground.receiveShadow = true; this.scene.add(ground);
    }
    if (env.stars) { this.stars = makeStars(env.stars); this.scene.add(this.stars); }
    (env.bodies ?? []).forEach((b, i) => { const sb = makeBody(b, 5 + i); this.bodies.push(sb); this.scene.add(sb.mesh); });
    if (env.room) this.scene.add(buildRoom(env.room));
    if (env.skyline) this.scene.add(makeSkyline(env.skyline));
    if (env.river) this.scene.add(makeRiver(env.river.points, env.river.width_m, env.river.color));
    for (const p of s.props ?? []) {
      const mp = makeProp(p); mp.root.position.set(...p.at); mp.root.rotation.y = rad(p.turn_deg ?? 0); this.scene.add(mp.root); this.propMade.push({ p: mp, def: p });
      const fl = p.float; const th: Thing = { id: p.id, isProp: true, appear: p.appear_s, until: p.until_s, root: mp.root, base: new THREE.Vector3(p.at[0], p.at[1], p.at[2]), baseYaw: rad(p.turn_deg ?? 0), moves: [], radius: mp.radius, height: mp.height, forward: 0 };
      if (fl) th.floatProp = { amp: fl.amp_m ?? 0.15, spin: ((fl.spin_deg_s ?? 25) * Math.PI) / 180, y0: p.at[1] };
      this.things.set(p.id, th);
    }

    // objects from the asset library, scaled to their real height and stood on the ground
    const loader = new GLTFLoader(), cache = new Map<string, THREE.Group>();
    for (const o of s.objects) {
      const a = s.assets[o.asset];
      if (!cache.has(o.asset)) cache.set(o.asset, (await loader.loadAsync(base + a.file)).scene);
      const inner = cache.get(o.asset)!.clone(true);
      inner.traverse((m: any) => {
        if (!m.isMesh) return;
        const old = m.material;
        if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
        const mat = twoTone(new THREE.MeshLambertMaterial({ map: old.map ?? null, color: old.map ? "#ffffff" : (old.color ?? "#cccccc"), side: THREE.DoubleSide }));
        if (a.brightness) mat.color.multiplyScalar(a.brightness);
        m.material = mat; m.castShadow = true; m.receiveShadow = true;
      });
      let behSpec: Behavior | null = null;
      if (a.behavior) { const r = await fetch(base + a.behavior); if (!r.ok) throw new Error(`behavior file ${a.behavior} not found`); behSpec = await r.json(); this.splitParts(inner, behSpec!); }
      const box = new THREE.Box3().setFromObject(inner), size = box.getSize(new THREE.Vector3());
      const rawBox = box.clone(), rawScale = a.height_m / size.y;
      inner.scale.setScalar(a.height_m / size.y);
      const b2 = new THREE.Box3().setFromObject(inner), c = b2.getCenter(new THREE.Vector3());
      inner.position.set(-c.x, -b2.min.y, -c.z);
      const root = new THREE.Group(), crush = new THREE.Group(); crush.add(inner); root.add(crush); this.scene.add(root);
      const sz = b2.getSize(new THREE.Vector3());
      const t: Thing = { appear: o.appear_s, until: o.until_s, id: o.id, root, base: new THREE.Vector3(o.at[0], o.at_y ?? 0, o.at[1]), baseYaw: rad(o.turn_deg ?? 0), moves: o.moves ?? [],
        radius: Math.max(sz.x, sz.z) / 2, height: a.height_m, forward: rad(a.forward_deg ?? 0) };
      t.solidR = o.solid_radius_m;
      if (o.hatch) { const h = makeHatch(Math.max(sz.x, sz.z) * 0.44, o.hatch.height_m, o.hatch.azimuth_deg); root.add(h.group); t.hatch = { h, open_s: o.hatch.open_s, close_s: o.hatch.close_s }; }
      if (o.legs) { const L = makeLegs(a.height_m, Math.max(sz.x, sz.z) * 0.22); root.add(L.group); t.legs = { unfold: L.unfold, deploy_s: o.legs.deploy_s }; L.unfold(0); }
      if (o.thrust) {
        t.thrust = o.thrust; const fl = o.thrust.flame_m ?? a.height_m * 0.5, g = new THREE.Group();
        for (const [r, h, col] of [[0.16, 1.0, "#ff7a1a"], [0.11, 0.78, "#ffc22e"], [0.06, 0.55, "#fff6c8"]] as [number, number, string][]) {
          const cone = new THREE.Mesh(new THREE.ConeGeometry(r * a.height_m * 0.5, h * fl, 14, 1, true).translate(0, -h * fl / 2, 0), new THREE.MeshBasicMaterial({ color: col, fog: false, toneMapped: false, side: THREE.DoubleSide }));
          cone.layers.set(NOINK); g.add(cone);
        }
        g.visible = false; root.add(g); t.flame = g;
        if (o.thrust.smoke !== false) t.smoke = Array.from({ length: 16 }, () => this.fxCard(300, 300));
      }
      if (behSpec) t.beh = this.makeBehavior(behSpec, inner, crush, rawBox, rawScale);
      this.things.set(o.id, t);
      for (const m of t.moves) if (m.type === "move" && m.dust) for (let i = 0; i < 4; i++) this.puffs.push({ card: this.fxCard(300, 300), owner: t, move: m });
    }

    // characters: one lit, ink-free billboard card per pose (scale fixed by the first pose's card)
    for (const ch of s.characters) {
      if (ch.rig) {
        const rig = new Rig(COSTUMES[ch.rig.costume] ?? COSTUMES.none, ch.height_m, ch.rig.face ?? "neutral", HEADS[ch.rig.species ?? ""] );
        rig.root.traverse((o: any) => { if (o.isMesh && o.castShadow !== false) o.castShadow = true; });
        this.scene.add(rig.root);
        const ra: RigActor = { until: ch.until_s, appear: ch.appear_s, id: ch.id, root: rig.root, base: new THREE.Vector3(ch.at[0], 0, ch.at[1]), baseYaw: 0, moves: ch.moves ?? [], radius: 0.3, height: ch.height_m, forward: 0,
          rig, actions: ch.actions!, expressions: ch.expressions ?? [], face: ch.rig.face ?? "neutral", speed: new Float32Array(0), phase: new Float32Array(0), yaw: new Float32Array(0) };
        this.rigs.push(ra); this.things.set(ch.id, ra);
        continue;
      }
      const names = [...new Set([...ch.poses!.map((p) => p.pose).filter((n) => !ch.cycles?.[n]), ...Object.values(ch.cycles ?? {}).flatMap((c) => c.frames)])];
      const texLoader = new THREE.TextureLoader(), cards = new Map<string, THREE.Mesh>();
      let pxPerM = 0;
      for (const n of names) {
        const tex = await texLoader.loadAsync(base + ch.cards!.replace("{pose}", n));
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
        const img = tex.image as HTMLImageElement;
        if (!pxPerM) pxPerM = img.height / ch.height_m;
        const hm = img.height / pxPerM, wm = img.width / pxPerM;
        const geo = new THREE.PlaneGeometry(wm, hm).translate(0, hm / 2, 0);
        const mesh = new THREE.Mesh(geo, cardShade(new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide })));
        mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
        mesh.layers.set(NOINK); mesh.castShadow = true; mesh.visible = false;
        cards.set(n, mesh);
      }
      const pivot = new THREE.Group(), root = new THREE.Group();
      for (const m of cards.values()) pivot.add(m);
      root.add(pivot); this.scene.add(root);
      const blob = new THREE.Mesh(new THREE.PlaneGeometry(ch.height_m * 0.55, ch.height_m * 0.22).rotateX(-Math.PI / 2), blobMaterial(this.blobTexture()));
      blob.position.y = 0.01; blob.layers.set(NOINK); root.add(blob);
      const a: Actor = { id: ch.id, root, pivot, cards, cycles: ch.cycles ?? {}, blob, poses: ch.poses!, facing: 1, base: new THREE.Vector3(ch.at[0], 0, ch.at[1]), baseYaw: 0,
        moves: ch.moves ?? [], radius: 0.3, height: ch.height_m, forward: 0 };
      this.actors.push(a); this.things.set(ch.id, a);
    }

    for (const e of s.effects ?? []) {
      const card = e.type === "stars" ? this.fxCard(420, 210) : e.type === "puff" ? this.fxCard(300, 300) : this.fxCard(500, 500);
      this.fx.push({ def: e, card });
    }

    for (const sc2 of env.scatter ?? []) this.scatter(sc2);
    this.checkLayout();

    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    this.composer.addPass(new RenderPass(this.scene, this.cam));
    this.composer.addPass(new InkPass(this.scene, this.cam));
    this.composer.addPass(new EffectPass(this.cam, new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }), new GradeEffect(GRADES[env.light], 1)));
    this.composer.setSize(this.w, this.h);
    this.buildBehaviors();
    this.resolveRides();
    this.buildRigTables();
  }

  private fxCard(cw: number, chh: number): FxCard {
    const canvas = document.createElement("canvas"); canvas.width = cw; canvas.height = chh;
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, chh / cw), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    mesh.layers.set(NOINK); mesh.visible = false; mesh.renderOrder = 5; this.scene.add(mesh);
    return { mesh, canvas, tex };
  }

  private blobTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!;
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, "rgb(120,112,120)"); gr.addColorStop(1, "rgb(255,255,255)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  private scatter(sc: NonNullable<Scene["environment"]["scatter"]>[0]) {
    const r = rng(sc.seed), mat = twoTone(new THREE.MeshLambertMaterial({ color: sc.color, flatShading: true }));
    const geo = new THREE.IcosahedronGeometry(1, 0);
    let placed = 0, tries = 0;
    while (placed < sc.count && tries++ < sc.count * 40) {
      const ang = r() * Math.PI * 2, d = Math.sqrt(r()) * sc.radius, x = Math.cos(ang) * d, z = Math.sin(ang) * d - 4;
      const size = sc.min_size + (sc.max_size - sc.min_size) * r() * r();
      const blocked = [...this.things.values()].some((t) => Math.hypot(t.base.x - x, t.base.z - z) < t.radius + size + 0.6)
        || (sc.keep_clear ?? []).some(([kx, kz, kr]) => Math.hypot(kx - x, kz - z) < kr);
      if (blocked) continue;
      const m = new THREE.Mesh(geo, mat); m.scale.set(size * (0.8 + 0.5 * r()), size * (0.45 + 0.35 * r()), size * (0.8 + 0.5 * r()));
      m.position.set(x, size * 0.15, z); m.rotation.y = r() * 6.28; m.castShadow = true; m.receiveShadow = true; this.scene.add(m); placed++;
    }
  }

  /** objects must not overlap where they stand (characters are thin cards and are allowed to pass) */
  private checkLayout() {
    // objects dropped by physics start in the air, so only ground-standing objects are compared
    const dropped = new Set(this.s.objects.filter((o) => (o.physics?.drop_m ?? 0) > 0).map((o) => o.id));
    const list = [...this.things.values()].filter((t) => !(t as Actor).cards && !dropped.has(t.id) && !t.isProp);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j], d = Math.hypot(a.base.x - b.base.x, a.base.z - b.base.z);
      if (d < a.radius + b.radius) this.warnings.push(`${a.id} and ${b.id} overlap at their start positions (${d.toFixed(2)} m apart)`);
    }
  }

  /** position, yaw and extra lift of a thing at time t, from its moves */
  private poseAt(t: Thing, time: number) {
    if (t.crash && time > t.crash.t) {
      // after a crash the thing stops dead at the contact point and rebounds a little
      const q = this.poseAtRaw(t, t.crash.t), k = 1 - Math.exp(-(time - t.crash.t) / 0.07);
      q.p.addScaledVector(t.crash.dir, -(t.beh?.spec.crash?.recoil_m ?? 0.2) * k); q.dir = null; q.lift = 0;
      return q;
    }
    return this.poseAtRaw(t, time);
  }
  private poseAtRaw(t: Thing, time: number) {
    const p = t.base.clone(); let yaw = t.baseYaw, lift = 0, dir: number | null = null, walking = 0, keepFacing = false;
    for (const m of t.moves) {
      if (m.type === "place") { if (time >= m.at_s) p.set(m.to[0], 0, m.to[1]); continue; }
      if (time < m.from_s) continue;
      const u = clamp01((time - m.from_s) / (m.to_s - m.from_s)), active = time <= m.to_s;
      if (m.type === "move" || m.type === "walk" || m.type === "hop") {
        const k = m.type === "walk" || (m.type === "move" && m.linear) ? u : easeIO(u), from = p.clone(), to = new THREE.Vector3(m.to[0], 0, m.to[1]);
        p.lerpVectors(from, to, k);
        if (active && from.distanceTo(to) > 1e-3) dir = Math.atan2(to.x - from.x, to.z - from.z);
        if (m.type === "move" && m.face_travel && dir !== null) yaw = dir - t.forward;
        if (m.type === "walk" && active && u < 1) walking = (time - m.from_s) * (m.steps_per_s ?? 2);
        if (m.type === "hop" && active) { lift += (m.height_m ?? 0.5) * Math.sin(Math.PI * u); keepFacing = m.keep_facing ?? true; }
      } else if (m.type === "fly") {
        const from = p.clone(); p.lerpVectors(from, new THREE.Vector3(...m.to), easeIO(u));
      } else if (m.type === "float" && active) {
        lift += (m.amp_m ?? 0.1) * Math.sin(((time - m.from_s) / (m.period_s ?? 2)) * Math.PI * 2);
      } else if (m.type === "spin") {
        yaw += rad(m.deg_per_s) * (Math.min(time, m.to_s) - m.from_s);
      } else if (m.type === "shake" && active) {
        const a = (m.amp_m ?? 0.05) * (1 - u); p.x += a * Math.sin(time * 90); p.z += a * Math.cos(time * 77);
      }
    }
    return { p, yaw, lift, dir, walking, keepFacing };
  }

  /** a rider is on screen where his vehicle is, not at the spot he started from: the camera must frame him there */
  /** where a thing is on screen for framing: a rider moves from his own spot to the seat while getting in, and back while getting out (same blend as renderRig) */
  private framePos(t: Thing, time: number): { p: THREE.Vector3; lift: number } {
    const q = this.poseAt(t, time), r = t as RigActor;
    if (r.actions) for (const a of r.actions) {
      if (a.do !== "ride" || a.to_s === undefined) continue;
      const enter = a.enter_s ?? 0.9, exit = a.exit_s ?? 0.7, sm = (u: number) => { const k = clamp01(u); return k * k * (3 - 2 * k); };
      let w = 0;
      if (time >= a.at_s && time < a.at_s + enter) w = sm((time - a.at_s) / enter);
      else if (time >= a.at_s + enter && time <= a.to_s) w = 1;
      else if (time > a.to_s && time < a.to_s + exit) w = 1 - sm((time - a.to_s) / exit);
      if (w > 0) { const v = this.poseAt(this.things.get(a.vehicle!)!, time); return { p: q.p.clone().lerp(v.p, w), lift: q.lift }; }
    }
    return { p: q.p, lift: q.lift };
  }

  /** camera position, look point and fov of one key at a time: hand-set, or auto-framed on the named things */
  private keyPose(k: Scene["camera"][0], time: number) {
    if (!k.frame) return { pos: new THREE.Vector3(...k.pos!), look: new THREE.Vector3(...this.lookPoint(k.look!, time)), fov: k.fov };
    const f = k.frame, pts = f.on.map((id) => { const t = this.things.get(id)!, q = this.framePos(t, time); return { c: new THREE.Vector3(q.p.x, q.p.y + q.lift + t.height / 2, q.p.z), r: Math.max(t.height / 2, t.radius) }; });
    const mid = pts.reduce((m, p) => m.add(p.c), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    const R = Math.max(...pts.map((p) => p.c.distanceTo(mid) + p.r));            // sphere that holds everything named
    const vt = Math.tan(rad(k.fov) / 2), ht = vt * (this.w / this.h), d = R / ((f.fill ?? 0.55) * Math.min(vt, ht));
    const az = rad(f.az_deg ?? 20), el = rad(f.el_deg ?? 12);
    const pos = mid.clone().add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d));
    pos.y = Math.max(pos.y, 0.4);
    return { pos, look: mid, fov: k.fov };
  }

  private cameraAt(time: number) {
    const k = this.s.camera; let i = 0;
    while (i < k.length - 2 && time >= k[i + 1].at_s) i++;
    const a = k[i], b = k[Math.min(i + 1, k.length - 1)];
    const u = b.cut ? (time >= b.at_s ? 1 : 0) : smoother((time - a.at_s) / Math.max(1e-6, b.at_s - a.at_s));
    const pa = this.keyPose(a, time), pb = this.keyPose(b, time);
    return { pos: pa.pos.lerp(pb.pos, u), look: pa.look.lerp(pb.look, u), fov: pa.fov + (pb.fov - pa.fov) * u };
  }

  /** a fixed look point, or a followed thing's current position plus an offset */
  private lookPoint(look: NonNullable<Scene["camera"][0]["look"]>, time: number): number[] {
    if (Array.isArray(look)) return look;
    const q = this.poseAt(this.things.get(look.follow)!, time), o = look.offset ?? [0, 1, 0];
    return [q.p.x + o[0], q.p.y + q.lift + o[1], q.p.z + o[2]];
  }

  render(frame: number) {
    const s = this.s, time = frame / s.fps;
    const c = this.cameraAt(time);
    // impact kick: flips sign every frame and decays over 7 frames (reference camera rule)
    for (const k of s.kicks ?? []) {
      const i = frame - Math.round(k.at_s * s.fps);
      if (i >= 0 && i < 7) { const a = k.amp * (1 - i / 7) * (i % 2 ? -1 : 1); c.pos.y += 0.05 * a; c.pos.x += 0.04 * a; c.fov += 0.6 * a; }
    }
    this.cam.position.copy(c.pos); this.cam.fov = c.fov; this.cam.updateProjectionMatrix(); this.cam.lookAt(c.look);

    if (this.stars) this.stars.position.copy(this.cam.position);
    for (const b of this.bodies) b.mesh.position.copy(this.cam.position).addScaledVector(b.dir, b.dist), b.mesh.quaternion.copy(this.cam.quaternion);
    for (const m of this.propMade) m.p.update(time);
    for (const t of this.things.values()) {
      if (t.isProp && t.floatProp) { const f = t.floatProp; t.root.position.y = f.y0 + f.amp * Math.sin(time * 1.3 + f.y0 * 3); t.root.rotation.y = f.spin * time; t.root.rotation.z = 0.35 * Math.sin(time * 0.8 + f.y0); }
      if (t.isProp) { t.root.visible = (t.appear === undefined || time >= t.appear) && (t.until === undefined || time < t.until); continue; }
      if ((t as Actor).cards || (t as RigActor).rig) continue;
      if (t.beh) this.applyBehavior(t, frame);
      const q = this.poseAt(t, time);
      t.root.visible = (t.appear === undefined || time >= t.appear) && (t.until === undefined || time < t.until);
      const tr = this.tracks[t.id];
      if (tr) {
        const k = tr[Math.min(frame, tr.length - 1)];
        t.root.position.set(k[0], k[1], k[2]); t.root.quaternion.set(k[3], k[4], k[5], k[6]);
        continue;
      }
      t.root.position.set(q.p.x, q.p.y + q.lift, q.p.z); t.root.rotation.y = q.yaw;
    }
    for (const a of this.actors) this.renderActor(a, time);
    for (const r of this.rigs) { this.renderRig(r, frame, time); if ((r.until !== undefined && time >= r.until) || (r.appear !== undefined && time < r.appear)) r.root.visible = false; }
    this.renderPuffs(time);
    this.renderThrust(time);
    this.renderRocketParts(time);
    this.renderEffects(time);
    this.renderBakedEffects(frame);
    this.composer.render();
  }

  // ------------------------------------------------------------------ behaviors (what an object can do)
  public events: { t: number; what: string }[] = [];

  /** cut the named parts out of the model: every triangle whose centre lies in a part's box moves to its own mesh */
  private splitParts(inner: THREE.Group, spec: Behavior) {
    if (!spec.parts?.length) return;
    inner.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = []; inner.traverse((m: any) => { if (m.isMesh) meshes.push(m); });
    const raw = new THREE.Box3().setFromObject(inner), sz = raw.getSize(new THREE.Vector3());
    const abs = (f: XYZ) => new THREE.Vector3(raw.min.x + f[0] * sz.x, raw.min.y + f[1] * sz.y, raw.min.z + f[2] * sz.z);
    const regions = spec.parts.map((p) => ({ min: abs(p.region.min), max: abs(p.region.max), hinge: abs(p.hinge), face: p.region.facing ? new THREE.Vector3(...p.region.facing).normalize() : null, faceMin: p.region.facing_min ?? 0.6, disc: p.region.disc_r ? p.region.disc_r * sz.y : 0 }));
    this.partMeshes.set(inner, []);
    for (const m of meshes) {
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld).toNonIndexed();
      const pos = g.getAttribute("position"), tri = pos.count / 3, owner = new Int16Array(tri).fill(-1), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
      for (let i = 0; i < tri; i++) {
        c.set(0, 0, 0); for (let k = 0; k < 3; k++) c.add(new THREE.Vector3().fromBufferAttribute(pos, i * 3 + k)); c.multiplyScalar(1 / 3);
        v0.fromBufferAttribute(pos, i * 3); v1.fromBufferAttribute(pos, i * 3 + 1); v2.fromBufferAttribute(pos, i * 3 + 2);
        const nrm = e1.subVectors(v1, v0).cross(e2.subVectors(v2, v0)).normalize();
        for (let r = 0; r < regions.length; r++) if ((!regions[r].face || nrm.dot(regions[r].face!) >= regions[r].faceMin) && (!regions[r].disc || Math.hypot(c.x - regions[r].hinge.x, c.y - regions[r].hinge.y) <= regions[r].disc) && c.x >= regions[r].min.x && c.x <= regions[r].max.x && c.y >= regions[r].min.y && c.y <= regions[r].max.y && c.z >= regions[r].min.z && c.z <= regions[r].max.z) { owner[i] = r; break; }
      }
      // a wheel turns about its own centre: find it from the triangles the disc caught, then cut again around it
      for (let r = 0; r < regions.length; r++) if (spec.parts![r].kind === "spin" && regions[r].disc && spec.parts![r].auto_pivot) {
        const bb = new THREE.Box3();
        for (let i = 0; i < tri; i++) if (owner[i] === r) for (let k = 0; k < 3; k++) bb.expandByPoint(v0.fromBufferAttribute(pos, i * 3 + k));
        if (!bb.isEmpty()) { regions[r].hinge.x = (bb.min.x + bb.max.x) / 2; regions[r].hinge.y = (bb.min.y + bb.max.y) / 2; regions[r].hinge.z = (bb.min.z + bb.max.z) / 2; }
      }
      owner.fill(-1);
      for (let i = 0; i < tri; i++) {
        c.set(0, 0, 0); v0.fromBufferAttribute(pos, i * 3); v1.fromBufferAttribute(pos, i * 3 + 1); v2.fromBufferAttribute(pos, i * 3 + 2); c.add(v0).add(v1).add(v2).multiplyScalar(1 / 3);
        const nrm = e1.subVectors(v1, v0).cross(e2.subVectors(v2, v0)).normalize();
        for (let r = 0; r < regions.length; r++) if ((!regions[r].face || nrm.dot(regions[r].face!) >= regions[r].faceMin) && c.x >= regions[r].min.x && c.x <= regions[r].max.x && c.y >= regions[r].min.y && c.y <= regions[r].max.y && c.z >= regions[r].min.z && c.z <= regions[r].max.z
          && (!regions[r].disc || Math.hypot(c.x - regions[r].hinge.x, c.y - regions[r].hinge.y) <= regions[r].disc)) { owner[i] = r; break; }
      }
      const build = (want: number) => {
        const out = new THREE.BufferGeometry();
        for (const [name, at] of Object.entries(g.attributes)) {
          const a = at as THREE.BufferAttribute, list: number[] = [];
          for (let i = 0; i < tri; i++) if (owner[i] === want) for (let k = 0; k < 3; k++) for (let j = 0; j < a.itemSize; j++) list.push(a.array[(i * 3 + k) * a.itemSize + j]);
          if (list.length) out.setAttribute(name, new THREE.Float32BufferAttribute(list, a.itemSize));
        }
        return out.getAttribute("position") ? out : null;
      };
      const mat = m.material as THREE.Material, parent = m.parent!;
      parent.remove(m);
      const rest = build(-1);
      const place = (geo: THREE.BufferGeometry, hinge?: THREE.Vector3) => {
        const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
        if (hinge) mesh.position.copy(hinge).multiplyScalar(-1);
        return mesh;
      };
      if (rest) inner.add(place(rest));
      for (let r = 0; r < regions.length; r++) {
        const geo = build(r); if (!geo) continue;
        let pv = this.partPivots.get(inner)?.[r];
        if (!pv) { pv = new THREE.Group(); pv.position.copy(regions[r].hinge); inner.add(pv); if (!this.partPivots.has(inner)) this.partPivots.set(inner, []); this.partPivots.get(inner)![r] = pv; }
        pv.add(place(geo, regions[r].hinge));
      }
    }
    // a part that caught no triangle is a mistake in the behavior file, not something to ignore
    spec.parts.forEach((p, r) => { if (!this.partPivots.get(inner)?.[r]) this.warnings.push(`behavior ${spec.id}: part ${p.id} contains no triangles; check its region box`); });
  }
  private partMeshes = new Map<THREE.Group, THREE.Mesh[]>();
  private partPivots = new Map<THREE.Group, THREE.Group[]>();

  private makeBehavior(spec: Behavior, inner: THREE.Group, crush: THREE.Group, raw: THREE.Box3, k: number): BehRt {
    const sz = raw.getSize(new THREE.Vector3()), n = Math.round(this.s.duration_s * this.s.fps) + 1;
    const toRoot = (f: XYZ) => new THREE.Vector3(raw.min.x + f[0] * sz.x, raw.min.y + f[1] * sz.y, raw.min.z + f[2] * sz.z).multiplyScalar(k).add(inner.position);
    const parts: PartRt[] = (spec.parts ?? []).map((p, r) => ({ id: p.id, pivot: this.partPivots.get(inner)?.[r] ?? new THREE.Group(), hingeRoot: toRoot(p.hinge),
      axis: new THREE.Vector3(...p.axis).normalize(), openRad: p.kind === "spin" ? 1 : rad(p.open_deg ?? 0), angle: new Float32Array(n) }));
    return { spec, crush, parts, crumple: new Float32Array(n) };
  }

  /** replay one frame of an object's behavior: part angles and crumple, computed once in buildBehaviors */
  private applyBehavior(t: Thing, frame: number) {
    const b = t.beh!, i = Math.min(frame, b.crumple.length - 1);
    for (const p of b.parts) p.pivot.quaternion.setFromAxisAngle(p.axis, p.angle[i] * p.openRad);
    const c = b.crumple[i], f = t.forward;
    const m = new THREE.Matrix4().makeRotationY(f).multiply(new THREE.Matrix4().makeScale(1 + 0.05 * c, 1 + 0.04 * c, 1 - 0.18 * c)).multiply(new THREE.Matrix4().makeRotationY(-f));
    b.crush.matrixAutoUpdate = false; b.crush.matrix.copy(m); b.crush.matrixWorldNeedsUpdate = true;
  }

  /** the logic of every object with a behavior file, simulated once in frame order: crashes, doors, crumple */
  private buildBehaviors() {
    const s = this.s, n = Math.round(s.duration_s * s.fps) + 1, dt = 1 / s.fps;
    const solids = [...this.things.values()].filter((t) => t.solidR !== undefined);
    const people = [...this.things.values()].filter((t) => (t as RigActor).rig || (t as Actor).cards);
    for (const t of this.things.values()) {
      const b = t.beh; if (!b) continue;
      const P: THREE.Vector3[] = [], speed = new Float32Array(n), yawA = new Float32Array(n);
      for (let f = 0; f < n; f++) { const q = this.poseAtRaw(t, f * dt); P.push(q.p.clone()); yawA[f] = q.yaw; }
      for (let f = 0; f < n; f++) { const a = P[Math.max(0, f - 1)], c = P[Math.min(n - 1, f + 1)]; speed[f] = a.distanceTo(c) / (dt * (Math.min(n - 1, f + 1) - Math.max(0, f - 1))); }
      // crash: moving fast enough, and the ground circles touch a solid thing it is moving towards
      const cr = b.spec.crash, R = b.spec.collide_radius_m ?? t.radius * 0.8;
      if (cr) {
        search: for (let f = 1; f < n; f++) {
          if (speed[f] < cr.min_speed_mps) continue;
          const v = new THREE.Vector3().subVectors(P[Math.min(n - 1, f + 1)], P[f - 1]);
          for (const o of solids) {
            if (o === t) continue;
            const op = this.poseAtRaw(o, f * dt).p, d = Math.hypot(P[f].x - op.x, P[f].z - op.z);
            if (d <= R + o.solidR! && v.dot(new THREE.Vector3(op.x - P[f].x, 0, op.z - P[f].z)) > 0) {
              t.crash = { t: f * dt, p: P[f].clone(), dir: new THREE.Vector3(v.x, 0, v.z).normalize(), speed: speed[f], other: o.id };
              this.events.push({ t: +(f * dt).toFixed(2), what: `crash: ${t.id} hit ${o.id} at ${speed[f].toFixed(1)} m/s` });
              break search;
            }
          }
        }
      }
      const tc = t.crash?.t ?? Infinity;
      for (const p of b.parts) {
        const spec = b.spec.parts!.find((x) => x.id === p.id)!, rate = 1 / (spec.open_s ?? 0.7);
        if (spec.kind === "spin") {
          // a wheel turns by distance / radius, so it matches the ground speed exactly; it locks at the crash
          const r = (spec.radius_m ?? 0.35); let ang = 0;
          for (let f = 0; f < n; f++) { if (f > 0 && f * dt <= tc) ang += (speed[f] * dt) / r; p.angle[f] = ang; }
          continue;
        }
        let a = 0, wasOpen = false;
        for (let f = 0; f < n; f++) {
          const time = f * dt, y = yawA[f], c = Math.cos(y), sn = Math.sin(y);
          const hx = P[f].x + p.hingeRoot.x * c + p.hingeRoot.z * sn, hz = P[f].z - p.hingeRoot.x * sn + p.hingeRoot.z * c;
          let target = 0;
          for (const tr of b.spec.triggers ?? []) if (tr.part === p.id && speed[f] <= (tr.max_speed_mps ?? 0.3))
            for (const who of people) { const w = this.poseAtRaw(who, time).p; if (Math.hypot(w.x - hx, w.z - hz) <= tr.within_m) target = 1; }
          if (time >= tc && cr?.open_parts?.includes(p.id)) target = 1;
          a += Math.max(-rate * dt, Math.min(rate * dt, target - a));
          p.angle[f] = a;
          const open = a > 0.5; if (open !== wasOpen) { this.events.push({ t: +time.toFixed(2), what: `${t.id}: ${p.id} ${open ? "opens" : "closes"}` }); wasOpen = open; }
        }
      }
      if (cr && t.crash) {
        for (let f = 0; f < n; f++) { const u = clamp01((f * dt - tc) / 0.14); b.crumple[f] = f * dt < tc ? 0 : cr.crumple * (1 - Math.pow(1 - u, 3)); }
        const at = t.crash.t, sz = t.height;
        this.fx.push({ def: { type: "burst", at_s: at, dur_s: 0.5, on: t.id, size_m: sz * 1.1, color: "#ffd24a" }, card: this.fxCard(500, 500) });
        this.fx.push({ def: { type: "stars", at_s: at + 0.1, dur_s: 1.0, on: t.id, size_m: sz * 0.9, lift_m: sz * 0.9 }, card: this.fxCard(420, 210) });
        this.fx.push({ def: { type: "puff", at_s: at, dur_s: 1.2, on: t.id, size_m: sz * 1.3, color: "#e8d8c0" }, card: this.fxCard(300, 300) });
        s.kicks = [...(s.kicks ?? []), { at_s: at, amp: cr.kick ?? 1.2 }];
      }
    }
  }

  /** where a rider ends up when he gets out: beside the vehicle (on the door side if it has a door), not back where he started */
  private resolveRides() {
    for (const r of this.rigs) {
      for (const a of r.actions) {
        if (a.do !== "ride" || a.to_s === undefined) continue;
        const v = this.things.get(a.vehicle!)!, q = this.poseAt(v, a.to_s), psi = q.yaw + v.forward, sd = a.seat!;
        const c = Math.cos(q.yaw), sn = Math.sin(q.yaw);
        const seat = new THREE.Vector3(q.p.x + sd[0] * c + sd[2] * sn, 0, q.p.z - sd[0] * sn + sd[2] * c);
        const side = new THREE.Vector3(Math.cos(psi), 0, -Math.sin(psi)), reach = (a.exit_m ?? 1.1);
        const cand = [1, -1].map((k) => seat.clone().addScaledVector(side, k * reach));
        let pick = cand[0];
        const door = v.beh?.parts.find((p) => v.beh!.spec.parts!.find((x) => x.id === p.id)!.kind !== "spin");
        if (door) {
          const hx = q.p.x + door.hingeRoot.x * c + door.hingeRoot.z * sn, hz = q.p.z - door.hingeRoot.x * sn + door.hingeRoot.z * c;
          pick = cand.sort((m, n) => Math.hypot(m.x - hx, m.z - hz) - Math.hypot(n.x - hx, n.z - hz))[0];
        }
        r.moves = [...r.moves.filter((m) => !(m.type === "place" && m.at_s === a.to_s)), { type: "place", at_s: a.to_s, to: [pick.x, pick.z] }];
      }
    }
  }

  /** per-frame ground speed, gait phase and heading of each rig, from its scripted moves (done once, in frame order) */
  private buildRigTables() {
    const s = this.s, n = Math.round(s.duration_s * s.fps) + 1, dt = 1 / s.fps;
    for (const r of this.rigs) {
      r.speed = new Float32Array(n); r.phase = new Float32Array(n); r.yaw = new Float32Array(n);
      let ph = 0, yaw = 0;
      for (let f = 0; f < n; f++) {
        const t = f * dt, a = this.poseAt(r, Math.max(0, t - dt / 2)).p, b = this.poseAt(r, Math.min(s.duration_s, t + dt / 2)).p;
        const vx = (b.x - a.x) / dt, vz = (b.z - a.z) / dt, sp = Math.hypot(vx, vz);
        const back = r.moves.some((m) => m.type === "walk" && m.backwards && t >= m.from_s && t <= m.to_s);
        r.speed[f] = sp; ph += (back ? -1 : 1) * (2 * Math.PI * sp * dt) / strideFor(sp); r.phase[f] = ph;
        const cur = r.actions[poseAtTime(r.actions, { time: t, speed: 0, phase: 0 }).index], here = this.poseAt(r, t).p;
        let target: number | null = null;
        if (sp > 0.25) target = Math.atan2(vx, vz) + (back ? Math.PI : 0);
        else if (cur.face_camera || f === 0) { const c = this.cameraAt(t).pos; target = Math.atan2(c.x - here.x, c.z - here.z); }
        if (cur.face_deg !== undefined && sp <= 0.25) target = rad(cur.face_deg);
        if (cur.face_toward && sp <= 0.25) { const o = this.poseAt(this.things.get(cur.face_toward)!, t).p; target = Math.atan2(o.x - here.x, o.z - here.z); }
        if (target !== null) {
          let d = target - yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
          yaw = f === 0 ? target : yaw + Math.max(-7 * dt, Math.min(7 * dt, d));
        }
        r.yaw[f] = yaw;
      }
    }
  }

  private renderRig(r: RigActor, frame: number, time: number) {
    const i = Math.min(frame, r.speed.length - 1), q = this.poseAt(r, time);
    const out = poseAtTime(r.actions, { time, speed: r.speed[i], phase: r.phase[i] });
    let x = q.p.x, z = q.p.z, y = 0, yaw = r.yaw[i], lift = out.lift + q.lift;
    const act = r.actions[out.index];
    const prev = r.actions[out.index - 1];
    const ride = act.do === "ride" ? act : prev && prev.do === "ride" && time < prev.to_s! + (prev.exit_s ?? 0.7) ? prev : null;
    // a rider reacts by himself when his vehicle crashes: thrown forward, arms up, shocked face (no scene script needed)
    let shocked = false;
    const crash = ride ? this.things.get(ride.vehicle!)!.crash : undefined;
    if (crash && time > crash.t && act === ride) {
      const dt = time - crash.t, bump = (1 - Math.exp(-dt / 0.06)) * Math.exp(-dt / 0.8), p = out.pose;
      p.spineX = (p.spineX ?? 0) + 0.45 * bump; p.headX = (p.headX ?? 0) - 0.3 * bump; p.pitch = (p.pitch ?? 0) + 0.12 * bump;
      p.LShX = (p.LShX ?? 0) + 0.9 * bump; p.RShX = (p.RShX ?? 0) + 0.9 * bump; p.LAbd = (p.LAbd ?? 0) + 0.5 * bump; p.RAbd = (p.RAbd ?? 0) + 0.5 * bump;
      shocked = dt < 2.2;
    }
    r.rig.apply(out.pose);
    if (ride) {
      const v = this.things.get(ride.vehicle!)!, vq = this.poseAt(v, time), c = Math.cos(vq.yaw), sn = Math.sin(vq.yaw), sd = ride.seat!;
      const sx = vq.p.x + sd[0] * c + sd[2] * sn, sz = vq.p.z - sd[0] * sn + sd[2] * c, sy = vq.p.y + vq.lift + sd[1] - HIP_H * (r.height / FIGURE_H);
      const rideYaw = vq.yaw + v.forward;
      const dy = (a: number, b: number, u: number) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * u; };
      if (act === ride) {
        const u = Math.min(1, (time - ride.at_s) / (ride.enter_s ?? 0.9)), k = u * u * (3 - 2 * u);
        x = q.p.x + (sx - q.p.x) * k; z = q.p.z + (sz - q.p.z) * k; y = sy * k + 0.45 * Math.sin(Math.PI * u) * (1 - u); yaw = dy(r.yaw[i], rideYaw, k);
        lift = 0;
      } else {
        const u = Math.min(1, (time - ride.to_s!) / (ride.exit_s ?? 0.7)), k = u * u * (3 - 2 * u);
        x = sx + (q.p.x - sx) * k; z = sz + (q.p.z - sz) * k; y = sy * (1 - k) + 0.5 * Math.sin(Math.PI * u); yaw = dy(rideYaw, r.yaw[i], k);
        // blend from the sitting pose happens in poseAtTime; ground lock only takes over once he has landed
        lift = out.lift;
      }
      r.rig.root.position.set(x, y + lift, z); r.rig.root.rotation.y = yaw;
    } else {
      r.rig.root.position.set(x, 0, z); r.rig.root.rotation.y = yaw;
      r.rig.root.position.y = out.lock ? -r.rig.lowestPoint() + lift : lift;
    }
    let face = r.face;
    const ex = r.expressions.filter((e) => time >= e.at_s).pop();
    if (ex) face = ex.face; else if (act.expression) face = act.expression;
    if (shocked) face = "surprised";
    r.rig.setExpression(face);
  }

  private renderActor(a: Actor, time: number) {
    const q = this.poseAt(a, time);
    let pose = a.poses[0];
    for (const k of a.poses) if (time >= k.at_s) pose = k;
    const cy = a.cycles[pose.pose];
    const shown = cy ? cy.frames[Math.floor(Math.max(0, time - pose.at_s) * cy.hz + 1e-6) % cy.frames.length] : pose.pose;
    for (const [n, m] of a.cards) m.visible = n === shown;
    // facing: explicit per pose, else from the screen direction of travel (cards are drawn facing right)
    if (pose.face) a.facing = pose.face === "right" ? 1 : -1;
    else if (q.dir !== null && !q.keepFacing) {
      const now = q.p.clone().project(this.cam), ahead = q.p.clone().add(new THREE.Vector3(Math.sin(q.dir), 0, Math.cos(q.dir))).project(this.cam);
      if (Math.abs(ahead.x - now.x) > 1e-4) a.facing = ahead.x > now.x ? 1 : -1;
    }
    // walk: 4-7 % bob, small lean into the step, planted feel (reference character rules)
    const step = q.walking > 0 ? Math.abs(Math.sin(Math.PI * q.walking)) : 0;
    const bob = q.walking > 0 ? 0.05 * a.height * step : 0;
    a.root.position.set(q.p.x, 0, q.p.z);
    a.pivot.position.y = q.lift + bob;
    a.pivot.rotation.z = q.walking > 0 ? -a.facing * rad(3 + 2 * Math.sin(Math.PI * 2 * q.walking)) : 0;
    a.pivot.scale.set(a.facing, q.walking > 0 ? 1 - 0.03 * (1 - step) : 1, 1);
    a.root.rotation.y = Math.atan2(this.cam.position.x - q.p.x, this.cam.position.z - q.p.z); // face the lens (cylindrical billboard)
    a.blob.scale.setScalar(1 / (1 + q.lift * 0.8));
  }

  private target(id: string) {
    const t = this.things.get(id)!;
    return { t, pos: new THREE.Vector3(t.root.position.x, 0, t.root.position.z) };
  }

  private renderEffects(time: number) {
    for (const { def, card } of this.fx) {
      const u = (time - def.at_s) / def.dur_s;
      card.mesh.visible = u >= 0 && u <= 1;
      if (!card.mesh.visible) continue;
      const { t, pos } = this.target(def.on), g = card.canvas.getContext("2d")!, pen = new Pen(g);
      g.clearRect(0, 0, card.canvas.width, card.canvas.height);
      if (def.type === "burst") fxBurst(pen, u, def.color ?? "#fff3b0");
      else if (def.type === "stars") fxStars(pen, ((time - def.at_s) / 1.2) % 1);
      else fxPuff(pen, u);
      card.tex.needsUpdate = true;
      card.mesh.scale.setScalar(def.size_m);
      // effect cards sit just in front of their target (toward the lens), so the target never hides them
      const toCam = new THREE.Vector3(this.cam.position.x - pos.x, 0, this.cam.position.z - pos.z).normalize().multiplyScalar(t.radius + 0.15);
      card.mesh.position.set(pos.x + toCam.x, (def.lift_m ?? t.height * 0.55), pos.z + toCam.z);
      card.mesh.quaternion.copy(this.cam.quaternion);
    }
  }

  /** rocket rules: the hatch door swings open/closed, the landing legs unfold */
  private renderRocketParts(time: number) {
    const sm = (u: number) => { const k = clamp01(u); return k * k * (3 - 2 * k); };
    for (const t of this.things.values()) {
      if (t.hatch) { const { open_s, close_s } = t.hatch; const k = sm((time - open_s) / 0.7) * (close_s === undefined ? 1 : 1 - sm((time - close_s) / 0.7)); t.hatch.h.door.rotation.y = -1.7 * k; }
      if (t.legs) t.legs.unfold(sm((time - t.legs.deploy_s) / 0.8));
    }
  }

  /** engine flame (flickers, fades in/out) and a smoke trail: each puff stays where the object was when it was born */
  private renderThrust(time: number) {
    for (const t of this.things.values()) {
      if (!t.thrust || !t.flame) continue;
      const { from_s, to_s } = t.thrust, on = time >= from_s && time <= to_s;
      const k = on ? Math.min(1, (time - from_s) / 0.25) * Math.min(1, (to_s - time) / 0.25 + 0.2) : 0;
      t.flame.visible = on && t.root.visible;
      if (on) { const fl = 0.85 + 0.3 * Math.sin(time * 61) * Math.cos(time * 37); t.flame.scale.set(0.9 + 0.2 * Math.sin(time * 80), Math.max(0.1, k * fl), 0.9 + 0.2 * Math.cos(time * 70)); }
      (t.smoke ?? []).forEach((c, i) => {
        const life = 1.6, age = (((time - from_s - i * (life / 16)) % life) + life) % life, born = time - age;
        const vis = t.root.visible && born >= from_s && born <= to_s + 0.3 && time <= to_s + life;
        c.mesh.visible = vis; if (!vis) return;
        const u = age / life, q = this.poseAt(t, born), g = c.canvas.getContext("2d")!;
        g.clearRect(0, 0, 300, 300); fxPuff(new Pen(g), Math.min(0.999, u)); c.tex.needsUpdate = true;
        c.mesh.scale.setScalar(t.height * (0.35 + 0.8 * u));
        c.mesh.position.set(q.p.x + Math.sin(i * 2.1) * 0.5 * u * t.height * 0.3, Math.max(0.2, q.p.y + q.lift) + t.height * 0.05, q.p.z + Math.cos(i * 1.7) * 0.4 * u * t.height * 0.3);
        c.mesh.quaternion.copy(this.cam.quaternion);
      });
    }
  }

  private renderPuffs(time: number) {
    const groups = new Map<Extract<Move, { type: "move" }>, typeof this.puffs>();
    for (const p of this.puffs) { if (!groups.has(p.move)) groups.set(p.move, []); groups.get(p.move)!.push(p); }
    for (const [m, list] of groups) list.forEach((p, i) => {
      const born = m.from_s + i * 0.35, u = (((time - born) % 1.4) + 1.4) % 1.4 / 1.4;
      const on = time >= born && time <= m.to_s + 0.8;
      p.card.mesh.visible = on;
      if (!on) return;
      const q = this.poseAt(p.owner, time - u * 0.5), g = p.card.canvas.getContext("2d")!;
      g.clearRect(0, 0, 300, 300); fxPuff(new Pen(g), u); p.card.tex.needsUpdate = true;
      p.card.mesh.scale.setScalar(p.owner.height * 0.9); p.card.mesh.position.set(q.p.x, p.owner.height * 0.2, q.p.z);
      p.card.mesh.quaternion.copy(this.cam.quaternion);
    });
  }
}
