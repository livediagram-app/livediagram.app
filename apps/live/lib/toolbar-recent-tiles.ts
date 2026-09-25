import { readLocalStorageSafe, safeJson, writeLocalStorageSafe } from './local-storage-safe';

// The Toolbar layout's recently-used tiles (spec/148): tile ids, most recent
// first. The strip puts a category's recently-used tiles ahead of the rest,
// so the element you just reached for is on the bar next time, in the first
// slot, and the tile it displaced drops back behind More.
//
// One list across every category rather than one per category: a tile used
// from Shapes is just as likely to be wanted again from Favourites. Per
// browser, like the palette's other UI state (spec/78), and separate from
// the Favourites list itself, so the floating Palette's order is untouched.

const TOOLBAR_RECENT_KEY = 'livediagram:v1:toolbar-recent-tiles';
// Far more than any strip shows (ten), so a category's used tiles aren't
// pushed out of the list by use elsewhere, and still a bounded write.
const RECENT_LIMIT = 40;

// Parse a stored value: a JSON array of strings, deduped. Anything else is
// treated as no history. Stale ids are harmless (they match no tile), so no
// catalogue check is needed here.
export function parseRecentTiles(raw: string | null): string[] {
  const parsed = raw === null ? null : safeJson(raw);
  if (!Array.isArray(parsed)) return [];
  const ids = parsed.filter((v): v is string => typeof v === 'string');
  return [...new Set(ids)].slice(0, RECENT_LIMIT);
}

export function loadRecentTiles(): string[] {
  return parseRecentTiles(readLocalStorageSafe(TOOLBAR_RECENT_KEY));
}

export function saveRecentTiles(ids: readonly string[]): void {
  writeLocalStorageSafe(TOOLBAR_RECENT_KEY, JSON.stringify(ids));
}

// Using a tile moves it to the front. Returns the same array when it is
// already there, so a repeat use re-renders nothing.
export function recordTileUse(recent: readonly string[], id: string): readonly string[] {
  if (recent[0] === id) return recent;
  return [id, ...recent.filter((r) => r !== id)].slice(0, RECENT_LIMIT);
}

// A category's tiles with its recently-used ones first (most recent first),
// then the rest in their own order. Stable, so an unused tile keeps its
// place relative to the other unused ones.
export function orderByRecent<T extends { id: string }>(
  tiles: readonly T[],
  recent: readonly string[],
): T[] {
  const rank = new Map(recent.map((id, i) => [id, i]));
  const used = tiles
    .filter((t) => rank.has(t.id))
    .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  return [...used, ...tiles.filter((t) => !rank.has(t.id))];
}
