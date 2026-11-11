import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { distributionSnap } from './geometry-guides';
import { createShape, type Element } from './index';

// Equal-spacing snap runs on every move of a drag. A tall lane or frame overlaps nearly the whole board on one axis, so
// a search that paired every neighbour with every other (and scanned the board for each one's own gaps) made each move
// quadratic: 74-87 ms at 5,000 boxes before, about 10 ms after, on a laptop.
//
// About 10 ms was still too slow for CI, which runs this under v8 coverage on busy two-core runners: 137 to 272 ms
// there against 120. Coverage multiplied the remaining work (76 ms here), which was several comparator sorts of the
// whole board per move and, for each neighbour's own gaps, a walk through every other column's boxes. The search now
// sorts by radix and finds each neighbour's gaps among the boxes in its own column: 1.6 ms here, 7.5 under coverage.
// The warm-up gives V8's background compiler time to finish first, and the timed passes stop at the first one inside
// the budget, up to ten. A quadratic search never gets inside it however many passes it takes.
const WARM_UP_MS = 1000;
const MIN_WARM_UPS = 20;
const MAX_PASSES = 10;

function board(n: number): Element[] {
  const cols = Math.ceil(Math.sqrt(n * 1.33));
  return Array.from({ length: n }, (_, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    return {
      ...createShape('focus-button', c * 180 + ((i * 7) % 13), r * 140 + ((i * 11) % 17)),
      id: `e${i}`,
      width: 120,
      height: 80,
      rotation: 0,
    };
  });
}

describe('distributionSnap performance', () => {
  it('snaps a board-tall lane among 5,000 boxes within budget', () => {
    const els = board(5000);
    const small = board(500);
    const none = new Set<string>();
    const lane = (k: number) => ({ x: 1003 + (k % 50), y: -50, width: 300, height: 100_000 });
    const move = (k: number) => distributionSnap(lane(k), els, none, 6);
    const warmUntil = Date.now() + WARM_UP_MS;
    for (let i = 0; i < MIN_WARM_UPS || Date.now() < warmUntil; i++)
      distributionSnap(lane(i), small, none, 6);
    const budget = cpuBudgetMs(40);
    let best = Infinity;
    for (let i = 0; i < MAX_PASSES && best >= budget; i++)
      best = Math.min(
        best,
        cpuMsOf(() => move(i)),
      );
    expect(best).toBeLessThan(budget);
  }, 30_000);
});
