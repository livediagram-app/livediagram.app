import { describe, expect, it } from 'vitest';
import { seededRandom } from './seeded-random';

describe('seededRandom', () => {
  it('repeats a seed exactly and stays in [0, 1)', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const run = Array.from({ length: 1000 }, () => a());
    expect(run).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(run.every((n) => n >= 0 && n < 1)).toBe(true);
  });

  it('pins the mulberry32 stream, so every seeded look keeps its shape', () => {
    const r = seededRandom(20261004);
    expect([r(), r(), r()].map((n) => n.toFixed(8))).toMatchInlineSnapshot(`
      [
        "0.76369766",
        "0.85147670",
        "0.94965040",
      ]
    `);
  });
});
