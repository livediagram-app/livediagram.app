import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { createMomentTrigger, MOMENT_KINDS, momentPiece } from '@/lib/piece-moments';

// docs/specs/009-elements/piece-moments.md "Cost": every step your character takes asks the trigger, one box test per
// moment piece and nothing built. A big office: 2000 moment pieces of every kind on one tab, packed so the walk keeps
// arriving at pieces and playing them (every arrival plays, owner 2026-11-07), not only stepping past.
const PIECES = Array.from({ length: 2000 }, (_, i) =>
  momentPiece({
    id: `p${i}`,
    kind: MOMENT_KINDS[i % MOMENT_KINDS.length]!,
    x: (i % 50) * 200,
    y: Math.floor(i / 50) * 220,
    width: 120,
    height: 160,
  }),
);
const STEPS = 1000;
// Measured about 24 ms for the 1000 steps on an M-series Mac, 69 ms under coverage there, and 209 ms on CI's
// coverage run (2026-11-07): coverage and the slower runner stack, so 60 (180 on CI) sat under CI's timing. 120 (360
// on CI) keeps room on both and still fails a scan that builds per step or grows past one box test a piece.
const BUDGET_MS = 120;

describe('the piece moment check', () => {
  it(`walks ${STEPS} steps among 2000 moment pieces inside ${cpuBudgetMs(BUDGET_MS)} ms`, () => {
    // A clock that runs on with the walk, so pieces finish their moments and play again.
    let t = 0;
    const trigger = createMomentTrigger({ now: () => (t += 50) });
    let played = 0;
    const walk = () => {
      for (let s = 0; s < STEPS; s++)
        played += trigger.step({ x: (s * 13) % 10000, y: (s * 7) % 8800 }, PIECES).length;
    };
    walk();
    // The walk is the worst case: it keeps arriving, so the play path is in the budget too.
    expect(played).toBeGreaterThan(STEPS / 40);
    const best = Math.min(...[0, 1, 2].map(() => cpuMsOf(walk)));
    expect(best).toBeLessThan(cpuBudgetMs(BUDGET_MS));
  });
});
