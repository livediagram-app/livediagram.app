// @vitest-environment jsdom

// The after-write beat the Timeline re-reads on (docs/specs/013-workspace/timeline.md §2.4b): one
// delayed run per write, bursts collapsed to one run per interval, and
// a purge handed over at once.

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyApiWrite, resetApiWriteListeners } from '@/lib/api/write-signal';
import { useAfterApiWrite } from './useAfterApiWrite';

beforeEach(() => {
  resetApiWriteListeners();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useAfterApiWrite', () => {
  it('runs once, a beat after the write, so the workers deferred emit has landed', () => {
    const run = vi.fn();
    renderHook(() => useAfterApiWrite(run, { delayMs: 1000, minIntervalMs: 5000 }));
    notifyApiWrite();
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('collapses a burst of writes into one run, then holds the interval', () => {
    // An editor autosaving every 600ms must not become a read every 600ms.
    const run = vi.fn();
    renderHook(() => useAfterApiWrite(run, { delayMs: 1000, minIntervalMs: 5000 }));
    for (let i = 0; i < 5; i += 1) {
      notifyApiWrite();
      vi.advanceTimersByTime(100);
    }
    vi.advanceTimersByTime(1000);
    expect(run).toHaveBeenCalledTimes(1);
    // A write straight after the run waits for the interval, not the delay.
    notifyApiWrite();
    vi.advanceTimersByTime(1000);
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(4000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('hands a purge over immediately and still schedules the re-read', () => {
    const run = vi.fn();
    renderHook(() => useAfterApiWrite(run, { delayMs: 1000, minIntervalMs: 5000 }));
    const purge = { sourceType: 'diagram', sourceId: 'd1' };
    notifyApiWrite({ purge });
    expect(run).toHaveBeenCalledWith({ purge });
    vi.advanceTimersByTime(1000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith({});
  });

  it('does nothing while disabled, and unsubscribes on unmount', () => {
    const run = vi.fn();
    const { unmount } = renderHook(() => useAfterApiWrite(run, { enabled: false }));
    notifyApiWrite();
    vi.advanceTimersByTime(10_000);
    expect(run).not.toHaveBeenCalled();
    unmount();
  });
});
