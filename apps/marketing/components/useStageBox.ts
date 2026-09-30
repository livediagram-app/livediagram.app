'use client';

import { useEffect, useState, type RefObject } from 'react';
import type { StageBox } from '@/lib/hero-stage';

// The hero stage's width and page-left edge, for snapping the track to whole pixels
// (lib/hero-stage.ts). A ResizeObserver reports the first size on observe and every resize after;
// a window resize can move the stage without resizing it (a centred max-width container), so that
// is watched too. Null until measured: the stage keeps its percentage layout until then.
export function useStageBox(ref: RefObject<HTMLElement | null>): StageBox | null {
  const [box, setBox] = useState<StageBox | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox((prev) =>
        prev && prev.width === r.width && prev.left === r.left
          ? prev
          : { width: r.width, left: r.left },
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [ref]);
  return box;
}
