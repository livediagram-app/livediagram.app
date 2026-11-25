// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { SETTLE_MS, isDesignTuning, markDesignTuning, useDesignTuning } from './page-design-tuning';

describe('a Fine Tune gesture', () => {
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('is on from the first tick and settles a moment after the last', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDesignTuning());
    expect(result.current).toBe(false);
    act(() => markDesignTuning());
    expect(result.current).toBe(true);
    // Ticks closer than the settle time keep it on.
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS - 50);
    });
    act(() => markDesignTuning());
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS - 50);
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(result.current).toBe(false);
    expect(isDesignTuning()).toBe(false);
  });
});
