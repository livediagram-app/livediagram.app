'use client';

import { useMemo, useSyncExternalStore } from 'react';

// Reactive CSS media query. Re-renders the caller whenever the query starts or
// stops matching, so a surface can mount/unmount on resize or follow an OS
// setting the user changes mid-session.
//
// useSyncExternalStore rather than useState + useEffect on purpose: the match
// is external state React doesn't own, and reading it in an effect means the
// first paint renders the wrong branch and then immediately corrects itself.
// It also keeps us clear of react-hooks/set-state-in-effect.
//
// The server snapshot is always false, so SSR and the first client render agree
// and the markup hydrates without a mismatch. Callers should therefore phrase
// the query so that `false` is the safe default for static HTML.

// matchMedia is optional-chained throughout: jsdom and very old browsers can
// leave it undefined, and a missing matchMedia should read as "no match"
// rather than throw during render.
export function useMediaQuery(query: string): boolean {
  // Memoised on `query` so the subscription survives re-renders. Fresh function
  // identities here would make useSyncExternalStore tear down and re-add the
  // listener on every single render.
  const [subscribe, getSnapshot] = useMemo(
    () =>
      [
        (cb: () => void) => {
          const mql = typeof window === 'undefined' ? null : window.matchMedia?.(query);
          if (!mql) return () => {};
          mql.addEventListener('change', cb);
          return () => mql.removeEventListener('change', cb);
        },
        () =>
          typeof window === 'undefined' ? false : (window.matchMedia?.(query).matches ?? false),
      ] as const,
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

// Shared query strings, so callers don't retype (and mistype) them.
export const PREFERS_REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
