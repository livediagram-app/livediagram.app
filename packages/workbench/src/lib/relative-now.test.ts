// @vitest-environment jsdom
// The shared relative-time clock: one interval for every subscriber, ticking together every RELATIVE_TICK_MS, caught
// up when the first subscriber arrives, and stopped when the last one leaves.
import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RELATIVE_TICK_MS, useRelativeNow } from './relative-now';

afterEach(() => vi.useRealTimers());

describe('useRelativeNow', () => {
  it('ticks every subscriber together on one interval, and stops when the last leaves', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const setInterval = vi.spyOn(window, 'setInterval');
    const clearInterval = vi.spyOn(window, 'clearInterval');
    const a = renderHook(() => useRelativeNow());
    const b = renderHook(() => useRelativeNow());
    expect(a.result.current).toBe(1_000_000);
    expect(setInterval).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(RELATIVE_TICK_MS));
    expect(a.result.current).toBe(1_000_000 + RELATIVE_TICK_MS);
    expect(b.result.current).toBe(a.result.current);
    a.unmount();
    expect(clearInterval).not.toHaveBeenCalled();
    b.unmount();
    expect(clearInterval).toHaveBeenCalledTimes(1);
    // Idle, then a new subscriber: the clock is caught up before the next tick.
    vi.setSystemTime(5_000_000);
    const c = renderHook(() => useRelativeNow());
    expect(c.result.current).toBe(5_000_000);
    c.unmount();
  });

  it('answers 0 when prerendered, so the first client render agrees', () => {
    function Clock() {
      return createElement('span', null, String(useRelativeNow()));
    }
    expect(renderToString(createElement(Clock))).toBe('<span>0</span>');
  });
});
