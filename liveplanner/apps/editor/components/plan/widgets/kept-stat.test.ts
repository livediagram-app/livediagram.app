// kept-stat.ts (docs/specs/026-plan/blueprints/board-widgets.md "Performance and limits"): a widget's count is read
// back while its list of cards, its key and what it reads stand, and counted again when any of them changes.
import { describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveplanner/items';
import { KEPT_PER_LIST, keptStat } from './kept-stat';

const list = (): readonly Item[] => [{ id: 'a' } as unknown as Item];

describe('keptStat', () => {
  it('counts once per list and key, and again for a new list, key or read object', () => {
    const items = list();
    const types = {};
    const count = vi.fn(() => 3);
    expect(keptStat(items, 'k', count, types)).toBe(3);
    expect(keptStat(items, 'k', count, types)).toBe(3);
    expect(count).toHaveBeenCalledTimes(1);
    keptStat(items, 'other', count, types);
    keptStat(list(), 'k', count, types);
    keptStat(items, 'k', count, {});
    expect(count).toHaveBeenCalledTimes(4);
    keptStat(items, 'k', count);
    keptStat(items, 'k', count);
    expect(count).toHaveBeenCalledTimes(5);
  });

  it('keeps at most KEPT_PER_LIST counts for a list, starting over past that', () => {
    const items = list();
    const count = vi.fn(() => 1);
    for (let i = 0; i <= KEPT_PER_LIST; i++) keptStat(items, `minute|${i}`, count);
    expect(count).toHaveBeenCalledTimes(KEPT_PER_LIST + 1);
    // The first went with the reset; the newest is kept.
    keptStat(items, `minute|${KEPT_PER_LIST}`, count);
    expect(count).toHaveBeenCalledTimes(KEPT_PER_LIST + 1);
    keptStat(items, 'minute|0', count);
    expect(count).toHaveBeenCalledTimes(KEPT_PER_LIST + 2);
  });
});
