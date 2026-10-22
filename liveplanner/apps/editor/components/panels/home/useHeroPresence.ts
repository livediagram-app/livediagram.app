'use client';

import { useEffect, useState } from 'react';
import { MOTION_MS } from '@liveplanner/tailwind-config/motion';

// Home's hero comes and goes with Home (docs/specs/013-workspace/explorer-home.md "The hero"): leaving Home folds it
// away, returning unfolds it, each over the `long` token, so the page under it slides rather than jumps. It is
// mounted only while it shows or folds away. Landing on Home shows it at once, so the first paint never waits on it.
// Reduced motion collapses the transition to instant (motion.md), and the fold-away then ends a beat later unseen.

export type HeroPresence = {
  /** Whether the hero is in the page at all. */
  mounted: boolean;
  /** Whether it is unfolded (its full height, opaque); false while it folds in or away. */
  open: boolean;
};

export function useHeroPresence(onHome: boolean): HeroPresence {
  const [state, setState] = useState<HeroPresence>(() => ({ mounted: onHome, open: onHome }));
  // The move itself is derived in render (React's "adjusting state when a prop changes"): arriving mounts it folded,
  // leaving starts the fold. The effects below only schedule what follows.
  const [wasHome, setWasHome] = useState(onHome);
  if (wasHome !== onHome) {
    setWasHome(onHome);
    if (onHome && !state.open) setState({ mounted: true, open: false });
    if (!onHome && state.mounted) setState({ mounted: true, open: false });
  }

  useEffect(() => {
    if (onHome) {
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
    const timer = setTimeout(() => setState({ mounted: false, open: false }), MOTION_MS.long);
    return () => clearTimeout(timer);
  }, [onHome]);

  return state;
}
