'use client';

// The long-task log (docs/specs/008-canvas/canvas-performance.md "Observability"): while the
// `canvas-perf` debug scope is on (always in development, by the debug flag in production), every
// main-thread task over 50 ms logs its length and the gesture in progress, so a regression shows up
// while working. Registers nothing otherwise, or where the browser reports no long tasks.
//
// `gestureNow` is the editor's own reader of the gesture in progress (its lib/canvas-gesture.ts, typed on the
// gestures that editor has): a module function, so the observer is set up once.

import { useEffect } from 'react';
import { debugLog, debugScopeOn } from '../../lib/debug-log';

export function useCanvasLongTaskLog(gestureNow: () => string): void {
  useEffect(() => {
    if (!debugScopeOn('canvas-perf')) return;
    if (typeof PerformanceObserver === 'undefined') return;
    if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) return;
    const observer = new PerformanceObserver((list) => {
      for (const task of list.getEntries()) {
        debugLog('[canvas-perf] long task', {
          ms: Math.round(task.duration),
          gesture: gestureNow(),
        });
      }
    });
    observer.observe({ type: 'longtask' });
    return () => observer.disconnect();
  }, [gestureNow]);
}
