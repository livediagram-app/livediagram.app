import { afterEach, describe, expect, it, vi } from 'vitest';
import { CI_CPU_HEADROOM, cpuBudgetMs, cpuGrowthLimitMs, cpuRatioCeiling } from './cpu-time.js';

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
