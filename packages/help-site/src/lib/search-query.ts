import { QUERY_MAX } from '@liveworkspace/help-registry/hrefs';

// The search box's text, shared with the app switch (liveworkspace/docs/specs/017-help/help-centre.md "A search
// survives the move"): the box publishes what the reader typed, the switch's links carry it as `?q=`, and the page a
// link lands on reads it back into its box. A tiny store rather than context, so the header's box and a phone chip
// elsewhere in the tree read the same text without a provider between them.

let current = '';
const listeners = new Set<() => void>();

export function getSearchQuery(): string {
  return current;
}

export function setSearchQuery(query: string): void {
  if (query === current) return;
  current = query;
  for (const listener of listeners) listener();
}

export function subscribeSearchQuery(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The query a page opens with: its `?q=`, capped, or '' when there is none. */
export function queryFromLocation(search: string): string {
  const q = new URLSearchParams(search).get('q');
  return q ? q.slice(0, QUERY_MAX) : '';
}

/** The page's address with `q` set to the box's text, or removed when the box is empty: kept in step so a reload
 *  or a shared link opens the same search. */
export function locationWithQuery(href: string, query: string): string {
  const url = new URL(href);
  const q = query.trim().slice(0, QUERY_MAX);
  if (q) url.searchParams.set('q', q);
  else url.searchParams.delete('q');
  return url.toString();
}

/** Clears the store between tests. */
export function resetSearchQueryForTests(): void {
  current = '';
  listeners.clear();
}

let arrival: { path: string; q: string } | undefined;

/** The `?q=` this page was opened with, read once from the address it arrived at (the box then removes `q` from
 *  the address): '' after a client navigation to another page, so a box mounted there opens empty. */
export function arrivalQuery(): string {
  arrival ??= { path: location.pathname, q: queryFromLocation(location.search) };
  return location.pathname === arrival.path ? arrival.q : '';
}
