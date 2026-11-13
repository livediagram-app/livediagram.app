import { describe, expect, it } from 'vitest';
import { stripCrowdsCorners } from './strip-crowds-corners';

describe('stripCrowdsCorners', () => {
  it('counts a corner the strip reaches into, with the gap to spare, never an empty one', () => {
    const strip = { left: 100, right: 500 };
    expect(stripCrowdsCorners(strip, [{ left: 495, right: 700 }])).toBe(true);
    expect(stripCrowdsCorners(strip, [{ left: 509, right: 700 }])).toBe(false);
    expect(stripCrowdsCorners(strip, [{ left: 505, right: 700 }], 2)).toBe(false);
    expect(stripCrowdsCorners(strip, [{ left: 300, right: 300 }])).toBe(false);
  });
});
