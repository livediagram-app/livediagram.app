import { describe, expect, it } from 'vitest';
import { median } from './canvas-gestures';

describe('median', () => {
  it('reads the middle run, the upper one of an even count, and zero for none', () => {
    expect(median([30, 10, 20])).toBe(20);
    expect(median([4, 1, 3, 2])).toBe(3);
    expect(median([])).toBe(0);
  });

  it('leaves the runs it was given in their order', () => {
    const runs = [3, 1, 2];
    median(runs);
    expect(runs).toEqual([3, 1, 2]);
  });
});
