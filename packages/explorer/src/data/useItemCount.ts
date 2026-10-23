'use client';

// How many items the person has in My Work, for Home's hero pill ("12 plans"): counted by the index up to the most
// a page holds, beside Jump Back In's read (`mine`, data/homeReads.ts), so the hero adds no request of its own.
// Only while the hero shows, and again after a change reloads the lists (`epoch`). Past the cap it says so
// (`more`), and the pill reads "200+ plans" rather than counting every item.

import { useEffect, useState } from 'react';
import { LIST_LIMIT_MAX, type App, type IndexClient } from '@liveworkspace/index-client';
import type { AppFilter } from '../words';
import { isAbort } from './errors';
import { readMineCount } from './homeReads';

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
    // Counted by the index beside Jump Back In's read when Home asks both at once (homeReads.ts).
    readMineCount(client, app, filter, LIST_LIMIT_MAX, controller.signal)
      .then((value) => setState({ key, value }))
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
