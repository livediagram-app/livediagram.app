'use client';

// Real 3D's look (docs/specs/008-canvas/3d-engine.md "The camera and the look"): the lights and materials every Real
// 3D scene shares, the live one and the model sheet, so a piece checked on the sheet looks the same in a Space.
// One light for everyone, fixed to the world (never to a camera), so every viewer sees the same shading.

import * as THREE from 'three';

/** How far round the sun's target its shadows reach, in canvas px. */
export const SUN_REACH = 1100;
/** Where the sun stands from its target: front left and high. */
export const SUN_FROM = { x: -520, y: 700, z: 1400 } as const;

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

/** A material lit by the scene's lights, faces coloured by their vertices, both sides. */
export function litMaterial(
  opts: THREE.MeshLambertMaterialParameters = {},
): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, ...opts });
}

/** Adds the lights and the shadow catcher to a scene and makes the shared materials. */
export function createLook(scene: THREE.Scene, renderer: THREE.WebGLRenderer): Look {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Tuned so a face toward the default camera keeps its drawing's colour, a top is a little lighter and a back a little
  // darker, as the drawings shade them (three's lights are divided by pi).
  const sky = new THREE.HemisphereLight(0xffffff, 0xd8d2c8, 2.55);
  const sun = new THREE.DirectionalLight(0xfff6e8, 1.26);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  sun.shadow.radius = 4;
  const sc = sun.shadow.camera;
  sc.left = -SUN_REACH;
  sc.right = SUN_REACH;
  sc.top = SUN_REACH;
  sc.bottom = -SUN_REACH;
  sc.near = 10;
  sc.far = 4000;
  const catcher = new THREE.Mesh(
    new THREE.PlaneGeometry(SUN_REACH * 2, SUN_REACH * 2),
    new THREE.ShadowMaterial({ opacity: 0.22 }),
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
