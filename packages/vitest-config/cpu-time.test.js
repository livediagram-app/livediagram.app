import { afterEach, describe, expect, it, vi } from 'vitest';
import { CI_CPU_HEADROOM, cpuBudgetMs } from './cpu-time.js';

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
