// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMinute, useToday } from './useToday';

afterEach(() => vi.useRealTimers());

describe('useToday', () => {
  it('holds one date through the day and moves on at midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 11, 23, 59, 0));
    const { result, rerender } = renderHook(() => useToday());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(result.current.toDateString()).toBe(new Date(2026, 9, 12).toDateString());
  });

  it('takes a new day when the page is shown again, with no timer having fired', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 11, 12));
    const { result } = renderHook(() => useToday());
    vi.setSystemTime(new Date(2026, 9, 13, 9));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.toDateString()).toBe(new Date(2026, 9, 13).toDateString());
  });
});

describe('useMinute', () => {
  it('ticks each minute while on, and never while off', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 16, 59, 0));
    const { result, rerender } = renderHook(({ on }) => useMinute(on), {
      initialProps: { on: true },
    });
    expect(result.current).toBe(new Date(2026, 9, 31, 16, 59).getTime());
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(new Date(2026, 9, 31, 17, 0).getTime());
    rerender({ on: false });
    expect(result.current).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
