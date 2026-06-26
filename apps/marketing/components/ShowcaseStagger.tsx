'use client';

import { Children, useEffect, useState, type ReactNode } from 'react';

// Client cycler for the SectionShowcase montage. The feature mocks each loop a
// continuous CSS animation; playing them all at once is busy, so this plays
// them in turn: one scene is "active" (animating, full opacity) at a time while
// the rest are paused (animation-play-state on every descendant) and dimmed.
// The active scene advances on a timer and wraps around.
//
// It takes the server-rendered scenes as `children` (the canonical way to pass
// server content into a client island) rather than the section data, so the
// FeatureArt scenes still render server-side and survive the static export.

const CYCLE_MS = 2600;

export function ShowcaseStagger({ children }: { children: ReactNode }) {
  const scenes = Children.toArray(children);
  const [active, setActive] = useState(0);
  // Until mounted we assume motion is allowed (matches the SSR markup, which
  // animates scene 0 and parks the rest); a reduced-motion user flips this on
  // mount so every scene renders settled and undimmed.
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    setReduced(prefersReduced);
    if (prefersReduced || scenes.length <= 1) return;

    const id = setInterval(() => {
      setActive((i) => (i + 1) % scenes.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [scenes.length]);

  return (
    <ul className="space-y-4">
      {scenes.map((scene, i) => {
        const isActive = reduced || i === active;
        return (
          <li
            key={i}
            className={
              'transition-opacity duration-500 ' +
              (isActive ? '' : '[&_*]:[animation-play-state:paused] opacity-60')
            }
          >
            {scene}
          </li>
        );
      })}
    </ul>
  );
}
