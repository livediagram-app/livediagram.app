// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SKETCH_INK_SETTLE_MS, watchUntilSettled } from './settle-watch';

// The settle wait a Sketch face's ink and WebKit's art pictures share (docs/specs/008-canvas/finish.md): a resize
// counts as a change only when asked for, and never the size the art started at.

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A ResizeObserver whose reports the test makes. */
function stubResizeObserver() {
  const reports: (() => void)[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        reports.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  return () => reports.forEach((report) => report());
}

describe('watchUntilSettled', () => {
  it('takes again once a resize settles, but not for the size it started at', () => {
    vi.useFakeTimers();
    const report = stubResizeObserver();
    const take = vi.fn();
    const stop = watchUntilSettled(document.createElement('div'), take, { resize: true });
    report();
    vi.advanceTimersByTime(SKETCH_INK_SETTLE_MS);
    expect(take).not.toHaveBeenCalled();
    report();
    vi.advanceTimersByTime(SKETCH_INK_SETTLE_MS);
    expect(take).toHaveBeenCalledTimes(1);
    stop();
  });

  it('ignores resizes unless asked', () => {
    vi.useFakeTimers();
    const report = stubResizeObserver();
    const take = vi.fn();
    const stop = watchUntilSettled(document.createElement('div'), take);
    report();
    report();
    vi.advanceTimersByTime(SKETCH_INK_SETTLE_MS);
    expect(take).not.toHaveBeenCalled();
    stop();
  });

  it('takes nothing after it stops', async () => {
    vi.useFakeTimers();
    const live = document.createElement('div');
    const take = vi.fn();
    const stop = watchUntilSettled(live, take);
    live.setAttribute('data-x', '1');
    await Promise.resolve();
    stop();
    vi.advanceTimersByTime(SKETCH_INK_SETTLE_MS);
    expect(take).not.toHaveBeenCalled();
  });
});
