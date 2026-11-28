// docs/specs/008-canvas/3d-engine.md "Sitting fits the figure": the seat's own top seats a sitter.
import { describe, expect, it } from 'vitest';
import type { PieceBounds } from './piece-pick';
import { seatSurface } from './seat-surface';

// A level square of two triangles at height z over [x0, x1] by [y0, y1].
const square = (x0: number, y0: number, x1: number, y1: number, z: number) => [
  ...[x0, y0, z, x1, y0, z, x1, y1, z],
  ...[x0, y0, z, x1, y1, z, x0, y1, z],
];
const bounds = (id: string): PieceBounds => ({
  id,
  box: { x: -20, y: -20, width: 40, height: 40 },
  f: { cx: 0, cy: 0, yaw: 0 },
  x0: -20,
  x1: 20,
  y0: -20,
  y1: 20,
  z1: 90,
});

describe('seatSurface', () => {
  // A chair: a seat at 40 over the middle, and a back at 90 behind it (y -23 to -17), above the cap.
  const positions = [...square(-15, -15, 15, 15, 40), ...square(-15, -23, 15, -17, 90)];
  const mesh = { positions, ranges: new Map([['stool', { from: 0, to: 12 }]]) };

  it('finds the seat behind the feet, under the cap, and names a hammock one to lie on', () => {
    // Facing +y (yaw 0): behind is -y.
    const seat = seatSurface(mesh, [bounds('stool')], () => 'bar-stool', { x: 0, y: 10 }, 0, 1, 60);
    // The back starts 27 px behind the feet; the measure stops 1 px short of it (the figure keeps its own depth
    // behind its hips clear as well, game-figure.ts).
    expect(seat).toEqual({ height: 40, lying: false, hipsBack: 26, bed: null });
    expect(
      seatSurface(mesh, [bounds('stool')], () => 'hammock', { x: 0, y: 10 }, 0, 1, 60)?.lying,
    ).toBe(true);
  });

  it('finds a back only 2 px thick behind a large sitter, never stepping over it', () => {
    const thin = [...square(-15, -15, 15, 15, 40), ...square(-15, -19, 15, -17, 90)];
    const m = { positions: thin, ranges: new Map([['chair', { from: 0, to: 12 }]]) };
    const seat = seatSurface(m, [bounds('chair')], () => 'chair', { x: 0, y: 10 }, 0, 1.9, 60);
    expect(seat?.hipsBack).toBeCloseTo(26.6, 5);
  });

  it('finds nothing away from any piece', () => {
    expect(
      seatSurface(mesh, [bounds('stool')], () => 'chair', { x: 300, y: 0 }, 0, 1, 60),
    ).toBeNull();
  });
});
