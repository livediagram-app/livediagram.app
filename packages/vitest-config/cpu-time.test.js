import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CI_CPU_HEADROOM,
  cpuBudgetMs,
  cpuGrowthLimitMs,
  cpuGrowthRatio,
  cpuRatioCeiling,
} from './cpu-time.js';

// docs/specs/003-system-architecture/testing.md "A tight budget is written for a developer's machine, widened on CI,
// and checked without coverage" and "Coverage never judges a budget".
afterEach(() => vi.unstubAllEnvs());

describe('cpuBudgetMs', () => {
  it('is the written budget in a plain run', () => {
    vi.stubEnv('CI', '');
    vi.stubEnv('LIVEWORKSPACE_COVERAGE', '');
    expect(cpuBudgetMs(16)).toBe(16);
  });

  it('widens on CI', () => {
    vi.stubEnv('LIVEWORKSPACE_COVERAGE', '');
    vi.stubEnv('CI', 'true');
    expect(cpuBudgetMs(16)).toBe(16 * CI_CPU_HEADROOM);
    vi.stubEnv('CI', '1');
    expect(cpuBudgetMs(16)).toBe(16 * CI_CPU_HEADROOM);
  });

  // CI=false is how some shells and images turn CI behaviour off: it is a developer's machine, held to the budget.
  it('holds the budget where CI is set to say no', () => {
    vi.stubEnv('LIVEWORKSPACE_COVERAGE', '');
    vi.stubEnv('CI', 'false');
    expect(cpuBudgetMs(16)).toBe(16);
    vi.stubEnv('CI', '0');
    expect(cpuBudgetMs(16)).toBe(16);
  });

  // Instrumentation, not the code, sets the pace under coverage; vitest-budgets checks the budget without it.
  it('is unbounded under coverage, on CI or not', () => {
    vi.stubEnv('LIVEWORKSPACE_COVERAGE', '1');
    vi.stubEnv('CI', '');
    expect(cpuBudgetMs(16)).toBe(Number.POSITIVE_INFINITY);
    vi.stubEnv('CI', 'true');
    expect(cpuBudgetMs(16)).toBe(Number.POSITIVE_INFINITY);
  });
});

// docs/ci.md "Speed budgets": a growth check's ratio holds in a plain run and on CI, and coverage never judges it.
describe('cpuRatioCeiling', () => {
  it('is the written ratio in a plain run and on CI alike', () => {
    vi.stubEnv('LIVEWORKSPACE_COVERAGE', '');
    vi.stubEnv('CI', '');
    expect(cpuRatioCeiling(8)).toBe(8);
    vi.stubEnv('CI', 'true');
    expect(cpuRatioCeiling(8)).toBe(8);
  });

  it('is unbounded under coverage', () => {
    vi.stubEnv('LIVEWORKSPACE_COVERAGE', '1');
    expect(cpuRatioCeiling(8)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('cpuGrowthLimitMs', () => {
  it('is the smaller time times the ratio, plus the slack', () => {
    vi.stubEnv('LIVEWORKSPACE_COVERAGE', '');
    vi.stubEnv('CI', 'true');
    expect(cpuGrowthLimitMs(3, 8, 5)).toBe(29);
    expect(cpuGrowthLimitMs(3, 8)).toBe(24);
  });

  // A small time of 0 ms times Infinity would be NaN, which no time is less than.
  it('is unbounded under coverage, even on a 0 ms small time', () => {
    vi.stubEnv('LIVEWORKSPACE_COVERAGE', '1');
    expect(cpuGrowthLimitMs(0, 8, 5)).toBe(Number.POSITIVE_INFINITY);
  });
});

// Samples from a list, then the last one again, logging which size ran.
function samples(
  /** @type {string} */ name,
  /** @type {number[]} */ ms,
  /** @type {string[]} */ log,
) {
  let i = 0;
  return () => {
    log.push(name);
    return ms[Math.min(i++, ms.length - 1)];
  };
}

describe('cpuGrowthRatio', () => {
  it('warms each size once, then samples them in turns and keeps the fastest of each', () => {
    const log = [];
    const ratio = cpuGrowthRatio(
      samples('s', [100, 3, 2, 4], log),
      samples('l', [900, 9, 12, 8], log),
      { ceiling: 8, runs: 3 },
    );
    expect(log).toEqual(['s', 'l', 's', 'l', 's', 'l', 's', 'l']);
    expect(ratio).toBe(4);
  });

  // A noisy round reads over the ceiling; the next one, sampled afresh, settles under it.
  it('samples another round while the ratio reads at or over the ceiling', () => {
    const log = [];
    const ratio = cpuGrowthRatio(samples('s', [1, 1, 1, 1], log), samples('l', [9, 9, 9, 5], log), {
      ceiling: 8,
      runs: 2,
    });
    expect(ratio).toBe(5);
    expect(log).toHaveLength(2 + 2 * 2 * 2);
  });

  // A quadratic step reads sixteen in every round, so it still fails after the last.
  it('stops after the last round and returns what it read', () => {
    const log = [];
    const ratio = cpuGrowthRatio(samples('s', [1], log), samples('l', [16], log), {
      ceiling: 8,
      runs: 2,
      attempts: 3,
    });
    expect(ratio).toBe(16);
    expect(log).toHaveLength(2 + 3 * 2 * 2);
  });

  it('runs five samples a round and three rounds by default, and never divides by 0', () => {
    const log = [];
    const ratio = cpuGrowthRatio(samples('s', [0], log), samples('l', [1], log), { ceiling: 8 });
    expect(ratio).toBe(1000);
    expect(log).toHaveLength(2 + 3 * 5 * 2);
  });

  it('runs one round under an unbounded ceiling', () => {
    const log = [];
    cpuGrowthRatio(samples('s', [1], log), samples('l', [16], log), {
      ceiling: Number.POSITIVE_INFINITY,
    });
    expect(log).toHaveLength(2 + 5 * 2);
  });
});
