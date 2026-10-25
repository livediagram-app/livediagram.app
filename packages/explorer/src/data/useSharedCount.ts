'use client';

// The Shared With Me row's count: how many items reached through a link the person has, in the filter on screen.
// The index has no count, so this is one page of the Shared list counted (one request when the Explorer opens, and
// again after a change reloads the lists; on Home, the same page Shared With You Recently reads). A full page reads
// "99+" rather than paging on.

import { useEffect, useState } from 'react';
import type { App, IndexClient } from '@liveworkspace/index-client';
import type { AppFilter } from '../words';
import { isAbort } from './errors';
import { readSharedFirstPage } from './homeReads';

export const SHARED_COUNT_CAP = 99;

export function useSharedCount(
  client: IndexClient,
  app: App,
  filter: AppFilter,
  epoch: number,
): number | string | undefined {
  const [count, setCount] = useState<number | string | undefined>(undefined);
  useEffect(() => {
    const controller = new AbortController();
    // Home's Shared With You Recently, asked at the same moment, takes its few from this one page (homeReads.ts).
    readSharedFirstPage(client, app, filter, SHARED_COUNT_CAP + 1, controller.signal)
      .then((res) => {
        const n = res.shared.length;
        setCount(n > SHARED_COUNT_CAP || res.more ? `${SHARED_COUNT_CAP}+` : n || undefined);
      })
      .catch((e: unknown) => {
        if (!isAbort(e)) setCount(undefined);
      });
    return () => controller.abort();
  }, [client, app, filter, epoch]);
  return count;
}
