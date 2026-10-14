import { describe, expect, it } from 'vitest';
import { rowDropIndex } from './useRowReorderDrag';

// Where a dragged row lands (the Slide Deck and Contents lists).
describe('rowDropIndex', () => {
  it('moves up before a row and down after one', () => {
    expect(rowDropIndex(3, { index: 0, side: 'before' }, 5)).toBe(0);
    expect(rowDropIndex(0, { index: 3, side: 'after' }, 5)).toBe(3);
    expect(rowDropIndex(0, { index: 3, side: 'before' }, 5)).toBe(2);
  });

  it('is no move onto itself or its neighbours’ facing sides', () => {
    expect(rowDropIndex(2, { index: 2, side: 'before' }, 5)).toBeNull();
    expect(rowDropIndex(2, { index: 1, side: 'after' }, 5)).toBeNull();
    expect(rowDropIndex(-1, { index: 1, side: 'after' }, 5)).toBeNull();
  });

  it('clamps past the end', () => {
    expect(rowDropIndex(0, { index: 9, side: 'after' }, 5)).toBe(4);
  });
});
