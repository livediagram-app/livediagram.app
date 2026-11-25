'use client';

// The Connect list's files (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting"): the person's Recent
// across every app, newest first, the host left out. A read when the list mounts (each opening mounts it, so nothing is
// kept from page load), again on Try Again, and again, quietly, each time the person comes back to the page while it
// shows (a file renamed in another tab, Work Tracker 1460): the rows held stay while it reads and when it fails. An
// unmount or a newer read aborts the one in flight.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { IndexClient, Item } from '@liveworkspace/index-client';
import { useReturnCount } from '@liveworkspace/explorer/return-to-tab';

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
  // A return is no new key: the list on screen stays until the answer lands.
  const returns = useReturnCount();
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
          if (abort.signal.aborted) return;
          setAnswer((had) => (keptOnFailure(had, key) ? had : { key, files: { state: 'failed' } }));
        },
      );
    return () => abort.abort();
  }, [key, hostId, returns]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const files: RecentFiles = answer?.key === key ? answer.files : { state: 'loading' };
  return { ...files, retry };
}

// A quiet read again (a return to the page) that fails keeps the list this read already showed.
function keptOnFailure(
  had: { key: string; files: RecentFiles } | null,
  key: string,
): had is { key: string; files: RecentFiles } {
  return had?.key === key && had.files.state === 'ready';
}
