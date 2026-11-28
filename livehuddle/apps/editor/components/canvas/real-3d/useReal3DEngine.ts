// Real 3D's renderer (docs/specs/008-canvas/3d-engine.md): made once on the layer's canvas, with its scene, camera,
// look, outline pass, shader warmup and shared materials, and disposed with the layer.

import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { DEPTH_K } from '@/lib/real-3d/projection';
import { SPACE_3D_PERSPECTIVE_PX } from '@/lib/space-3d/space-3d-camera';
import { createOutlinePass, type OutlinePass } from './outline-pass';
import { laterMaterials, ShaderWarmup } from './shader-warmup';
import { createLook, type Look } from './scene-look';
import { OUTLINE } from './real3d-scene-kit';

export type Real3DEngine = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  outline: OutlinePass;
  look: Look;
  /** Holds a frame while the programs it needs compile off the main thread (shader-warmup.ts). */
  warmup: ShaderWarmup;
  /** Stand-ins for the materials the scene makes later, compiled with its first frame (shader-warmup.ts). */
  later: THREE.Group;
  mats: {
    solid: THREE.MeshLambertMaterial;
    glass: THREE.MeshLambertMaterial;
    line: THREE.LineBasicMaterial;
    shadow: THREE.MeshBasicMaterial;
    figure: THREE.MeshLambertMaterial;
  };
};

/** The renderer, once: null until the canvas mounts and after it unmounts. */
export function useReal3DEngine(
  canvasRef: RefObject<HTMLCanvasElement | null>,
): RefObject<Real3DEngine | null> {
  const engineRef = useRef<Real3DEngine | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    THREE.ColorManagement.enabled = false;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    const scene = new THREE.Scene();
    const look = createLook(scene, renderer);
    const camera = new THREE.Camera();
    const mats = {
      solid: look.mats.solid,
      glass: look.mats.glass,
      line: new THREE.LineBasicMaterial({ color: OUTLINE, transparent: true, opacity: 0.3 }),
      shadow: new THREE.MeshBasicMaterial({
        color: 0x0f172a,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
      figure: look.mats.figure,
    };
    const outline = createOutlinePass({
      k: DEPTH_K,
      perspective: SPACE_3D_PERSPECTIVE_PX,
      ink: OUTLINE,
    });
    const warmup = new ShaderWarmup(renderer);
    const later = laterMaterials();
    engineRef.current = {
      renderer,
      scene,
      camera,
      mats,
      outline,
      look,
      warmup,
      later: later.group,
    };
    return () => {
      later.dispose();
      outline.dispose();
      look.dispose();
      mats.line.dispose();
      mats.shadow.dispose();
      renderer.dispose();
      engineRef.current = null;
    };
  }, [canvasRef]);
  return engineRef;
}
