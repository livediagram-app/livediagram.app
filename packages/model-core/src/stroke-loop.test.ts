import { describe, expect, it } from 'vitest';
import {
  closeStrokeLoop,
  inPointsBox,
  insideLoop,
  isStrokeLoop,
  loopArea,
  loopPerimeter,
  loopFillPath,
  strokeLoopGap,
  strokeLoopTolerance,
  STROKE_LOOP_MIN_GAP_PX,
} from './stroke-loop';

// A circle of radius r round (cx, cy), sampled `n` times, stopping `gapDeg` short of a full turn.
function arc(r: number, gapDeg = 0, n = 48, cx = 100, cy = 100) {
  const sweep = ((360 - gapDeg) * Math.PI) / 180;
  return Array.from({ length: n }, (_, i) => {
    const a = (sweep * i) / (n - 1);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

describe('when ends meet', () => {
  it('takes a loop that closes, and one that leaves a small gap', () => {
    expect(isStrokeLoop(arc(50), 1.5)).toBe(true);
    // 15 degrees of a 50 px circle leaves about 13 px: within the 16 px floor.
    expect(isStrokeLoop(arc(50, 15), 1.5)).toBe(true);
    // 15 degrees of a 200 px circle leaves about 52 px: within 15% of its 400 px side.
    expect(isStrokeLoop(arc(200, 15), 1.5)).toBe(true);
  });

  it('refuses a gap past the tolerance, too few points, and nothing enclosed', () => {
    expect(isStrokeLoop(arc(50, 90), 1.5)).toBe(false);
    expect(isStrokeLoop(arc(50).slice(0, 3), 1.5)).toBe(false);
    // Out and back along a line: the ends meet but it encloses nothing.
    const line = [
      { x: 0, y: 0 },
      { x: 50, y: 1 },
      { x: 100, y: 0 },
      { x: 50, y: 2 },
      { x: 1, y: 1 },
    ];
    expect(isStrokeLoop(line, 1.5)).toBe(false);
    // A stroke drawn on one spot has no length at all.
    expect(isStrokeLoop(Array.from({ length: 5 }, () => ({ x: 3, y: 3 })), 1.5)).toBe(false);
    // A long thin oval (10:1) is still a loop.
    const oval = arc(50).map((p) => ({ x: p.x, y: 100 + (p.y - 100) / 10 }));
    expect(isStrokeLoop(oval, 1.5)).toBe(true);
  });

  it('forgives the largest of the floor, three pen widths and 15% of the longer side', () => {
    const small = arc(10);
    expect(strokeLoopTolerance(small, 1)).toBe(STROKE_LOOP_MIN_GAP_PX);
    expect(strokeLoopTolerance(small, 9)).toBe(27);
    expect(strokeLoopTolerance(arc(500), 1)).toBeCloseTo(150, 0);
    expect(strokeLoopTolerance([], 1)).toBe(STROKE_LOOP_MIN_GAP_PX);
  });

  it('measures the gap and the area', () => {
    expect(strokeLoopGap([{ x: 0, y: 0 }])).toBe(0);
    expect(
      strokeLoopGap([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ]),
    ).toBe(5);
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(loopArea(square)).toBe(100);
    expect(loopPerimeter(square)).toBe(40);
  });
});

describe('closing a loop', () => {
  it('adds the first point at the end, with the last pressure', () => {
    const pts = arc(50, 20, 8);
    const closed = closeStrokeLoop(pts, [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
    expect(closed.points).toHaveLength(9);
    expect(closed.points[8]).toEqual(pts[0]);
    expect(closed.pressures).toEqual([0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.9]);
  });

  it('leaves a loop whose ends already touch, and has no pressures to add without any', () => {
    const pts = arc(50, 0, 8);
    expect(closeStrokeLoop(pts).points).toHaveLength(8);
    expect(closeStrokeLoop(pts).pressures).toBeUndefined();
    expect(closeStrokeLoop(arc(50, 20, 8), null).points).toHaveLength(9);
  });
});

describe('inside a loop', () => {
  it('is even-odd, closed across the gap', () => {
    const pts = arc(50, 20);
    expect(insideLoop({ x: 100, y: 100 }, pts)).toBe(true);
    expect(insideLoop({ x: 10, y: 10 }, pts)).toBe(false);
  });

  it('checks the box first, grown by a pad', () => {
    const pts = arc(50);
    expect(inPointsBox({ x: 100, y: 100 }, pts)).toBe(true);
    expect(inPointsBox({ x: 160, y: 100 }, pts)).toBe(false);
    expect(inPointsBox({ x: 160, y: 100 }, pts, 20)).toBe(true);
    expect(inPointsBox({ x: 0, y: 0 }, [])).toBe(false);
  });
});

describe('the fill path', () => {
  it('is a closed polygon through the points, or nothing under three', () => {
    expect(
      loopFillPath([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10.123 },
      ]),
    ).toBe('M 0 0 L 10 0 L 10 10.123 Z');
    expect(
      loopFillPath(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10.126 },
        ],
        (n) => Math.round(n * 100) / 100,
      ),
    ).toBe('M 0 0 L 10 0 L 10 10.13 Z');
    expect(loopFillPath([{ x: 0, y: 0 }])).toBe('');
  });
});
