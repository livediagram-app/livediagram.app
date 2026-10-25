'use client';

// Calls `onReturn` when the person comes back to this browser tab (it becomes visible again, or the window takes
// focus), at most once per `minGapMs`, so a list left open since yesterday reads itself again without a click. Both
// events fire on one return; the gap folds them into one call.

import { useEffect, useRef } from 'react';

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
