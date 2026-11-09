'use client';

import { useSyncExternalStore } from 'react';

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

// One MediaQueryList and one `change` listener per query string, shared by every caller: matchMedia parses the query
// and builds a new list each call, and a canvas can hold hundreds of callers of one query (an arrow's handles each
// ask whether the pointer is coarse), so each adding a listener of its own cost a listener per caller and a
// dispatch per caller on every change. The listener is added with the first subscriber and removed with the last,
// and the list is let go with it.
type Shared = {
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => boolean;
};

// Keyed on the matchMedia in use too, so a page (or a test) that swaps it gets lists from the new one.
const byMatcher = new WeakMap<object, Map<string, Shared>>();
const NONE: Shared = { subscribe: () => () => {}, getSnapshot: () => false };

function sharedQuery(query: string): Shared {
  const matcher = typeof window === 'undefined' ? undefined : window.matchMedia;
  if (typeof matcher !== 'function') return NONE;
  const queries = byMatcher.get(matcher) ?? new Map<string, Shared>();
  byMatcher.set(matcher, queries);
  const known = queries.get(query);
  if (known) return known;
  const list = matcher.call(window, query) ?? null;
  if (!list) return NONE;
  const subscribers = new Set<() => void>();
  const notify = () => {
    for (const cb of [...subscribers]) cb();
  };
  const shared: Shared = {
    subscribe(cb) {
      if (subscribers.size === 0) list.addEventListener('change', notify);
      subscribers.add(cb);
      return () => {
        if (!subscribers.delete(cb) || subscribers.size > 0) return;
        list.removeEventListener('change', notify);
        // Nobody left: the next caller asks matchMedia afresh, as a caller mounting alone always did.
        if (queries.get(query) === shared) queries.delete(query);
      };
    },
    getSnapshot: () => list.matches,
  };
  queries.set(query, shared);
  return shared;
}

export function useMediaQuery(query: string): boolean {
  // The same subscribe and getSnapshot for every render and every caller of `query`, so useSyncExternalStore never
  // tears the subscription down between renders.
  const { subscribe, getSnapshot } = sharedQuery(query);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

// Shared query strings, so callers don't retype (and mistype) them.
export const PREFERS_REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
