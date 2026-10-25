import { describe, expect, it } from 'vitest';
import { elementKindLabel } from './element-kind-label';
import type { Element } from './index';

// Minimal element stubs — elementKindLabel only reads `type` (+ `shape`).
const shape = (kind: string) => ({ type: 'shape', shape: kind }) as unknown as Element;
const ofType = (type: string) => ({ type }) as unknown as Element;

describe('elementKindLabel', () => {
  it('title-cases a simple shape kind', () => {
    expect(elementKindLabel(shape('square'))).toBe('Square');
    expect(elementKindLabel(shape('circle'))).toBe('Circle');
    expect(elementKindLabel(shape('cylinder'))).toBe('Cylinder');
  });

  it('spaces hyphenated shape kinds', () => {
    expect(elementKindLabel(shape('speech-bubble'))).toBe('Speech Bubble');
  });

  it('names the icon shape', () => {
    expect(elementKindLabel(shape('icon'))).toBe('Icon');
  });

  it('names non-shape element types', () => {
    expect(elementKindLabel(ofType('text'))).toBe('Text');
    expect(elementKindLabel(ofType('table'))).toBe('Table');
    expect(elementKindLabel(ofType('sticky'))).toBe('Sticky');
    expect(elementKindLabel(ofType('image'))).toBe('Image');
    expect(elementKindLabel(ofType('freehand'))).toBe('Sketch');
    // Freehand variants (docs/specs/006-project/stroke-points.md highlighter, docs/specs/008-canvas/finish.md "Polygons" polygon tool).
    const freehand = (extra: object) => ({ type: 'freehand', ...extra }) as unknown as Element;
    expect(elementKindLabel(freehand({ pen: 'highlighter' }))).toBe('Highlight');
    expect(elementKindLabel(freehand({ straightEdges: true }))).toBe('Polyline');
    expect(elementKindLabel(freehand({ straightEdges: true, closed: true }))).toBe('Polygon');
    expect(elementKindLabel(ofType('annotation'))).toBe('Annotation');
    expect(elementKindLabel(ofType('link-card'))).toBe('Link');
    expect(elementKindLabel(ofType('arrow'))).toBe('Arrow');
  });
});

describe('elementKindLabel — stickies', () => {
  const note = (extra: Record<string, unknown>) =>
    ({ id: 'n', type: 'sticky', x: 0, y: 0, width: 200, height: 200, ...extra }) as Element;

  it('names a sticky "Sticky", whatever its colour', () => {
    expect(elementKindLabel(note({}))).toBe('Sticky');
    expect(elementKindLabel(note({ fillColor: '#93c5fd', fixedSize: true }))).toBe('Sticky');
  });
});

// docs/specs/009-elements/pie-chart.md "Chart types": a chart is named as the palette names it.
describe('a chart', () => {
  it('is named by its chart type, not its stored kind', () => {
    expect(elementKindLabel(shape('bar-chart'))).toBe('Column Chart');
    const area = { type: 'shape', shape: 'line-chart', chartVariant: 'area' } as unknown as Element;
    expect(elementKindLabel(area)).toBe('Area Chart');
    expect(elementKindLabel(shape('pie-chart'))).toBe('Pie Chart');
  });
});
