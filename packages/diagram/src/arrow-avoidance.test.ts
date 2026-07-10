import { describe, expect, it } from 'vitest';
import { collisionAvoidingCurveOffset, type AvoidanceObstacle } from './arrow-avoidance';

const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  role: AvoidanceObstacle['role'] = 'other',
): AvoidanceObstacle => ({ x, y, width, height, role });

describe('collisionAvoidingCurveOffset', () => {
  it('stays straight when nothing is in the way', () => {
    const off = collisionAvoidingCurveOffset({ x: 0, y: 0 }, { x: 0, y: 400 }, [
      rect(200, 100, 120, 80),
    ]);
    expect(off).toBeNull();
  });

  it('bows away from an element the straight chord would cross', () => {
    // Vertical chord straight through a box sitting on the line. The box
    // extends 80px left of the chord but only 40px right, so the cheaper
    // bow is rightward.
    const off = collisionAvoidingCurveOffset({ x: 100, y: 0 }, { x: 100, y: 400 }, [
      rect(20, 150, 120, 80),
    ]);
    expect(off).not.toBeNull();
    expect(off!.dx).toBeGreaterThan(0);
  });

  it('bows when the chord merely grazes within the clearance margin', () => {
    // Box to the left, its right edge 6px from the chord: no intersection,
    // but inside the margin ring.
    const off = collisionAvoidingCurveOffset({ x: 100, y: 0 }, { x: 100, y: 400 }, [
      rect(0, 150, 94, 80),
    ]);
    expect(off).not.toBeNull();
    expect(off!.dx).toBeGreaterThan(0);
  });

  it('bows outward when the chord runs flush along its own endpoint boxes', () => {
    // Two stacked boxes, arrow pinned at their right edges: the chord runs
    // along x=100 touching both connected elements (the image-21 case).
    const from = { x: 100, y: 360 };
    const to = { x: 100, y: 40 };
    const off = collisionAvoidingCurveOffset(from, to, [
      rect(0, 0, 100, 80, 'to'),
      rect(0, 320, 100, 80, 'from'),
    ]);
    expect(off).not.toBeNull();
    // Away from the boxes = positive x.
    expect(off!.dx).toBeGreaterThan(0);
  });

  it('ignores obstacles that contain an endpoint (unclearable)', () => {
    const off = collisionAvoidingCurveOffset({ x: 100, y: 0 }, { x: 100, y: 400 }, [
      rect(60, -20, 80, 60), // wraps the from point
    ]);
    expect(off).toBeNull();
  });

  it('leaves stub arrows alone', () => {
    const off = collisionAvoidingCurveOffset({ x: 0, y: 0 }, { x: 10, y: 10 }, [
      rect(0, 0, 200, 200),
    ]);
    expect(off).toBeNull();
  });
});
