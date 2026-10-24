'use client';

// What other apps keep in a place that looks empty in this app (liveworkspace/docs/one-explorer.md "A place that
// is empty here but not elsewhere"): filtered to the app, a folder holding only another app's items would read as
// empty and be deleted by mistake. Asked only once the app's own list has come back empty: one request, the
// place's first page across every app, counted by app.

import { useEffect, useState } from 'react';
import type { App, IndexClient, Item } from '@liveworkspace/index-client';
import { viewList } from './viewLists';
import type { ExplorerView } from '../views';

export type OtherApps = {
  // How many of each other app's items the first page held, in the order first met.
  counts: [App, number][];
  // A few of them, for the art.
  items: Item[];
  // The place holds more than the page counted.
  more: boolean;
};

const SHOWN = 3;

export function useOtherApps({
  client,
  view,
  app,
  enabled,
  epoch,
}: {
  client: IndexClient;
  view: ExplorerView;
  app: App;
  // The app's own list is in and empty, and the view is filtered to the app.
  enabled: boolean;
  epoch: number;
}): OtherApps | null {
  const list = enabled ? viewList(client, view, app, 'all') : null;
  const key = list ? `${list.key}|${epoch}` : null;
  const [answer, setAnswer] = useState<{ key: string; value: OtherApps | null } | null>(null);

  useEffect(() => {
    if (!list || !key) return;
    const controller = new AbortController();
    list
      .load(null, controller.signal)
      .then((page) => {
        const others = page.items.filter((i) => i.app !== app && list.belongs(i));
        const counts = new Map<App, number>();
        for (const i of others) counts.set(i.app, (counts.get(i.app) ?? 0) + 1);
        setAnswer({
          key,
          value: others.length
            ? {
                counts: [...counts],
                items: others.slice(0, SHOWN),
                more: page.nextCursor !== null,
              }
            : null,
        });
      })
      .catch(() => {
        // Aborted, or refused: the plain empty state stands.
      });
    return () => controller.abort();
    // `list` is read through `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, app]);

  return answer && answer.key === key ? answer.value : null;
}
