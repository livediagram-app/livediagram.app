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
