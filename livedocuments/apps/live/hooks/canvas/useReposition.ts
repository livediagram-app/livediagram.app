import { useLayoutEffect } from 'react';

// Keep a floating element (popover, portal menu) attached to its anchor:
// run `measure` once before paint, then again on every viewport change.
// Scroll is captured (third arg `true`) so it also fires for scrolls in
// nested containers, not just the window — easy to get wrong, which is
// why this lives in one place. `measure` owns the actual positioning and
// any null-anchor guard. Pass it memoised (useCallback with the values it
// reads): a new measure re-measures and re-attaches, and the lint checks
// the caller's dependencies.
export function useReposition(measure: () => void) {
  useLayoutEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);
}
