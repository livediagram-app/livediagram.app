import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTimingSampler,
  reportTiming,
  resetTimingForTests,
  startTiming,
  wasHiddenSince,
} from './timing';

// Plain node with a hand-rolled document and a controllable performance clock, like index.test.ts.

let clock = 0;
let visibility = 'visible';
let visibilityHandlers: Array<() => void> = [];
let history: { name: string; startTime: number }[] = [];

beforeEach(() => {
  clock = 1_000;
  visibility = 'visible';
  visibilityHandlers = [];
  history = [];
  resetTimingForTests();
  vi.useFakeTimers();
  vi.stubGlobal('performance', {
    now: () => clock,
    getEntriesByType: (type: string) => (type === 'visibility-state' ? history : []),
  });
  vi.stubGlobal('document', {
    get visibilityState() {
      return visibility;
    },
    addEventListener: (_type: string, fn: () => void) => visibilityHandlers.push(fn),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const hide = () => {
  visibility = 'hidden';
  visibilityHandlers.forEach((fn) => fn());
};
const show = () => {
  visibility = 'visible';
  visibilityHandlers.forEach((fn) => fn());
};

describe('startTiming', () => {
  it('reports the elapsed time as its bucket', () => {
    const track = vi.fn();
    const timing = startTiming(track, 'TabLoad');
    clock += 420;
    timing.end();
    expect(track).toHaveBeenCalledWith('Timing', 'Measured', 'TabLoad.Under500ms');
  });

  it('counts only the first end', () => {
    const track = vi.fn();
    const timing = startTiming(track, 'Save');
    timing.end();
    timing.end();
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('backdates the start with from', () => {
    const track = vi.fn();
    startTiming(track, 'DocumentLoad', { from: 0 }).end();
    expect(track).toHaveBeenCalledWith('Timing', 'Measured', 'DocumentLoad.Under2000ms');
  });

  it('drops a timing the page was hidden during', () => {
    const track = vi.fn();
    const timing = startTiming(track, 'RoomReconnect');
    clock += 100;
    hide();
    clock += 60_000;
    show();
    timing.end();
    expect(track).not.toHaveBeenCalled();
  });

  it('drops a timing that started while the page was hidden', () => {
    const track = vi.fn();
    visibility = 'hidden';
    const timing = startTiming(track, 'RoomReconnect');
    show();
    clock += 50;
    timing.end();
    expect(track).not.toHaveBeenCalled();
  });

  it('keeps a timing that started after the page came back', () => {
    const track = vi.fn();
    startTiming(track, 'Save'); // starts the watch
    hide();
    clock += 10;
    show();
    clock += 10;
    const timing = startTiming(track, 'Save');
    clock += 50;
    timing.end();
    expect(track).toHaveBeenCalledWith('Timing', 'Measured', 'Save.Under100ms');
  });

  it('drops a cancelled timing', () => {
    const track = vi.fn();
    const timing = startTiming(track, 'Save');
    timing.cancel();
    timing.end();
    expect(track).not.toHaveBeenCalled();
  });

  it('ends after the next paint when asked', () => {
    const track = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 16));
    const timing = startTiming(track, 'TabLoad');
    clock += 200;
    timing.endAfterPaint();
    expect(track).not.toHaveBeenCalled();
    clock += 20;
    vi.runAllTimers();
    expect(track).toHaveBeenCalledWith('Timing', 'Measured', 'TabLoad.Under250ms');
  });

  it('ends straight away where there are no frames to wait for', () => {
    const track = vi.fn();
    startTiming(track, 'TabLoad').endAfterPaint();
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('does nothing where there is no performance clock', () => {
    vi.stubGlobal('performance', undefined);
    const track = vi.fn();
    const timing = startTiming(track, 'Save');
    timing.endAfterPaint();
    timing.end();
    timing.cancel();
    expect(track).not.toHaveBeenCalled();
  });
});

describe('wasHiddenSince', () => {
  it("reads the browser's visibility history from before the watch began", () => {
    history = [{ name: 'hidden', startTime: 500 }];
    expect(wasHiddenSince(0)).toBe(true);
    expect(wasHiddenSince(600)).toBe(false);
  });

  it('is true while the page is hidden, and where there is no document', () => {
    visibility = 'hidden';
    expect(wasHiddenSince(clock)).toBe(true);
    vi.stubGlobal('document', undefined);
    expect(wasHiddenSince(clock)).toBe(true);
  });

  it('treats a missing visibility history as never hidden', () => {
    vi.stubGlobal('performance', {
      now: () => clock,
      getEntriesByType: () => {
        throw new Error('unsupported');
      },
    });
    expect(wasHiddenSince(0)).toBe(false);
  });
});

describe('reportTiming', () => {
  it('sends nothing for an unknown metric or a bad value', () => {
    const track = vi.fn();
    reportTiming(track, 'Unknown', 10);
    reportTiming(track, 'Save', Number.NaN);
    expect(track).not.toHaveBeenCalled();
  });

  it('never throws into the caller', () => {
    expect(() =>
      reportTiming(
        () => {
          throw new Error('transport');
        },
        'Save',
        10,
      ),
    ).not.toThrow();
  });
});

describe('createTimingSampler', () => {
  it('allows the first, then at most one per interval', () => {
    const sample = createTimingSampler(60_000);
    expect(sample()).toBe(true);
    clock += 30_000;
    expect(sample()).toBe(false);
    clock += 30_000;
    expect(sample()).toBe(true);
    expect(sample()).toBe(false);
  });
});
