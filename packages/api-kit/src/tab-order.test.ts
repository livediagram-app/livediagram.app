import { describe, expect, it } from 'vitest';
import { nextOrderIndex } from './tab-order';

describe('nextOrderIndex', () => {
  it('is one past the highest place, not the count, after a middle tab left', () => {
    expect(nextOrderIndex([{ orderIndex: 0 }, { orderIndex: 2 }])).toBe(3);
    expect(nextOrderIndex([{ orderIndex: 4 }, { orderIndex: 1 }])).toBe(5);
  });

  it('is 0 with no tabs', () => {
    expect(nextOrderIndex([])).toBe(0);
  });
});
