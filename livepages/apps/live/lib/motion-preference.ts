import { PREFERS_REDUCED_MOTION } from '@livediagram/ui';

// Whether motion should be cut right now: the in-app "Reduce motion" preference (the `.reduce-motion`
// class useReduceMotion keeps on <html>) or the OS `prefers-reduced-motion` setting. For script-driven
// motion (a viewport glide, a smooth scroll) that CSS media queries cannot reach.
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    (document.documentElement.classList.contains('reduce-motion') ||
      window.matchMedia?.(PREFERS_REDUCED_MOTION).matches === true)
  );
}
