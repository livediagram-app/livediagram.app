// The Toolbar strip's Search (docs/specs/007-editor/toolbar-layout.md "Search: every element type"):
// which element tiles a query finds among the ones the current editor mode's palette offers. Pure,
// so the ranking is tested without a strip.
import { componentShapeKind, type EditorMode, type Element } from '@livedesign/design';
import { paletteRank } from '@liveworkspace/icons';
import { tileKeywords } from '@/lib/palette-tile-keywords';
import { paletteCategoriesFor } from './palette-layouts';
import { tileDisplayName, type PaletteTileDef } from './palette-tile-defs';

// --- The element types on the tab --------------------------------------------------------------
// A tile and an element meet on a signature: the element type, plus the creation-time choice that
// tells two tiles of one type apart where the element records it (the shape kind; a pen; an embed's
// provider; an arrow's or a line's ends). Where an element does not record the choice (which
// variant, which card preset), the tiles share a signature and the first in layout order stands for
// them.

const shapeSig = (kind: string, choice?: string) => `shape:${kind}:${choice ?? ''}`;

/** The signature a tile places, or null for a tile that places no one element type (the icon,
 *  sticker and tech catalogue tiles, the shape pen's recognised shapes, a board's header widget,
 *  the hero and avatar composites). */
export function tileSignature(tile: PaletteTileDef): string | null {
  const a = tile.action;
  switch (a.type) {
    case 'shape':
      if (a.kind === 'icon' || a.kind === 'sticker') return null;
      return shapeSig(a.kind, a.variant);
    case 'component': {
      const kind = componentShapeKind(a.kind);
      return kind ? shapeSig(kind) : null;
    }
    case 'sticky':
      return 'sticky:';
    case 'freehand':
      return 'freehand:';
    case 'highlighter':
      return 'freehand:highlighter';
    // A marker's stroke is a freehand element like the pencil's: where both are offered, the
    // pencil, first in layout order, stands for it.
    case 'marker':
      return 'freehand:';
    case 'polygon':
      return 'path';
    case 'arrow':
      return a.ends === 'none' ? 'arrow:none' : 'arrow:';
    case 'video':
      return `video:${a.provider ?? ''}`;
    case 'text':
    case 'table':
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
      return shapeSig(el.shape);
    case 'sticky':
      return 'sticky:';
    case 'freehand':
      return `freehand:${el.pen ?? ''}`;
    case 'arrow':
      return el.arrowEnds === 'none' ? 'arrow:none' : 'arrow:';
    case 'video':
      return `video:${el.embedProvider ?? ''}`;
    default:
      return el.type;
  }
}

/** The tiles, in order, whose element type is on the tab: one per signature. */
function tilesOnTab(
  tiles: readonly PaletteTileDef[],
  elements: readonly Element[],
): PaletteTileDef[] {
  const onTab = new Set(elements.map(elementSignature));
  const seen = new Set<string>();
  return tiles.filter((t) => {
    const sig = tileSignature(t);
    if (sig === null || !onTab.has(sig) || seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

/** Tiles in first-seen order, each once: Popular repeats tiles its mode's other categories hold. */
function unique(tiles: Iterable<PaletteTileDef>): PaletteTileDef[] {
  const seen = new Map<string, PaletteTileDef>();
  for (const t of tiles) if (!seen.has(t.id)) seen.set(t.id, t);
  return [...seen.values()];
}

/** Every element tile a mode's palette offers, in layout order. The catalogue categories (Icons,
 *  Stickers, ...) hold no tiles and so add none. */
export function modeElementTiles(mode: EditorMode): PaletteTileDef[] {
  return unique(paletteCategoriesFor(mode).flatMap((c) => c.tiles ?? []));
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

/** Every element tile the mode's palette offers, in layout order. Image-upload tiles are left out
 *  without image support, as in every grid. */
export function searchableElementTiles({
  mode,
  hasImage,
  drawTiles = [],
}: {
  mode: EditorMode;
  hasImage: boolean;
  // This person's markers (palette-marker-tiles): no layout holds them (the Logo palette adds
  // them itself, useLogoMarkerTiles), so they follow the mode's own tiles.
  drawTiles?: readonly PaletteTileDef[];
}): PaletteTileDef[] {
  return unique([...modeElementTiles(mode), ...drawTiles]).filter((t) => hasImage || !t.needsImage);
}

/** What the Search lists: the query's matches, best first, or before anything is typed, the
 *  element types already on the tab. */
export function searchElementTiles({
  query,
  tabElements = [],
  ...offered
}: {
  query: string;
  // The tab's elements: an empty query lists the tiles of the element types on it.
  tabElements?: readonly Element[];
  mode: EditorMode;
  hasImage: boolean;
  drawTiles?: readonly PaletteTileDef[];
}): PaletteTileDef[] {
  const tiles = searchableElementTiles(offered);
  return query.trim() ? rankTiles(query, tiles) : tilesOnTab(tiles, tabElements);
}
