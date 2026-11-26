'use client';

// Real 3D's character rig (docs/specs/008-canvas/3d-engine.md "Characters"): a character's parts (lib/real-3d/
// character.ts) hung on joints, posed every frame from what the walker says it is doing: a smooth walk cycle while it
// walks, sat on a seat, a raised flag, a cup in hand, and each reaction's arms and legs. Only the joints' angles change
// per frame; the geometry is built once per look and shared by everyone who wears it.

import * as THREE from 'three';
import {
  BODY,
  characterParts,
  type CharacterPart,
  type CharacterLook,
} from '@/lib/real-3d/character';
import type { MeshBuilder } from '@/lib/real-3d/mesh-builder';
import { SEAT_Z } from '@/lib/real-3d/models/kit';

/** What a walker says its character is doing (AvatarWalker's `data-figure`). */
export type WalkerPose = RigPose & {
  facing: 'down' | 'up' | 'left' | 'right';
  config: unknown;
  shirt?: string;
};

/** What the rig poses from. */
export type RigPose = {
  walking: boolean;
  seated: boolean;
  lift: number;
  wave: number | null;
  holding: unknown;
  pose: {
    armsOut?: boolean;
    armsUp?: boolean;
    waveArm?: boolean;
    legsApart?: boolean;
  } | null;
};

type Geometries = Record<
  'torso' | 'armL' | 'armR' | 'thighL' | 'thighR' | 'shinL' | 'shinR',
  THREE.BufferGeometry
> & { skirt: THREE.BufferGeometry | null };

function geometryOf(b: MeshBuilder): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.colours, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
  return g;
}

/** Each look's geometries, built once and kept (bounded, oldest out). */
export class CharacterKit {
  private readonly built = new Map<string, Geometries>();
  /** A lit material for characters drawn outside a scene's own (the model sheet). */
  readonly material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  private readonly cap: number;
  constructor(cap = 48) {
    this.cap = cap;
  }

  geometries(key: string, look: CharacterLook): Geometries {
    const have = this.built.get(key);
    if (have) return have;
    const p = characterParts(look);
    const g: Geometries = {
      torso: geometryOf(p.torso.mesh),
      armL: geometryOf(p.armL.mesh),
      armR: geometryOf(p.armR.mesh),
      thighL: geometryOf(p.thighL.mesh),
      thighR: geometryOf(p.thighR.mesh),
      shinL: geometryOf(p.shinL.mesh),
      shinR: geometryOf(p.shinR.mesh),
      skirt: p.skirt ? geometryOf(p.skirt.mesh) : null,
    };
    this.built.set(key, g);
    if (this.built.size > this.cap) {
      const first = this.built.keys().next().value as string;
      const old = this.built.get(first);
      this.built.delete(first);
      if (old) dispose(old);
    }
    return g;
  }

  dispose(): void {
    for (const g of this.built.values()) dispose(g);
    this.built.clear();
  }
}

function dispose(g: Geometries): void {
  for (const v of Object.values(g)) v?.dispose();
}

const PIVOTS = characterParts({});

const at = (p: CharacterPart) => new THREE.Vector3(p.pivot[0], p.pivot[1], p.pivot[2]);

/** One character's joints, in sprite pixels (its group is scaled to canvas px). */
export class CharacterRig {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly hips = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly kneeL = new THREE.Group();
  private readonly kneeR = new THREE.Group();
  private readonly skirtJoint = new THREE.Group();
  private readonly prop = new THREE.Group();
  private meshes: THREE.Mesh[] = [];
  private key = '';
  private phase = 0;
  private swing = 0;

  private readonly material: THREE.Material;
  constructor(material: THREE.Material) {
    this.material = material;
    this.root.add(this.body);
    this.body.add(this.hips, this.legL, this.legR, this.skirtJoint);
    this.hips.position.copy(at(PIVOTS.torso));
    this.armL.position.copy(at(PIVOTS.armL));
    this.armR.position.copy(at(PIVOTS.armR));
    this.hips.add(this.armL, this.armR);
    this.legL.position.copy(at(PIVOTS.thighL));
    this.legR.position.copy(at(PIVOTS.thighR));
    this.kneeL.position.copy(at(PIVOTS.shinL));
    this.kneeR.position.copy(at(PIVOTS.shinR));
    this.legL.add(this.kneeL);
    this.legR.add(this.kneeR);
    this.skirtJoint.position.set(0, 0, BODY.hip);
    this.armR.add(this.prop);
    this.prop.position.set(0, 0, -BODY.arm - 0.4);
  }

  /** Dresses the rig in a look's geometries (only when the look changes). */
  wear(key: string, g: Geometries): void {
    if (key === this.key) return;
    this.key = key;
    for (const m of this.meshes) m.parent?.remove(m);
    const mesh = (geo: THREE.BufferGeometry, parent: THREE.Object3D) => {
      const m = new THREE.Mesh(geo, this.material);
      m.castShadow = true;
      m.frustumCulled = false;
      parent.add(m);
      this.meshes.push(m);
    };
    this.meshes = [];
    mesh(g.torso, this.hips);
    mesh(g.armL, this.armL);
    mesh(g.armR, this.armR);
    mesh(g.thighL, this.legL);
    mesh(g.thighR, this.legR);
    mesh(g.shinL, this.kneeL);
    mesh(g.shinR, this.kneeR);
    if (g.skirt) mesh(g.skirt, this.skirtJoint);
  }

  private cup: THREE.Object3D | null = null;
  private flag: THREE.Object3D | null = null;

  /** Holds a prop in the right hand: a cup, a flag, or nothing (each made the first time it is held). */
  hold(what: 'cup' | 'flag' | null): void {
    if (what === 'cup') this.cup ??= cupProp();
    if (what === 'flag') this.flag ??= flagProp();
    const want = what === 'cup' ? this.cup : what === 'flag' ? this.flag : null;
    if ((this.prop.children[0] ?? null) === want) return;
    this.prop.clear();
    if (want) this.prop.add(want);
  }

  /**
   * Poses the joints for this frame. `dt` is the seconds since the last frame; `unit` the canvas px per sprite
   * pixel, for the seat's height.
   */
  pose(p: RigPose, dt: number, unit: number, now: number): void {
    const r = p.pose;
    // The walk cycle runs while walking and eases back to standing when it stops.
    const target = p.walking && !p.seated ? 1 : 0;
    this.swing += (target - this.swing) * Math.min(1, dt * 10);
    if (this.swing > 0.01) this.phase += dt * Math.PI * 2 * 1.9;
    else this.phase = 0;
    const s = Math.sin(this.phase) * this.swing;
    const bob = Math.abs(Math.cos(this.phase)) * this.swing * 0.35;
    // Legs: the stride, or sat with thighs forward and shins down, or apart for a jumping jack.
    let hipL = s * 0.55;
    let hipR = -s * 0.55;
    let kneeL = Math.max(0, -Math.sin(this.phase + 0.9)) * 0.7 * this.swing;
    let kneeR = Math.max(0, Math.sin(this.phase + 0.9)) * 0.7 * this.swing;
    let spread = 0;
    this.body.position.set(0, 0, bob);
    this.hips.rotation.set(0, 0, 0);
    if (p.seated) {
      hipL = hipR = Math.PI / 2;
      kneeL = kneeR = -Math.PI / 2;
      // Hips at the seat's height, feet on the seat's spot.
      const seat = SEAT_Z / unit;
      this.body.position.set(0, -BODY.thigh, seat - BODY.hip);
      this.hips.rotation.x = -0.05;
    } else if (r?.legsApart) spread = 0.32;
    this.legL.rotation.set(hipL, -spread, 0);
    this.legR.rotation.set(hipR, spread, 0);
    this.kneeL.rotation.x = -kneeL;
    this.kneeR.rotation.x = -kneeR;
    // Arms: swinging opposite the legs, or the reaction's, or holding up a flag or a cup.
    let armL = new THREE.Euler(-s * 0.6, 0, 0);
    let armR = new THREE.Euler(s * 0.6, 0, 0);
    if (p.seated) {
      armL = new THREE.Euler(0.55, 0, 0.1);
      armR = new THREE.Euler(0.55, 0, -0.1);
    }
    if (r?.armsUp) {
      armL = new THREE.Euler(0, 2.75, 0);
      armR = new THREE.Euler(0, -2.75, 0);
    } else if (r?.armsOut) {
      armL = new THREE.Euler(0, 1.45, 0);
      armR = new THREE.Euler(0, -1.45, 0);
    }
    if (r?.waveArm) armR = new THREE.Euler(0, -2.55 + Math.sin(now * 0.012) * 0.35, 0);
    if (p.wave !== null) armR = new THREE.Euler(0, -2.7, 0);
    else if (p.holding && !r) armR = new THREE.Euler(0.95, 0, -0.08);
    this.armL.rotation.copy(armL);
    this.armR.rotation.copy(armR);
  }
}

/** A cup held in the hand: a mug with a handle. */
export function cupProp(colour = 0xf8fafc): THREE.Object3D {
  const g = new THREE.Group();
  const mug = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 0.95, 2.2, 14),
    new THREE.MeshLambertMaterial({ color: colour }),
  );
  mug.rotation.x = Math.PI / 2;
  mug.position.set(0, 1.2, -0.4);
  mug.castShadow = true;
  g.add(mug);
  return g;
}

/** A flag held up: a pole and a red cloth that ripples. */
export function flagProp(): THREE.Object3D {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 11, 8),
    new THREE.MeshLambertMaterial({ color: 0xb8845a }),
  );
  pole.rotation.x = Math.PI / 2;
  pole.position.set(0, 0, -3.5);
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 3.4, 6, 1),
    new THREE.MeshLambertMaterial({ color: 0xf43f5e, side: THREE.DoubleSide }),
  );
  cloth.rotation.x = Math.PI / 2;
  cloth.position.set(-2.6, 0, -7.6);
  cloth.castShadow = true;
  g.add(pole, cloth);
  return g;
}
