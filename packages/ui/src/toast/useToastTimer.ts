'use client';

// A toast's timeout (liveworkspace/docs/specs/016-notifications/toasts.md "Timing"): runs for `ms`, holds while
// `paused` (hovered, focused, or the page hidden) and resumes with the time it had left, never a fresh
// start. `ms` null is no timer at all (a toast already leaving). A new `ms` (an action toast replaced with no
// buttons) starts over.
import { useEffect, useInsertionEffect, useRef } from 'react';

export function useToastTimer(ms: number | null, paused: boolean, onElapsed: () => void): void {
  const remaining = useRef<number | null>(ms);
  // The newest callback, read by the timer without restarting it (updated before any effect of the commit).
  const elapsed = useRef(onElapsed);
  useInsertionEffect(() => {
    elapsed.current = onElapsed;
  });
  // Declared first, so on a new `ms` it runs after the timer's cleanup and before its restart.
  useEffect(() => {
    remaining.current = ms;
  }, [ms]);
  useEffect(() => {
    const left = remaining.current;
    if (left === null || paused) return;
    const started = Date.now();
    const id = setTimeout(() => {
      remaining.current = 0;
      elapsed.current();
    }, left);
    return () => {
      clearTimeout(id);
      if (remaining.current !== 0) remaining.current = Math.max(0, left - (Date.now() - started));
    };
  }, [ms, paused, elapsed]);
}
