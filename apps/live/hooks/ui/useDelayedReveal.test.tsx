// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedReveal } from './useDelayedReveal';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// The sign-in nudge's delay (docs/specs/014-identity/sign-in-encouragement.md).
describe('useDelayedReveal', () => {
  it('reveals after the delay while enabled', () => {
    const { result } = renderHook(() => useDelayedReveal(1000, true));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(999));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it('never reveals while disabled', () => {
    const { result } = renderHook(() => useDelayedReveal(1000, false));
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(false);
  });

  it('hides on disable, and a re-enable waits the full delay again', () => {
    const { result, rerender } = renderHook(({ on }) => useDelayedReveal(1000, on), {
      initialProps: { on: true },
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(true);
    rerender({ on: false });
    expect(result.current).toBe(false);
    rerender({ on: true });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(999));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });
});
