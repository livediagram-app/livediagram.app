import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/diagram';
import { buildFilterGroups } from './SelectionFilterMenu';

// Minimal element stubs — buildFilterGroups only reads `id`, `type`, `shape`.
function shape(id: string, kind: string): Element {
  return { id, type: 'shape', shape: kind, x: 0, y: 0, width: 1, height: 1 } as Element;
}
function arrow(id: string): Element {
  return {
    id,
    type: 'arrow',
    from: { kind: 'free', x: 0, y: 0 },
    to: { kind: 'free', x: 1, y: 1 },
  } as Element;
}
function text(id: string): Element {
  return { id, type: 'text', x: 0, y: 0, width: 1, height: 1 } as Element;
}

describe('buildFilterGroups', () => {
  it('returns one bucket per element kind, pluralised with ids', () => {
    const groups = buildFilterGroups([arrow('a1'), arrow('a2'), text('t1')]);
    const arrows = groups.find((g) => g.key === 'arrow');
    const txt = groups.find((g) => g.key === 'text');
    expect(arrows?.label).toBe('Arrows');
    expect(arrows?.ids).toEqual(['a1', 'a2']);
    expect(txt?.label).toBe('Text'); // mass noun, not pluralised
    expect(txt?.ids).toEqual(['t1']);
  });

  it('splits shapes by kind and adds an "All shapes" bucket when 2+ kinds', () => {
    const groups = buildFilterGroups([
      shape('s1', 'square'),
      shape('s2', 'square'),
      shape('s3', 'circle'),
    ]);
    expect(groups[0]).toMatchObject({ key: 'all-shapes', label: 'All shapes' });
    expect(groups[0]?.ids).toEqual(['s1', 's2', 's3']);
    expect(groups.find((g) => g.key === 'shape:square')?.label).toBe('Squares');
    expect(groups.find((g) => g.key === 'shape:circle')?.label).toBe('Circles');
  });

  it('omits the "All shapes" bucket for a single shape kind', () => {
    const groups = buildFilterGroups([shape('s1', 'square'), shape('s2', 'square')]);
    expect(groups.map((g) => g.key)).toEqual(['shape:square']);
  });

  it('orders buckets by size, largest first', () => {
    const groups = buildFilterGroups([arrow('a1'), text('t1'), text('t2'), text('t3')]);
    expect(groups.map((g) => g.key)).toEqual(['text', 'arrow']);
  });
});
