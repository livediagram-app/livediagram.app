// @vitest-environment jsdom

// The Overview's opening (docs/specs/026-plan/plan-overview.md "Opening"): entering until it has settled, then still.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOTION_CEILING_MS } from '@liveworkspace/style-guards/motion';
import { OVERVIEW_ENTRANCE_MS, useOverviewEntrance } from './useOverviewEntrance';

afterEach(() => vi.useRealTimers());

describe('the Overview entrance', () => {
  it('is entering from the first frame until the entrance has settled, and never again', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(() => useOverviewEntrance());
    expect(result.current).toBe(true);
    expect(OVERVIEW_ENTRANCE_MS).toBeGreaterThanOrEqual(MOTION_CEILING_MS);
    act(() => {
      vi.advanceTimersByTime(OVERVIEW_ENTRANCE_MS);
    });
    expect(result.current).toBe(false);
    rerender();
    expect(result.current).toBe(false);
  });
});
