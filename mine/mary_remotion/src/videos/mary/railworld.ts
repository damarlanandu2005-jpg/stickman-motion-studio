// The Mary Celeste's world on the engine's stack: his sky / sun / fog / two-tone light rig, card characters, ink + DOF post.
// Four places (sea, wharf, cabin, map table) and four lights (grey, day, indoor, golden). OWNER: world agent (this file, lights/shade/grade), mat agent (bellset.ts).
import * as THREE from "three";
import { V } from "./build";
import { cloudHD, ctex } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, blob, railStage } from "./cast";
import { shotById, camAt, FPS, RShot, ORIGIN, driftZ, YAW } from "./bstory";
import { castAt, drawGuy } from "./railcast";
import * as S from "./maryset";

export type Kit = Record<string, THREE.Object3D>;
/** Bell needs no Kenney models: everything is built in code */
export const loadKit = () => Promise.resolve({} as Kit);

const mix = (a: LightPreset, o: Partial<LightPreset>): LightPreset => ({ ...a, ...o });
type LName = "day" | "indoor" | "grey" | "golden";
const PRES: Record<LName, LightPreset> = {
  day: mix(LIGHTS.day, { az: 70, el: 42, lit: [1.62, 1.42, 1.15], shade: [0.54, 0.5, 0.6], lift: [0.06, 0.05, 0.09], fog: "#b8cce8", fogNear: 90, fogFar: 650, sunCol: "#ffe2c0", sunI: 2.8 }),
  indoor: mix(LIGHTS.day, { az: 60, el: 50, lit: [1.5, 1.3, 1.05], shade: [0.62, 0.46, 0.42], lift: [0.08, 0.05, 0.06], fog: "#3a2418", fogNear: 200, fogFar: 900, sunCol: "#ffe0b0", sunI: 2.2 }),
  grey: mix(LIGHTS.day, { az: 70, el: 62, lit: [1.22, 1.24, 1.27], shade: [0.62, 0.66, 0.74], lift: [0.07, 0.08, 0.1], fog: "#aab4bc", fogNear: 90, fogFar: 520, sunCol: "#e8eef5", sunI: 1.5 }),
  golden: mix(LIGHTS.day, { az: 75, el: 14, lit: [1.5, 1.22, 0.9], shade: [0.6, 0.55, 0.64], lift: [0.07, 0.06, 0.09], fog: "#eab68c", fogNear: 20, fogFar: 135, sunCol: "#ffc88c", sunI: 2.4 }),
};
/** sky gradient (horizon -> zenith) per light */
const SKY: Record<LName, string[] | null> = {
  day: null, indoor: null,
  grey: ["#b4bdc4", "#aab4bc", "#a0aab2", "#98a2ac", "#929ca6"],
  golden: ["#f4c48c", "#eba378", "#cf8d86", "#9884a6", "#6a72a8"],
};
export class RailWorld {
  root = new THREE.Group();
  private pool = new Pool(); private actors: Actor[] = []; private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private skyMat: THREE.ShaderMaterial; private sky: THREE.Mesh;
  private fog = new THREE.Fog("#e6c4a8", 35, 330);
  private clouds: THREE.Mesh[] = []; private cloudMaps: THREE.Texture[];
  private sea: THREE.Group; private harbor: THREE.Group; private cabin: THREE.Group; private table: THREE.Group; private glow: THREE.Mesh;
  private mary = S.makeShip({ sail: "#efe6d0", hull: "#33262a" }); private dg = S.makeShip({ sail: "#cdbd98", hull: "#2e3a46", stripe: "#c9b88a" }); private boat = S.makeBoat();
  private shipA = S.makeShip({ sail: "#dcd2b8", hull: "#3a3030", sails: false }); private shipB = S.makeShip({ sail: "#dcd2b8", hull: "#334238", sails: false });
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
    this.sea = S.buildSea(R); this.harbor = S.buildHarbor(R); this.cabin = S.buildCabin(R); this.table = S.buildTable(R);
    this.harbor.position.set(...ORIGIN.HARBOR); this.cabin.position.set(...ORIGIN.CABIN); this.table.position.set(...ORIGIN.TABLE);
    this.dg.scale.setScalar(0.85); this.shipA.scale.setScalar(0.9); this.shipB.scale.setScalar(0.9);
    R.add(this.mary, this.dg, this.boat, this.shipA, this.shipB);
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
    const s = shotById(id), lt = s.light as LName, L = PRES[lt], K = LOOK.day, P = s.place, outdoor = P === "SEA" || P === "HARBOR";
    const c = camAt(f, id);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    this.sea.visible = P === "SEA" || P === "HARBOR"; this.harbor.visible = P === "HARBOR"; this.cabin.visible = P === "CABIN"; this.table.visible = P === "TABLE";
    // ships: the Mary Celeste in the sea (local origin) or alongside the wharf; the Dei Gratia and the boat only at sea
    const o = ORIGIN[P === "HARBOR" ? "HARBOR" : "SEA"];
    this.mary.visible = outdoor; this.mary.rotation.y = P === "SEA" ? (YAW[id] ?? 0) : 0; this.mary.position.set(o[0], o[1], o[2] + (P === "SEA" ? driftZ(f) : 0));
    this.dg.visible = P === "SEA"; this.dg.position.set(o[0] - 22, 0, o[2] - 30);
    this.boat.visible = P === "SEA"; this.boat.position.set(o[0] - 2, 0.2, o[2] + 6.3);
    this.shipA.visible = P === "HARBOR"; this.shipA.position.set(o[0] - 44, 0, o[2] + 0); this.shipB.visible = P === "HARBOR"; this.shipB.position.set(o[0] + 46, 0, o[2] - 1);
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
    const su = this.skyMat.uniforms, skyC = SKY[lt] ?? K.sky.c; skyC.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((d) => THREE.MathUtils.degToRad(d)); su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position); this.sky.visible = outdoor;
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar; scene.fog = this.fog; scene.background = outdoor ? null : new THREE.Color("#2a1810");
    this.clouds.forEach((m) => { m.visible = outdoor && lt === "day"; m.lookAt(cam.position.x, m.position.y, cam.position.z); });
    this.glow.visible = lt === "golden"; this.glow.position.copy(cam.position).addScaledVector(sunDir, 900); this.glow.quaternion.copy(cam.quaternion); this.glow.scale.set(300, 300, 1);
    (this.glow.material as THREE.MeshBasicMaterial).color.set("#fff4dc").multiplyScalar(0.9);
    // ---- cast ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const info = { pos: cam.position, right };
    const stg = railStage("day", info);
    for (const g of castAt(f)) { const p = drawGuy(g, info, f); stg.places.push(p); blob(stg, p.x, p.y, p.z, g.scale ?? 1); }
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
