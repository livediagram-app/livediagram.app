'use client';

import { useEffect, useState, type RefObject } from 'react';

// How near the screen a tile starts its preview (blueprint PREVIEW_MARGIN_PX).
export const PREVIEW_MARGIN_PX = 300;

// True from the first time `ref` comes within PREVIEW_MARGIN_PX of the screen, and from then on (a preview once drawn
// is kept). Without IntersectionObserver (an old browser, a test) it is near at once.
export function useNearScreen(ref: RefObject<Element | null>): boolean {
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const node = ref.current;
    if (near || !node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: `${PREVIEW_MARGIN_PX}px` },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [ref, near]);
  return near;
}
