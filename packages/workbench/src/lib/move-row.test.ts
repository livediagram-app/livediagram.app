import { describe, expect, it } from 'vitest';
import { moveRow } from './move-row';

describe('moveRow', () => {
  it('moves an item either way', () => {
    expect(moveRow(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveRow(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
  });

  it('leaves the order alone past either end', () => {
    expect(moveRow(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveRow(['a', 'b'], 1, 2)).toEqual(['a', 'b']);
  });
});
