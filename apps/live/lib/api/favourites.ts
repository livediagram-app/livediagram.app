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

import { API_BASE, apiHeaders } from './core';

export async function apiListFavourites(ownerId: string): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/favourites`, { headers: await apiHeaders(ownerId) });
    if (!res.ok) return [];
    const body = (await res.json()) as { ids?: unknown };
    if (!Array.isArray(body.ids)) return [];
    return body.ids.filter((id): id is string => typeof id === 'string');
  } catch {
    // Offline, or a pure-guest self-host with no /api configured. An empty
    // list degrades to "no favourites" rather than breaking the Explorer.
    return [];
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
  try {
    await fetch(`${API_BASE}/favourites/${encodeURIComponent(diagramId)}`, {
      method: favourite ? 'PUT' : 'DELETE',
      headers: await apiHeaders(ownerId),
    });
  } catch {
    // Swallowed — see above.
  }
}
