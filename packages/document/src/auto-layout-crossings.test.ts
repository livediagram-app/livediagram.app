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
