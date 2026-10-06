// The Toolbar strip's Search (docs/specs/007-editor/toolbar-layout.md "Search: every element type"):
// which element tiles a query finds, split into the ones the current editor mode's palette offers
// and the ones only another mode's (or the event-storming notation) does. Pure, so the split and
// the ranking are tested without a strip.
import { componentShapeKind, type EditorMode, type Element } from '@livediagram/document';
import { paletteRank } from '@livediagram/icons';
import { tileKeywords } from '@/lib/palette-tile-keywords';
import { PALETTE_LAYOUTS, paletteCategoriesFor } from './palette-layouts';
import { tileDisplayName, type PaletteTileDef } from './palette-tile-defs';

export type ElementTileSearch = {
  // The matches the current mode's palette offers, best first. On an empty query: the tiles whose
  // element type is already on the tab, in layout order.
  here: PaletteTileDef[];
  // The matches only another mode's palette offers, best first; on an empty query, those already
  // on the tab.
  elsewhere: PaletteTileDef[];
};

// --- The element types on the tab --------------------------------------------------------------
// A tile and an element meet on a signature: the element type, plus the creation-time choice that
// tells two tiles of one type apart where the element records it (the shape kind and its session,
// reaction, mode, scale or plan view; a sticky's workshop kind; a pen; an embed's provider; an
// arrow's or a line's ends). Where an element does not record the choice (which board preset, which
// card type), the tiles share a signature and the first in layout order stands for them.

const shapeSig = (kind: string, choice?: string) => `shape:${kind}:${choice ?? ''}`;

/** The signature a tile places, or null for a tile that places no one element type (the icon,
 *  sticker and tech catalogue tiles, the shape pen's recognised shapes, a board's header widget,
 *  the hero and avatar composites). */
export function tileSignature(tile: PaletteTileDef): string | null {
  const a = tile.action;
  switch (a.type) {
    case 'shape':
      if (a.kind === 'icon' || a.kind === 'sticker') return null;
      return shapeSig(
        a.kind,
        a.session ??
          a.reaction ??
          a.mode ??
          a.estimateScale ??
          (a.kind === 'plan-view' ? a.plan : undefined),
      );
    case 'component': {
      const kind = componentShapeKind(a.kind);
      return kind ? shapeSig(kind) : null;
    }
    case 'sticky':
      return `sticky:${a.esKind ?? ''}`;
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
      return shapeSig(
        el.shape,
        el.session?.tool ?? el.reaction ?? el.mode ?? el.estimateScale ?? el.planView?.view,
      );
    case 'sticky':
      return `sticky:${el.esKind ?? ''}`;
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

/** The tiles, in order, whose element type is on the tab: one per signature. `seen` carries the
 *  signatures already listed, so a second list never repeats the first's. */
export function tilesOnTab(
  tiles: readonly PaletteTileDef[],
  elements: readonly Element[],
  seen = new Set<string>(),
): PaletteTileDef[] {
  const onTab = new Set(elements.map(elementSignature));
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

/** Every element tile a mode's palette offers, in layout order. `planCardTiles` stands in for
 *  Plan's Cards, which follow the document's item types (as on the strip). The catalogue
 *  categories (Icons, Stickers, ...) hold no tiles and so add none. */
export function modeElementTiles(
  mode: EditorMode,
  planCardTiles?: readonly PaletteTileDef[],
): PaletteTileDef[] {
  return unique(
    paletteCategoriesFor(mode).flatMap((c) =>
      c.id === 'plan-cards' && planCardTiles ? planCardTiles : (c.tiles ?? []),
    ),
  );
}

// Every mode's tiles, the event-storming notation included: a fixed set, so built once.
let everyModeTiles: PaletteTileDef[] | null = null;
function allElementTiles(): PaletteTileDef[] {
  everyModeTiles ??= unique(
    (Object.keys(PALETTE_LAYOUTS) as EditorMode[]).flatMap((mode) =>
      paletteCategoriesFor(mode, { esBoard: true }).flatMap((c) => c.tiles ?? []),
    ),
  );
  return everyModeTiles;
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

/** Every element tile, split: the ones the mode's palette offers (layout order) and the ones only
 *  another mode's does. Image-upload tiles are left out without image support, as in every grid. */
export function elementTileSections({
  mode,
  hasImage,
  planCardTiles,
  drawTiles = [],
}: {
  mode: EditorMode;
  hasImage: boolean;
  planCardTiles?: readonly PaletteTileDef[];
  // Draw mode's markers (palette-marker-tiles): Draw has no palette layout, and the strip that
  // searches is never shown in Draw, so they are always another mode's.
  drawTiles?: readonly PaletteTileDef[];
}): ElementTileSearch {
  const visible = (t: PaletteTileDef) => hasImage || !t.needsImage;
  const here = modeElementTiles(mode, planCardTiles).filter(visible);
  const hereIds = new Set(here.map((t) => t.id));
  const elsewhere = allElementTiles().filter(
    (t) =>
      visible(t) &&
      !hereIds.has(t.id) &&
      // A document's own card types replace the built-in ones in Plan: a built-in type it
      // dropped is not "elsewhere", it is gone.
      !(planCardTiles && t.section === 'plan-cards'),
  );
  return { here, elsewhere: [...elsewhere, ...drawTiles] };
}

/** What the Search lists: the query's matches, best first, or before anything is typed, the
 *  element types already on the tab. */
export function searchElementTiles({
  query,
  tabElements = [],
  ...sections
}: {
  query: string;
  // The tab's elements: an empty query lists the tiles of the element types on it.
  tabElements?: readonly Element[];
  mode: EditorMode;
  hasImage: boolean;
  planCardTiles?: readonly PaletteTileDef[];
  drawTiles?: readonly PaletteTileDef[];
}): ElementTileSearch {
  const { here, elsewhere } = elementTileSections(sections);
  if (!query.trim()) {
    const seen = new Set<string>();
    const onTab = tilesOnTab(here, tabElements, seen);
    return { here: onTab, elsewhere: tilesOnTab(elsewhere, tabElements, seen) };
  }
  return { here: rankTiles(query, here), elsewhere: rankTiles(query, elsewhere) };
}
