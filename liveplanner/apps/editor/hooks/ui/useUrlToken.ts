import { useSyncExternalStore } from 'react';

// The page URL's `?token=` (docs/specs/013-workspace/teams.md: the /join and /join/decline landings), as a store
// with nothing to subscribe to: these pages never change their own query. Undefined while prerendering and
// hydrating (the server snapshot), so the static export and the first client render agree, with no hydration
// mismatch, and the URL is read after. Null when the URL carries no token.
const noSubscription = () => () => {};
const readUrlToken = () => new URLSearchParams(window.location.search).get('token');
const beforeHydration = (): string | null | undefined => undefined;

export function useUrlToken(): string | null | undefined {
  return useSyncExternalStore(noSubscription, readUrlToken, beforeHydration);
}
