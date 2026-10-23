'use client';

import { useEffect, useState } from 'react';

// Home's hero comes and goes with Home: leaving Home folds it away, returning unfolds it, each over the host
// theme's `long` duration (250 ms), so the page under it slides rather than jumps. It is mounted only while it
// shows or folds away. Landing on Home shows it at once, so the first paint never waits on it. Under reduced
// motion the fold is instant (`motion-reduce:transition-none` on the wrapper) and the unmount simply follows.

export const HERO_FOLD_MS = 250;

export type HeroPresence = {
  /** Whether the hero is in the page at all. */
  mounted: boolean;
  /** Whether it is unfolded (its full height, opaque); false while it folds in or away. */
  open: boolean;
};

export function useHeroPresence(shown: boolean): HeroPresence {
  const [state, setState] = useState<HeroPresence>(() => ({ mounted: shown, open: shown }));
  // The move itself is derived in render (React's "adjusting state when a prop changes"): arriving mounts it
  // folded, leaving starts the fold. The effect only schedules what follows.
  const [was, setWas] = useState(shown);
  if (was !== shown) {
    setWas(shown);
    if (shown && !state.open) setState({ mounted: true, open: false });
    if (!shown && state.mounted) setState({ mounted: true, open: false });
  }

  useEffect(() => {
    if (shown) {
      // Unfold on the frame after the folded one painted, so the transition has a start to run from.
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setState({ mounted: true, open: true }));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    const timer = setTimeout(() => setState({ mounted: false, open: false }), HERO_FOLD_MS);
    return () => clearTimeout(timer);
  }, [shown]);

  return state;
}
