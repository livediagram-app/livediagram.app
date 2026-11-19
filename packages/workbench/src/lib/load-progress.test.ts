import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTO_RELOAD_DELAY_MS,
  AUTO_RELOAD_WINDOW_MS,
  createLoadProgress,
  LOAD_TIMEOUT_MS,
} from './load-progress';

// Each product's docs/specs/007-editor/load-recovery.md "The load always ends" + "Self-healing on the opening screen".
// Each editor's lib/load-progress.test.ts drives its binding; these pin the shared module's every branch.

const KEY = 'thing:load-auto-reloads';
const make = () =>
  createLoadProgress({
    ownStep: 'thing',
    ownToken: 'Thing',
    telemetry: 'ThingLoad',
    autoReloadKey: KEY,
  });

class MemoryStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

let lp: ReturnType<typeof make>;
let storage: MemoryStorage;
let now: number;
const deps = (extra: Record<string, unknown> = {}) => ({
  online: () => true,
  storage: storage as unknown as Storage,
  url: 'https://x.test/thing/d1',
  now: () => now,
  ...extra,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  storage = new MemoryStorage();
  now = 1_000_000;
  lp = make();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('armLoadWatchdog', () => {
  it('does nothing for a load that finishes in time', () => {
    const onTimedOut = vi.fn();
    const warn = vi.fn();
    const w = lp.armLoadWatchdog(onTimedOut, deps({ warn }));
    expect(lp.getLoadProgress().step).toBe('identity');
    expect(w.finish()).toBe(false);
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS * 2);
    expect(onTimedOut).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps the step a failed load reached, and resets for a test's next load", () => {
    const w = lp.armLoadWatchdog(vi.fn(), deps());
    lp.setLoadStep('thing');
    w.finish();
    expect(lp.getLoadProgress().step).toBe('thing');
    lp.resetLoadProgressForTests();
    expect(lp.getLoadProgress()).toEqual({
      step: null,
      startedAt: null,
      timedOut: false,
      healing: false,
    });
  });

  it('reloads once on the first timeout in a tab, saying so first under the editor’s name', () => {
    const onTimedOut = vi.fn();
    const reload = vi.fn();
    const warn = vi.fn();
    lp.armLoadWatchdog(onTimedOut, deps({ reload, warn }));
    lp.setLoadStep('thing');
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(lp.getLoadProgress()).toMatchObject({ timedOut: true, healing: true });
    expect(warn.mock.calls.map((c): unknown => c[0])).toEqual([
      'ThingLoad.TimedOut.Thing',
      'ThingLoad.AutoReload',
    ]);
    expect(storage.getItem(KEY)).not.toBeNull();
    vi.advanceTimersByTime(AUTO_RELOAD_DELAY_MS);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(onTimedOut).not.toHaveBeenCalled();
  });

  it('shows the error on a second timeout within the window, then heals again after it', () => {
    const reload = vi.fn();
    lp.armLoadWatchdog(vi.fn(), deps({ reload }));
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);

    const onTimedOut = vi.fn();
    lp.armLoadWatchdog(onTimedOut, deps({ reload }));
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(onTimedOut).toHaveBeenCalledTimes(1);
    expect(lp.getLoadProgress().healing).toBe(false);

    now += AUTO_RELOAD_WINDOW_MS + 1;
    const third = vi.fn();
    lp.armLoadWatchdog(third, deps({ reload }));
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(third).not.toHaveBeenCalled();
    expect(lp.getLoadProgress().healing).toBe(true);
  });

  it('does not reload while offline, and leaves the claim for when it can help', () => {
    const onTimedOut = vi.fn();
    const reload = vi.fn();
    lp.armLoadWatchdog(onTimedOut, deps({ reload, online: () => false }));
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS + AUTO_RELOAD_DELAY_MS);
    expect(onTimedOut).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    expect(storage.getItem(KEY)).toBeNull();
  });

  it('shows the error when session storage is unavailable or throws, rather than risking a loop', () => {
    const onTimedOut = vi.fn();
    lp.armLoadWatchdog(onTimedOut, deps({ storage: null }));
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(onTimedOut).toHaveBeenCalledTimes(1);

    vi.stubGlobal('window', {
      get sessionStorage(): Storage {
        throw new Error('blocked');
      },
    });
    const blocked = vi.fn();
    lp.armLoadWatchdog(blocked, { online: () => true });
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(blocked).toHaveBeenCalledTimes(1);
  });

  it("uses the browser's clock, session storage, address, connection and reload when given none", () => {
    const reload = vi.fn();
    const session = new MemoryStorage();
    vi.stubGlobal('window', {
      sessionStorage: session,
      location: { href: 'https://x.test/thing/d2', reload },
    });
    lp.armLoadWatchdog(vi.fn());
    expect(lp.getLoadProgress().startedAt).toBe(Date.now());
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS + AUTO_RELOAD_DELAY_MS);
    expect(JSON.parse(session.getItem(KEY)!)).toHaveProperty(['https://x.test/thing/d2']);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('names an unknown step when the progress was cleared under a running load', () => {
    const warn = vi.fn();
    lp.armLoadWatchdog(vi.fn(), deps({ warn, online: () => false }));
    lp.resetLoadProgressForTests();
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(console.warn).toHaveBeenCalledWith(
      `[load] timed out after ${LOAD_TIMEOUT_MS} ms at step unknown`,
    );
    expect(warn).toHaveBeenCalledWith('ThingLoad.TimedOut.Unknown');
  });

  it('reports a late load so the caller can replace the error screen', () => {
    storage.setItem(KEY, JSON.stringify({ 'https://x.test/thing/d1': now }));
    const warn = vi.fn();
    const w = lp.armLoadWatchdog(vi.fn(), deps({ warn }));
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(w.finish()).toBe(true);
    expect(warn).toHaveBeenCalledWith('ThingLoad.Late');
    // finish is once only.
    expect(w.finish()).toBe(false);
  });

  it('lets a load that lands before the healing reload win, cancelling the reload', () => {
    const reload = vi.fn();
    const w = lp.armLoadWatchdog(vi.fn(), deps({ reload }));
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(lp.getLoadProgress().healing).toBe(true);
    expect(w.finish()).toBe(true);
    expect(lp.getLoadProgress().healing).toBe(false);
    vi.advanceTimersByTime(AUTO_RELOAD_DELAY_MS * 2);
    expect(reload).not.toHaveBeenCalled();
  });

  it('notifies subscribers of step changes', () => {
    const fn = vi.fn();
    const off = lp.subscribeLoadProgress(fn);
    lp.setLoadStep('share');
    lp.setLoadStep('share');
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    lp.setLoadStep('done');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('keeps each editor’s progress apart', () => {
    const other = make();
    lp.setLoadStep('share');
    expect(other.getLoadProgress().step).toBeNull();
  });
});

describe('loadStepToken', () => {
  it('names each step for telemetry, the editor’s own included', () => {
    expect(lp.loadStepToken('first-tab')).toBe('FirstTab');
    expect(lp.loadStepToken('thing')).toBe('Thing');
    expect(lp.loadStepToken(null)).toBe('Unknown');
  });
});
