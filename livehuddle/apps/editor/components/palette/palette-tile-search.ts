// The Toolbar strip's Search (docs/specs/007-editor/toolbar-layout.md "Search: every element type"):
// which element tiles a query finds, of the ones the palette offers. Pure, so the ranking is tested without a strip.
import type { Element } from '@livehuddle/document';
import { paletteRank } from '@liveworkspace/icons';
import { tileKeywords } from '@/lib/palette-tile-keywords';
import { SEARCH_ONLY_TILE_IDS, paletteCategories } from './palette-layouts';
import { tileById, tileDisplayName, type PaletteTileDef } from './palette-tile-defs';

// --- The element types on the tab --------------------------------------------------------------
// A tile and an element meet on a signature: the element type, plus the creation-time choice that
// tells two tiles of one type apart where the element records it (the shape kind and its session,
// mode or scale; a sticky's workshop kind; a pen; an embed's provider; an
// arrow's or a line's ends). Where an element does not record the choice, the tiles share a signature and the first in layout order stands for them.

const shapeSig = (kind: string, choice?: string) => `shape:${kind}:${choice ?? ''}`;

/** The signature a tile places, or null for a tile that places no one element type (the icon,
 *  sticker and tech catalogue tiles, the shape pen's recognised shapes, a board's header widget,
 *  the hero and avatar composites). */
export function tileSignature(tile: PaletteTileDef): string | null {
  const a = tile.action;
  switch (a.type) {
    case 'shape':
      if (a.kind === 'icon' || a.kind === 'sticker') return null;
      return shapeSig(a.kind, a.mode ?? a.variant);
    case 'component':
      return null;
    case 'sticky':
      return 'sticky';
    case 'freehand':
      return 'freehand:';
    case 'highlighter':
      return 'freehand:highlighter';
    case 'polygon':
      return 'path';
    case 'arrow':
      return a.ends === 'none' ? 'arrow:none' : 'arrow:';
    case 'text':
    case 'image':
    case 'annotation':
    case 'link-card':
      return a.type;
    default:
      return null;
  }
}

/** The signature an element on the canvas carries (see tileSignature). */
export function elementSignature(el: Element): string {
  switch (el.type) {
    case 'shape':
      return shapeSig(el.shape, el.mode);
    case 'sticky':
      return 'sticky';
    case 'freehand':
      return `freehand:${el.pen ?? ''}`;
    case 'arrow':
      return el.arrowEnds === 'none' ? 'arrow:none' : 'arrow:';
    default:
      return el.type;
  }
}

/** The tiles, in order, whose element type is on the tab: one per signature. */
function tilesOnTab(
  tiles: readonly PaletteTileDef[],
  elements: readonly Element[],
): PaletteTileDef[] {
  const seen = new Set<string>();
  const onTab = new Set(elements.map(elementSignature));
  return tiles.filter((t) => {
    const sig = tileSignature(t);
    if (sig === null || !onTab.has(sig) || seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

/** Tiles in first-seen order, each once: Popular repeats tiles the other categories hold. */
function unique(tiles: Iterable<PaletteTileDef>): PaletteTileDef[] {
  const seen = new Map<string, PaletteTileDef>();
  for (const t of tiles) if (!seen.has(t.id)) seen.set(t.id, t);
  return [...seen.values()];
}

/** Every element tile the palette offers, in layout order. The catalogue category (Stickers) holds no tiles and so
 *  adds none. */
export function paletteElementTiles(): PaletteTileDef[] {
  return unique(paletteCategories().flatMap((c) => c.tiles ?? []));
}

// The tiles on no strip (SEARCH_ONLY_TILE_IDS), the Search being the strip's one way to them.
let searchOnly: PaletteTileDef[] | null = null;
function searchOnlyTiles(): PaletteTileDef[] {
  searchOnly ??= SEARCH_ONLY_TILE_IDS.map(tileById).filter(
    (t): t is PaletteTileDef => t !== undefined,
  );
  return searchOnly;
}

/** The query's matches, ranked exact name, name prefix, name substring, then keyword only; ties
 *  keep the input order. An empty query keeps every tile, in order. */
export function rankTiles(query: string, tiles: readonly PaletteTileDef[]): PaletteTileDef[] {
  const q = query.trim();
  if (!q) return [...tiles];
  return tiles
    .map((tile, i) => ({
      tile,
      i,
      rank: paletteRank(q, {
        name: tileDisplayName(tile),
        keywords: `${tile.label} ${tileKeywords(tile)}`,
      }),
    }))
    .filter((r) => r.rank < 4)
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((r) => r.tile);
}

/** Lists already ranked on their own (element tiles, then each catalogue's), merged into one by
 *  how well the NAME matches: exact, prefix, substring, then keyword only. Without it a name match
 *  in a later list ("Bar chart", an icon) sat below a keyword-only match in an earlier one (the
 *  diamond, a "flowchart" shape). Ties keep list order, so element tiles lead among equals. An
 *  empty query keeps the lists in order. */
export function mergeByName(
  query: string,
  ...lists: readonly PaletteTileDef[][]
): PaletteTileDef[] {
  const all = lists.flat();
  const q = query.trim();
  if (!q) return all;
  const rank = (t: PaletteTileDef) =>
    Math.min(3, paletteRank(q, { name: tileDisplayName(t), keywords: '' }));
  return all
    .map((tile, i) => ({ tile, i, rank: rank(tile) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((r) => r.tile);
}

/** Every element tile the Search can list: the palette's (layout order), then the tiles on no strip. Image-upload
 *  tiles are left out without image support, as in every grid. */
function searchableElementTiles(hasImage: boolean): PaletteTileDef[] {
  return unique([...paletteElementTiles(), ...searchOnlyTiles()]).filter(
    (t) => hasImage || !t.needsImage,
  );
}

/** What the Search lists: the query's matches, best first, or before anything is typed, the
 *  element types already on the tab. */
export function searchElementTiles({
  query,
  tabElements = [],
  hasImage,
}: {
  query: string;
  // The tab's elements: an empty query lists the tiles of the element types on it.
  tabElements?: readonly Element[];
  hasImage: boolean;
}): PaletteTileDef[] {
  const tiles = searchableElementTiles(hasImage);
  return query.trim() ? rankTiles(query, tiles) : tilesOnTab(tiles, tabElements);
}
