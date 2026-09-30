import { describe, expect, it } from 'vitest';
import {
  CORNER_TURN_DEG,
  catmullRomSegment,
  catmullRomToBezierPath,
  isStrokeCorner,
} from './index';
import { maxDistance, samplePath } from './stroke-test-traces';

// The one curve every freehand stroke draws through (docs/specs/023-whiteboard/whiteboard.md "Pens"):
// centripetal Catmull-Rom, broken at corners.

const numbers = (d: string) => d.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/g)!.map(Number);

describe('isStrokeCorner', () => {
  const o = { x: 0, y: 0 };
  const turn = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: 10 * Math.cos(a), y: 10 * Math.sin(a) };
  };

  it('treats a turn of at least the corner angle as a corner', () => {
    expect(CORNER_TURN_DEG).toBe(80);
    expect(isStrokeCorner({ x: -10, y: 0 }, o, turn(CORNER_TURN_DEG + 0.5))).toBe(true);
    expect(isStrokeCorner({ x: -10, y: 0 }, o, turn(178))).toBe(true);
  });

  it('keeps gentler turns smooth', () => {
    expect(isStrokeCorner({ x: -10, y: 0 }, o, turn(CORNER_TURN_DEG - 0.5))).toBe(false);
    expect(isStrokeCorner({ x: -10, y: 0 }, o, turn(45))).toBe(false);
  });

  it('never calls a point with a zero-length chord a corner', () => {
    expect(isStrokeCorner(o, o, { x: -10, y: 0 })).toBe(false);
  });
});

describe('catmullRomToBezierPath, centripetal', () => {
  // Unevenly spaced points, as a simplifier leaves them: a short chord beside long ones.
  const uneven = [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 31, y: 0.5 },
    { x: 32, y: 2 },
    { x: 60, y: 20 },
  ];

  it('hugs unevenly spaced points instead of overshooting', () => {
    const curve = samplePath(catmullRomToBezierPath(uneven, false), 32);
    // The uniform formula this replaced swings 1.47 px off this polyline; centripetal 0.37.
    expect(maxDistance(curve, uneven)).toBeLessThan(0.5);
  });

  it('is unchanged by a uniform scale and a shift (similarity)', () => {
    const a = numbers(catmullRomToBezierPath(uneven, false));
    const moved = uneven.map((p) => ({ x: p.x * 2 + 5, y: p.y * 2 - 3 }));
    const b = numbers(catmullRomToBezierPath(moved, false));
    b.forEach((n, i) => expect(n).toBeCloseTo(i % 2 === 0 ? a[i]! * 2 + 5 : a[i]! * 2 - 3, 9));
  });

  it('builds the curve in true proportions and then scales it', () => {
    const plain = numbers(catmullRomToBezierPath(uneven, false));
    const scaled = numbers(catmullRomToBezierPath(uneven, false, { scaleX: 2, scaleY: 0.5 }));
    scaled.forEach((n, i) => expect(n).toBeCloseTo(plain[i]! * (i % 2 === 0 ? 2 : 0.5), 9));
  });

  it('shapes every number with fmt', () => {
    const d = catmullRomToBezierPath(uneven, false, { fmt: (n) => Math.round(n) });
    expect(numbers(d).every(Number.isInteger)).toBe(true);
  });

  it('writes the same segments catmullRomSegment does', () => {
    const d = catmullRomToBezierPath(uneven, false);
    const at = (i: number) => uneven[i];
    const pieces = uneven.slice(1).map((_, i) => catmullRomSegment(at, i));
    expect(d).toBe(`M 0 0 ${pieces.join(' ')}`);
  });

  it('draws a segment between coincident points without NaN', () => {
    const d = catmullRomToBezierPath(
      [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 5, y: 5 },
        { x: 10, y: 0 },
      ],
      false,
    );
    expect(numbers(d).every(Number.isFinite)).toBe(true);
  });
});

describe('catmullRomToBezierPath, corners', () => {
  // A retrace cusp: out to the tip and straight back, a hair below.
  const cusp = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 40, y: 0 },
    { x: 20, y: 2 },
    { x: 0, y: 3 },
  ];

  it('breaks the tangent at a cusp, so the line turns on the tip without a loop', () => {
    const d = catmullRomToBezierPath(cusp, false);
    const curve = samplePath(d, 64);
    // Nothing reaches past the tip.
    expect(Math.max(...curve.map((p) => p.x))).toBeLessThanOrEqual(40 + 1e-9);
    // The segment arriving at the tip arrives along its chord.
    const arriving = numbers(catmullRomSegment((i) => cusp[i], 1));
    expect(arriving[3]).toBeCloseTo(0, 9);
  });

  it('keeps each corner of a closed triangle sharp: straight edges', () => {
    const tri = [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 30, y: 50 },
    ];
    const d = catmullRomToBezierPath(tri, true);
    expect(d.endsWith(' Z')).toBe(true);
    expect(maxDistance(samplePath(d.replace(' Z', ''), 32), [...tri, tri[0]!])).toBeLessThan(1e-9);
  });

  it('keeps a smooth closed loop round (no corners on a circle)', () => {
    const circle = Array.from({ length: 12 }, (_, i) => ({
      x: 10 * Math.cos((i * Math.PI) / 6),
      y: 10 * Math.sin((i * Math.PI) / 6),
    }));
    const curve = samplePath(catmullRomToBezierPath(circle, true).replace(' Z', ''), 16);
    for (const p of curve) expect(Math.abs(Math.hypot(p.x, p.y) - 10)).toBeLessThan(0.05);
  });
});
