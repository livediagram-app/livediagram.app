'use client';

// The long-task log (docs/specs/008-canvas/canvas-performance.md "Observability"): while the
// `canvas-perf` debug scope is on (always in development, by the debug flag in production), every
// main-thread task over 50 ms logs its length and the gesture in progress, so a regression shows up
// while working. Registers nothing otherwise, or where the browser reports no long tasks.

import { useEffect } from 'react';
import { canvasGestureNow } from '@/lib/canvas-gesture';
import { debugLog, debugScopeOn } from '@/lib/debug-log';

export function useCanvasLongTaskLog(): void {
  useEffect(() => {
    if (!debugScopeOn('canvas-perf')) return;
    if (typeof PerformanceObserver === 'undefined') return;
    if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) return;
    const observer = new PerformanceObserver((list) => {
      for (const task of list.getEntries()) {
        debugLog('[canvas-perf] long task', {
          ms: Math.round(task.duration),
          gesture: canvasGestureNow(),
        });
      }
    });
    observer.observe({ type: 'longtask' });
    return () => observer.disconnect();
  }, []);
}
