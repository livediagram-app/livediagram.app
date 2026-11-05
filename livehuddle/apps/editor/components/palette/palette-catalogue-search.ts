// The Toolbar strip's Search over the open-ended catalogues (docs/specs/007-editor/toolbar-layout.md
// "Search: every element type"): Stickers, each entry a dynamic tile (palette-dynamic-tiles) so it places as its
// category's own tile does. Split like the element tiles: a catalogue the mode's palette offers is this mode's, the
// rest another mode's. No line-art icons and no Technology marks: livehuddle offers neither
// (docs/specs/002-project-scope/not-in-livehuddle.md "Icons").
import type { EditorMode, Element } from '@livehuddle/document';
import { paletteRank, type StickerDef } from '@liveworkspace/icons';
import { getStickerCatalog } from '@liveworkspace/workbench/lib/stickers';
import { paletteCategoryOffered } from './palette-layouts';
import { stickerTileDef } from './palette-dynamic-tiles';
import type { PaletteTileDef } from './palette-tile-defs';
import type { ElementTileSearch } from './palette-tile-search';

// Matches shown per catalogue: five rows of the popover's three-wide grid. The catalogue's own
// category has the rest, with its browse.
export const CATALOGUE_MATCH_LIMIT = 15;

type Catalogue<T> = {
  // The PALETTE_CATEGORIES id: whether the mode offers it decides its section.
  category: 'stickers';
  entries: () => readonly T[];
  id: (entry: T) => string;
  name: (entry: T) => string;
  keywords: (entry: T) => string;
  tile: (entry: T) => PaletteTileDef;
};

const STICKERS: Catalogue<StickerDef> = {
  category: 'stickers',
  entries: getStickerCatalog,
  id: (s) => s.id,
  name: (s) => s.label,
  // A badge also matches on the word on its pill, so "blocked" finds BLOCKED.
  keywords: (s) => `${s.keywords} ${s.id} ${s.kind === 'badge' ? s.text : ''}`,
  tile: stickerTileDef,
};
/** A catalogue's best matches for a non-empty query, ranked as the element tiles are, capped. */
function matchesIn<T>(cat: Catalogue<T>, query: string): PaletteTileDef[] {
  const q = query.trim();
  const ranked: { entry: T; rank: number; i: number }[] = [];
  cat.entries().forEach((entry, i) => {
    const rank = paletteRank(q, { name: cat.name(entry), keywords: cat.keywords(entry) });
    if (rank < 4) ranked.push({ entry, rank, i });
  });
  return ranked
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, CATALOGUE_MATCH_LIMIT)
    .map((r) => cat.tile(r.entry));
}

/** The stickers on the tab: a shape carrying its sticker id. A stored icon lists nothing: livehuddle offers no icon
 *  to add more of. */
function stickerIdsOnTab(elements: readonly Element[]) {
  const stickers = new Set<string>();
  for (const el of elements) if (el.type === 'shape' && el.stickerId) stickers.add(el.stickerId);
  return stickers;
}

function onTab<T>(cat: Catalogue<T>, ids: Set<string>): PaletteTileDef[] {
  if (ids.size === 0) return [];
  return cat
    .entries()
    .filter((e) => ids.has(cat.id(e)))
    .map(cat.tile);
}

/** The catalogue tiles the Search lists: the query's matches, or before anything is typed, the
 *  entries already on the tab; each catalogue in this mode's section when the mode offers it. */
export function searchCatalogueTiles({
  query,
  mode,
  tabElements = [],
  loaded = true,
}: {
  query: string;
  mode: EditorMode;
  tabElements?: readonly Element[];
  // Whether the catalogues have loaded (useIconCatalogs): a component passes the subscription's value so the React
  // Compiler re-runs this when they land. Before then they hold nothing to list.
  loaded?: boolean;
}): ElementTileSearch {
  if (!loaded) return { here: [], elsewhere: [] };
  const browsing = !query.trim();
  const ids = browsing ? stickerIdsOnTab(tabElements) : null;
  const out: ElementTileSearch = { here: [], elsewhere: [] };
  const tiles = ids ? onTab(STICKERS, ids) : matchesIn(STICKERS, query);
  (paletteCategoryOffered(mode, STICKERS.category) ? out.here : out.elsewhere).push(...tiles);
  return out;
}
