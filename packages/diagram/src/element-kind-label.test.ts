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
    // Freehand variants (spec/81 highlighter, spec/84 polygon tool).
    const freehand = (extra: object) => ({ type: 'freehand', ...extra }) as unknown as Element;
    expect(elementKindLabel(freehand({ pen: 'highlighter' }))).toBe('Highlight');
    expect(elementKindLabel(freehand({ straightEdges: true }))).toBe('Polyline');
    expect(elementKindLabel(freehand({ straightEdges: true, closed: true }))).toBe('Polygon');
    expect(elementKindLabel(ofType('annotation'))).toBe('Annotation');
    expect(elementKindLabel(ofType('link-card'))).toBe('Link');
    expect(elementKindLabel(ofType('arrow'))).toBe('Arrow');
  });
});

// An event-storming note IS its kind (spec/139): "Selected Domain Event"
// tells a facilitator what they picked up; "Selected Sticky" tells them
// nothing the board didn't already show. The kind is stored on the element
// from creation; notes authored before that fall back to their canonical
// colour, which is the notation anyway.
describe('elementKindLabel — event-storming notes', () => {
  const note = (extra: Record<string, unknown>) =>
    ({ id: 'n', type: 'sticky', x: 0, y: 0, width: 200, height: 200, ...extra }) as Element;

  it('names the note kind when the element carries it', () => {
    expect(elementKindLabel(note({ esKind: 'domain-event' }))).toBe('Domain Event');
    expect(elementKindLabel(note({ esKind: 'read-model' }))).toBe('Read Model');
    expect(elementKindLabel(note({ esKind: 'hotspot' }))).toBe('Hotspot');
  });

  it('falls back to the canonical fill for notes authored before the stamp', () => {
    expect(elementKindLabel(note({ fillColor: '#93c5fd', fixedSize: true }))).toBe('Command');
    expect(elementKindLabel(note({ fillColor: '#d8b4fe', fixedSize: true }))).toBe('Policy');
  });

  it('stays "Sticky" for an ordinary note', () => {
    expect(elementKindLabel(note({}))).toBe('Sticky');
    // A hand-picked colour on a normal sticky is not a notation claim.
    expect(elementKindLabel(note({ fillColor: '#93c5fd' }))).toBe('Sticky');
  });
});
