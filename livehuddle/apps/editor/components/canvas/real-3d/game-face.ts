'use client';

// Real 3D's game characters' faces (docs/specs/008-canvas/3d-engine.md "Characters"): the packs' heads draw each eye
// as a small dark slit and have no mouth, so a face is laid over them: eyes with a white, an iris in the look's eye
// colour, a pupil, a catchlight and a lash line; a nose; a smiling mouth with a lower lip. Each feature sits on the
// head's own surface (found once per head by casting onto its skin), carried by the Head bone.

import * as THREE from 'three';
import { markFigure } from './figure-mark';

/** A feature's place on the face, in the head mesh's own (geometry) space. */
type Spot = { at: THREE.Vector3; normal: THREE.Vector3 };
type Layout = {
  eyes: [Spot, Spot];
  /** Each eye's half width and half height. */
  eye: { rx: number; ry: number };
  nose: Spot;
  mouth: Spot;
  /** The space between the eyes' centres, the face's measure. */
  span: number;
};

/** Each head's layout, by its eye geometry (shared by every clone of the pack). */
const layouts = new Map<string, Layout | null>();

const UP = new THREE.Vector3(0, 0, 1);
const FORWARD = new THREE.Vector3(0, -1, 0);

/** Where a ray from in front of the face, at (x, z), meets the skin. */
function onSkin(skin: THREE.Mesh, x: number, z: number, probe: THREE.Raycaster): Spot | null {
  probe.set(new THREE.Vector3(x, -5, z), new THREE.Vector3(0, 1, 0));
  const hit = probe.intersectObject(skin, false)[0];
  if (!hit?.face) return null;
  const normal = hit.face.normal.clone().normalize();
  // A face turned away from the viewer (a fold under the brow) faces forward instead.
  if (normal.dot(FORWARD) < 0.4) normal.copy(FORWARD);
  return { at: hit.point.clone(), normal };
}

function layoutOf(eyeMesh: THREE.Mesh, skinMesh: THREE.Mesh): Layout | null {
  const key = eyeMesh.geometry.uuid;
  if (layouts.has(key)) return layouts.get(key)!;
  const pos = eyeMesh.geometry.getAttribute('position');
  const sides = [new THREE.Box3(), new THREE.Box3()];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    sides[v.x < 0 ? 0 : 1]!.expandByPoint(v);
  }
  const probe = new THREE.Raycaster();
  const skin = new THREE.Mesh(
    skinMesh.geometry,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  let layout: Layout | null = null;
  if (!sides[0]!.isEmpty() && !sides[1]!.isEmpty()) {
    const centre = sides.map((b) => b.getCenter(new THREE.Vector3()));
    const size = sides[0]!.getSize(new THREE.Vector3());
    const span = centre[0]!.distanceTo(centre[1]!);
    const eyeZ = (centre[0]!.z + centre[1]!.z) / 2;
    const eyes = centre.map((c) => onSkin(skin, c.x, c.z, probe));
    const nose = onSkin(skin, 0, eyeZ - span * 0.42, probe);
    const mouth = onSkin(skin, 0, eyeZ - span * 0.86, probe);
    if (eyes[0] && eyes[1] && nose && mouth)
      layout = {
        eyes: [eyes[0], eyes[1]],
        // Bigger than the pack's slits: a game character's eyes read from across the room.
        eye: { rx: Math.max(size.x * 0.62, span * 0.24), ry: Math.max(size.z * 0.6, span * 0.2) },
        nose,
        mouth,
        span,
      };
  }
  layouts.set(key, layout);
  return layout;
}

const mats = new Map<string, THREE.MeshLambertMaterial>();
function mat(colour: string): THREE.MeshLambertMaterial {
  let m = mats.get(colour);
  if (!m) {
    m = markFigure(
      new THREE.MeshLambertMaterial({
        color: colour,
        // Drawn just over the skin it lies on.
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    mats.set(colour, m);
  }
  return m;
}

const CIRCLE = new THREE.CircleGeometry(1, 20);
const NOSE = new THREE.SphereGeometry(1, 12, 8);
/** The lash line: the top of a ring. */
const LASH = new THREE.RingGeometry(0.86, 1.08, 20, 1, Math.PI * 0.08, Math.PI * 0.84);
/** The smile: the bottom of a ring. */
const SMILE = new THREE.RingGeometry(0.82, 1, 20, 1, Math.PI * 1.16, Math.PI * 0.68);
const LIP = new THREE.CircleGeometry(1, 16, Math.PI * 1.1, Math.PI * 0.8);

/** A flat feature laid on a spot, facing out of the face, `lift` in front of it. */
function lay(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  spot: Spot,
  sx: number,
  sy: number,
  lift: number,
  dx = 0,
  dz = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  // The feature's +z out of the face, its +y up the face.
  const out = spot.normal;
  const right = new THREE.Vector3().crossVectors(UP, out).normalize();
  const up = new THREE.Vector3().crossVectors(out, right).normalize();
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, out));
  m.position.copy(spot.at).addScaledVector(out, lift).addScaledVector(UP, dz);
  m.position.x += dx;
  m.scale.set(sx, sy, 1);
  m.castShadow = false;
  return m;
}

/**
 * The face for a head, carried by its Head bone; null when the head has no eyes to place it by. `eyeMesh` and
 * `skinMesh` are the head's Eye and Skin parts (one geometry space); `skinMaterial` shades the nose as the skin is.
 */
export function gameFace(
  eyeMesh: THREE.SkinnedMesh,
  skinMesh: THREE.SkinnedMesh,
  skinMaterial: THREE.Material,
  headBone: THREE.Bone,
  colours: { iris: string; lips: string },
): THREE.Object3D | null {
  const l = layoutOf(eyeMesh, skinMesh);
  const bone = eyeMesh.skeleton.bones.indexOf(headBone);
  if (!l || bone < 0) return null;
  const face = new THREE.Group();
  face.name = 'face';
  const { rx, ry } = l.eye;
  const k = l.span;
  for (const spot of l.eyes) {
    face.add(lay(CIRCLE, mat('#f7f4ef'), spot, rx, ry, k * 0.02));
    face.add(lay(CIRCLE, mat(colours.iris), spot, ry * 0.78, ry * 0.86, k * 0.03, 0, -ry * 0.06));
    face.add(lay(CIRCLE, mat('#120d0b'), spot, ry * 0.4, ry * 0.44, k * 0.04, 0, -ry * 0.06));
    face.add(
      lay(CIRCLE, mat('#ffffff'), spot, ry * 0.16, ry * 0.16, k * 0.05, ry * 0.24, ry * 0.2),
    );
    face.add(lay(LASH, mat('#1d1512'), spot, rx * 1.02, ry * 1.04, k * 0.055));
  }
  // The nose: a small rounded bump in the skin's own shading.
  const nose = new THREE.Mesh(NOSE, skinMaterial);
  nose.position.copy(l.nose.at).addScaledVector(l.nose.normal, k * 0.03);
  nose.scale.set(k * 0.11, k * 0.1, k * 0.13);
  face.add(nose);
  face.add(lay(SMILE, mat('#5a2626'), l.mouth, k * 0.26, k * 0.2, k * 0.02, 0, k * 0.1));
  face.add(lay(LIP, mat(colours.lips), l.mouth, k * 0.15, k * 0.07, k * 0.015, 0, -k * 0.07));
  // From the head mesh's own space into the Head bone's: as the mesh was bound to it.
  face.matrixAutoUpdate = false;
  face.matrix.copy(eyeMesh.skeleton.boneInverses[bone]!).multiply(eyeMesh.bindMatrix);
  headBone.add(face);
  return face;
}
