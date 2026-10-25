// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useToastTimer } from './useToastTimer';

// docs/specs/004-interface-design/toasts.md "Timing".
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useToastTimer', () => {
  it('fires once after its time', () => {
    const done = vi.fn();
    renderHook(() => useToastTimer(4000, false, done));
    vi.advanceTimersByTime(3999);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('never fires for a toast that waits', () => {
    const done = vi.fn();
    renderHook(() => useToastTimer(null, false, done));
    vi.advanceTimersByTime(600_000);
    expect(done).not.toHaveBeenCalled();
  });

  it('holds while paused and resumes with what was left', () => {
    const done = vi.fn();
    const view = renderHook(({ paused }) => useToastTimer(4000, paused, done), {
      initialProps: { paused: false },
    });
    vi.advanceTimersByTime(2500);
    view.rerender({ paused: true });
    vi.advanceTimersByTime(60_000);
    expect(done).not.toHaveBeenCalled();
    view.rerender({ paused: false });
    vi.advanceTimersByTime(1499);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('starts over on a new time (an action toast emptied of its buttons)', () => {
    const done = vi.fn();
    const view = renderHook(({ ms }) => useToastTimer(ms, false, done), {
      initialProps: { ms: null as number | null },
    });
    vi.advanceTimersByTime(10_000);
    view.rerender({ ms: 4000 });
    vi.advanceTimersByTime(3999);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
  });
});
