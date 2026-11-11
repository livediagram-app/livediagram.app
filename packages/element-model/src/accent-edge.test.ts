import { describe, expect, it } from 'vitest';
import {
  ACCENT_EDGES,
  accentEdgeColour,
  accentEdgeRect,
  accentEdgeThickness,
  isAccentEdge,
  resolvedAccentEdge,
  supportsAccentEdge,
  svgAccentEdge,
  withAccentEdge,
  withAccentEdgeColor,
} from './accent-edge';
import type { ShapeElement } from './element';
import { createShape, createText } from './testing/elements';

// docs/specs/008-canvas/accent-edge.md. Each product's own test reads the bar through its renderer.
const box = (shape = 'square', over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape(shape, 0, 0),
  id: 'b1',
  width: 200,
  height: 100,
  ...over,
});

describe('which elements take an edge', () => {
  it('takes the straight-edged box kinds, and nothing else', () => {
    for (const shape of ['square', 'stadium', 'card', 'mind-node'])
      expect(supportsAccentEdge(box(shape))).toBe(true);
    for (const shape of ['circle', 'diamond']) expect(supportsAccentEdge(box(shape))).toBe(false);
    expect(supportsAccentEdge(createText(0, 0))).toBe(false);
    expect(supportsAccentEdge({ type: 'shape' })).toBe(false);
  });

  it('knows the three edges', () => {
    expect(ACCENT_EDGES.every(isAccentEdge)).toBe(true);
    expect(isAccentEdge('right')).toBe(false);
  });

  it('resolves an edge only on a kind that takes one, with a known value', () => {
    expect(resolvedAccentEdge(box('square', { accentEdge: 'top' }))).toBe('top');
    expect(resolvedAccentEdge(box('circle', { accentEdge: 'top' }))).toBeNull();
    expect(resolvedAccentEdge(box('square', { accentEdge: 'right' as 'top' }))).toBeNull();
    expect(resolvedAccentEdge(createText(0, 0))).toBeNull();
  });
});

describe('the bar', () => {
  it('is a share of the shorter side, held between 3 and 6', () => {
    expect(accentEdgeThickness(200, 100)).toBe(6);
    expect(accentEdgeThickness(60, 60)).toBeCloseTo(3.6);
    expect(accentEdgeThickness(20, 20)).toBe(3);
  });

  it('lies along its edge, never thicker than the box', () => {
    expect(accentEdgeRect('left', 200, 100, 5)).toEqual({ x: 0, y: 0, width: 5, height: 100 });
    expect(accentEdgeRect('top', 200, 100, 5)).toEqual({ x: 0, y: 0, width: 200, height: 5 });
    expect(accentEdgeRect('bottom', 200, 100, 5)).toEqual({ x: 0, y: 95, width: 200, height: 5 });
    expect(accentEdgeRect('left', 2, 100, 5).width).toBe(2);
    expect(accentEdgeRect('top', 200, 100)).toEqual({ x: 0, y: 0, width: 200, height: 6 });
  });

  it('takes its own colour, else the border as drawn', () => {
    expect(accentEdgeColour(box('square', { accentEdgeColor: '#ff0000' }), '#000')).toBe('#ff0000');
    expect(accentEdgeColour(box(), '#000')).toBe('#000');
  });
});

describe('svgAccentEdge', () => {
  it('draws a clipped bar inside the border', () => {
    const svg = svgAccentEdge(box('square', { accentEdge: 'left' }), {
      stroke: '#123456',
      borderWidth: 2,
      radius: 8,
    });
    expect(svg).toContain('<clipPath id="lvd-ae-b1">');
    expect(svg).toContain('x="2" y="2" width="196" height="96" rx="6"');
    expect(svg).toContain('fill="#123456"');
  });

  it('draws nothing without an edge, or with no room inside the border', () => {
    const o = { stroke: '#000', borderWidth: 2, radius: 4 };
    expect(svgAccentEdge(box(), o)).toBe('');
    expect(svgAccentEdge(box('square', { accentEdge: 'top', width: 4 }), o)).toBe('');
  });
});

describe('withAccentEdge and withAccentEdgeColor', () => {
  it('sets and clears the edge and its colour on a kind that takes one', () => {
    const on = withAccentEdge(box(), 'bottom');
    expect(on.accentEdge).toBe('bottom');
    expect(withAccentEdge(on, null)).not.toHaveProperty('accentEdge');
    const coloured = withAccentEdgeColor(on, '#00ff00');
    expect(coloured.accentEdgeColor).toBe('#00ff00');
    expect(withAccentEdgeColor(coloured, null)).not.toHaveProperty('accentEdgeColor');
  });

  it('leaves any other element as it was', () => {
    const circle = box('circle');
    expect(withAccentEdge(circle, 'top')).toBe(circle);
    expect(withAccentEdgeColor(circle, '#fff')).toBe(circle);
  });
});
