import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FIRST_HOLD_MS, LATER_HOLD_MS, laterMaterials, ShaderWarmup } from './shader-warmup';

// A stand-in renderer: compiling makes one program per material it has not met, and resolves when told to.
function fakeRenderer() {
  const programs: unknown[] = [];
  const seen = new Set<string>();
  let finish: (() => void)[] = [];
  const renderer = {
    info: { programs },
    compileAsync: vi.fn((scene: THREE.Object3D) => {
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (!m || !(o as THREE.Mesh).isMesh) return;
        const key = `${m.uuid}:${m.version}:${m.type}`;
        if (m.userData.newProgram === false || seen.has(key)) return;
        seen.add(key);
        programs.push(key);
      });
      return new Promise<THREE.Object3D>((resolve) => finish.push(() => resolve(scene)));
    }),
  };
  const done = async () => {
    const all = finish;
    finish = [];
    all.forEach((f) => f());
    await Promise.resolve();
    await Promise.resolve();
  };
  return { renderer, done };
}

const camera = new THREE.Camera();
const meshOf = (m: THREE.Material) => new THREE.Mesh(new THREE.BufferGeometry(), m);

describe('ShaderWarmup (docs/specs/008-canvas/3d-engine.md "Performance")', () => {
  it('holds the first frame until its programs have compiled, then draws', async () => {
    const { renderer, done } = fakeRenderer();
    const w = new ShaderWarmup(renderer);
    const scene = new THREE.Scene();
    scene.add(meshOf(new THREE.MeshLambertMaterial()));
    expect(w.mayDraw([{ scene, camera }], 0)).toBe(false);
    expect(w.mayDraw([{ scene, camera }], 16)).toBe(false);
    expect(w.drawn).toBe(false);
    await done();
    expect(w.mayDraw([{ scene, camera }], 32)).toBe(true);
    expect(w.drawn).toBe(true);
    // Nothing new: no compile at all.
    renderer.compileAsync.mockClear();
    expect(w.mayDraw([{ scene, camera }], 48)).toBe(true);
    expect(renderer.compileAsync).not.toHaveBeenCalled();
  });

  it('holds a newcomer only a moment, and never longer than its cap', async () => {
    const { renderer, done } = fakeRenderer();
    const w = new ShaderWarmup(renderer);
    const scene = new THREE.Scene();
    expect(w.mayDraw([{ scene, camera }], 0)).toBe(true);
    scene.add(meshOf(new THREE.MeshBasicMaterial()));
    expect(w.mayDraw([{ scene, camera }], 100)).toBe(false);
    expect(w.mayDraw([{ scene, camera }], 100 + LATER_HOLD_MS - 1)).toBe(false);
    expect(w.mayDraw([{ scene, camera }], 100 + LATER_HOLD_MS)).toBe(true);
    // A late answer from the given-up compile changes nothing.
    await done();
    expect(w.mayDraw([{ scene, camera }], 1000)).toBe(true);
  });

  it('waits up to the first cap before a slow first frame draws anyway', () => {
    const { renderer } = fakeRenderer();
    const w = new ShaderWarmup(renderer);
    const scene = new THREE.Scene();
    scene.add(meshOf(new THREE.MeshLambertMaterial()));
    expect(w.mayDraw([{ scene, camera }], 0)).toBe(false);
    expect(w.mayDraw([{ scene, camera }], FIRST_HOLD_MS - 1)).toBe(false);
    expect(w.mayDraw([{ scene, camera }], FIRST_HOLD_MS)).toBe(true);
  });

  it('draws at once when a changed material needs no new program', () => {
    const { renderer } = fakeRenderer();
    const w = new ShaderWarmup(renderer);
    const scene = new THREE.Scene();
    const m = new THREE.MeshLambertMaterial();
    m.userData.newProgram = false;
    scene.add(meshOf(m));
    expect(w.mayDraw([{ scene, camera }], 0)).toBe(true);
    m.needsUpdate = true;
    expect(w.mayDraw([{ scene, camera }], 16)).toBe(true);
    expect(renderer.compileAsync).toHaveBeenCalledTimes(2);
  });

  it('compiles the later materials lit by the scene, never adding them to it', () => {
    const { renderer } = fakeRenderer();
    const w = new ShaderWarmup(renderer);
    const scene = new THREE.Scene();
    const later = laterMaterials();
    void w.prewarm(later.group, camera, scene);
    expect(renderer.compileAsync).toHaveBeenCalledWith(later.group, camera, scene);
    // Once per renderer: the frame loop starting again compiles nothing more.
    void w.prewarm(later.group, camera, scene);
    expect(renderer.compileAsync).toHaveBeenCalledTimes(1);
    expect(later.group.children.length).toBeGreaterThanOrEqual(10);
    expect(scene.children).toHaveLength(0);
    expect(() => later.dispose()).not.toThrow();
  });
});
