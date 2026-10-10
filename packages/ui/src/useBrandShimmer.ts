import { useEffect } from 'react';

// One gleam across the wordmark each time the logo is pointed at
// (docs/specs/004-interface-design/brand-mark.md, "Size and motion"). Paced
// for reading, beside the prism's turn in motion.md's list of hover stories.
export const SHIMMER_MS = 900;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

// Sweeps the overlay's background highlight once, left to right, each time
// `hovers` counts up (0 is never), then hides it. Leaving early lets the sweep
// finish; a new hover restarts it. A frame loop writing one style property;
// nothing under prefers-reduced-motion.
export function useBrandShimmer(hovers: number, overlay: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = overlay.current;
    if (!hovers || !el || typeof window === 'undefined' || !window.matchMedia) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / SHIMMER_MS);
      // The highlight band sits off the right at 100% and off the left at 0%.
      el.style.backgroundPosition = `${100 - 100 * easeInOut(t)}% 0`;
      el.style.opacity = t < 1 ? '1' : '0';
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.style.opacity = '0';
    };
  }, [hovers, overlay]);
}
