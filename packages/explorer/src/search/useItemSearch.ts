'use client';

// The index's search over everything the person can open (its `search` view: their own space, their teams' and what
// a live link reaches, never more), asked once the typing pauses, the request before cancelled. The Explorer's
// Search panel asks it for one app or all; each editor's Search panel asks it for every app (item-search.ts).

import { useEffect, useState } from 'react';
import type { App, IndexClient, Item } from '@liveworkspace/index-client';
import { SEARCH_DEBOUNCE_MS, SEARCH_GROUP_MAX } from './match';

/** What the index found for `q` (the trimmed query it was asked), or that it could not be asked. */
export type ItemSearchState = { q: string; items: Item[]; failed: boolean };

/**
 * The index's items for the trimmed query `q`, in `app` or every app (null), at most `limit`. Nothing is asked for
 * an empty query or without a client; the answer names the query it is for, so a caller shows it only while that is
 * still what was typed.
 */
export function useItemSearch(
  client: IndexClient | null,
  app: App | null,
  q: string,
  limit = SEARCH_GROUP_MAX,
): ItemSearchState | null {
  const [state, setState] = useState<ItemSearchState | null>(null);
  useEffect(() => {
    if (q === '' || !client) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      client
        .listItems({ view: 'search', q, limit, ...(app ? { app } : {}) }, { signal: abort.signal })
        .then(
          (res) => setState({ q, items: res.items.slice(0, limit), failed: false }),
          () => !abort.signal.aborted && setState({ q, items: [], failed: true }),
        );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [client, app, q, limit]);
  return state;
}
