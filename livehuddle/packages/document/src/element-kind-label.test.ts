import { describe, expect, it } from 'vitest';
import { elementKindLabel } from './element-kind-label';
import type { Element } from './index';

// Minimal element stubs — elementKindLabel only reads `type` (+ `shape`).
const shape = (kind: string) => ({ type: 'shape', shape: kind }) as unknown as Element;
const ofType = (type: string) => ({ type }) as unknown as Element;

describe('elementKindLabel', () => {
  it('title-cases a simple shape kind', () => {
    expect(elementKindLabel(shape('room'))).toBe('Room');
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
    expect(elementKindLabel(ofType('link-card'))).toBe('Link');
  });

  // The retired types go by their placeholder's name (element-engine.md D24): every pen stroke is a Drawing.
  it('names a stored arrow, line, drawing, path and annotation', () => {
    expect(elementKindLabel(ofType('freehand'))).toBe('Drawing');
    const freehand = (extra: object) => ({ type: 'freehand', ...extra }) as unknown as Element;
    expect(elementKindLabel(freehand({ pen: 'highlighter' }))).toBe('Drawing');
    expect(elementKindLabel(freehand({ straightEdges: true, closed: true }))).toBe('Drawing');
    expect(elementKindLabel(ofType('path'))).toBe('Path');
    expect(elementKindLabel(ofType('annotation'))).toBe('Annotation');
    expect(elementKindLabel(ofType('arrow'))).toBe('Arrow');
    expect(elementKindLabel({ type: 'arrow', arrowEnds: 'none' } as unknown as Element)).toBe(
      'Line',
    );
  });
});

// A sticky is named "Sticky" whatever its colour.
describe('elementKindLabel: stickies', () => {
  const note = (extra: Record<string, unknown>) =>
    ({ id: 'n', type: 'sticky', x: 0, y: 0, width: 200, height: 200, ...extra }) as Element;

  it('stays "Sticky" whatever its colour', () => {
    expect(elementKindLabel(note({}))).toBe('Sticky');
    expect(elementKindLabel(note({ fillColor: '#93c5fd' }))).toBe('Sticky');
  });
});

// docs/specs/009-elements/pie-chart.md "Chart types": a chart is named as the palette names it.
describe('a retired chart', () => {
  it("goes by its placeholder's name, from its stored kind", () => {
    expect(elementKindLabel(shape('bar-chart'))).toBe('Bar Chart');
    expect(elementKindLabel(shape('line-chart'))).toBe('Line Chart');
    expect(elementKindLabel(shape('pie-chart'))).toBe('Pie Chart');
  });
});
