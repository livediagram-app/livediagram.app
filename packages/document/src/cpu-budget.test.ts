import { afterEach, describe, expect, it, vi } from 'vitest';
import { CI_CPU_HEADROOM, cpuBudgetMs } from '@livediagram/vitest-config/cpu-time';

// docs/specs/003-system-architecture/testing.md "A tight budget is written for a developer's
// machine and widened on CI". The helper lives in vitest-config, which has no suite of its own.
describe('cpuBudgetMs', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is the budget as written on a developer machine', () => {
    vi.stubEnv('CI', '');
    expect(cpuBudgetMs(100)).toBe(100);
  });

  it('widens it by CI_CPU_HEADROOM on CI', () => {
    vi.stubEnv('CI', 'true');
    expect(cpuBudgetMs(100)).toBe(100 * CI_CPU_HEADROOM);
  });
});
