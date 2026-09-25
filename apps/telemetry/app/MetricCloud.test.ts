import { describe, expect, it } from 'vitest';
import { centreOut } from './MetricCloud';

describe('centreOut', () => {
  it('puts the heaviest item in the middle and tapers both ways', () => {
    const laid = centreOut([1, 5, 3, 9, 7], (n) => n);
    expect(laid).toEqual([3, 7, 9, 5, 1]);
    expect(laid[Math.floor(laid.length / 2)]).toBe(9);
  });
});
