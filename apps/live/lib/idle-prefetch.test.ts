// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefetchWhenIdle } from './idle-prefetch';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('prefetchWhenIdle', () => {
  it('runs each loader once the page is idle, and only once per page', () => {
    let idle: () => void = () => {};
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => ((idle = cb), 1));
    vi.stubGlobal('cancelIdleCallback', () => {});
    const load = vi.fn(async () => ({}));
    prefetchWhenIdle([load]);
    expect(load).not.toHaveBeenCalled();
    idle();
    prefetchWhenIdle([load]);
    idle();
    expect(load).toHaveBeenCalledOnce();
  });

  it('never runs once cancelled, and swallows a failed load', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    const failing = vi.fn(async () => {
      throw new Error('offline');
    });
    const cancelled = vi.fn(async () => ({}));
    prefetchWhenIdle([cancelled])();
    prefetchWhenIdle([failing]);
    vi.runAllTimers();
    expect(cancelled).not.toHaveBeenCalled();
    expect(failing).toHaveBeenCalledOnce();
  });
});
