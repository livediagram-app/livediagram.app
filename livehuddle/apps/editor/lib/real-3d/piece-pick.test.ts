// docs/specs/008-canvas/3d-view.md "Editing in 3D": a press picks the piece whose model it lands on, not the piece
// whose coarse box happens to be nearer (the owner, 2026-11-27: "I often can't click an element to select it").
import { describe, expect, it } from 'vitest';
import { pickPiece, rayTriangles, type PieceBounds } from './piece-pick';

const bounds = (id: string, x0: number, x1: number, z1: number): PieceBounds => ({
  id,
  box: { x: x0, y: -10, width: x1 - x0, height: 20 },
  f: { cx: 0, cy: 0, yaw: 0 },
  x0,
  x1,
  y0: -10,
  y1: 10,
  z1,
});
// A level square of two triangles at height z over [x0, x1] by [-10, 10].
const square = (x0: number, x1: number, z: number) =>
  [
    [x0, -10, z, x1, -10, z, x1, 10, z],
    [x0, -10, z, x1, 10, z, x0, 10, z],
  ].flat();

describe('rayTriangles', () => {
  it('meets a triangle from either side, and misses beside it', () => {
    const pos = square(0, 10, 5);
    expect(rayTriangles(pos, 0, 6, { x: 5, y: 0, z: 20 }, { x: 0, y: 0, z: -1 })).toBeCloseTo(15);
    expect(rayTriangles(pos, 0, 6, { x: 5, y: 0, z: -20 }, { x: 0, y: 0, z: 1 })).toBeCloseTo(25);
    expect(rayTriangles(pos, 0, 6, { x: 15, y: 0, z: 20 }, { x: 0, y: 0, z: -1 })).toBeNull();
  });
});

describe('pickPiece', () => {
  // A tall "desk" box over [0, 40] whose only triangles are a top at x 20..40, and a low "chair" at x 0..10.
  const desk = bounds('desk', 0, 40, 30);
  const chair = bounds('chair', 0, 10, 8);
  const positions = [...square(20, 40, 30), ...square(0, 10, 8)];
  const ranges = new Map([
    ['desk', { from: 0, to: 6 }],
    ['chair', { from: 6, to: 12 }],
  ]);
  const down = { x: 0, y: 0, z: -1 };

  it('picks the piece whose triangles the ray meets, past a nearer box', () => {
    expect(pickPiece([desk, chair], { x: 5, y: 0, z: 50 }, down)?.id).toBe('desk');
    expect(pickPiece([desk, chair], { x: 5, y: 0, z: 50 }, down, { positions, ranges })?.id).toBe(
      'chair',
    );
    expect(pickPiece([desk, chair], { x: 30, y: 0, z: 50 }, down, { positions, ranges })?.id).toBe(
      'desk',
    );
  });

  it('falls back to the boxes when the ray meets no triangle', () => {
    expect(pickPiece([desk, chair], { x: 15, y: 0, z: 50 }, down, { positions, ranges })?.id).toBe(
      'desk',
    );
  });
});
