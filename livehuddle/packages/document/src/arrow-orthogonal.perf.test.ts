import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { withFacingBends } from './arrow-orthogonal';
import type { Element } from './index';

// docs/specs/008-canvas/layout-cleanup.md "Angled lines bend twice": an agent's board of thousands of facing arrows is
// bent in near-linear time. Scanning every box and every placed run for each arrow took 1.8 s on this board.

function board(n: number): Element[] {
  const els: Element[] = [];
  for (let i = 0; i < n; i++)
    els.push({
      id: `b${i}`,
      type: 'shape',
      shape: 'square',
      x: (i % 40) * 200,
      y: Math.floor(i / 40) * 200,
      width: 120,
      height: 60,
    });
  for (let i = 0; i < n; i++)
    els.push({
      id: `a${i}`,
      type: 'arrow',
      arrowStyle: 'angled',
      from: { kind: 'pinned', elementId: `b${i}`, anchor: 's' },
      to: { kind: 'pinned', elementId: `b${(i + 41) % n}`, anchor: 'n' },
    });
  return els;
}

describe('withFacingBends at scale', () => {
  it('bends 2,000 arrows across 2,000 boxes within budget', () => {
    const els = board(2000);
    withFacingBends(els);
    let best = Infinity;
    for (let pass = 0; pass < 3; pass++)
      best = Math.min(
        best,
        cpuMsOf(() => withFacingBends(els)),
      );
    // About 75 ms here; the quadratic scan it replaced took 1.8 s.
    expect(best).toBeLessThan(cpuBudgetMs(400));
  });

  it('returns a board with no angled arrow as it is', () => {
    const els = board(10).map((el) =>
      el.type === 'arrow' ? { ...el, arrowStyle: 'straight' as const } : el,
    );
    expect(withFacingBends(els)).toBe(els);
  });
});
