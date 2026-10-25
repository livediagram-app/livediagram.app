'use client';

// A toast's timeout (docs/specs/004-interface-design/toasts.md "Timing"): runs for `ms`, holds while
// `paused` (hovered, focused, or the page hidden) and resumes with the time it had left, never a fresh
// start. `ms` null is no timer at all (a toast already leaving). A new `ms` (an action toast replaced with no
// buttons) starts over.
import { useEffect, useRef } from 'react';
import { useLatest } from '../../hooks/ui/useLatest';

export function useToastTimer(ms: number | null, paused: boolean, onElapsed: () => void): void {
  const remaining = useRef<number | null>(ms);
  const elapsed = useLatest(onElapsed);
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
