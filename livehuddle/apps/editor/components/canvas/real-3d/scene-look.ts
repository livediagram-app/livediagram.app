'use client';

// Real 3D's look (docs/specs/008-canvas/3d-engine.md "The camera and the look"): the lights and materials every Real
// 3D scene shares, the live one and the model sheet, so a piece checked on the sheet looks the same in a Space.
// One light for everyone, fixed to the world (never to a camera), so every viewer sees the same shading.

import * as THREE from 'three';

/** How far round the sun's target its shadows reach, in canvas px. */
export const SUN_REACH = 1100;
/** Where the sun stands from its target: front left and high. */
export const SUN_FROM = { x: -620, y: 560, z: 1050 } as const;

export type Look = {
  sun: THREE.DirectionalLight;
  /** A see-through plane on the floor that catches the shadows (the floor itself is the DOM's). */
  catcher: THREE.Mesh;
  mats: {
    solid: THREE.MeshLambertMaterial;
    glass: THREE.MeshLambertMaterial;
    figure: THREE.MeshLambertMaterial;
  };
  /** Moves the sun (and its shadows) to cover the scene round a point. */
  follow: (x: number, y: number) => void;
  dispose: () => void;
};

/**
 * Where the camera's eye is, as a homogeneous point in the scene (w 0 when it is infinitely far): set each frame from
 * the projection, read by every material lit with `ownNormals`.
 */
export const EYE = { value: new THREE.Vector4(0, 0, 1, 0) };
const CLIP_EYE = new THREE.Vector4(0, 0, 1, 0);
/** Sets the eye from the camera's projection (the scene's view is the identity: the stage's matrix is all projection). */
export function setEye(projectionInverse: THREE.Matrix4): void {
  EYE.value.copy(CLIP_EYE).applyMatrix4(projectionInverse);
}

/**
 * Lit on the side the camera sees. The stage's projection mirrors the floor, so three's double-sided shading (which
 * turns a normal round for a face it thinks is seen from behind) cannot be trusted, and the built models' faces do not
 * all carry outward normals; a solid's face the camera sees faces the camera, so each normal is turned toward the eye.
 */
export function ownNormals<M extends THREE.Material>(m: M): M {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uEye = EYE;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec4 uEye;')
      .replace(
        '#include <normal_fragment_begin>',
        `vec3 normal = normalize( vNormal );
        // The scene's view is the identity, so -vViewPosition is the point in the scene.
        vec3 toEye = uEye.xyz + vViewPosition * uEye.w;
        if ( dot( normal, toEye ) * sign( uEye.w == 0.0 ? 1.0 : uEye.w ) < 0.0 ) normal = -normal;
        vec3 nonPerturbedNormal = normal;`,
      );
  };
  m.customProgramCacheKey = () => 'own-normals';
  return m;
}

/** A material lit by the scene's lights, faces coloured by their vertices, both sides. */
export function litMaterial(
  opts: THREE.MeshLambertMaterialParameters = {},
): THREE.MeshLambertMaterial {
  return ownNormals(
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, ...opts }),
  );
}

/** Adds the lights and the shadow catcher to a scene and makes the shared materials. */
export function createLook(scene: THREE.Scene, renderer: THREE.WebGLRenderer): Look {
  renderer.shadowMap.enabled = true;
  // PCF, which three (0.18x) swaps a PCFSoftShadowMap for at its first draw anyway: set before anything compiles, so
  // the programs compiled ahead of that draw (shader-warmup.ts) are the ones it uses.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // A warm sun clearly stronger than a cool sky (the owner, 2026-11-27, of a flat first look: "not achieving the level
  // of polish, quality, finish and fidelity I wanted"), so every model is shaped by light and shade; a face toward the
  // default camera keeps about its drawing's colour (three's lights are divided by pi).
  const sky = new THREE.HemisphereLight(0xe4efff, 0xcbbf9f, 2.2);
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.75);
  sun.castShadow = true;
  // About two texels a canvas px on a computer, so a chair's legs cast legs; half that on a phone (its memory).
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const map = coarse ? 2048 : 4096;
  sun.shadow.mapSize.set(map, map);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  sun.shadow.radius = 3;
  const sc = sun.shadow.camera;
  sc.left = -SUN_REACH;
  sc.right = SUN_REACH;
  sc.top = SUN_REACH;
  sc.bottom = -SUN_REACH;
  sc.near = 10;
  sc.far = 4000;
  const catcher = new THREE.Mesh(
    new THREE.PlaneGeometry(SUN_REACH * 2, SUN_REACH * 2),
    new THREE.ShadowMaterial({ color: 0x1c2433, opacity: 0.34 }),
  );
  catcher.receiveShadow = true;
  catcher.frustumCulled = false;
  scene.add(sky, sun, sun.target, catcher);
  const mats = {
    solid: litMaterial(),
    glass: litMaterial({ transparent: true, opacity: 0.22, depthWrite: false }),
    figure: litMaterial(),
  };
  const follow = (x: number, y: number) => {
    sun.target.position.set(x, y, 0);
    sun.position.set(x + SUN_FROM.x, y + SUN_FROM.y, SUN_FROM.z);
    catcher.position.set(x, y, 0.3);
  };
  follow(0, 0);
  return {
    sun,
    catcher,
    mats,
    follow,
    dispose: () => {
      scene.remove(sky, sun, sun.target, catcher);
      catcher.geometry.dispose();
      (catcher.material as THREE.Material).dispose();
      Object.values(mats).forEach((m) => m.dispose());
    },
  };
}
