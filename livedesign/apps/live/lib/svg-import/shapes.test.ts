// docs/specs/020-import-export/svg-import.md "Geometry": the basic shapes as contours, curves within 0.25 px.
import { describe, expect, it } from 'vitest';
import type { Contour, Pt, Segment } from './geometry';
import { arcPieces } from './arc';
import { parseLength, shapeContours } from './shapes';

const VP = { width: 200, height: 100 };
const attrs = (a: Record<string, string>) => (n: string) => a[n] ?? null;
const shape = (tag: string, a: Record<string, string>, px = 1) =>
  shapeContours(tag, attrs(a), VP, px);

function at(p0: Pt, s: Segment, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x,
    y: u * u * u * p0.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y,
  };
}

// The largest distance of the contour's curve from the ellipse (in units).
function worstEllipseError(c: Contour, cx: number, cy: number, rx: number, ry: number): number {
  let worst = 0;
  let p0 = c.start;
  for (const s of c.segments) {
    for (let t = 0; t <= 1; t += 0.05) {
      const p = at(p0, s, t);
      const a = Math.atan2((p.y - cy) / ry, (p.x - cx) / rx);
      const q = { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
      worst = Math.max(worst, Math.hypot(p.x - q.x, p.y - q.y));
    }
    p0 = s.to;
  }
  return worst;
}

describe('parseLength', () => {
  it('reads units and percentages', () => {
    expect(parseLength('10', 'x', VP)).toBe(10);
    expect(parseLength('10px', 'x', VP)).toBe(10);
    expect(parseLength('3pt', 'x', VP)).toBe(4);
    expect(parseLength('1pc', 'x', VP)).toBe(16);
    expect(parseLength('25.4mm', 'x', VP)).toBeCloseTo(96);
    expect(parseLength('2.54cm', 'x', VP)).toBeCloseTo(96);
    expect(parseLength('1in', 'x', VP)).toBe(96);
    expect(parseLength('50%', 'x', VP)).toBe(100);
    expect(parseLength('50%', 'y', VP)).toBe(50);
    expect(parseLength('100%', 'd', VP)).toBeCloseTo(Math.hypot(200, 100) / Math.SQRT2);
    expect(parseLength(null, 'x', VP, 7)).toBe(7);
    expect(parseLength('auto', 'x', VP, 7)).toBe(7);
    expect(parseLength('3em', 'x', VP, 7)).toBe(7);
  });
});

describe('shapeContours', () => {
  it('draws a rect as four straight sides, closed', () => {
    const [c] = shape('rect', { x: '1', y: '2', width: '10', height: '5' })!;
    expect(c!.closed).toBe(true);
    expect(c!.segments).toHaveLength(4);
    expect(c!.segments.every((s) => s.line)).toBe(true);
    expect(shape('rect', { width: '0', height: '5' })).toEqual([]);
  });

  it('rounds a rect, one radius standing for both and clamped to half the side', () => {
    const [c] = shape('rect', { width: '100', height: '40', rx: '10' })!;
    // Four straight sides and four corner arcs.
    expect(c!.segments.filter((s) => s.line)).toHaveLength(4);
    expect(c!.segments.filter((s) => !s.line)).toHaveLength(4);
    const [pill] = shape('rect', { width: '100', height: '40', ry: '80' })!;
    // Each radius is clamped on its own (50 by 20): both straight runs vanish, leaving an ellipse.
    expect(pill!.segments.filter((s) => s.line)).toHaveLength(0);
    const [stadium] = shape('rect', { width: '100', height: '40', rx: '20' })!;
    expect(stadium!.segments.filter((s) => s.line)).toHaveLength(2);
    const [auto] = shape('rect', { width: '10', height: '10', rx: 'auto', ry: '2' })!;
    expect(auto!.segments.filter((s) => !s.line)).toHaveLength(4);
    const [square] = shape('rect', { width: '10', height: '10', rx: '0', ry: '3' })!;
    expect(square!.segments).toHaveLength(4);
  });

  it('draws circles and ellipses within 0.25 px at their landed size', () => {
    const [c] = shape('circle', { cx: '50', cy: '50', r: '40' }, 10)!;
    expect(worstEllipseError(c!, 50, 50, 40, 40) * 10).toBeLessThan(0.25);
    const [e] = shape('ellipse', { cx: '0', cy: '0', rx: '80', ry: '20' }, 10)!;
    expect(worstEllipseError(e!, 0, 0, 80, 20) * 10).toBeLessThan(0.25);
    expect(shape('circle', { r: '0' })).toEqual([]);
    expect(shape('ellipse', { rx: '5' })).toEqual([]);
  });

  it('keeps a small circle at four nodes and splits a large one finer', () => {
    expect(shape('circle', { r: '10' })![0]!.segments).toHaveLength(4);
    expect(shape('circle', { r: '10' }, 500)![0]!.segments.length).toBeGreaterThan(4);
    expect(arcPieces(Math.PI / 2, 100)).toBe(1);
    expect(arcPieces(Math.PI / 2, 10_000)).toBeGreaterThan(1);
  });

  it('draws lines, polylines and polygons', () => {
    expect(shape('line', { x1: '0', y1: '0', x2: '5', y2: '5' })![0]!.closed).toBe(false);
    expect(shape('line', { x1: '1', y1: '1', x2: '1', y2: '1' })).toEqual([]);
    const [pl] = shape('polyline', { points: '0,0 10,0 10,10 3' })!;
    expect(pl!.segments).toHaveLength(2);
    expect(pl!.closed).toBe(false);
    const [pg] = shape('polygon', { points: '0 0 10 0 10 10' })!;
    expect(pg!.segments).toHaveLength(3);
    expect(pg!.closed).toBe(true);
    const [shut] = shape('polygon', { points: '0 0 10 0 10 10 0 0' })!;
    expect(shut!.segments).toHaveLength(3);
    expect(shape('polygon', { points: '1 1' })).toEqual([]);
    expect(shape('polygon', {})).toEqual([]);
  });

  it('answers null for anything that is not a basic shape', () => {
    expect(shape('text', {})).toBeNull();
  });
});
