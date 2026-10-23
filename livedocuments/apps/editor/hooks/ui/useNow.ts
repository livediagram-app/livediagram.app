import { useEffect, useState } from 'react';

// `Date.now()` as state that re-renders on an interval while `active`, so a
// live readout (a running timer's clock) ticks instead of freezing at
// whatever the last render saw. The first tick lands on the next frame, so a
// readout that goes from paused to running never shows the stale instant it
// was holding. While inactive nothing is scheduled and the value is frozen,
// which is what a paused readout wants anyway.
export function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const raf = window.requestAnimationFrame(tick);
    const id = window.setInterval(tick, intervalMs);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, [active, intervalMs]);
  return now;
}
