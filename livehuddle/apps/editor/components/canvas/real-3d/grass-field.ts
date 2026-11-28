'use client';

// Real 3D's grass (docs/specs/008-canvas/3d-engine.md "Grass"): the lawns' blades (lib/real-3d/scene-grass.ts) drawn
// as one instanced mesh, so tens of thousands of blades cost one draw call, and their wild flowers as one more. Each
// blade is a thin tapered strip curving over toward its tip (each its own bend and a slight twist), dark at the root
// where it melts into the ground and lighter and warmer at the tip, lit as the ground is (from above, never darker on
// its back), in the sun's shadows, and swaying in a slow wind that rolls across the lawn, each blade on its own beat.
// The wind is all in the vertex shader: a frame sets one number.
//
// The ink pass outlines whatever stands against the floor; a blade drawn opaque would be inked all round, every blade
// a dark dot. Blades write an alpha just under the ink's threshold (and premultiply for it), so the ink passes them by.

import * as THREE from 'three';
import { BLADE_STRIDE, FLOWER_STRIDE, type GrassField } from '@/lib/real-3d/scene-grass';

/** Just under the ink pass's "this pixel is drawn" alpha (outline-pass.ts), so no blade is outlined. */
const GRASS_ALPHA = 0.88;

/**
 * One blade, 1 wide and 1 tall, bending forward (+y) toward its tip: root, two joints, the tip. Its shade (times the
 * blade's own colour) runs from a root just under the ground's to a lighter tip a touch warmer (more red, less blue).
 */
function bladeGeometry(): THREE.BufferGeometry {
  const rows = [
    { w: 0.5, y: 0, z: 0, c: [0.6, 0.62, 0.62] },
    { w: 0.4, y: 0.08, z: 0.42, c: [0.8, 0.82, 0.8] },
    { w: 0.24, y: 0.26, z: 0.78, c: [1.0, 1.0, 0.94] },
  ];
  const tip = { y: 0.52, z: 1, c: [1.16, 1.12, 0.9] };
  const pos: number[] = [];
  const col: number[] = [];
  for (const r of rows) {
    pos.push(-r.w, r.y, r.z, r.w, r.y, r.z);
    col.push(...r.c, ...r.c);
  }
  pos.push(0, tip.y, tip.z);
  col.push(...tip.c);
  const index = [0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 6];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // Lit as the ground: every blade's normal points up (a little toward its lean), so neither face is in shade.
  const normals: number[] = [];
  for (let i = 0; i < pos.length / 3; i++) normals.push(0, 0.25, 0.97);
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setIndex(index);
  return g;
}

/**
 * One wild flower's head, 1 across, standing at the top of its stalk (z 1, swaying as a blade's tip does): five petals
 * round a warm middle, facing up. The stalk is lost in the grass, so only the head is drawn.
 */
function flowerGeometry(): THREE.BufferGeometry {
  const pos: number[] = [0, 0, 1];
  const col: number[] = [1, 0.78, 0.3];
  const index: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = i % 2 === 0 ? 0.5 : 0.22;
    pos.push(Math.cos(a) * r, Math.sin(a) * r, 1);
    col.push(1, 1, 1);
    index.push(0, 1 + i, 1 + ((i + 1) % 10));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const normals: number[] = [];
  for (let i = 0; i < pos.length / 3; i++) normals.push(0, 0.2, 0.98);
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setIndex(index);
  return g;
}

export type GrassMesh = {
  object: THREE.Object3D;
  /** Moves the wind on (seconds). */
  update: (seconds: number) => void;
  dispose: () => void;
};

/** The field's blades as one mesh (and its flowers as another); null when there are none. */
export function grassMesh(field: GrassField): GrassMesh | null {
  if (field.count === 0 && field.flowerCount === 0) return null;
  const geometry = bladeGeometry();
  const flowerGeo = flowerGeometry();
  const time = { value: 0 };
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        vec4 mvPosition = vec4( transformed, 1.0 );
        float bend = position.z * position.z;
        #ifdef USE_INSTANCING
          vec2 root = instanceMatrix[3].xy;
          // Each blade's own beat, from where it stands (no attribute to carry).
          float beat = fract( sin( dot( root, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
          // A slight twist toward the tip, one way or the other.
          float twist = ( beat - 0.5 ) * 0.9 * bend;
          mvPosition.xy = mat2( cos( twist ), sin( twist ), -sin( twist ), cos( twist ) ) * mvPosition.xy;
          mvPosition = instanceMatrix * mvPosition;
          float tall = instanceMatrix[2].z / 6.5;
        #else
          vec2 root = vec2( 0.0 );
          float beat = 0.0;
          float tall = 1.0;
        #endif
        // Wind: slow gusts rolling across the lawn, a quicker flutter on top on each blade's own beat; the tip moves,
        // the root never, and a taller blade further.
        float gust = sin( uTime * 1.3 + root.x * 0.018 + root.y * 0.011 ) * 0.6
          + sin( uTime * 2.7 + root.x * 0.05 - root.y * 0.04 ) * 0.25
          + sin( uTime * 5.3 + beat * 6.2831 ) * 0.14;
        mvPosition.xy += vec2( 0.9, 0.35 ) * gust * bend * 1.6 * tall;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`,
      );
    shader.fragmentShader = shader.fragmentShader
      // Both faces lit alike: no flipping the normal for the back face.
      .replace(
        '#include <normal_fragment_begin>',
        'vec3 normal = normalize( vNormal ); vec3 nonPerturbedNormal = normal;',
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>\ngl_FragColor = vec4( gl_FragColor.rgb * ${GRASS_ALPHA.toFixed(2)}, ${GRASS_ALPHA.toFixed(2)} );`,
      );
  };
  const mesh = new THREE.InstancedMesh(geometry, material, field.count);
  // Each blade's matrix written straight in (a turn about z, its width, lean and height), no per-blade objects.
  const mats = mesh.instanceMatrix.array as Float32Array;
  for (let i = 0; i < field.count; i++) {
    const o = i * BLADE_STRIDE;
    const h = field.blades[o + 3]!;
    const w = field.blades[o + 4]!;
    // A tall blade bends over further than a short one, and each its own way further or less.
    const lean = h * (0.5 + h * 0.06) * field.blades[o + 5]!;
    const cos = Math.cos(field.blades[o + 2]!);
    const sin = Math.sin(field.blades[o + 2]!);
    const k = i * 16;
    mats[k] = cos * w;
    mats[k + 1] = sin * w;
    mats[k + 2] = 0;
    mats[k + 3] = 0;
    mats[k + 4] = -sin * lean;
    mats[k + 5] = cos * lean;
    mats[k + 6] = 0;
    mats[k + 7] = 0;
    mats[k + 8] = 0;
    mats[k + 9] = 0;
    mats[k + 10] = h;
    mats[k + 11] = 0;
    mats[k + 12] = field.blades[o]!;
    mats[k + 13] = field.blades[o + 1]!;
    mats[k + 14] = 0;
    mats[k + 15] = 1;
  }
  mesh.instanceColor = new THREE.InstancedBufferAttribute(field.colours.slice(), 3);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  // The flowers: the same material (lit, swaying, passed by the ink), a head at each one's height.
  const blooms = new THREE.InstancedMesh(flowerGeo, material, field.flowerCount);
  const fm = blooms.instanceMatrix.array as Float32Array;
  for (let i = 0; i < field.flowerCount; i++) {
    const o = i * FLOWER_STRIDE;
    const size = field.flowers[o + 3]!;
    const k = i * 16;
    fm.fill(0, k, k + 16);
    fm[k] = size;
    fm[k + 5] = size;
    fm[k + 10] = field.flowers[o + 2]!;
    fm[k + 12] = field.flowers[o]!;
    fm[k + 13] = field.flowers[o + 1]!;
    fm[k + 15] = 1;
  }
  blooms.instanceColor = new THREE.InstancedBufferAttribute(field.flowerColours.slice(), 3);
  blooms.instanceMatrix.needsUpdate = true;
  blooms.receiveShadow = true;
  blooms.frustumCulled = false;
  const object = new THREE.Group();
  if (field.count > 0) object.add(mesh);
  if (field.flowerCount > 0) object.add(blooms);
  return {
    object,
    update: (seconds) => {
      time.value = seconds;
    },
    dispose: () => {
      geometry.dispose();
      flowerGeo.dispose();
      material.dispose();
      mesh.dispose();
      blooms.dispose();
    },
  };
}
