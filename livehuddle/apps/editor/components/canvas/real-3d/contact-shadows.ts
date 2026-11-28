'use client';

// Real 3D's grounding (docs/specs/008-canvas/3d-engine.md "The camera"): a soft contact shadow under every standing
// piece's footprint, darkest where it meets the floor and fading past its edge, so nothing seems to float. All of them
// are one draw (an instanced quad with a soft-edged rounded box drawn in its shader), rebuilt with the pieces.

import * as THREE from 'three';
import type { PieceBounds } from '@/lib/real-3d/piece-pick';

/** How far past a footprint's edge its shadow fades out, in canvas px. */
const SPREAD = 7;
/** Lower than this, a piece lies on the floor and casts no contact shadow (a rug's frame, a pad's well). */
const MIN_HEIGHT = 4;
/** Higher than this off the floor, a piece hangs on a wall (a clock, a board, a dartboard) and casts none. */
const HUNG = 6;
/** Larger than this across, a piece is a floor of its own (an office pod, a car park) and casts none. */
const MAX_SIDE = 420;

const VERTEX = /* glsl */ `
attribute vec3 halfSize;
varying vec2 vP;
varying vec2 vHalf;
varying float vRound;
void main() {
  vHalf = halfSize.xy;
  vRound = halfSize.z;
  vP = position.xy * (halfSize.xy + ${SPREAD.toFixed(1)});
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(vP, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 colour;
uniform float strength;
varying vec2 vP;
varying vec2 vHalf;
varying float vRound;
void main() {
  // Distance outside a box a little smaller than the footprint, its corners rounded (fully, for a round thing).
  vec2 inner = max(vHalf - 2.0, vec2(0.5));
  float r = mix(2.0, min(inner.x, inner.y), vRound);
  vec2 d = abs(vP) - inner + r;
  float out_ = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
  float a = 1.0 - smoothstep(-2.0, ${SPREAD.toFixed(1)} + 2.0, out_);
  gl_FragColor = vec4(colour, a * a * strength);
}`;

export type ContactShadows = {
  object: THREE.Object3D;
  /** Hides one piece's shadow (while a drag or a moment carries the piece) and returns what shows it again. */
  hide: (id: string) => () => void;
  dispose: () => void;
};

/** Kinds whose crown or canopy overhangs a narrow foot: their contact shadow is the foot's alone, round. */
const NARROW_FOOT: Record<string, number> = {
  tree: 0.16,
  'garden-umbrella': 0.1,
  'coat-rack': 0.3,
  'umbrella-stand': 0.6,
  signpost: 0.2,
  'room-sign': 0.2,
};
/** Kinds that are round on the floor. */
const ROUND = new Set([
  'campfire',
  'plant',
  'outdoor-plant',
  'fountain',
  'bean-bag',
  'pet-bed',
  'tree',
]);
/** Kinds that cast no contact shadow (the Avatar Pad lights its own floor; the Pond lies in the ground). */
const NONE = new Set(['avatar-pad', 'car-park', 'office-pod', 'pond', 'road']);

/** Over a lawn the shadow lies at the blades' height, shading their tips (laid under them, the blades hid it). */
const OVER_GRASS = 4.5;

export function contactShadows(
  bounds: readonly PieceBounds[],
  onLawn: (x: number, y: number) => boolean,
  kindOf: (id: string) => string | undefined,
): ContactShadows {
  const shown = bounds.filter(
    (b) =>
      !NONE.has(kindOf(b.id) ?? '') &&
      b.z1 >= MIN_HEIGHT &&
      (b.z0 ?? 0) <= HUNG &&
      b.x1 - b.x0 <= MAX_SIDE &&
      b.y1 - b.y0 <= MAX_SIDE,
  );
  const geometry = new THREE.PlaneGeometry(2, 2);
  const half = new Float32Array(Math.max(1, shown.length) * 3);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      colour: { value: new THREE.Color(0x10141c) },
      strength: { value: 0.4 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    // The stage's projection mirrors the floor (as every Real 3D material, both sides drawn).
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, shown.length));
  mesh.count = shown.length;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const z = new THREE.Vector3(0, 0, 1);
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  shown.forEach((b, i) => {
    // The footprint's middle in its frame, turned and laid on the canvas.
    const mx = (b.x0 + b.x1) / 2;
    const my = (b.y0 + b.y1) / 2;
    const c = Math.cos(b.f.yaw);
    const s = Math.sin(b.f.yaw);
    p.set(b.f.cx + mx * c - my * s, b.f.cy + mx * s + my * c, 0);
    p.z = onLawn(p.x, p.y) ? OVER_GRASS : 0.45;
    q.setFromAxisAngle(z, b.f.yaw);
    m.compose(p, q, one);
    mesh.setMatrixAt(i, m);
    const kind = kindOf(b.id) ?? '';
    const narrow = NARROW_FOOT[kind];
    const side = Math.min(b.x1 - b.x0, b.y1 - b.y0);
    half[i * 3] = narrow ? (side * narrow) / 2 : (b.x1 - b.x0) / 2;
    half[i * 3 + 1] = narrow ? (side * narrow) / 2 : (b.y1 - b.y0) / 2;
    half[i * 3 + 2] = narrow || ROUND.has(kind) ? 1 : 0;
  });
  geometry.setAttribute('halfSize', new THREE.InstancedBufferAttribute(half, 3));
  mesh.instanceMatrix.needsUpdate = true;
  const index = new Map(shown.map((b, i) => [b.id, i] as const));
  const none = new THREE.Matrix4().makeScale(0, 0, 0);
  return {
    object: mesh,
    hide: (id) => {
      const i = index.get(id);
      if (i === undefined) return () => {};
      const saved = new THREE.Matrix4();
      mesh.getMatrixAt(i, saved);
      mesh.setMatrixAt(i, none);
      mesh.instanceMatrix.needsUpdate = true;
      return () => {
        mesh.setMatrixAt(i, saved);
        mesh.instanceMatrix.needsUpdate = true;
      };
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}
