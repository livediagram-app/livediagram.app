import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createMomentTrigger, MOMENT_KINDS, type MomentPiece } from '@/lib/piece-moments';

// docs/specs/009-elements/piece-moments.md "Cost": every step your character takes asks the trigger, one box test per
// moment piece and nothing built. A big garden: 2000 trees, ponds and fires on one tab.
const PIECES: MomentPiece[] = Array.from({ length: 2000 }, (_, i) => ({
  id: `p${i}`,
  kind: MOMENT_KINDS[i % MOMENT_KINDS.length]!,
  x: (i % 50) * 200,
  y: Math.floor(i / 50) * 220,
  width: 120,
  height: 160,
}));
const STEPS = 1000;
// Measured about 19 µs a step here at 2000 pieces (0.4 µs at a garden's 40); the budget leaves room for slow CI.
const BUDGET_MS = 60;

describe('the piece moment check', () => {
  it(`walks ${STEPS} steps among 2000 moment pieces inside ${cpuBudgetMs(BUDGET_MS)} ms`, () => {
    const trigger = createMomentTrigger({ random: () => 0.9 });
    const walk = () => {
      for (let s = 0; s < STEPS; s++)
        trigger.step({ x: (s * 13) % 10000, y: (s * 7) % 8800 }, PIECES);
    };
    walk();
    const best = Math.min(...[0, 1, 2].map(() => cpuMsOf(walk)));
    expect(best).toBeLessThan(cpuBudgetMs(BUDGET_MS));
  });
});
