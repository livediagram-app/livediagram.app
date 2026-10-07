import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  armLoadWatchdog,
  AUTO_RELOAD_DELAY_MS,
  AUTO_RELOAD_WINDOW_MS,
  getLoadProgress,
  LOAD_TIMEOUT_MS,
  loadStepToken,
  resetLoadProgressForTests,
  setLoadStep,
  subscribeLoadProgress,
} from './load-progress';

// docs/specs/007-editor/load-recovery.md "The load always ends" + "Self-healing on the opening screen".

class MemoryStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

let storage: MemoryStorage;
let now: number;
const deps = (extra: Record<string, unknown> = {}) => ({
  online: () => true,
  storage: storage as unknown as Storage,
  url: 'https://x.test/document/d1',
  now: () => now,
  ...extra,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  storage = new MemoryStorage();
  now = 1_000_000;
  resetLoadProgressForTests();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('armLoadWatchdog', () => {
  it('does nothing for a load that finishes in time', () => {
    const onTimedOut = vi.fn();
    const warn = vi.fn();
    const w = armLoadWatchdog(onTimedOut, deps({ warn }));
    expect(getLoadProgress().step).toBe('identity');
    expect(w.finish()).toBe(false);
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS * 2);
    expect(onTimedOut).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(getLoadProgress().step).toBe('done');
  });

  it('reloads once on the first timeout in a tab, saying so first', () => {
    const onTimedOut = vi.fn();
    const reload = vi.fn();
    const warn = vi.fn();
    armLoadWatchdog(onTimedOut, deps({ reload, warn }));
    setLoadStep('document');
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(getLoadProgress()).toMatchObject({ timedOut: true, healing: true });
    expect(warn.mock.calls.map((c) => c[0])).toEqual([
      'DocumentLoad.TimedOut.Document',
      'DocumentLoad.AutoReload',
    ]);
    expect(reload).not.toHaveBeenCalled();
    vi.advanceTimersByTime(AUTO_RELOAD_DELAY_MS);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(onTimedOut).not.toHaveBeenCalled();
  });

  it('shows the error on a second timeout within the window, then heals again after it', () => {
    const reload = vi.fn();
    armLoadWatchdog(vi.fn(), deps({ reload }));
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);

    const onTimedOut = vi.fn();
    armLoadWatchdog(onTimedOut, deps({ reload }));
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(onTimedOut).toHaveBeenCalledTimes(1);
    expect(getLoadProgress().healing).toBe(false);

    now += AUTO_RELOAD_WINDOW_MS + 1;
    const third = vi.fn();
    armLoadWatchdog(third, deps({ reload }));
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(third).not.toHaveBeenCalled();
    expect(getLoadProgress().healing).toBe(true);
  });

  it('does not reload while offline, and leaves the claim for when it can help', () => {
    const onTimedOut = vi.fn();
    const reload = vi.fn();
    armLoadWatchdog(onTimedOut, deps({ reload, online: () => false }));
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS + AUTO_RELOAD_DELAY_MS);
    expect(onTimedOut).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    expect(storage.getItem('livediagram:load-auto-reloads')).toBeNull();
  });

  it('shows the error when session storage is unavailable, rather than risking a loop', () => {
    const onTimedOut = vi.fn();
    armLoadWatchdog(onTimedOut, deps({ storage: null }));
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(onTimedOut).toHaveBeenCalledTimes(1);
  });

  it('reports a late load so the caller can replace the error screen', () => {
    // Second timeout in the tab: the error shows, no reload pending.
    storage.setItem(
      'livediagram:load-auto-reloads',
      JSON.stringify({ 'https://x.test/document/d1': now }),
    );
    const warn = vi.fn();
    const w = armLoadWatchdog(vi.fn(), deps({ warn }));
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(w.finish()).toBe(true);
    expect(warn).toHaveBeenCalledWith('DocumentLoad.Late');
    // finish is once only.
    expect(w.finish()).toBe(false);
  });

  it('does not report a late load as recoverable while a healing reload is pending', () => {
    const w = armLoadWatchdog(vi.fn(), deps({ reload: vi.fn() }));
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(w.finish()).toBe(false);
  });

  it('notifies subscribers of step changes', () => {
    const fn = vi.fn();
    const off = subscribeLoadProgress(fn);
    setLoadStep('share');
    setLoadStep('share');
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    setLoadStep('done');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('loadStepToken', () => {
  it('names each step for telemetry', () => {
    expect(loadStepToken('first-tab')).toBe('FirstTab');
    expect(loadStepToken(null)).toBe('Unknown');
  });
});
