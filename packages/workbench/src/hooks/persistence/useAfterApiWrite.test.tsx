// @vitest-environment jsdom

// The after-write beat a view re-reads on: one delayed run per signal, and
// bursts collapsed to one run per interval.

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  notifyApiWrite,
  resetApiWriteListeners,
  subscribeApiWrites,
} from '../../lib/api/write-signal';
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

  it('does nothing while disabled, and unsubscribes on unmount', () => {
    const run = vi.fn();
    const { unmount } = renderHook(() => useAfterApiWrite(run, { enabled: false }));
    notifyApiWrite();
    vi.advanceTimersByTime(10_000);
    expect(run).not.toHaveBeenCalled();
    unmount();
  });

  it('counts only the signals its filter takes, drops a run pending at unmount, and survives a failing listener', () => {
    const run = vi.fn();
    const { unmount } = renderHook(() =>
      useAfterApiWrite(run, { delayMs: 10, filter: (signal) => signal.claimed === true }),
    );
    // Another listener's bug never reaches the writer, nor the views after it.
    const broken = vi.fn(() => {
      throw new Error('listener bug');
    });
    subscribeApiWrites(broken);
    notifyApiWrite();
    vi.advanceTimersByTime(10);
    expect(run).not.toHaveBeenCalled();
    notifyApiWrite({ claimed: true });
    vi.advanceTimersByTime(10);
    expect(run).toHaveBeenCalledOnce();
    expect(broken).toHaveBeenCalledTimes(2);
    notifyApiWrite({ claimed: true });
    unmount();
    vi.advanceTimersByTime(10_000);
    expect(run).toHaveBeenCalledOnce();
  });
});
