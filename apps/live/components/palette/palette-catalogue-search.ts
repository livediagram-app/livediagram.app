// The Toolbar strip's Search over the open-ended catalogues (docs/specs/007-editor/toolbar-layout.md
// "Search: every element type"): Icons, Stickers and Technology, each entry a dynamic tile
// (palette-dynamic-tiles) so it places as its category's own tile does. Split like the element
// tiles: a catalogue the mode's palette offers is this mode's, the rest another mode's.
import type { EditorMode, Element } from '@livediagram/document';
import { paletteRank, type IconDef, type StickerDef, type TechIconDef } from '@livediagram/icons';
import { getLineArtIconCatalog } from '@/lib/icons';
import { getStickerCatalog } from '@/lib/stickers';
import { getLoadedTechIconCatalog } from '@/lib/icon-registry';
import { isTechIconId } from '@/lib/tech-icons';
import { paletteCategoryOffered } from './palette-layouts';
import { iconTileDef, stickerTileDef, techTileDef } from './palette-dynamic-tiles';
import type { PaletteTileDef } from './palette-tile-defs';
import type { ElementTileSearch } from './palette-tile-search';

// Matches shown per catalogue: five rows of the popover's three-wide grid. The catalogue's own
// category has the rest, with its browse.
export const CATALOGUE_MATCH_LIMIT = 15;

type Catalogue<T> = {
  // The PALETTE_CATEGORIES id: whether the mode offers it decides its section.
  category: 'icons' | 'stickers' | 'technology';
  entries: () => readonly T[];
  id: (entry: T) => string;
  name: (entry: T) => string;
  keywords: (entry: T) => string;
  tile: (entry: T) => PaletteTileDef;
};

const ICONS: Catalogue<IconDef> = {
  category: 'icons',
  entries: getLineArtIconCatalog,
  id: (i) => i.id,
  name: (i) => i.label,
  keywords: (i) => `${i.keywords} ${i.id}`,
  tile: iconTileDef,
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
const TECH: Catalogue<TechIconDef> = {
  category: 'technology',
  entries: getLoadedTechIconCatalog,
  id: (t) => t.id,
  name: (t) => t.label,
  keywords: (t) => `${t.keywords} ${t.id} ${t.provider}`,
  tile: techTileDef,
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

/** The catalogue entries on the tab, by catalogue: an icon or a technology mark is an icon shape
 *  carrying its id, a sticker a shape carrying its sticker id. */
function idsOnTab(elements: readonly Element[]) {
  const icons = new Set<string>();
  const tech = new Set<string>();
  const stickers = new Set<string>();
  for (const el of elements) {
    if (el.type !== 'shape') continue;
    if (el.stickerId) stickers.add(el.stickerId);
    else if (el.shape === 'icon' && el.iconId)
      (isTechIconId(el.iconId) ? tech : icons).add(el.iconId);
  }
  return { icons, tech, stickers };
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
}: {
  query: string;
  mode: EditorMode;
  tabElements?: readonly Element[];
}): ElementTileSearch {
  const browsing = !query.trim();
  const ids = browsing ? idsOnTab(tabElements) : null;
  const out: ElementTileSearch = { here: [], elsewhere: [] };
  const add = <T>(cat: Catalogue<T>, onTabIds: Set<string> | undefined) => {
    const tiles = ids ? onTab(cat, onTabIds!) : matchesIn(cat, query);
    (paletteCategoryOffered(mode, cat.category) ? out.here : out.elsewhere).push(...tiles);
  };
  add(ICONS, ids?.icons);
  add(STICKERS, ids?.stickers);
  add(TECH, ids?.tech);
  return out;
}
