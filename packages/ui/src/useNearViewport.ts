'use client';

import { useEffect, useState, type RefObject } from 'react';

// Whether an element has come near the viewport, latched once true: for work only worth doing if the reader can
// get there (a below-the-fold section's request). Where IntersectionObserver is missing it answers true at once,
// so nothing is ever withheld.
export function useNearViewport(ref: RefObject<Element | null>, rootMargin = '600px'): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (near) return;
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin, near]);
  return near;
}
