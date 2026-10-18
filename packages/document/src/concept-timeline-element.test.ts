import { describe, expect, it } from 'vitest';
import { normaliseElement } from './element-normalise';
import { createShape, isConceptShape, type ShapeElement } from './index';
import { svgConcept } from './svg-render-concept';

// docs/specs/009-elements/concept-graphics.md "Timeline"
describe('the Timeline element', () => {
  it('is a concept graphic, made with four milestones and their whens', () => {
    const t = createShape('timeline-rail', 0, 0) as ShapeElement;
    expect(isConceptShape(t.shape)).toBe(true);
    expect(t.conceptRows).toEqual([
      { label: 'Kick-off', note: 'Jan' },
      { label: 'First prototype', note: 'Mar' },
      { label: 'Beta with customers', note: 'Jun' },
      { label: 'Launch', note: 'Sep' },
    ]);
    expect('railCount' in t).toBe(false);
  });

  it('opens a rail saved before as milestones: its labels their names, an unnamed one numbered', () => {
    const old = {
      ...createShape('square', 0, 0),
      shape: 'timeline-rail',
      railCount: 4,
      railLabels: ['2023', ' ', '2025'],
    };
    const now = normaliseElement(old) as ShapeElement & Record<string, unknown>;
    expect(now.conceptRows).toEqual([
      { label: '2023' },
      { label: 'Milestone 2' },
      { label: '2025' },
      { label: 'Milestone 4' },
    ]);
    expect('railCount' in now).toBe(false);
    expect('railLabels' in now).toBe(false);
  });

  it('keeps a migrated rail within the Timeline’s range', () => {
    const many = { ...createShape('square', 0, 0), shape: 'timeline-rail', railCount: 12 };
    const few = { ...createShape('square', 0, 0), shape: 'timeline-rail', railCount: 1 };
    expect((normaliseElement(many) as ShapeElement).conceptRows).toHaveLength(8);
    expect((normaliseElement(few) as ShapeElement).conceptRows).toHaveLength(2);
    // Never counted: three, as it was made.
    const bare = { ...createShape('square', 0, 0), shape: 'timeline-rail' };
    expect((normaliseElement(bare) as ShapeElement).conceptRows).toHaveLength(3);
  });

  it('exports its spine, a dot per milestone and every name and when', () => {
    const t = createShape('timeline-rail', 0, 0) as ShapeElement & { type: 'shape' };
    const svg = svgConcept(t as never, {
      stroke: '#2563eb',
      fill: '#ffffff',
      labelColor: '#0f172a',
      label: '',
    });
    expect(svg.match(/<circle /g)?.length).toBeGreaterThanOrEqual(4);
    for (const word of ['Kick-off', 'Launch', 'Jan', 'Sep']) expect(svg).toContain(word);
    expect(svg).toContain('<polygon');
  });
});
