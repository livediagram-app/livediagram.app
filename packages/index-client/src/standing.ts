// Where an item stands at the index, as the index tells its app (liveworkspace/docs/specs/004-index/one-explorer-contracts.md
// "Where an item stands"): after every archive, move out of Archived, trash and restore, the index calls
// `POST <app>/api/internal/items/:id/standing` with the app's key and `{archived, trashed, at}`, off its request's path.
// The app keeps the newest it has heard (by `at`) and treats the item as put away while either flag holds; an app
// that has heard nothing runs the item as before (fails open).

export type ItemStanding = {
  archived: boolean;
  trashed: boolean;
  // When the change was written at the index (epoch ms): an older standing never overrides a newer one.
  at: number;
};

// The path under the app's /api/internal a standing goes to.
export const itemStandingPath = (itemId: string) => `/items/${encodeURIComponent(itemId)}/standing`;

/** Whether an item standing so is put away (archived or in the Trash). */
export const isPutAway = (standing: Pick<ItemStanding, 'archived' | 'trashed'>): boolean =>
  standing.archived || standing.trashed;

// A standing as the app reads its body, or null for anything else.
export function parseItemStanding(value: unknown): ItemStanding | null {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v !== 'object') return null;
  const { archived, trashed, at } = v;
  if (typeof archived !== 'boolean' || typeof trashed !== 'boolean') return null;
  if (typeof at !== 'number' || !Number.isSafeInteger(at) || at <= 0) return null;
  return { archived, trashed, at };
}

// What an item's room keeps of the newest standing it heard: put away, whether that was the Trash, and `at`.
// `trashed` is absent from a standing kept before the room kept it, and reads as archived.
export type KeptStanding = { putAway: boolean; trashed?: boolean; at: number };

// What a grant says of when it was signed, and whether its item is in the Trash.
export type StandingGrant = { iat?: number; iatMs?: number; trashed?: boolean };

/** Why a room refuses a grant on an item put away since it was signed (one-explorer-contracts.md "Where an item
 *  stands", Work Tracker 1323). */
export type PutAwayRefusal = 'archived' | 'trashed';

// The header a room's refusal carries, so the worker drops the grant it holds for that caller and item.
export const ITEM_PUT_AWAY_HEADER = 'X-Item-Put-Away';

/** When a grant was signed (epoch ms), or null for one built by hand. */
export function grantSignedAt(grant: StandingGrant): number | null {
  if (typeof grant.iatMs === 'number') return grant.iatMs;
  return typeof grant.iat === 'number' ? grant.iat * 1000 : null;
}

/** Whether a room that keeps `kept` refuses `grant`: only while the item is put away, and only a grant signed before
 *  it was. A trashed grant is the app's own to answer, and a grant with no signing moment is let through (fails
 *  open), as is everything on a room that never heard a standing. */
export function putAwayRefusal(
  kept: KeptStanding | null,
  grant: StandingGrant,
): PutAwayRefusal | null {
  if (!kept?.putAway || grant.trashed) return null;
  const signed = grantSignedAt(grant);
  if (signed === null || signed >= kept.at) return null;
  return kept.trashed ? 'trashed' : 'archived';
}
