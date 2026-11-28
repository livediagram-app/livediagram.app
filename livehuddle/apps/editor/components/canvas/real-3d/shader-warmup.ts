'use client';

// Shaders compiled off the main thread (docs/specs/008-canvas/3d-engine.md "Performance"): three.js compiles a
// material's program the first time it draws it, and the browser waits for the GPU driver while it does, which froze
// the page for seconds as a Space opened. So before a frame draws anything new, its programs are compiled in parallel
// (KHR_parallel_shader_compile, through `compileAsync`) and the frame holds until they are ready: the first frame
// waits (the floor shows meanwhile), and a later newcomer (a character's model arriving, a poster's picture) holds the
// scene a moment at most, never the page.

import * as THREE from 'three';
import { markFigure, solidBothSides } from './figure-mark';
import { ownNormals } from './scene-look';

/** How long the first frame waits for its programs before it draws anyway (a slow device compiles on the spot). */
export const FIRST_HOLD_MS = 6000;
/** How long a later frame holds for a newcomer's programs before it draws anyway. */
export const LATER_HOLD_MS = 400;

/** One scene the frame draws, and the scene whose lights it is lit by (itself unless given). */
export type WarmPass = { scene: THREE.Object3D; camera: THREE.Camera; lights?: THREE.Scene };

type Renderer = Pick<THREE.WebGLRenderer, 'compileAsync'> & {
  info: { programs?: readonly unknown[] | null };
};

function materialsOf(o: THREE.Object3D): THREE.Material | THREE.Material[] | null {
  const r = o as THREE.Mesh;
  if (!(r.isMesh || (o as THREE.Line).isLine || (o as THREE.Points).isPoints)) return null;
  return r.material ?? null;
}

export class ShaderWarmup {
  /** Each material's version when last compiled, so only a new or changed one sends the frame to compile. */
  private readonly known = new WeakMap<THREE.Material, number>();
  private waiting = 0;
  private ticket = 0;
  private holdUntil = 0;
  private drewOnce = false;
  private readonly prewarmed = new WeakSet<THREE.Object3D>();

  private readonly renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  /** Whether a frame has drawn yet. */
  get drawn(): boolean {
    return this.drewOnce;
  }

  /** Whether this frame may draw: false while programs it needs are compiling. Call once a frame, before drawing. */
  mayDraw(passes: readonly WarmPass[], now: number): boolean {
    if (this.waiting) {
      if (now < this.holdUntil) return false;
      // Waited long enough: draw, compiling what is left on the spot.
      this.waiting = 0;
      return this.draw();
    }
    if (!passes.some((p) => this.hasNewcomer(p.scene))) return this.draw();
    const programs = () => this.renderer.info.programs?.length ?? 0;
    const before = programs();
    const ready = passes.map((p) =>
      this.renderer.compileAsync(p.scene, p.camera, p.lights ?? null),
    );
    // Every program it needs already existed (a material changed nothing that matters): draw now.
    if (programs() === before) return this.draw();
    const ticket = ++this.ticket;
    this.waiting = ticket;
    this.holdUntil = now + (this.drewOnce ? LATER_HOLD_MS : FIRST_HOLD_MS);
    void Promise.all(ready).then(() => {
      if (this.waiting === ticket) this.waiting = 0;
    });
    return false;
  }

  /**
   * Compiles programs nothing in the scene uses yet but something will (a moment's parts, a picture, a selection),
   * lit as `lights` is, without drawing them.
   */
  prewarm(objects: THREE.Object3D, camera: THREE.Camera, lights: THREE.Scene): Promise<unknown> {
    if (this.prewarmed.has(objects)) return Promise.resolve();
    this.prewarmed.add(objects);
    return this.renderer.compileAsync(objects, camera, lights);
  }

  private draw(): true {
    this.drewOnce = true;
    return true;
  }

  private hasNewcomer(scene: THREE.Object3D): boolean {
    let found = false;
    scene.traverse((o) => {
      const m = materialsOf(o);
      if (!m) return;
      for (const mat of Array.isArray(m) ? m : [m]) {
        if (this.known.get(mat) === mat.version) continue;
        this.known.set(mat, mat.version);
        found = true;
      }
    });
    return found;
  }
}

/**
 * Stand-ins for the materials the scene makes later (docs/specs/008-canvas/3d-engine.md "Performance"): a moment's
 * glow and lit parts, a poster's picture, a desk's lit screen, a selection's marks, a figure's props. Each is a
 * program three caches by its settings, so compiling these once means the real ones never compile mid-walk. Never
 * drawn, and kept until the scene goes: three frees a program once no material uses it.
 */
export function laterMaterials(): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
  );
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  const picture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  picture.colorSpace = THREE.NoColorSpace;
  const materials: THREE.Material[] = [
    // A moment's glow and its lit parts (moment-fx.ts).
    new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, transparent: true }),
    // A poster's picture (poster-pictures.ts).
    new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, map: picture }),
    // A desk's lit screen (desk-screens.ts).
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    // An idle Screen's logo (idle-screens.ts).
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, map: picture }),
    // A figure's props and a dog's heart (character-rig.ts, office-dog.ts, status-props.ts).
    new THREE.MeshLambertMaterial(),
    new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
    // A dog's coat, lit on the side the camera sees (office-dog.ts).
    ownNormals(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })),
    // A figure's own parts, marked for the ink pass, and what it holds, both on both sides (figure-mark.ts).
    markFigure(new THREE.MeshLambertMaterial()),
    solidBothSides(new THREE.MeshLambertMaterial()),
    solidBothSides(new THREE.MeshBasicMaterial()),
  ];
  for (const m of materials) group.add(new THREE.Mesh(geometry, m));
  // A selection's marks (selection-marks.ts).
  const lines = new THREE.LineBasicMaterial({ transparent: true, depthTest: false });
  group.add(new THREE.LineSegments(geometry, lines));
  materials.push(lines);
  return {
    group,
    dispose: () => {
      geometry.dispose();
      picture.dispose();
      materials.forEach((m) => m.dispose());
    },
  };
}
