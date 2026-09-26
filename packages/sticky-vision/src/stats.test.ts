import { describe, expect, it } from 'vitest';
import { median } from './stats';

describe('median', () => {
  it('takes the middle value of an odd count', () => {
    expect(median([9, 1, 5])).toBe(5);
  });

  it('takes the UPPER middle of an even count', () => {
    expect(median([1, 2, 3, 4])).toBe(3);
  });

  it('is 0 for no values', () => {
    expect(median([])).toBe(0);
  });

  it("never reorders the caller's array", () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});
