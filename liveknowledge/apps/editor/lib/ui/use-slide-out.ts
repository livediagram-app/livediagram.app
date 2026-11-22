'use client';

// A panel that slides away rather than vanishing (docs/specs/030-knowledgebase/page-surface.md "Sidebars slide"):
// while `on` turns false it stays drawn for one slide, `leaving` set so it can take its off-screen place, then goes.
// Coming back is the panel's own `starting:` style. With reduced motion it goes at once.
import { useEffect, useState } from 'react';

/** How long a sidebar's slide takes (ms): `duration-200`. */
export const SLIDE_MS = 200;

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useSlideOut(on: boolean): { drawn: boolean; leaving: boolean } {
  const [was, setWas] = useState(on);
  const [leaving, setLeaving] = useState(false);
  // Turning off starts the slide in the same render (React's state-from-props pattern), so no frame shows it gone.
  if (was !== on) {
    setWas(on);
    setLeaving(!on && !reducedMotion());
  }
  useEffect(() => {
    if (!leaving) return;
    const done = window.setTimeout(() => setLeaving(false), SLIDE_MS);
    return () => window.clearTimeout(done);
  }, [leaving]);
  return { drawn: on || leaving, leaving: !on && leaving };
}
