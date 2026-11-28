// docs/specs/008-canvas/3d-engine.md "An idle Screen shows the logo": every idle Screen is a quad of one mesh on one
// shared texture, redrawn only while the prism moves, at most IDLE_LOGO_FPS a second, and only while one is in view.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { IDLE_LOGO_REST_MS } from '@/lib/real-3d/idle-screen-logo';
import { createIdleScreens } from './idle-screens';
import { piecesMesh } from '@/lib/real-3d/scene-pieces';

// A canvas whose 2D context takes every call and counts the drawImage calls onto the texture.
function fakeCanvas(counter: { draws: number }) {
  const ctx: Record<string, unknown> = {
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: () => ({ width: 10 }),
  };
  const canvas = { width: 0, height: 0, getContext: () => proxy } as unknown as HTMLCanvasElement;
  const proxy = new Proxy(ctx, {
    get: (t, k) =>
      k === 'canvas'
        ? canvas
        : k in t
          ? t[k as string]
          : k === 'drawImage'
            ? () => counter.draws++
            : () => {},
    set: (t, k, v) => ((t[k as string] = v), true),
  });
  return canvas;
}

const corners = (x = 0) => [x, 0, 0, x + 160, 0, 0, x + 160, 0, 90, x, 0, 90];
// A camera looking at everything near the origin, and one looking far away.
const seeing = new THREE.OrthographicCamera(-1000, 1000, 1000, -1000, -1000, 1000);
seeing.updateProjectionMatrix();
const away = new THREE.OrthographicCamera(9000, 9100, 9100, 9000, -1, 1);
away.updateProjectionMatrix();

const g = globalThis as { Path2D?: unknown };
const hadPath = 'Path2D' in g;
beforeAll(() => {
  if (!hadPath) g.Path2D = class {};
});
afterAll(() => {
  if (!hadPath) delete g.Path2D;
});

function rig(reduced = false) {
  const counter = { draws: 0 };
  const idle = createIdleScreens({ reduced: () => reduced, canvas: () => fakeCanvas(counter) });
  // Two drawImage calls a redraw: the backdrop and the prism's layer.
  return { idle, redraws: () => counter.draws / 2 };
}

describe('idle screens', () => {
  it('draws every idle Screen as one mesh, its quads following set, move and hide', () => {
    const { idle } = rig();
    expect(idle.count()).toBe(0);
    idle.set(
      new Map([
        ['a', corners()],
        ['b', corners(300)],
      ]),
    );
    expect(idle.count()).toBe(2);
    expect(idle.object.geometry.getIndex()!.count).toBe(12);
    idle.move(new Map([['a', corners(50)]]));
    expect(idle.object.geometry.getAttribute('position').getX(0)).toBe(50);
    idle.hide(new Set(['b']));
    expect(idle.count()).toBe(1);
    idle.set(new Map());
    expect(idle.object.visible).toBe(false);
    idle.dispose();
  });

  it('twenty Screens still cost one redraw per due frame, none while resting', () => {
    const { idle, redraws } = rig();
    idle.set(new Map(Array.from({ length: 20 }, (_, i) => [`s${i}`, corners(i * 200)] as const)));
    const t0 = performance.now();
    idle.tick(t0, seeing.projectionMatrix);
    expect(redraws()).toBe(1);
    // Its rest beat: nothing more to draw.
    for (let t = 100; t < IDLE_LOGO_REST_MS - 200; t += 33)
      idle.tick(t0 + t, seeing.projectionMatrix);
    expect(redraws()).toBe(1);
    // Moving: a 30 fps frame loop redraws it about 15 times a second, never per Screen.
    const from = t0 + IDLE_LOGO_REST_MS + 50;
    for (let t = 0; t < 1000; t += 1000 / 30) idle.tick(from + t, seeing.projectionMatrix);
    expect(redraws() - 1).toBeGreaterThanOrEqual(13);
    expect(redraws() - 1).toBeLessThanOrEqual(16);
    idle.dispose();
  });

  it('skips the redraw while no idle Screen is in view', () => {
    const { idle, redraws } = rig();
    idle.set(new Map([['a', corners()]]));
    const t0 = performance.now();
    idle.tick(t0, away.projectionMatrix);
    expect(redraws()).toBe(1);
    for (let t = 0; t < 1000; t += 33) idle.tick(t0 + IDLE_LOGO_REST_MS + t, away.projectionMatrix);
    expect(redraws()).toBe(1);
    idle.dispose();
  });

  it('draws once and holds still under reduced motion', () => {
    const { idle, redraws } = rig(true);
    idle.set(new Map([['a', corners()]]));
    const t0 = performance.now();
    for (let t = 0; t < 10_000; t += 33) idle.tick(t0 + t, seeing.projectionMatrix);
    expect(redraws()).toBe(1);
    idle.dispose();
  });

  it("marks a Screen's glass, apart from the Posters' pictures", () => {
    const built = piecesMesh([
      { id: 's', type: 'shape', shape: 'screen', x: 0, y: 0, width: 192, height: 120 } as never,
    ]);
    expect(built.screenFaces.get('s')).toHaveLength(12);
    expect(built.posterPictures.has('s')).toBe(false);
  });
});
