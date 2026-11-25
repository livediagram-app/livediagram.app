'use client';

// Calls `onReturn` when the person comes back to this browser tab (it becomes visible again, or the window takes
// focus), at most once per `minGapMs`, so a list left open since yesterday reads itself again without a click. Both
// events fire on one return; the gap folds them into one call.

import { useEffect, useRef, useState } from 'react';

export function useReturnToTab(onReturn: () => void, minGapMs = 30_000, enabled = true): void {
  const latest = useRef(onReturn);
  latest.current = onReturn;
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    let last = Date.now();
    const fire = () => {
      if (document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - last < minGapMs) return;
      last = now;
      latest.current();
    };
    document.addEventListener('visibilitychange', fire);
    window.addEventListener('focus', fire);
    return () => {
      document.removeEventListener('visibilitychange', fire);
      window.removeEventListener('focus', fire);
    };
  }, [minGapMs, enabled]);
}

// How far apart two returns must be to read again in a picker or the editors' panel: enough to fold the one return's
// visibilitychange and focus into one read, short enough that a rename made in another tab and straight back shows.
export const RETURN_REREAD_GAP_MS = 1_000;

/**
 * How many times the person has come back to this browser tab while `enabled` (Work Tracker 1460, 1461). A list that
 * picks a file puts it among its read's dependencies, so a rename made in another tab shows on its rows with no reload.
 */
export function useReturnCount(enabled = true, minGapMs = RETURN_REREAD_GAP_MS): number {
  const [count, setCount] = useState(0);
  useReturnToTab(() => setCount((n) => n + 1), minGapMs, enabled);
  return count;
}
