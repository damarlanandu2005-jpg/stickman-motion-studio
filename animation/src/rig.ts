// 3D stickman: ONE skeleton, drawn in the reference ink/toon look, with a costume that is just a layer of parts bound to
// the bones (like clothes). The face is a fixed texture on the head; it only changes when the scene asks for it.
// Conventions: the body faces +z, up is +y, the character's left side is +x. Pose angles are in radians:
//   hip/shoulder "forward" and elbow/knee "flex" are positive when the limb swings forward / bends the usual way,
//   "abd" lifts an arm or leg sideways away from the body, spine/hips pitch is positive when leaning forward.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { twoTone } from "../reference/shade";
import { NOINK } from "../reference/ink";

export type Pose = Record<string, number>;

export const HIP_H = 0.92;          // hips height above the ground in a straight stance (metres, for a 1.9 m figure)
export const FIGURE_H = 1.9;

type Bone = "torso" | "head" | "arm" | "fore" | "thigh" | "shin" | "foot";
export type Part = { bone: Bone; shape: "capsule" | "sphere" | "box" | "torus" | "cyl"; size: number[]; at: [number, number, number];
  rot?: [number, number, number]; color: string; opacity?: number; mirror?: boolean; noink?: boolean };

/** A costume is plain data: which shapes sit on which bones. Swap the list to dress him differently. */
export const COSTUMES: Record<string, Part[]> = {
  none: [],
  astronaut: [
    // torso: suit, belt, chest panel, backpack, neck ring
    { bone: "torso", shape: "capsule", size: [0.19, 0.18], at: [0, 0.21, 0], color: "#f3f1ea" },
    { bone: "torso", shape: "torus", size: [0.19, 0.03], at: [0, 0.03, 0], rot: [Math.PI / 2, 0, 0], color: "#7d818c" },
    { bone: "torso", shape: "box", size: [0.08, 0.045, 0.03], at: [0, 0.03, 0.2], color: "#f2a81d" },
    { bone: "torso", shape: "box", size: [0.17, 0.12, 0.03], at: [0, 0.31, 0.185], color: "#e8e5dc" },
    { bone: "torso", shape: "box", size: [0.055, 0.055, 0.02], at: [-0.04, 0.31, 0.205], color: "#2f6fd6" },
    { bone: "torso", shape: "sphere", size: [0.016], at: [0.035, 0.335, 0.205], color: "#d9342b" },
    { bone: "torso", shape: "sphere", size: [0.016], at: [0.035, 0.29, 0.205], color: "#d9342b" },
    { bone: "torso", shape: "box", size: [0.34, 0.44, 0.16], at: [0, 0.27, -0.25], color: "#9a9ea8" },
    { bone: "torso", shape: "torus", size: [0.14, 0.04], at: [0, 0.46, 0], rot: [Math.PI / 2, 0, 0], color: "#f3f1ea" },
    // head: glass helmet bubble + ear pods
    { bone: "head", shape: "sphere", size: [0.37], at: [0, 0.25, 0], color: "#bfe3ff", opacity: 0.3, noink: true },
    { bone: "head", shape: "cyl", size: [0.06, 0.08], at: [0.37, 0.25, 0], rot: [0, 0, Math.PI / 2], color: "#9a9ea8", mirror: true },
    // arms: shoulder pad, sleeves, bands, gloves
    { bone: "arm", shape: "sphere", size: [0.1], at: [0, 0, 0], color: "#f3f1ea", mirror: true },
    { bone: "arm", shape: "capsule", size: [0.072, 0.2], at: [0, -0.14, 0], color: "#f3f1ea", mirror: true },
    { bone: "arm", shape: "torus", size: [0.074, 0.018], at: [0, -0.255, 0], rot: [Math.PI / 2, 0, 0], color: "#7d818c", mirror: true },
    { bone: "fore", shape: "capsule", size: [0.066, 0.18], at: [0, -0.14, 0], color: "#f3f1ea", mirror: true },
    { bone: "fore", shape: "torus", size: [0.068, 0.018], at: [0, -0.255, 0], rot: [Math.PI / 2, 0, 0], color: "#7d818c", mirror: true },
    { bone: "fore", shape: "sphere", size: [0.1], at: [0, -0.325, 0], color: "#26262c", mirror: true },
    // legs: suit, knee pads, boots
    { bone: "thigh", shape: "capsule", size: [0.1, 0.28], at: [0, -0.22, 0], color: "#f3f1ea", mirror: true },
    { bone: "shin", shape: "capsule", size: [0.09, 0.28], at: [0, -0.22, 0], color: "#f3f1ea", mirror: true },
    { bone: "shin", shape: "box", size: [0.15, 0.11, 0.04], at: [0, -0.03, 0.085], color: "#7d818c", mirror: true },
    { bone: "foot", shape: "box", size: [0.17, 0.12, 0.33], at: [0, -0.02, 0.08], color: "#f3f1ea", mirror: true },
    { bone: "foot", shape: "box", size: [0.18, 0.045, 0.34], at: [0, -0.09, 0.08], color: "#6c707b", mirror: true },
  ],
};

const FACES: Record<string, (g: CanvasRenderingContext2D) => void> = {
  neutral: (g) => { eye(g, 78, 108, 19, 30); eye(g, 178, 108, 19, 30); line(g, 100, 184, 156, 184, 13); },
  smile: (g) => { eye(g, 78, 108, 19, 30); eye(g, 178, 108, 19, 30); arc(g, 128, 150, 44, 0.25, 0.75, 13); },
  surprised: (g) => { eye(g, 84, 98, 18, 26); eye(g, 172, 98, 18, 26); g.fillStyle = "#241726"; g.beginPath(); g.ellipse(128, 174, 16, 22, 0, 0, 7); g.fill(); },
  worried: (g) => { eye(g, 88, 104, 9, 13); eye(g, 168, 104, 9, 13); line(g, 70, 76, 104, 86, 6); line(g, 186, 76, 152, 86, 6); arc(g, 128, 176, 24, 1.15, 1.85, 7); },
  dizzy: (g) => { for (const x of [88, 168]) { g.strokeStyle = "#241726"; g.lineWidth = 7; g.beginPath(); g.arc(x, 100, 13, 0, 5.5); g.stroke(); } line(g, 108, 166, 148, 166, 7); },
};
const eye = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) => { g.fillStyle = "#241726"; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
const line = (g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number) => { g.strokeStyle = "#241726"; g.lineWidth = w; g.lineCap = "round"; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
const arc = (g: CanvasRenderingContext2D, cx: number, cy: number, r: number, a0: number, a1: number, w: number) => { g.strokeStyle = "#241726"; g.lineWidth = w; g.lineCap = "round"; g.beginPath(); g.arc(cx, cy, r, Math.PI * a0, Math.PI * a1); g.stroke(); };
export const EXPRESSIONS = Object.keys(FACES);

const grp = (parent: THREE.Object3D, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const INKCOL = "#1b1b22", SKIN = "#fbfaf6";

export class Rig {
  readonly root = new THREE.Group();          // yaw + position of the feet
  readonly figure = new THREE.Group();        // uniform scale
  readonly hips: THREE.Group; readonly torso: THREE.Group; readonly head: THREE.Group;
  readonly arm: THREE.Group[]; readonly fore: THREE.Group[]; readonly thigh: THREE.Group[]; readonly shin: THREE.Group[]; readonly foot: THREE.Group[];
  private faceTex: THREE.CanvasTexture; private faceG: CanvasRenderingContext2D; private expr = "";
  private readonly scale: number;

  constructor(costume: Part[], heightM: number, face = "neutral") {
    this.scale = heightM / FIGURE_H;
    this.figure.scale.setScalar(this.scale);
    this.root.add(this.figure);
    this.hips = grp(this.figure, 0, HIP_H);
    this.torso = grp(this.hips);
    this.head = grp(this.torso, 0, 0.46);
    // sides: index 0 = left (+x), index 1 = right (-x)
    this.arm = [0, 1].map((i) => grp(this.torso, i ? -0.2 : 0.2, 0.42));
    this.fore = this.arm.map((a) => grp(a, 0, -0.28));
    this.thigh = [0, 1].map((i) => grp(this.hips, i ? -0.09 : 0.09, 0));
    this.shin = this.thigh.map((t) => grp(t, 0, -0.44));
    this.foot = this.shin.map((s) => grp(s, 0, -0.44));

    const mat = (c: string, opacity?: number, noink = false) => {
      const m = twoTone(new THREE.MeshLambertMaterial({ color: c, transparent: opacity !== undefined, opacity: opacity ?? 1, depthWrite: opacity === undefined }));
      return m;
    };
    const add = (bone: THREE.Object3D, geo: THREE.BufferGeometry, color: string, at: number[], rot?: number[], opacity?: number, noink = false) => {
      const m = new THREE.Mesh(geo, mat(color, opacity)); m.position.set(at[0], at[1], at[2]);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      m.castShadow = opacity === undefined; if (noink) m.layers.set(NOINK); bone.add(m); return m;
    };
    // the bare stickman underneath: thin ink-black limbs, white round head
    add(this.torso, new THREE.CapsuleGeometry(0.035, 0.4, 4, 8), INKCOL, [0, 0.23, 0]);
    this.arm.forEach((a) => add(a, new THREE.CapsuleGeometry(0.03, 0.22, 4, 8), INKCOL, [0, -0.14, 0]));
    this.fore.forEach((f) => { add(f, new THREE.CapsuleGeometry(0.03, 0.22, 4, 8), INKCOL, [0, -0.14, 0]); add(f, new THREE.SphereGeometry(0.058, 14, 10), INKCOL, [0, -0.3, 0]); });
    this.thigh.forEach((t) => add(t, new THREE.CapsuleGeometry(0.032, 0.38, 4, 8), INKCOL, [0, -0.22, 0]));
    this.shin.forEach((s) => add(s, new THREE.CapsuleGeometry(0.032, 0.38, 4, 8), INKCOL, [0, -0.22, 0]));
    this.foot.forEach((f) => add(f, new THREE.CapsuleGeometry(0.036, 0.16, 4, 8), INKCOL, [0, -0.03, 0.06], [Math.PI / 2, 0, 0]));
    add(this.head, new THREE.SphereGeometry(0.27, 32, 22), SKIN, [0, 0.25, 0]);

    // face: a thin shell on the front of the head carrying the fixed face texture
    const c = document.createElement("canvas"); c.width = c.height = 256;
    this.faceG = c.getContext("2d")!; this.faceTex = new THREE.CanvasTexture(c); this.faceTex.colorSpace = THREE.SRGBColorSpace;
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2725, 24, 16, Math.PI / 2 - 0.62, 1.24, Math.PI / 2 - 0.5, 1.0),
      new THREE.MeshBasicMaterial({ map: this.faceTex, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
    shell.position.set(0, 0.25, 0); shell.layers.set(NOINK); shell.renderOrder = 2; this.head.add(shell);
    this.setExpression(face);

    // costume layer
    for (const p of costume) {
      const sides = p.mirror ? [0, 1] : [-1];
      for (const s of sides) {
        const bone = this.bone(p.bone, s);
        const geo = p.shape === "capsule" ? new THREE.CapsuleGeometry(p.size[0], p.size[1], 6, 14)
          : p.shape === "sphere" ? new THREE.SphereGeometry(p.size[0], 20, 14)
          : p.shape === "box" ? new RoundedBoxGeometry(p.size[0], p.size[1], p.size[2], 3, Math.min(...p.size) * 0.3)
          : p.shape === "torus" ? new THREE.TorusGeometry(p.size[0], p.size[1], 10, 28)
          : new THREE.CylinderGeometry(p.size[0], p.size[0], p.size[1], 16);
        const at: [number, number, number] = [...p.at];
        if (p.mirror && (p.bone === "torso" || p.bone === "head") && s === 1) at[0] = -at[0];
        add(bone, geo, p.color, at, p.rot, p.opacity, p.noink);
      }
    }
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = false; });
  }

  private bone(b: Bone, side: number): THREE.Object3D {
    const i = side < 0 ? 0 : side;
    return { torso: this.torso, head: this.head, arm: this.arm[i], fore: this.fore[i], thigh: this.thigh[i], shin: this.shin[i], foot: this.foot[i] }[b];
  }

  setExpression(name: string) {
    const n = FACES[name] ? name : "neutral";
    if (n === this.expr) return;
    this.expr = n;
    const g = this.faceG; g.clearRect(0, 0, 256, 256); FACES[n](g); this.faceTex.needsUpdate = true;
  }

  /** put the skeleton in a pose; missing keys are 0 (straight standing stance) */
  apply(p: Pose) {
    const v = (k: string) => p[k] ?? 0;
    this.hips.position.y = HIP_H + v("hipsY");
    this.hips.rotation.set(v("pitch"), v("turn"), v("roll"), "YXZ");     // whole body about the hips; + pitch = leans forward
    this.torso.rotation.set(v("spineX"), v("spineY"), v("spineZ"));
    this.head.rotation.set(v("headX"), v("headY"), v("headZ"));
    for (const i of [0, 1]) {
      const s = i ? "R" : "L", sign = i ? -1 : 1;
      this.arm[i].rotation.set(-v(s + "ShX"), 0, sign * v(s + "Abd"), "XYZ");
      this.fore[i].rotation.set(-v(s + "El"), 0, 0);
      this.thigh[i].rotation.set(-v(s + "Hip"), 0, sign * v(s + "HipAbd"));
      this.shin[i].rotation.set(v(s + "Knee"), 0, 0);
      this.foot[i].rotation.set(-v(s + "Ank"), 0, 0);
    }
  }

  /** lowest point of the body above/below the ground plane (world y, metres). Needs fresh matrices. */
  lowestPoint(): number {
    this.root.updateMatrixWorld(true);
    const tmp = new THREE.Vector3(); let low = Infinity;
    const probe = (o: THREE.Object3D, x: number, y: number, z: number, r: number) => { tmp.set(x, y, z); o.localToWorld(tmp); low = Math.min(low, tmp.y - r * this.scale); };
    for (const i of [0, 1]) {
      probe(this.foot[i], 0, -0.115, 0.22, 0.0); probe(this.foot[i], 0, -0.115, -0.08, 0.0);
      probe(this.fore[i], 0, -0.3, 0, 0.1);        // hands
      probe(this.fore[i], 0, 0, 0, 0.06);            // elbows
      probe(this.shin[i], 0, 0, 0, 0.09);            // knees
    }
    probe(this.hips, 0, 0, 0, 0.19);                 // seat
    probe(this.torso, 0, 0.26, -0.33, 0.0);          // back of the backpack
    probe(this.torso, 0.2, 0.42, 0, 0.1); probe(this.torso, -0.2, 0.42, 0, 0.1);  // shoulders
    probe(this.head, 0, 0.25, 0, 0.36);               // helmet
    return low;
  }
}
