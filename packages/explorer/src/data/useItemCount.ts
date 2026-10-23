'use client';

// How many items the person has in My Work, for Home's hero pill ("12 plans"). The index has no count, so
// this is one page of My Work's list at the most a page holds, counted: one request, only while the hero
// shows, again after a change reloads the lists (`epoch`). A page that comes back full says so (`more`), and
// the pill reads "200+ plans" rather than paging on to count every item.

import { useEffect, useState } from 'react';
import { LIST_LIMIT_MAX, type App, type IndexClient } from '@liveworkspace/index-client';
import type { AppFilter } from '../words';
import { isAbort } from './errors';

export type ItemCount = { count: number; more: boolean };

export function useItemCount(
  client: IndexClient,
  app: App,
  filter: AppFilter,
  enabled: boolean,
  epoch: number,
): ItemCount | undefined {
  const key = `${filter}:${epoch}`;
  const [state, setState] = useState<{ key: string; value: ItemCount | undefined } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    client
      .listItems(
        {
          view: 'all',
          team: 'personal',
          limit: LIST_LIMIT_MAX,
          ...(filter === 'app' ? { app } : {}),
        },
        { signal: controller.signal },
      )
      .then((res) =>
        setState({
          key,
          value: { count: res.items.length, more: res.nextCursor !== null },
        }),
      )
      .catch((e: unknown) => {
        // A count that failed to load has nothing to tell: the pill stays away.
        if (!isAbort(e)) setState({ key, value: undefined });
      });
    return () => controller.abort();
  }, [client, app, filter, enabled, key]);
  // A count for another filter is never shown, and neither is "0" while one loads. After a reload the last
  // count stays up until the new one lands, so the pill never blinks.
  if (!state) return undefined;
  if (state.key.split(':')[0] !== filter) return undefined;
  return state.value;
}
