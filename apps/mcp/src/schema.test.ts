import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createDiagramShape,
  elementSchemaDoc,
  findDiagramsShape,
  updateDiagramShape,
} from './schema';

describe('elementSchemaDoc', () => {
  it('lists element types, the pinned-arrow convention, and the no-colour rule', () => {
    const doc = elementSchemaDoc();
    expect(doc).toContain('shape');
    expect(doc).toContain('arrow');
    expect(doc).toContain('pinned');
    expect(doc).toContain('"e"'.replace(/"/g, '')); // anchor 'e' from packages/diagram
    expect(doc).toContain('Do NOT set colours');
  });
});

describe('tool input shapes', () => {
  it('find: optional query, bounded limit', () => {
    const s = z.object(findDiagramsShape);
    expect(s.parse({}).query).toBeUndefined();
    expect(() => s.parse({ limit: 100 })).toThrow();
  });

  it('create: requires name + tab.elements', () => {
    const s = z.object(createDiagramShape);
    expect(() => s.parse({ name: 'x' })).toThrow();
    expect(
      s.parse({ name: 'x', tab: { name: 't', elements: [{ id: 'a', type: 'shape' }] } }).name,
    ).toBe('x');
  });

  it('update: mode enum + optional ops', () => {
    const s = z.object(updateDiagramShape);
    expect(() => s.parse({ diagramId: 'd', mode: 'nope' })).toThrow();
    const ok = s.parse({
      diagramId: 'd',
      mode: 'ops',
      ops: [{ op: 'remove', elementId: 'x' }],
    });
    expect(ok.mode).toBe('ops');
  });
});
