import { readLocalStorageSafe, writeLocalStorageSafe } from './local-storage-safe';

// Palette Favourites persistence (spec/78): the user's curated tile-id list
// for the palette's Favourites category. Per-browser localStorage, like the
// palette's other UI state — not synced to the account.

const PALETTE_FAVOURITES_KEY = 'livediagram:v2:palette-favourites';

// The default Favourites grid (spec/78), in order.
//
// Twelve, which is four rows of three — the grid's natural shape, so the
// starting state has no ragged last row. The order is deliberate rather than
// alphabetical: the three shapes anyone reaches for first, then the things you
// put ON a diagram (text, arrow, frame, note, image), then the two drawing
// tools, then the two session elements a facilitated board wants to hand.
//
// Every id here must exist in PALETTE_TILES; a stale one renders nothing and
// silently costs the user a slot.
export const DEFAULT_PALETTE_FAVOURITES: readonly string[] = [
  'shapes:square',
  'shapes:circle',
  'shapes:diamond',
  'tools:text',
  'tools:arrow',
  'tools:frame',
  'tools:sticky',
  'tools:image',
  'tools:shape-pen',
  'tools:highlighter',
  'tools:session-timer',
  'collab:comment-pin',
];

// Dynamic icon favourites (`icon:<iconId>` / `tech:<iconId>`, spec/78) are
// kept VERBATIM rather than checked against validIds: their catalogues load
// async (lib/icon-registry), so validating here would wrongly drop every
// icon favourite on any load that runs before the chunk lands — and the
// next save would persist that loss. They validate at render instead
// (resolveFavouriteTile), where a stale id simply renders nothing.
const DYNAMIC_ID_PREFIXES = ['icon:', 'tech:'];
const isDynamicId = (id: string) => DYNAMIC_ID_PREFIXES.some((p) => id.startsWith(p));

// Parse a stored favourites value into a clean id list: must be a JSON
// array of strings; unknown / stale FIXED ids (a tile renamed or removed in
// a later release) are silently dropped; duplicates collapse to the first
// occurrence. Anything unparseable falls back to the defaults (also
// filtered, so a default retired later can't resurrect). Pure — the
// localStorage read/write wrappers below feed it — so it's unit-testable.
export function parseFavourites(raw: string | null, validIds: ReadonlySet<string>): string[] {
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
        return [...new Set(parsed)].filter((id) => validIds.has(id) || isDynamicId(id));
      }
    } catch {
      // fall through to defaults
    }
  }
  return DEFAULT_PALETTE_FAVOURITES.filter((id) => validIds.has(id));
}

export function loadPaletteFavourites(validIds: ReadonlySet<string>): string[] {
  return parseFavourites(readLocalStorageSafe(PALETTE_FAVOURITES_KEY), validIds);
}

export function savePaletteFavourites(ids: string[]): void {
  writeLocalStorageSafe(PALETTE_FAVOURITES_KEY, JSON.stringify(ids));
}
