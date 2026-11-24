import { describe, expect, it } from 'vitest';
import { roundedPx } from './rounded-size';

describe('roundedPx', () => {
  it('reads a fractional-scale 44 px row as 44', () => {
    expect(roundedPx(43.99997)).toBe(44);
    expect(roundedPx(44.00003)).toBe(44);
  });
  it('keeps a real 1 px shortfall short', () => {
    expect(roundedPx(43)).toBe(43);
    expect(roundedPx(43.4)).toBe(43);
  });
});
