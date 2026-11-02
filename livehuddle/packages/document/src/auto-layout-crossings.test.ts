import { describe, expect, it } from 'vitest';
import { countCrossings, reduceCrossings } from './auto-layout-crossings';

// docs/specs/008-canvas/layout-cleanup.md "Fewer crossings".
describe('reduceCrossings', () => {
  // Two ranks wired in an X: a->d, b->c, with d before c below.
  const layerOf = new Map([
    ['a', 0],
    ['b', 0],
    ['c', 1],
    ['d', 1],
  ]);
  const edges = [
    { from: 'a', to: 'c' },
    { from: 'b', to: 'd' },
  ];

  it('uncrosses an X', () => {
    const start = [
      ['a', 'b'],
      ['d', 'c'],
    ];
    expect(countCrossings(start, edges, layerOf)).toBe(1);
    const out = reduceCrossings(start, edges, layerOf);
    expect(countCrossings(out, edges, layerOf)).toBe(0);
  });

  it('leaves an order that already has no crossings alone', () => {
    const start = [
      ['a', 'b'],
      ['c', 'd'],
    ];
    expect(reduceCrossings(start, edges, layerOf)).toBe(start);
  });
});

describe('countCrossings', () => {
  // The definition it implements: every pair of adjacent-rank edges, tested directly.
  function bruteForce(order: string[][], edges: { from: string; to: string }[]): number {
    const at = new Map<string, [number, number]>();
    order.forEach((rank, r) => rank.forEach((id, i) => at.set(id, [r, i])));
    const spans = edges
      .map((e) => [at.get(e.from)!, at.get(e.to)!] as const)
      .filter(([a, b]) => Math.abs(a[0] - b[0]) === 1)
      .map(([a, b]) => (a[0] < b[0] ? [a[0], a[1], b[1]] : [b[0], b[1], a[1]]));
    let n = 0;
    for (let i = 0; i < spans.length; i++)
      for (let j = i + 1; j < spans.length; j++) {
        const [r1, t1, b1] = spans[i]!;
        const [r2, t2, b2] = spans[j]!;
        if (r1 === r2 && (t1! - t2!) * (b1! - b2!) < 0) n++;
      }
    return n;
  }

  it('matches a pair-by-pair count, shared ends and long edges included', () => {
    let seed = 7;
    const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
    for (let trial = 0; trial < 50; trial++) {
      const order = Array.from({ length: 2 + rand(4) }, (_, r) =>
        Array.from({ length: 1 + rand(6) }, (_, i) => `${r}.${i}`),
      );
      const layerOf = new Map(order.flatMap((rank, r) => rank.map((id) => [id, r] as const)));
      const ids = [...layerOf.keys()];
      const edges = Array.from({ length: rand(20) }, () => ({
        from: ids[rand(ids.length)]!,
        to: ids[rand(ids.length)]!,
      }));
      expect(countCrossings(order, edges, layerOf)).toBe(bruteForce(order, edges));
    }
  });
});
