// docs/specs/020-import-export/svg-import.md "Geometry": transform lists as one matrix, plus the matrix helpers.
import { describe, expect, it } from 'vitest';
import {
  apply,
  contoursBox,
  IDENTITY,
  maxScaleOf,
  multiply,
  scaleOf,
  transformContour,
} from './geometry';
import { parsePathData } from './path-data';
import { parseTransform } from './transform';

const close = (m: readonly number[], want: number[]) =>
  m.forEach((v, i) => expect(v).toBeCloseTo(want[i]!, 9));

describe('parseTransform', () => {
  it('reads each function', () => {
    close(parseTransform('matrix(1 2 3 4 5 6)'), [1, 2, 3, 4, 5, 6]);
    close(parseTransform('translate(5)'), [1, 0, 0, 1, 5, 0]);
    close(parseTransform('translate(5,6)'), [1, 0, 0, 1, 5, 6]);
    close(parseTransform('scale(2)'), [2, 0, 0, 2, 0, 0]);
    close(parseTransform('scale(2 3)'), [2, 0, 0, 3, 0, 0]);
    close(parseTransform('rotate(90)'), [0, 1, -1, 0, 0, 0]);
    close(parseTransform('skewX(45)'), [1, 0, 1, 1, 0, 0]);
    close(parseTransform('skewY(45)'), [1, 1, 0, 1, 0, 0]);
  });

  it('rotates about a point', () => {
    const p = apply(parseTransform('rotate(180 10 10)'), { x: 0, y: 0 });
    expect(p.x).toBeCloseTo(20);
    expect(p.y).toBeCloseTo(20);
  });

  it('applies a list left to right (the first is outermost)', () => {
    const p = apply(parseTransform('translate(10 0) scale(2)'), { x: 1, y: 1 });
    expect(p).toEqual({ x: 12, y: 2 });
  });

  it('ignores an empty or malformed list whole', () => {
    expect(parseTransform(null)).toBe(IDENTITY);
    expect(parseTransform('')).toBe(IDENTITY);
    expect(parseTransform('translate(5) wobble(3)')).toBe(IDENTITY);
    expect(parseTransform('translate 5')).toBe(IDENTITY);
    expect(parseTransform('translate(5')).toBe(IDENTITY);
    expect(parseTransform('translate(a)')).toBe(IDENTITY);
    expect(parseTransform('matrix(1 2 3)')).toBe(IDENTITY);
    expect(parseTransform('rotate(1 2)')).toBe(IDENTITY);
    expect(parseTransform('translate(1 2 3)')).toBe(IDENTITY);
    expect(parseTransform('scale(1 2 3)')).toBe(IDENTITY);
    expect(parseTransform('skewX(1 2)')).toBe(IDENTITY);
    expect(parseTransform('skewY()')).toBe(IDENTITY);
    expect(parseTransform('matrix(1 2 3 4 5 6 7)')).toBe(IDENTITY);
  });
});

describe('matrix helpers', () => {
  it('measures the scale of a matrix', () => {
    expect(scaleOf([2, 0, 0, 8, 0, 0])).toBe(4);
    expect(maxScaleOf([2, 0, 0, 8, 0, 0])).toBeCloseTo(8);
    expect(maxScaleOf(multiply(parseTransform('rotate(30)'), [3, 0, 0, 1, 0, 0]))).toBeCloseTo(3);
  });

  it('carries a contour through a matrix, straight segments still straight', () => {
    const [c] = parsePathData('M0 0 L10 0 C10 5 5 10 0 10');
    const t = transformContour(c!, [2, 0, 0, 2, 1, 1]);
    expect(t.start).toEqual({ x: 1, y: 1 });
    expect(t.segments[0]!.line).toBe(true);
    expect(t.segments[1]!.line).toBeUndefined();
    expect(t.segments[1]!.to).toEqual({ x: 1, y: 21 });
  });

  it('boxes the drawn curve, not its control points', () => {
    const box = contoursBox(parsePathData('M0 0 C0 -40 100 -40 100 0'));
    expect(box!.y0).toBeCloseTo(-30);
    expect(box!.x1).toBe(100);
    expect(contoursBox([])).toBeNull();
    // A curve whose derivative is linear (a quadratic raised to a cubic) and one along a straight run.
    expect(contoursBox(parsePathData('M0 0 Q50 -20 100 0'))!.y0).toBeCloseTo(-10);
    expect(contoursBox(parsePathData('M0 0 C0 0 0 0 0 10'))!.y1).toBe(10);
  });
});
