// The palette per editor mode (docs/specs/007-editor/editor-modes.md "The palette per mode"): which
// categories each mode's palette offers, in order, what each is called there, and which tiles it
// holds. A category's identity (its glyph, and the label, blurb and band it wears by default)
// lives in PALETTE_CATEGORIES; a tile's identity in PALETTE_TILES. A layout only arranges them,
// so the same tile can sit in different categories in different modes, and a category can be
// renamed or re-filled for one mode without touching another.
//
// An entry with no `tiles` holds its category's own tiles (tilesForCategory), so a layout spells
// out only where a mode differs. The catalogue categories (My shapes, Icons, Stickers, Tech) are
// bodies with their own content and take no tile list. Every mode lands on its own Popular, a
// fixed pick of twelve tiles from across its categories.
import type { EditorMode } from '@livediagram/document';
import { PALETTE_CATEGORIES } from './palette-categories';
import { tileById, tilesForCategory, type PaletteTileDef } from './palette-tile-defs';

export type PaletteLayoutEntry = {
  // A PALETTE_CATEGORIES id: the glyph, and the default label, blurb and band.
  id: string;
  label?: string;
  description?: string;
  band?: number;
  // The tiles, in order, by tile id. Absent = the category's own tiles.
  tiles?: readonly string[];
  // Offered only on an event-storming board.
  boardOnly?: true;
};

export type PaletteLayout = {
  // The category the palette opens on (an event-storming board opens on its notation instead).
  landing: string;
  categories: readonly PaletteLayoutEntry[];
};

// The categories whose body is its own content rather than a list of tiles.
export const CATALOGUE_CATEGORIES: ReadonlySet<string> = new Set([
  'my-shapes',
  'icons',
  'stickers',
  'technology',
]);

/** A category's own tile ids, less the named ones: for a layout that drops a tile or two. */
function tilesExcept(categoryId: string, ...drop: string[]): readonly string[] {
  return tilesForCategory(categoryId)
    .map((t) => t.id)
    .filter((id) => !drop.includes(id));
}

// Media's embed providers (the Embed group).
const EMBED_TILES = [
  'media:embed-youtube',
  'media:embed-vimeo',
  'media:embed-loom',
  'media:embed-figma',
  'media:embed-gdocs',
  'media:embed-website',
];

// Diagram mode: Popular, then every category but the mock-up kit (Components, Devices) and the
// charts (Data), each with its own tiles but Media's embeds.
const DIAGRAM: PaletteLayout = {
  landing: 'popular',
  categories: [
    {
      // The twelve tiles a diagram is most often built from (what used to be the default
      // Favourites): the basic shapes, words, an arrow and a frame, a note and a picture, the
      // shape pen, and the table, code block and entity.
      id: 'popular',
      tiles: [
        'shapes:square',
        'shapes:circle',
        'shapes:diamond',
        'tools:text',
        'tools:arrow',
        'tools:frame',
        'tools:sticky',
        'tools:image',
        'tools:shape-pen',
        'tools:table',
        'tools:code-block',
        'tools:entity',
      ],
    },
    { id: 'shapes' },
    { id: 'my-shapes' },
    { id: 'write' },
    { id: 'draw' },
    { id: 'build' },
    { id: 'event-storming', boardOnly: true },
    { id: 'icons' },
    { id: 'stickers' },
    { id: 'technology' },
    // Image and Avatar; no embedded pages.
    { id: 'media', tiles: tilesExcept('media', ...EMBED_TILES) },
    { id: 'behaviour' },
  ],
};

// Infographic mode: Popular, the mock-up kit, glyphs, stickers, pictures and charts; no pens, tech
// icons, behaviours or workshop notation.
const INFOGRAPHIC: PaletteLayout = {
  landing: 'popular',
  categories: [
    {
      // Twelve tiles an infographic is most often built from, in the order they are reached for:
      // words and simple marks, a picture and a speech bubble, the charts, then the ready-made
      // blocks. Each is also in one of the categories below.
      id: 'popular',
      tiles: [
        'tools:text',
        'shapes:square',
        'shapes:circle',
        'tools:image',
        'shapes:speech-bubble',
        'data:pie',
        'data:bar',
        'data:progress-ring',
        'components:stat',
        'components:process',
        'tools:timeline',
        'components:callout',
      ],
    },
    { id: 'shapes' },
    { id: 'my-shapes' },
    // The page is the canvas here, so no Page element; and no Annotation, a diagram's marker.
    { id: 'write', tiles: tilesExcept('write', 'tools:page', 'tools:annotation') },
    // Mind maps, lanes and frames organise a diagram, not a visual page.
    { id: 'build', tiles: tilesExcept('build', 'tools:mind-node', 'tools:lane', 'tools:frame') },
    // The web blocks, without the data-model Entity.
    { id: 'components', tiles: tilesExcept('components', 'tools:entity') },
    { id: 'devices' },
    { id: 'icons' },
    { id: 'stickers' },
    { id: 'media' },
    { id: 'data' },
  ],
};

export const PALETTE_LAYOUTS = { diagram: DIAGRAM, infographic: INFOGRAPHIC } as const;

/** The layout a mode's palette shows. Draw mode shows its own tools, so it borrows Diagram's. */
export function paletteLayoutFor(mode: EditorMode): PaletteLayout {
  return mode === 'infographic' ? INFOGRAPHIC : DIAGRAM;
}

export type ResolvedPaletteCategory = (typeof PALETTE_CATEGORIES)[number] & {
  // The tiles it holds, in order; null for a catalogue category, whose body is its own.
  tiles: PaletteTileDef[] | null;
};

const IDENTITY = new Map(PALETTE_CATEGORIES.map((c) => [c.id, c]));

function resolve(entry: PaletteLayoutEntry): ResolvedPaletteCategory {
  const identity = IDENTITY.get(entry.id);
  if (!identity) throw new Error(`palette layout names an unknown category: ${entry.id}`);
  const tiles = CATALOGUE_CATEGORIES.has(entry.id)
    ? null
    : entry.tiles
      ? entry.tiles.map(tileById).filter((t): t is PaletteTileDef => t !== undefined)
      : tilesForCategory(entry.id);
  return {
    ...identity,
    ...(entry.label ? { label: entry.label } : null),
    ...(entry.description ? { description: entry.description } : null),
    ...(entry.band !== undefined ? { group: entry.band } : null),
    tiles,
  };
}

/** The categories a mode's palette offers, in order, with their tiles. A board-only category is
 *  left out unless the tab is an event-storming board. */
export function paletteCategoriesFor(
  mode: EditorMode,
  { esBoard = false }: { esBoard?: boolean } = {},
): ResolvedPaletteCategory[] {
  return paletteLayoutFor(mode)
    .categories.filter((e) => esBoard || !e.boardOnly)
    .map(resolve);
}

/** Whether a mode's palette offers category `id` (on an ordinary tab). */
export function paletteCategoryOffered(mode: EditorMode, id: string): boolean {
  return paletteLayoutFor(mode).categories.some((e) => e.id === id && !e.boardOnly);
}

/** The category the palette opens on: an event-storming board's notation, or the mode's own. */
export function paletteLandingCategory(mode: EditorMode, esBoard: boolean): string {
  return esBoard ? 'event-storming' : paletteLayoutFor(mode).landing;
}
