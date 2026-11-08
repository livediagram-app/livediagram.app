import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { distributionSnap } from './geometry-guides';
import type { Element } from './index';

// Equal-spacing snap runs on every move of a drag. A tall lane or frame overlaps nearly the whole board on one axis, so
// a search that paired every neighbour with every other (and scanned the board for each one's own gaps) made each move
// quadratic: 74-87 ms at 5,000 boxes before, about 10 ms after, on a laptop. Warm-up passes then the fastest of five.
const WARM_UP_PASSES = 3;
const PASSES = 5;

function board(n: number): Element[] {
  const cols = Math.ceil(Math.sqrt(n * 1.33));
  return Array.from({ length: n }, (_, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    return {
      id: `e${i}`,
      type: 'shape',
      shape: 'rectangle',
      x: c * 180 + ((i * 7) % 13),
      y: r * 140 + ((i * 11) % 17),
      width: 120,
      height: 80,
      rotation: 0,
    } as Element;
  });
}

describe('distributionSnap performance', () => {
  it('snaps a board-tall lane among 5,000 boxes within budget', () => {
    const els = board(5000);
    const none = new Set<string>();
    const move = (k: number) =>
      distributionSnap({ x: 1003 + k, y: -50, width: 300, height: 100_000 }, els, none, 6);
    for (let i = 0; i < WARM_UP_PASSES; i++) move(i);
    let best = Infinity;
    for (let i = 0; i < PASSES; i++)
      best = Math.min(
        best,
        cpuMsOf(() => move(i)),
      );
    expect(best).toBeLessThan(cpuBudgetMs(40));
  });
});
