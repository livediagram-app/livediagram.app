import { describe, expect, it } from 'vitest';
import {
  createArrow,
  createFreehand,
  createShape,
  createText,
  type Element,
} from '@livediagram/diagram';
import {
  DEFAULT_ERASER_CONFIG,
  eraserAllows,
  eraserRadius,
  eraserSamplePoints,
  parseEraserConfig,
  ERASER_SIZES,
} from './eraser-config';

describe('the default eraser', () => {
  it('is the eraser as it always was: a one-pixel sweep that takes anything', () => {
    expect(DEFAULT_ERASER_CONFIG).toEqual({
      mode: 'sweep',
      size: 'point',
      target: 'anything',
    });
    expect(eraserRadius(DEFAULT_ERASER_CONFIG)).toBe(0);
  });
});

describe('eraserSamplePoints', () => {
  it('asks the hit test once for a Point brush', () => {
    expect(eraserSamplePoints(10, 20, 0)).toEqual([{ x: 10, y: 20 }]);
  });

  it('samples the centre and two rings for a sized brush', () => {
    const points = eraserSamplePoints(0, 0, 40);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points).toHaveLength(25);
    // Every sample lands inside the brush, and the furthest reach its edge —
    // a ring beyond the radius would erase things the user can't see it over.
    const distances = points.map((p) => Math.hypot(p.x, p.y));
    expect(Math.max(...distances)).toBeCloseTo(40);
    for (const d of distances) expect(d).toBeLessThanOrEqual(40.001);
  });

  it('grows with the size setting', () => {
    const radii = ERASER_SIZES.map((s) => eraserRadius({ ...DEFAULT_ERASER_CONFIG, size: s.id }));
    expect([...radii].sort((a, b) => a - b)).toEqual(radii);
  });
});

describe('eraserAllows', () => {
  const shape = createShape('square', 0, 0);
  const text = createText(0, 0);
  const arrow: Element = createArrow(0, 0, 10, 10);
  const drawing: Element = createFreehand(
    [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
    false,
  );

  it('lets everything through by default', () => {
    for (const el of [shape, text, arrow, drawing]) expect(eraserAllows(el, 'anything')).toBe(true);
  });

  it('protects the diagram when set to drawings', () => {
    expect(eraserAllows(drawing, 'drawings')).toBe(true);
    expect(eraserAllows(shape, 'drawings')).toBe(false);
    expect(eraserAllows(arrow, 'drawings')).toBe(false);
    expect(eraserAllows(text, 'drawings')).toBe(false);
  });

  it('protects the boxes when set to arrows', () => {
    expect(eraserAllows(arrow, 'arrows')).toBe(true);
    expect(eraserAllows(shape, 'arrows')).toBe(false);
    expect(eraserAllows(drawing, 'arrows')).toBe(false);
  });
});

describe('parseEraserConfig', () => {
  it('costs one field, not the whole config, when a token is unknown', () => {
    expect(parseEraserConfig({ mode: 'nibble', size: 'large', target: 'drawings' })).toEqual({
      mode: 'sweep',
      size: 'large',
      target: 'drawings',
    });
  });

  it('falls back completely for junk', () => {
    expect(parseEraserConfig(null)).toEqual(DEFAULT_ERASER_CONFIG);
    expect(parseEraserConfig('not json')).toEqual(DEFAULT_ERASER_CONFIG);
  });
});
