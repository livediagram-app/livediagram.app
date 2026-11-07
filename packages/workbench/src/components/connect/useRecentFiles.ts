'use client';

// The Connect list's files (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting"): the person's Recent
// across every app, newest first, the host left out. One read when the list mounts, and again on Try Again; an unmount
// or a newer read aborts the one in flight.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { IndexClient, Item } from '@liveworkspace/index-client';

// IDX35: enough to fill the start panel twice without paging.
export const CONNECT_RECENT_LIMIT = 40;

export type RecentFiles =
  { state: 'loading' } | { state: 'ready'; items: Item[] } | { state: 'failed' };

export function useRecentFiles(
  client: Pick<IndexClient, 'listItems'>,
  hostId: string,
): RecentFiles & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  // Which read an answer belongs to: a newer one (another host, Try Again) shows Loading until its own lands.
  const key = `${hostId}\n${attempt}`;
  const [answer, setAnswer] = useState<{ key: string; files: RecentFiles } | null>(null);
  // The client is read when a load starts, so a caller that builds one per render does not reload the list.
  const clientRef = useRef(client);
  useLayoutEffect(() => {
    clientRef.current = client;
  });
  useEffect(() => {
    const abort = new AbortController();
    clientRef.current
      .listItems({ view: 'recent', limit: CONNECT_RECENT_LIMIT }, { signal: abort.signal })
      .then(
        (page) => {
          if (abort.signal.aborted) return;
          const items = page.items.filter((item) => item.id !== hostId);
          setAnswer({ key, files: { state: 'ready', items } });
        },
        () => {
          if (!abort.signal.aborted) setAnswer({ key, files: { state: 'failed' } });
        },
      );
    return () => abort.abort();
  }, [key, hostId]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const files: RecentFiles = answer?.key === key ? answer.files : { state: 'loading' };
  return { ...files, retry };
}
