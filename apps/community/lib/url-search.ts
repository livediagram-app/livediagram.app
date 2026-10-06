// The page URL's query string as a tiny external store, so the gallery's filters live in exactly one
// place, the URL (docs/specs/025-community/community.md "Gallery": a filtered view can be shared and
// survives a reload). Components read it through useSyncExternalStore, which is SSR-safe (the static
// export renders with no query, `null`) and needs no effect to copy the URL into state. Writes use
// history.replaceState: changing a filter is not a navigation, so Back leaves the gallery.

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeSearch(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

export function getSearchSnapshot(): string {
  return window.location.search;
}

export function getServerSearchSnapshot(): string | null {
  return null;
}

// Replace the query string (`''` or `?a=b`), keeping the path and hash.
export function replaceSearch(search: string): void {
  if (search === window.location.search) return;
  const { pathname, hash } = window.location;
  window.history.replaceState(window.history.state, '', `${pathname}${search}${hash}`);
  notify();
}
