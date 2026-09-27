import { describe, expect, it } from 'vitest';
import {
  IDENTITY,
  apply,
  compose,
  matrixRotationDeg,
  matrixScale,
  parseCssTransform,
  parseSvgTransform,
  translate,
} from './matrix';

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('parseCssTransform', () => {
  it('reads matrix()', () => {
    expect(parseCssTransform('matrix(1, 0, 0, 1, 10, 20)')).toEqual({
      matrix: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 },
      unknown: [],
    });
  });

  it('reads translate and scale in order', () => {
    const { matrix } = parseCssTransform('translate(10px, 20px) scale(2)');
    const p = apply(matrix, { x: 1, y: 1 });
    expect(p).toEqual({ x: 12, y: 22 });
  });

  it('reads rotate in degrees, radians and turns', () => {
    for (const value of ['90deg', `${Math.PI / 2}rad`, '0.25turn']) {
      const p = apply(parseCssTransform(`rotate(${value})`).matrix, { x: 1, y: 0 });
      close(p.x, 0);
      close(p.y, 1);
    }
  });

  it('reads translateX, translateY and two-argument scale', () => {
    const p = apply(parseCssTransform('translateX(5px) translateY(-3px) scale(2, 3)').matrix, {
      x: 1,
      y: 1,
    });
    expect(p).toEqual({ x: 7, y: 0 });
  });

  it('treats none and empty as identity', () => {
    expect(parseCssTransform('none').matrix).toEqual(IDENTITY);
    expect(parseCssTransform('').matrix).toEqual(IDENTITY);
  });

  it('names functions it does not know and skips them', () => {
    const result = parseCssTransform('skewX(10deg) translate(1px, 2px)');
    expect(result.unknown).toEqual(['skewX']);
    expect(apply(result.matrix, { x: 0, y: 0 })).toEqual({ x: 1, y: 2 });
  });

  it('treats unparsable numbers as identity for that function', () => {
    const result = parseCssTransform('matrix(1, 0, 0, nope, 0, 0)');
    expect(result.matrix).toEqual(IDENTITY);
    expect(result.unknown).toEqual(['matrix']);
  });
});

describe('parseSvgTransform', () => {
  it('reads space- and comma-separated SVG lists', () => {
    const m = parseSvgTransform('translate(10 20) scale(2,2)').matrix;
    expect(apply(m, { x: 1, y: 1 })).toEqual({ x: 12, y: 22 });
  });

  it('reads rotate with a centre', () => {
    const p = apply(parseSvgTransform('rotate(180 5 5)').matrix, { x: 0, y: 0 });
    close(p.x, 10);
    close(p.y, 10);
  });
});

describe('compose', () => {
  it('applies the right matrix first', () => {
    const m = compose(translate(10, 0), parseCssTransform('scale(2)').matrix);
    expect(apply(m, { x: 1, y: 1 })).toEqual({ x: 12, y: 2 });
  });
});

describe('matrixRotationDeg and matrixScale', () => {
  it('reads the rotation and scale a matrix carries', () => {
    const m = parseCssTransform('rotate(30deg) scale(2, 3)').matrix;
    close(matrixRotationDeg(m), 30);
    const s = matrixScale(m);
    close(s.x, 2);
    close(s.y, 3);
  });

  it('normalises rotation into (-180, 180]', () => {
    close(matrixRotationDeg(parseCssTransform('rotate(270deg)').matrix), -90);
    close(matrixRotationDeg(parseCssTransform('rotate(-180deg)').matrix), 180);
  });
});
