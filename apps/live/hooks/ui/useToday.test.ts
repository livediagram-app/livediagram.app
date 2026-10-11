// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useToday } from './useToday';

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

  it('takes a new day on a render that finds one, with no timer having fired', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 11, 12));
    const { result, rerender } = renderHook(() => useToday());
    vi.setSystemTime(new Date(2026, 9, 13, 9));
    rerender();
    expect(result.current.toDateString()).toBe(new Date(2026, 9, 13).toDateString());
  });
});
