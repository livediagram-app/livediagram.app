'use client';

// Find a File (liveworkspace/docs/specs/004-index/live-embeds.md "Making one", Work Tracker 1427): two or more
// characters search every file the person can open by name, across the apps a live embed shows, once typing pauses
// for LIVE_PICKER_SEARCH_SETTLE_MS; at most LIVE_PICKER_SEARCH_MAX, archived files and the host left out. A newer
// query, or closing, aborts the read in flight. Under two characters: idle, and the chooser filters Recent.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { IndexClient, Item } from '@liveworkspace/index-client';
import { LIVE_EMBED_APPS, isLiveEmbedApp } from '@liveworkspace/element-model/live-item';

export const LIVE_PICKER_SEARCH_MAX = 20;
export const LIVE_PICKER_SEARCH_SETTLE_MS = 250;
const SEARCH_MIN = 2;

export type FileSearch =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; items: Item[] }
  | { state: 'failed' };

export function useFileSearch(
  client: Pick<IndexClient, 'listItems'>,
  query: string,
  hostId: string,
): FileSearch {
  const q = query.trim();
  const searching = q.length >= SEARCH_MIN;
  const [answer, setAnswer] = useState<{ q: string; search: FileSearch } | null>(null);
  const clientRef = useRef(client);
  useLayoutEffect(() => {
    clientRef.current = client;
  });
  useEffect(() => {
    if (!searching) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      clientRef.current
        .listItems(
          { view: 'search', q, apps: LIVE_EMBED_APPS, limit: LIVE_PICKER_SEARCH_MAX },
          { signal: abort.signal },
        )
        .then(
          (page) => {
            if (abort.signal.aborted) return;
            // The apps asked for alone, whatever the index answers: a huddle's would sit there unpickable.
            const items = page.items.filter(
              (item) => item.id !== hostId && !item.archivedAt && isLiveEmbedApp(item.app),
            );
            setAnswer({ q, search: { state: 'ready', items } });
          },
          () => {
            if (!abort.signal.aborted) setAnswer({ q, search: { state: 'failed' } });
          },
        );
    }, LIVE_PICKER_SEARCH_SETTLE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [q, searching, hostId]);
  if (!searching) return { state: 'idle' };
  return answer?.q === q ? answer.search : { state: 'loading' };
}
