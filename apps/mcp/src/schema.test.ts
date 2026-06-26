import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  addTabShape,
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

  it('create: requires name + at least one tab', () => {
    const s = z.object(createDiagramShape);
    expect(() => s.parse({ name: 'x' })).toThrow(); // tabs required
    expect(() => s.parse({ name: 'x', tabs: [] })).toThrow(); // min 1
    const ok = s.parse({
      name: 'x',
      tabs: [
        { name: 'Overview', elements: [{ id: 'a', type: 'shape' }] },
        { name: 'Detail', elements: [] },
      ],
    });
    expect(ok.tabs).toHaveLength(2);
  });

  it('add_tab: requires diagramId + name + elements', () => {
    const s = z.object(addTabShape);
    expect(() => s.parse({ name: 't', elements: [] })).toThrow(); // missing diagramId
    const ok = s.parse({ diagramId: 'd', name: 'Detail', elements: [], layout: 'preserve' });
    expect(ok.diagramId).toBe('d');
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

  it('create/update accept an optional layout enum', () => {
    const c = z.object(createDiagramShape);
    expect(
      c.parse({ name: 'x', tabs: [{ name: 't', elements: [] }], layout: 'preserve' }).layout,
    ).toBe('preserve');
    expect(() =>
      c.parse({ name: 'x', tabs: [{ name: 't', elements: [] }], layout: 'nope' }),
    ).toThrow();
    const u = z.object(updateDiagramShape);
    expect(u.parse({ diagramId: 'd', mode: 'replace', elements: [], layout: 'auto' }).layout).toBe(
      'auto',
    );
  });
});
