import { describe, expect, it } from 'vitest';
import { createFreehand } from './factories';
import { handDrawnElementPaint } from './hand-drawn';
import { MARKER_LINE_PX } from './finish';
import { isPolygonOutline, polygonStrokePx } from './drawn-outline-finish';
import { svgBoxed } from './svg-render';

// docs/specs/008-canvas/finish.md "Polygons".
const vertices = [
  { x: 0, y: 0 },
  { x: 200, y: 20 },
  { x: 160, y: 140 },
  { x: 10, y: 120 },
];
const polygon = (closed = true) => ({
  ...createFreehand(vertices, closed),
  id: 'poly',
  straightEdges: true,
});

describe('isPolygonOutline', () => {
  it('names a Polygon-tool outline, never a pencil or highlighter stroke', () => {
    expect(isPolygonOutline(polygon())).toBe(true);
    expect(isPolygonOutline({ ...polygon(), straightEdges: undefined })).toBe(false);
    expect(isPolygonOutline({ ...polygon(), pen: 'highlighter' })).toBe(false);
  });
});

describe('polygonStrokePx', () => {
  it('draws an unset line Thin under Professional and at the nib under Marker', () => {
    expect(polygonStrokePx(polygon(), 'flexible')).toBe(2);
    expect(polygonStrokePx(polygon(), 'professional')).toBe(1);
    expect(polygonStrokePx(polygon(), 'marker')).toBe(MARKER_LINE_PX);
    expect(polygonStrokePx({ ...polygon(), strokeWidth: 'thick' }, 'professional')).toBeGreaterThan(
      2,
    );
  });
});

describe('a polygon drawn by hand', () => {
  it('is drawn by hand under Sketch, shaded when closed', () => {
    const paint = handDrawnElementPaint(polygon(), 'sketch', '#bae6fd');
    if (paint?.drawing.pen !== 'pencil') throw new Error('expected pencil');
    expect(paint.drawing.strokes).not.toBe('');
    expect(paint.drawing.solid).not.toBe('');
    expect(paint.drawing.hatch).not.toBe('');
  });

  it('is drawn in marker under Marker, coloured in when closed', () => {
    const paint = handDrawnElementPaint(polygon(), 'marker', '#bae6fd');
    if (paint?.drawing.pen !== 'marker') throw new Error('expected marker');
    expect(paint.drawing.ink.join('')).not.toBe('');
    expect(paint.drawing.streaks.join('')).not.toBe('');
  });

  it('draws an open polyline as a line only', () => {
    const paint = handDrawnElementPaint(polygon(false), 'marker', '#bae6fd');
    if (paint?.drawing.pen !== 'marker') throw new Error('expected marker');
    expect(paint.drawing.solid).toBe('');
    expect(paint.drawing.streaks.join('')).toBe('');
  });

  it('leaves a pencil stroke and Flexible as drawn', () => {
    expect(
      handDrawnElementPaint({ ...polygon(), straightEdges: undefined }, 'sketch', '#fff'),
    ).toBeNull();
    expect(handDrawnElementPaint(polygon(), 'flexible', '#fff')).toBeNull();
  });

  it('exports drawn by hand in its finish', () => {
    expect(svgBoxed(polygon(), {})).not.toContain('data-finish');
    expect(svgBoxed(polygon(), { tabFinish: 'sketch' })).toContain('data-finish="sketch"');
    expect(svgBoxed(polygon(), { tabFinish: 'marker' })).toContain('data-finish="marker"');
    expect(svgBoxed(polygon(), { tabFinish: 'professional' })).toContain('stroke-width="1"');
  });
});
