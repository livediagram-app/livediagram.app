import { describe, expect, it } from 'vitest';
import { resizeChannels } from './resize';

describe('resizeChannels', () => {
  it('keeps a flat image flat at any size', () => {
    const src = new Float32Array(4 * 3 * 2).fill(0.5);
    const out = resizeChannels(src, 4, 3, 2, 7, 5);
    expect(out).toHaveLength(7 * 5 * 2);
    expect([...out].every((v) => Math.abs(v - 0.5) < 1e-6)).toBe(true);
  });

  it('is the identity at the same size', () => {
    const src = Float32Array.from({ length: 6 * 4 }, (_, i) => i);
    expect([...resizeChannels(src, 6, 4, 1, 6, 4)]).toEqual([...src]);
  });

  it('interpolates between neighbours when doubling', () => {
    const src = Float32Array.from([0, 1]);
    const out = resizeChannels(src, 2, 1, 1, 4, 1);
    expect(out[0]).toBeCloseTo(0);
    expect(out[1]).toBeCloseTo(0.25);
    expect(out[2]).toBeCloseTo(0.75);
    expect(out[3]).toBeCloseTo(1);
  });
});
