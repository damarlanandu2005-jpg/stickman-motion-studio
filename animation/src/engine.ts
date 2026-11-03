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
import { Pen, fxBurst, fxStars, fxPuff } from "../reference/toon";
import { Scene, Move, XZ, XYZ, PhysicsTracks } from "./scene";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smoother = (x: number) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };
const easeIO = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const rad = (d: number) => (d * Math.PI) / 180;
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

type Thing = { id: string; root: THREE.Group; base: THREE.Vector3; baseYaw: number; moves: Move[]; radius: number; height: number; forward: number };
type Actor = Thing & { cards: Map<string, THREE.Mesh>; pivot: THREE.Group; poses: Scene["characters"][0]["poses"]; facing: number; blob: THREE.Mesh };
type FxCard = { mesh: THREE.Mesh; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture };

export class Engine {
  readonly warnings: string[] = [];
  private s: Scene; private w: number; private h: number;
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private cam: THREE.PerspectiveCamera;
  private composer!: EffectComposer; private sun!: THREE.DirectionalLight;
  private things = new Map<string, Thing>(); private actors: Actor[] = [];
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
    const fwd = new THREE.Vector3(l0[0] - c0.pos[0], 0, l0[2] - c0.pos[2]).normalize();
    const sd = fwd.applyAxisAngle(new THREE.Vector3(0, 1, 0), -rad(L.az)).multiplyScalar(Math.cos(rad(L.el)));
    sd.y = Math.sin(rad(L.el)); this.sun.position.copy(sd.multiplyScalar(60)); this.sun.target.position.set(0, 0, 0);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), twoTone(new THREE.MeshLambertMaterial({ color: env.ground })));
    ground.receiveShadow = true; this.scene.add(ground);

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
      const box = new THREE.Box3().setFromObject(inner), size = box.getSize(new THREE.Vector3());
      inner.scale.setScalar(a.height_m / size.y);
      const b2 = new THREE.Box3().setFromObject(inner), c = b2.getCenter(new THREE.Vector3());
      inner.position.set(-c.x, -b2.min.y, -c.z);
      const root = new THREE.Group(); root.add(inner); this.scene.add(root);
      const sz = b2.getSize(new THREE.Vector3());
      const t: Thing = { id: o.id, root, base: new THREE.Vector3(o.at[0], 0, o.at[1]), baseYaw: rad(o.turn_deg ?? 0), moves: o.moves ?? [],
        radius: Math.max(sz.x, sz.z) / 2, height: a.height_m, forward: rad(a.forward_deg ?? 0) };
      this.things.set(o.id, t);
      for (const m of t.moves) if (m.type === "move" && m.dust) for (let i = 0; i < 4; i++) this.puffs.push({ card: this.fxCard(300, 300), owner: t, move: m });
    }

    // characters: one lit, ink-free billboard card per pose (scale fixed by the first pose's card)
    for (const ch of s.characters) {
      const names = [...new Set(ch.poses.map((p) => p.pose))];
      const texLoader = new THREE.TextureLoader(), cards = new Map<string, THREE.Mesh>();
      let pxPerM = 0;
      for (const n of names) {
        const tex = await texLoader.loadAsync(base + ch.cards.replace("{pose}", n));
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
      const a: Actor = { id: ch.id, root, pivot, cards, blob, poses: ch.poses, facing: 1, base: new THREE.Vector3(ch.at[0], 0, ch.at[1]), baseYaw: 0,
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
    const list = [...this.things.values()].filter((t) => !(t as Actor).cards && !dropped.has(t.id));
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j], d = Math.hypot(a.base.x - b.base.x, a.base.z - b.base.z);
      if (d < a.radius + b.radius) this.warnings.push(`${a.id} and ${b.id} overlap at their start positions (${d.toFixed(2)} m apart)`);
    }
  }

  /** position, yaw and extra lift of a thing at time t, from its moves */
  private poseAt(t: Thing, time: number) {
    const p = t.base.clone(); let yaw = t.baseYaw, lift = 0, dir: number | null = null, walking = 0, keepFacing = false;
    for (const m of t.moves) {
      if (time < m.from_s) continue;
      const u = clamp01((time - m.from_s) / (m.to_s - m.from_s)), active = time <= m.to_s;
      if (m.type === "move" || m.type === "walk" || m.type === "hop") {
        const k = m.type === "walk" ? u : easeIO(u), from = p.clone(), to = new THREE.Vector3(m.to[0], 0, m.to[1]);
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

  private cameraAt(time: number) {
    const k = this.s.camera; let i = 0;
    while (i < k.length - 2 && time >= k[i + 1].at_s) i++;
    const a = k[i], b = k[Math.min(i + 1, k.length - 1)];
    const u = b.cut ? (time >= b.at_s ? 1 : 0) : smoother((time - a.at_s) / Math.max(1e-6, b.at_s - a.at_s));
    const L = (x: number[], y: number[]) => new THREE.Vector3(x[0] + (y[0] - x[0]) * u, x[1] + (y[1] - x[1]) * u, x[2] + (y[2] - x[2]) * u);
    return { pos: L(a.pos, b.pos), look: L(this.lookPoint(a.look, time), this.lookPoint(b.look, time)), fov: a.fov + (b.fov - a.fov) * u };
  }

  /** a fixed look point, or a followed thing's current position plus an offset */
  private lookPoint(look: Scene["camera"][0]["look"], time: number): number[] {
    if (Array.isArray(look)) return look;
    const q = this.poseAt(this.things.get(look.follow)!, time), o = look.offset ?? [0, 1, 0];
    return [q.p.x + o[0], q.lift + o[1], q.p.z + o[2]];
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

    for (const t of this.things.values()) {
      if ((t as Actor).cards) continue;
      const q = this.poseAt(t, time);
      const tr = this.tracks[t.id];
      if (tr) {
        const k = tr[Math.min(frame, tr.length - 1)];
        t.root.position.set(k[0], k[1], k[2]); t.root.quaternion.set(k[3], k[4], k[5], k[6]);
        continue;
      }
      t.root.position.set(q.p.x, q.lift, q.p.z); t.root.rotation.y = q.yaw;
    }
    for (const a of this.actors) this.renderActor(a, time);
    this.renderPuffs(time);
    this.renderEffects(time);
    this.composer.render();
  }

  private renderActor(a: Actor, time: number) {
    const q = this.poseAt(a, time);
    let pose = a.poses[0];
    for (const k of a.poses) if (time >= k.at_s) pose = k;
    for (const [n, m] of a.cards) m.visible = n === pose.pose;
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
