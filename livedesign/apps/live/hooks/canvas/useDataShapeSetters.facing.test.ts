import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livedesign/document';
import { track } from '@/lib/telemetry';
import { useDataShapeSetters } from './useDataShapeSetters';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/009-elements/office.md: a meeting table seats six all round and never turns.
describe('the facing setter', () => {
  it('turns a chair and leaves a meeting table in the same selection as it is', () => {
    const table = { ...createShape('meeting-table', 0, 0), id: 'table' } as Element;
    const chair = { ...createShape('chair', 300, 0), id: 'chair' } as Element;
    let els: Element[] = [table, chair];
    const { setChairFacingSelected } = useDataShapeSetters({
      currentSelectionIds: () => new Set(['table', 'chair']),
      commit: (map) => {
        els = map(els);
      },
      elements: () => els,
      notify: () => {},
    });
    setChairFacingSelected('w');
    expect(els.find((e) => e.id === 'table')).not.toHaveProperty('chairFacing');
    expect(els.find((e) => e.id === 'chair')).toHaveProperty('chairFacing', 'w');
    expect(track).toHaveBeenCalledWith('Element', 'Changed', 'Chair');
  });
});
