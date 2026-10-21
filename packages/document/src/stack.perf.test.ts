import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import { createShape, settleStacks, type Element, type ShapeElement } from './index';

// docs/specs/009-elements/blueprints/stack.md "Performance and limits": settling runs at every commit, so a large
// board with stacks must stay cheap. 2,000 loose boxes and 20 stacks of 10 children, already laid out (the common case:
// one child moved). Warm-up passes then the fastest of five, as the other budget tests do.
const WARM_UP_PASSES = 3;
const PASSES = 5;

function board(): Element[] {
  const els: Element[] = [];
  for (let i = 0; i < 2000; i++)
    els.push({
      ...createShape('square', 0, 0),
      id: `b${i}`,
      x: 5000 + (i % 50) * 120,
      y: Math.floor(i / 50) * 100,
      width: 80,
      height: 60,
    });
  for (let s = 0; s < 20; s++) {
    els.push({
      ...createShape('stack', 0, 0),
      id: `s${s}`,
      x: 0,
      y: s * 200,
      width: 1200,
      height: 150,
    });
    for (let k = 0; k < 10; k++)
      els.push({
        ...createShape('square', 0, 0),
        id: `s${s}k${k}`,
        x: 20 + k * 110,
        y: s * 200 + 30,
        width: 80,
        height: 60,
      });
  }
  return settleStacks(els);
}

describe('settleStacks budget', () => {
  it('settles a 2,200-element board with 20 stacks of 10 within 60 ms of CPU', () => {
    const settled = board();
    const moved = settled.map((e) =>
      e.id === 's3k4' ? { ...e, x: (e as ShapeElement).x + 300 } : e,
    );
    for (let p = 0; p < WARM_UP_PASSES; p++) settleStacks(moved);
    let best = Infinity;
    for (let p = 0; p < PASSES; p++)
      best = Math.min(
        best,
        cpuMsOf(() => settleStacks(moved)),
      );
    expect(best).toBeLessThan(cpuBudgetMs(60));
  });

  it('settles the same board within 60 ms when a child is added, the stack growing (two passes)', () => {
    const settled = board();
    const added = [
      ...settled,
      {
        ...createShape('square', 0, 0),
        id: 'new',
        x: 40,
        y: 3 * 200 + 40,
        width: 80,
        height: 60,
      },
    ];
    for (let p = 0; p < WARM_UP_PASSES; p++) settleStacks(added);
    let best = Infinity;
    for (let p = 0; p < PASSES; p++)
      best = Math.min(
        best,
        cpuMsOf(() => settleStacks(added)),
      );
    expect(best).toBeLessThan(cpuBudgetMs(60));
  });

  it('returns at once for a board with no stack', () => {
    const els = board().filter((e) => !(e.type === 'shape' && e.shape === 'stack'));
    expect(settleStacks(els)).toBe(els);
  });
});
