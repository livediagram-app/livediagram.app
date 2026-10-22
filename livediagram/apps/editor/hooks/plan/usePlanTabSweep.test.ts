// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PLAN_SWEEP_MAX_TABS, shouldSweepPlanTabs, usePlanTabSweep } from './usePlanTabSweep';

// docs/specs/026-plan/plan-templates.md "Hand-offs": a Plan document's other tabs load once, bounded.
describe('usePlanTabSweep', () => {
  it('sweeps a Plan document of a few tabs, never one tab or past the bound', () => {
    expect(shouldSweepPlanTabs(true, 4)).toBe(true);
    expect(shouldSweepPlanTabs(false, 4)).toBe(false);
    expect(shouldSweepPlanTabs(true, 1)).toBe(false);
    expect(shouldSweepPlanTabs(true, PLAN_SWEEP_MAX_TABS)).toBe(true);
    expect(shouldSweepPlanTabs(true, PLAN_SWEEP_MAX_TABS + 1)).toBe(false);
  });

  it('loads the tabs once a session, however often it renders', () => {
    const load = vi.fn(async () => {});
    const { rerender } = renderHook(({ needed, n }) => usePlanTabSweep(needed, n, load), {
      initialProps: { needed: false, n: 3 },
    });
    expect(load).not.toHaveBeenCalled();
    rerender({ needed: true, n: 3 });
    rerender({ needed: true, n: 4 });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
