// Per-user document favourites (docs/specs/013-workspace/favourites.md).
//
// A star lives in its own D1 table rather than the preferences blob:
// favourites are meant to be unlimited, and that blob is capped at 4 KB
// server-side (~100 UUIDs), where overflowing would start failing EVERY
// preference write rather than just this one.
//
// Ids only. The Explorer already holds the personal and team document rows
// it needs to render the Favourites view, so the server shipping full rows
// would duplicate that and have to re-derive the team-visibility rules the
// document list already applies.

import { API_BASE, apiHeaders, apiFetch } from './core';
import {
  isOfflineId,
  offlineListFavouriteIds,
  offlineSetFavourite,
} from '../offline/offline-store';

// Like the document list (see api-client), this MERGES rather than
// dispatches: the Favourites view shows cloud and offline documents in one
// place, so it needs both sets, and the offline ones still answer when the
// cloud fetch fails.
export async function apiListFavourites(ownerId: string): Promise<string[]> {
  // Its own catch: no IndexedDB (SSR, private mode) must not take the cloud
  // half down with it, which sharing a try block would do.
  const offline = await offlineListFavouriteIds().catch(() => []);
  try {
    return [...(await fetchCloudFavouriteIds(ownerId)), ...offline];
  } catch {
    // Offline, or a pure-guest self-host with no /api configured. The local
    // stars still stand; the cloud half degrades to "no favourites" rather
    // than breaking the Explorer.
    return offline;
  }
}

// The account's stars alone, throwing when they could not be read. Take Offline needs to know
// rather than guess: a failed read taken as "not starred" would drop the star with the server row.
export async function fetchCloudFavouriteIds(ownerId: string): Promise<string[]> {
  const res = await apiFetch(`${API_BASE}/favourites`, { headers: await apiHeaders(ownerId) });
  if (!res.ok) throw new Error(`favourites failed: ${res.status}`);
  const body = (await res.json()) as { ids?: unknown };
  if (!Array.isArray(body.ids)) throw new Error('favourites failed: malformed');
  return body.ids.filter((id): id is string => typeof id === 'string');
}

// Star / un-star. Fire-and-forget with the same swallow as preferences:
// the caller has already applied the change optimistically, and a toast
// for a failed bookmark sync would be more annoying than useful.
export async function apiSetFavourite(
  ownerId: string,
  documentId: string,
  favourite: boolean,
): Promise<void> {
  // An offline document has no row in `documents`, and the favourites table's
  // document_id is a foreign key into it (migration 0040), so sending this
  // star to the server does not just go unused, it is REJECTED with
  // "FOREIGN KEY constraint failed". Keep it local, as docs/specs/006-document/offline-mode.md requires of
  // every offline row: no server fetch, "list, thumbnail, or otherwise".
  if (await isOfflineId(documentId)) {
    await offlineSetFavourite(documentId, favourite).catch(() => {});
    return;
  }
  try {
    await apiFetch(`${API_BASE}/favourites/${encodeURIComponent(documentId)}`, {
      method: favourite ? 'PUT' : 'DELETE',
      headers: await apiHeaders(ownerId),
    });
  } catch {
    // Swallowed — see above.
  }
}
