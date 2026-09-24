// Per-user diagram favourites (spec/95).
//
// A star lives in its own D1 table rather than the preferences blob:
// favourites are meant to be unlimited, and that blob is capped at 4 KB
// server-side (~100 UUIDs), where overflowing would start failing EVERY
// preference write rather than just this one.
//
// Ids only. The Explorer already holds the personal and team diagram rows
// it needs to render the Favourites view, so the server shipping full rows
// would duplicate that and have to re-derive the team-visibility rules the
// diagram list already applies.

import { API_BASE, apiHeaders, apiFetch } from './core';
import {
  isOfflineId,
  offlineListFavouriteIds,
  offlineSetFavourite,
} from '../offline/offline-store';

// Like the diagram list (see api-client), this MERGES rather than
// dispatches: the Favourites view shows cloud and offline diagrams in one
// place, so it needs both sets, and the offline ones still answer when the
// cloud fetch fails.
export async function apiListFavourites(ownerId: string): Promise<string[]> {
  // Its own catch: no IndexedDB (SSR, private mode) must not take the cloud
  // half down with it, which sharing a try block would do.
  const offline = await offlineListFavouriteIds().catch(() => []);
  try {
    const res = await apiFetch(`${API_BASE}/favourites`, { headers: await apiHeaders(ownerId) });
    if (!res.ok) return offline;
    const body = (await res.json()) as { ids?: unknown };
    if (!Array.isArray(body.ids)) return offline;
    const cloud = body.ids.filter((id): id is string => typeof id === 'string');
    return [...cloud, ...offline];
  } catch {
    // Offline, or a pure-guest self-host with no /api configured. The local
    // stars still stand; the cloud half degrades to "no favourites" rather
    // than breaking the Explorer.
    return offline;
  }
}

// Star / un-star. Fire-and-forget with the same swallow as preferences:
// the caller has already applied the change optimistically, and a toast
// for a failed bookmark sync would be more annoying than useful.
export async function apiSetFavourite(
  ownerId: string,
  diagramId: string,
  favourite: boolean,
): Promise<void> {
  // An offline diagram has no row in `diagrams`, and the favourites table's
  // diagram_id is a foreign key into it (migration 0040), so sending this
  // star to the server does not just go unused, it is REJECTED with
  // "FOREIGN KEY constraint failed". Keep it local, as spec/76 requires of
  // every offline row: no server fetch, "list, thumbnail, or otherwise".
  if (await isOfflineId(diagramId)) {
    await offlineSetFavourite(diagramId, favourite).catch(() => {});
    return;
  }
  try {
    await apiFetch(`${API_BASE}/favourites/${encodeURIComponent(diagramId)}`, {
      method: favourite ? 'PUT' : 'DELETE',
      headers: await apiHeaders(ownerId),
    });
  } catch {
    // Swallowed — see above.
  }
}
