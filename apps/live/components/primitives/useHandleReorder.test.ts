import { describe, expect, it } from 'vitest';
import { reorderSlot } from './useHandleReorder';

// The slot a dragged row lands in, from the rows' middles (docs/specs/026-plan/item-types.md "Editing a type").
describe('reorderSlot', () => {
  const mids = [10, 50, 90, 130];

  it('stays put until the row passes a neighbour’s middle', () => {
    expect(reorderSlot(mids, 1, 0)).toBe(1);
    expect(reorderSlot(mids, 1, 39)).toBe(1);
    expect(reorderSlot(mids, 1, -39)).toBe(1);
  });

  it('moves one slot per middle passed, either way', () => {
    expect(reorderSlot(mids, 1, 41)).toBe(2);
    expect(reorderSlot(mids, 1, 81)).toBe(3);
    expect(reorderSlot(mids, 1, -41)).toBe(0);
  });

  it('clamps at the ends', () => {
    expect(reorderSlot(mids, 0, 1000)).toBe(3);
    expect(reorderSlot(mids, 3, -1000)).toBe(0);
  });
});
