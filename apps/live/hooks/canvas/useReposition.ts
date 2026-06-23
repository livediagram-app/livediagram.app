import { useLayoutEffect, type DependencyList } from 'react';

// Keep a floating element (popover, portal menu) attached to its anchor:
// run `measure` once before paint, then again on every viewport change.
// Scroll is captured (third arg `true`) so it also fires for scrolls in
// nested containers, not just the window — easy to get wrong, which is
// why this lives in one place. `measure` owns the actual positioning and
// any null-anchor guard; pass the values it reads as `deps`.
export function useReposition(measure: () => void, deps: DependencyList) {
  useLayoutEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
