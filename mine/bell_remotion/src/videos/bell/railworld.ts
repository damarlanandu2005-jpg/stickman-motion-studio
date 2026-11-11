// Bell's world on the engine's stack: his sky / sun / fog / two-tone light rig, card characters, ink + DOF post.
// One workshop (indoor light) + one town street (day light). OWNER: world agent (this file, lights/shade/grade), mat agent (bellset.ts).
import * as THREE from "three";
import { V } from "./build";
import { cloudHD, ctex } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, blob, railStage } from "./cast";
import { shotById, camAt, FPS, RShot, STATE } from "./bstory";
import { castAt, drawGuy, fxAt, receiverAt, wireEndAt } from "./railcast";
import * as S from "./bellset";

export type Kit = Record<string, THREE.Object3D>;
/** Bell needs no Kenney models: everything is built in code */
export const loadKit = () => Promise.resolve({} as Kit);

const mix = (a: LightPreset, o: Partial<LightPreset>): LightPreset => ({ ...a, ...o });
const PRES: Record<"day" | "indoor", LightPreset> = {
  day: mix(LIGHTS.day, { az: 70, el: 42, lit: [1.62, 1.42, 1.15], shade: [0.44, 0.42, 0.62], lift: [0.05, 0.05, 0.11], fog: "#b8cce8", fogNear: 70, fogFar: 650, sunCol: "#ffe2c0", sunI: 2.8 }),
  indoor: mix(LIGHTS.day, { az: 60, el: 50, lit: [1.5, 1.3, 1.05], shade: [0.62, 0.46, 0.42], lift: [0.08, 0.05, 0.06], fog: "#3a2418", fogNear: 200, fogFar: 900, sunCol: "#ffe0b0", sunI: 2.2 }),
};
export class RailWorld {
  root = new THREE.Group();
  private pool = new Pool(); private actors: Actor[] = []; private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private skyMat: THREE.ShaderMaterial; private sky: THREE.Mesh;
  private fog = new THREE.Fog("#e6c4a8", 35, 330);
  private clouds: THREE.Mesh[] = []; private cloudMaps: THREE.Texture[];
  private shop: THREE.Group; private town: THREE.Group; private glow: THREE.Mesh;
  private jar = S.makeJar(); private puddle = S.makePuddle(); private wire = S.makeWire(); private receiver = S.makeReceiver();
  private frustum = new THREE.Frustum(); private m4 = new THREE.Matrix4();
  private sunCache = new Map<number, THREE.Vector3>();

  constructor(_kit: Kit) {
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
    this.cloudMaps = [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud));
    ([[-80, 95, -380, 220], [120, 130, -450, 260], [-260, 110, -330, 200], [20, 170, -560, 300], [300, 120, -300, 220], [-420, 140, -90, 240], [440, 150, -120, 260]] as number[][]).forEach(([x, y, z, w], i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), new THREE.MeshBasicMaterial({ map: this.cloudMaps[i % 4], transparent: true, depthWrite: false, fog: false }));
      m.position.set(x, y, z); m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    });
    const gl = ctex("sunGlow", 256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 2, 128, 128, 126); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.12, "rgba(255,255,255,0.9)"); gr.addColorStop(0.3, "rgba(255,255,255,0.28)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); });
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: gl, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.glow.layers.set(NOINK); R.add(this.glow);
    this.shop = S.buildWorkshop(R); this.town = S.buildTown(R);
    R.add(this.jar, this.puddle, this.wire, this.receiver);
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
    const s = shotById(id), lt = s.light, L = PRES[lt], K = LOOK.day, shop = s.place === "WORKSHOP";
    const c = camAt(f, id), st = STATE(f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    this.shop.visible = shop; this.town.visible = !shop;
    this.jar.visible = shop; this.puddle.visible = shop && st.puddle > 0; this.wire.visible = shop;
    const sunDir = this.shotSun(s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 9, 14, 95);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera; sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(0.04, 0.015, 0); TONE.uSat.value = 1.12;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad; CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    const su = this.skyMat.uniforms; K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((d) => THREE.MathUtils.degToRad(d)); su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position); this.sky.visible = !shop;
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar; scene.fog = this.fog; scene.background = shop ? new THREE.Color("#2a1810") : null;
    this.clouds.forEach((m) => { m.visible = !shop; m.lookAt(cam.position.x, m.position.y, cam.position.z); });
    this.glow.visible = !shop; this.glow.position.copy(cam.position).addScaledVector(sunDir, 900); this.glow.quaternion.copy(cam.quaternion); this.glow.scale.set(300, 300, 1);
    (this.glow.material as THREE.MeshBasicMaterial).color.set("#fff4dc").multiplyScalar(0.9);
    // ---- the spill: jar tips toward +x and empties onto the bench, the puddle grows ----
    const th = st.jarTip * (Math.PI / 2);
    this.jar.position.set(S.JAR0.x + 0.12 * st.jarTip, S.BENCH_Y + 0.17 * Math.sin(th), S.JAR0.z); this.jar.rotation.set(0, 0, -th);
    this.puddle.position.set(S.JAR0.x + 0.12 + 0.47, S.BENCH_Y + 0.012, S.JAR0.z); this.puddle.scale.set(0.05 + 0.5 * st.puddle, 1, 0.05 + 0.38 * st.puddle);
    // ---- cast + receiver + wire ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const info = { pos: cam.position, right };
    const rp = shop ? receiverAt(f, right) : null; this.receiver.visible = !!rp;
    const we = S.WIRE_START, fe = wireEndAt(f);
    const pts: S.V3[] = [we, [0.3, 1.14, -3.95], [0.78, 1.14, -3.9], [0.9, 0.55, -3.98], [1.0, 0.03, -4.05], [2.4, 0.03, -4.2], [4.3, 0.03, -4.1], [fe[0], 0.03, fe[2]]];
    if (rp) { pts.push([fe[0] - 0.05, 0.5, fe[2] + 0.1], [rp[0] - 0.05, rp[1] - 0.45, rp[2] + 0.02], rp); this.receiver.position.set(rp[0], rp[1], rp[2]); this.receiver.rotation.set(0, 0, 0); }
    if (shop) S.setWire(this.wire, pts);
    const stg = railStage("day", info);
    for (const g of castAt(f)) { const p = drawGuy(g, info, f); stg.places.push(p); blob(stg, g.x, g.y ?? 0, g.z, g.scale ?? 1); }
    for (const x of fxAt(f, cam.position)) stg.fx.push(x);
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
    void FPS;
    return focus;
  }
}
