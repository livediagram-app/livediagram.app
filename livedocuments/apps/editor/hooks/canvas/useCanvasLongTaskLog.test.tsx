// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginCanvasGesture, resetCanvasGesturesForTests } from '@/lib/canvas-gesture';
import { useCanvasLongTaskLog } from './useCanvasLongTaskLog';

// docs/specs/008-canvas/canvas-performance.md "Observability": while the `canvas-perf` debug scope is
// on, every long task logs its length and the gesture in progress.

const scope = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/debug-log', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/debug-log')>();
  return { ...real, debugScopeOn: () => scope.on };
});

type Callback = (list: { getEntries: () => { duration: number }[] }) => void;
let observers: { cb: Callback; types: string[]; disconnected: boolean }[] = [];

function stubObserver(supported: string[]) {
  observers = [];
  class FakeObserver {
    static supportedEntryTypes = supported;
    private readonly entry: { cb: Callback; types: string[]; disconnected: boolean };
    constructor(cb: Callback) {
      this.entry = { cb, types: [], disconnected: false };
      observers.push(this.entry);
    }
    observe(opts: { type: string }) {
      this.entry.types.push(opts.type);
    }
    disconnect() {
      this.entry.disconnected = true;
    }
  }
  vi.stubGlobal('PerformanceObserver', FakeObserver);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetCanvasGesturesForTests();
  scope.on = true;
});

describe('useCanvasLongTaskLog', () => {
  it('logs each long task with the gesture in progress', () => {
    stubObserver(['longtask']);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    renderHook(() => useCanvasLongTaskLog());
    expect(observers.map((o) => o.types)).toEqual([['longtask']]);
    beginCanvasGesture('move');
    observers[0]!.cb({ getEntries: () => [{ duration: 87.6 }] });
    expect(info).toHaveBeenCalledWith('[canvas-perf] long task', { ms: 88, gesture: 'move' });
  });

  it('stops observing when the canvas goes', () => {
    stubObserver(['longtask']);
    const { unmount } = renderHook(() => useCanvasLongTaskLog());
    unmount();
    expect(observers[0]!.disconnected).toBe(true);
  });

  it('observes nothing while the scope is off', () => {
    stubObserver(['longtask']);
    scope.on = false;
    renderHook(() => useCanvasLongTaskLog());
    expect(observers).toHaveLength(0);
  });

  it('observes nothing where the browser has no long tasks', () => {
    stubObserver(['mark', 'measure']);
    renderHook(() => useCanvasLongTaskLog());
    expect(observers).toHaveLength(0);
  });
});
