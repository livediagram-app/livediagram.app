'use client';

// An editor's door from an open item (`/explorer?item=<id>`, liveworkspace/docs/specs/004-index/one-explorer.md "Opening
// from an open item"): the place that holds the item, worked out once the person is known (Offline's list, else one
// read of the index), then the address replaced with that place's own, so Back returns to the item in its editor.
// Until then the page shows the Explorer's skeleton, never Home first. The place shows as soon as it is known
// (`view`), not once the router has moved to its address, which is a second round trip. While the person is in that
// place, the item is marked there (`arrivedItem`).
import { useEffect, useRef, useState } from 'react';
import {
  explorerPath,
  ITEM_PARAM,
  resolveItemView,
  sameView,
  type ExplorerView,
  type ItemViewer,
} from '@liveworkspace/explorer';
import type { IndexClient } from '@liveworkspace/index-client';
import type { ThisBrowserItem } from '@liveworkspace/explorer/this-browser';

// `from`: the address's view when the answer came, as a path.
type Found = { id: string; view: ExplorerView | null; from: string };

export function useItemArrival({
  item,
  viewer,
  client,
  local,
  view,
  replace,
}: {
  // The item the address names on arrival, or null.
  item: string | null;
  // Who is here, once known.
  viewer: ItemViewer | null;
  client: Pick<IndexClient, 'getItem'>;
  // Offline's list, on the app's address.
  local: readonly ThisBrowserItem[];
  // The view the page shows now.
  view: ExplorerView;
  // Goes to the place without a new history entry.
  replace: (href: string) => void;
}): { pending: boolean; arrivedItem: string | null; view: ExplorerView } {
  const [found, setFound] = useState<Found | null>(null);
  // The item after whose answer the address moved (to its place, or anywhere): from then on the address's view shows.
  const [moved, setMoved] = useState<string | null>(null);
  // Read when the lookup starts, not a reason to start another.
  const latest = useRef({ client, local, replace, view });
  useEffect(() => {
    latest.current = { client, local, replace, view };
  });
  const viewerId = viewer?.id ?? null;
  const teamKey = viewer?.teamIds.join(',') ?? '';

  useEffect(() => {
    if (!item || viewerId === null) return;
    let live = true;
    const { client: c, local: l } = latest.current;
    void resolveItemView(item, {
      client: c,
      viewer: { id: viewerId, teamIds: teamKey ? teamKey.split(',') : [] },
      local: l,
    }).then((place) => {
      if (!live) return;
      setFound({ id: item, view: place, from: explorerPath(latest.current.view) });
      if (place) {
        latest.current.replace(explorerPath(place));
        return;
      }
      // Not one the index answers: the page stays where it was, without the handed-over id. Null, not
      // history.state: Next skips its own state, so useSearchParams would keep the old address.
      const url = new URL(window.location.href);
      url.searchParams.delete(ITEM_PARAM);
      window.history.replaceState(null, '', url);
    });
    return () => {
      live = false;
    };
  }, [item, viewerId, teamKey]);

  const done = found !== null && found.id === item;
  const place = done ? found.view : null;
  const addressMoved = done && explorerPath(view) !== found.from;
  // Kept while rendering (React's pattern for state that follows a change), so no effect renders twice.
  if (addressMoved && moved !== item) setMoved(item);
  // The place from the answer until the address first moves (the router's own move to it, or the person going
  // elsewhere first); the address's view before the answer and after.
  const shown = place && moved !== item && !addressMoved ? place : view;
  return {
    pending: item !== null && !done,
    // The place whatever the lens: a filter typed there still shows the item's place.
    arrivedItem: place && sameView(place, shown) ? item : null,
    view: shown,
  };
}
