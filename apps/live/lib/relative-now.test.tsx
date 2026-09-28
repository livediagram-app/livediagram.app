// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RELATIVE_TICK_MS, useRelativeNow } from './relative-time';

// Relative time reads the shared tick store's clock, never Date.now() during render
// (docs/specs/003-system-architecture/react-state-and-effects.md).
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-28T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('useRelativeNow', () => {
  it('ticks every 30 seconds', () => {
    expect(RELATIVE_TICK_MS).toBe(30_000);
  });

  it('starts at the current time and moves on each tick', () => {
    const { result } = renderHook(() => useRelativeNow());
    const start = Date.parse('2026-09-28T10:00:00Z');
    expect(result.current).toBe(start);
    act(() => vi.advanceTimersByTime(RELATIVE_TICK_MS));
    expect(result.current).toBe(start + RELATIVE_TICK_MS);
  });

  it('gives every subscriber the same instant', () => {
    const a = renderHook(() => useRelativeNow());
    act(() => vi.advanceTimersByTime(12_000));
    const b = renderHook(() => useRelativeNow());
    act(() => vi.advanceTimersByTime(RELATIVE_TICK_MS));
    expect(a.result.current).toBe(b.result.current);
  });
});
