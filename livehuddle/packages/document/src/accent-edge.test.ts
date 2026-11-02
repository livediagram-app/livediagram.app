import { describe, expect, it } from 'vitest';
import {
  accentEdgeRect,
  accentEdgeThickness,
  resolvedAccentEdge,
  supportsAccentEdge,
  svgAccentEdge,
} from './accent-edge';
import { boxedNeedsSvgRaster, createShape, svgBoxed, type ShapeElement } from './index';

const square = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('square', 0, 0),
  id: 'sq1',
  x: 10,
  y: 20,
  width: 200,
  height: 100,
  ...over,
});

describe('accent edge (docs/specs/008-canvas/accent-edge.md)', () => {
  it('is offered on the box shapes only', () => {
    for (const shape of ['square', 'stadium', 'card', 'mind-node'])
      expect(supportsAccentEdge({ type: 'shape', shape }), shape).toBe(true);
    for (const shape of ['circle', 'diamond', 'cylinder', 'frame'])
      expect(supportsAccentEdge({ type: 'shape', shape }), shape).toBe(false);
    expect(supportsAccentEdge({ type: 'sticky' })).toBe(false);
  });

  it('resolves to none on an unsupported kind or an unknown value', () => {
    expect(resolvedAccentEdge(square({ accentEdge: 'left' }))).toBe('left');
    expect(resolvedAccentEdge(square())).toBeNull();
    expect(resolvedAccentEdge(square({ accentEdge: 'right' as never }))).toBeNull();
    expect(resolvedAccentEdge(square({ shape: 'circle', accentEdge: 'top' }))).toBeNull();
  });

  it('holds the thickness between 3 and 6 px, a share of the shorter side', () => {
    expect(accentEdgeThickness(20, 20)).toBe(3);
    expect(accentEdgeThickness(80, 80)).toBeCloseTo(4.8);
    expect(accentEdgeThickness(400, 300)).toBe(6);
  });

  it('lays the bar along its edge of the inner box', () => {
    expect(accentEdgeRect('left', 100, 50, 5)).toEqual({ x: 0, y: 0, width: 5, height: 50 });
    expect(accentEdgeRect('top', 100, 50, 5)).toEqual({ x: 0, y: 0, width: 100, height: 5 });
    expect(accentEdgeRect('bottom', 100, 50, 5)).toEqual({ x: 0, y: 45, width: 100, height: 5 });
  });

  it('exports a bar clipped inside the border, in its own colour or the border colour', () => {
    const own = svgAccentEdge(square({ accentEdge: 'left', accentEdgeColor: '#ff0000' }), {
      stroke: '#123456',
      borderWidth: 2,
      radius: 8,
    });
    expect(own).toContain(
      '<clipPath id="lvd-ae-sq1"><rect x="12" y="22" width="196" height="96" rx="6"/>',
    );
    expect(own).toContain('fill="#ff0000" clip-path="url(#lvd-ae-sq1)"');
    const inherited = svgAccentEdge(square({ accentEdge: 'top' }), {
      stroke: '#123456',
      borderWidth: 2,
      radius: 8,
    });
    expect(inherited).toContain('fill="#123456"');
    expect(svgAccentEdge(square(), { stroke: '#000', borderWidth: 2, radius: 8 })).toBe('');
  });

  it('draws in the full element export', () => {
    expect(svgBoxed(square({ accentEdge: 'bottom' }))).toContain('clip-path="url(#lvd-ae-sq1)"');
    expect(svgBoxed(square())).not.toContain('lvd-ae-');
  });
});

describe('accent edge writes', () => {
  it('sets and clears on a supported shape only', async () => {
    const { withAccentEdge, withAccentEdgeColor } = await import('./accent-edge');
    const on = withAccentEdge(square(), 'top');
    expect(on.accentEdge).toBe('top');
    expect('accentEdge' in withAccentEdge(on, null)).toBe(false);
    const circle = square({ shape: 'circle' });
    expect(withAccentEdge(circle, 'left')).toBe(circle);
    expect(withAccentEdgeColor(on, '#00ff00').accentEdgeColor).toBe('#00ff00');
    expect('accentEdgeColor' in withAccentEdgeColor(on, null)).toBe(false);
  });
});

describe('accent edge in the PNG / PDF path', () => {
  it('rasterises through the SVG only when the element draws an edge', () => {
    expect(boxedNeedsSvgRaster(square({ accentEdge: 'left' }))).toBe(true);
    expect(boxedNeedsSvgRaster(square())).toBe(false);
  });
});
