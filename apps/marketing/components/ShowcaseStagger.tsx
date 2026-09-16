'use client';

import { Children, useEffect, useState, type ReactNode } from 'react';
import { useMediaQuery, PREFERS_REDUCED_MOTION } from '@livediagram/ui';

import styles from './ShowcaseStagger.module.css';

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
  // hydration so every scene renders settled and undimmed. Reading it through
  // useMediaQuery also means toggling the OS setting takes effect immediately,
  // where the previous mount-only read stayed stale for the rest of the visit.
  const reduced = useMediaQuery(PREFERS_REDUCED_MOTION);

  useEffect(() => {
    if (reduced || scenes.length <= 1) return;

    const id = setInterval(() => {
      setActive((i) => (i + 1) % scenes.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [reduced, scenes.length]);

  return (
    <ul className="space-y-4">
      {scenes.map((scene, i) => {
        const isActive = reduced || i === active;
        return (
          <li
            key={i}
            className={
              'transition-opacity duration-500 ' + (isActive ? '' : `${styles.frozen} opacity-60`)
            }
          >
            {scene}
          </li>
        );
      })}
    </ul>
  );
}
