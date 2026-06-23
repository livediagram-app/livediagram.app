'use client';

import { useEffect, useState } from 'react';

// Reveal something after `delayMs`, but only while `enabled` is true.
// Returns false until the timer fires, then true. Used for the
// editor's sign-in nudge (spec/36), which waits ~5 minutes into a
// session before appearing so it never greets someone the instant
// they open a diagram.
//
// The timer is tied to `enabled`: it starts when `enabled` becomes
// true and is cleared if `enabled` goes false (e.g. the visitor signs
// in, or the banner gets dismissed), resetting `revealed` so a later
// re-enable waits the full delay again. Keep `enabled` free of
// transient flags (like zen mode) you don't want to restart the
// countdown; gate those on the returned value at render time instead.
export function useDelayedReveal(delayMs: number, enabled = true): boolean {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setRevealed(false);
      return;
    }
    const id = window.setTimeout(() => setRevealed(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs, enabled]);

  return revealed;
}
