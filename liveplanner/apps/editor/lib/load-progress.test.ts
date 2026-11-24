import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  armLoadWatchdog,
  AUTO_RELOAD_DELAY_MS,
  AUTO_RELOAD_KEY,
  getLoadProgress,
  LOAD_TIMEOUT_MS,
  loadStepToken,
  resetLoadProgressForTests,
  setLoadStep,
} from './load-progress';

// docs/specs/007-editor/load-recovery.md "The load always ends" + "Self-healing on the opening screen". The watchdog's
// rules are tested once beside it (packages/workbench/src/lib/load-progress.test.ts); this holds what this editor
// binds to it: its own step, its telemetry name and its storage key.

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  resetLoadProgressForTests();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('this editor’s load progress', () => {
  it('heals a first timeout under its own step, telemetry name and storage key', () => {
    const stored = new Map<string, string>();
    const storage = {
      getItem: (k: string) => stored.get(k) ?? null,
      setItem: (k: string, v: string) => void stored.set(k, v),
    } as unknown as Storage;
    const reload = vi.fn();
    const warn = vi.fn();
    armLoadWatchdog(vi.fn(), {
      online: () => true,
      storage,
      url: 'https://x.test/project/d1',
      now: () => 1_000_000,
      reload,
      warn,
    });
    setLoadStep('project');
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(getLoadProgress()).toMatchObject({ step: 'project', timedOut: true, healing: true });
    expect(warn.mock.calls.map((c): unknown => c[0])).toEqual([
      'ProjectLoad.TimedOut.Project',
      'ProjectLoad.AutoReload',
    ]);
    vi.advanceTimersByTime(AUTO_RELOAD_DELAY_MS);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(AUTO_RELOAD_KEY).toBe('liveplanner:load-auto-reloads');
    expect([...stored.keys()]).toEqual([AUTO_RELOAD_KEY]);
  });

  it('names its own step for telemetry', () => {
    expect(loadStepToken('project')).toBe('Project');
    expect(loadStepToken('first-tab')).toBe('FirstTab');
  });
});
