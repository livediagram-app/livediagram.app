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
  // Offered only while the tab has a logo page (docs/specs/007-editor/logo-pages.md "The Logo
  // palette").
  logoOnly?: true;
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

// Illustrate mode: Popular, the mock-up kit, glyphs, stickers, pictures and charts; no pens, tech
// icons, behaviours or workshop notation.
const ILLUSTRATE: PaletteLayout = {
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
    // First of Common, while the tab has a logo page; each person's markers join these
    // (useLogoMarkerTiles).
    {
      id: 'logo',
      tiles: [
        'logo:pen',
        'tools:pencil',
        'tools:text',
        'shapes:square',
        'shapes:circle',
        'shapes:diamond',
      ],
      logoOnly: true,
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

// Plan mode (docs/specs/026-plan/plan-mode.md "The palette"): cards, boards and their widgets first, then the
// plan views that read every card (docs/specs/026-plan/plan-views.md), then the few other elements a team
// plans beside its boards, borrowed from Write, Media and Behaviours; nothing that organises a diagram.
const PLAN: PaletteLayout = {
  // Opening on Cards: a Plan tab is worked by its boards, so the drawing and decorating categories, and a
  // Popular drawn from them, stay with the other modes.
  landing: 'plan-cards',
  categories: [
    { id: 'plan-cards' },
    { id: 'plan-boards' },
    { id: 'plan-widgets' },
    { id: 'plan-metrics' },
    { id: 'plan-visualisations' },
    { id: 'plan-content', tiles: ['tools:sticky', 'tools:text', 'tools:image', 'tools:page'] },
    {
      id: 'plan-tools',
      tiles: [
        'collab:temperature',
        'collab:estimate',
        'collab:idea-box',
        'tools:picker',
        'tools:session-timer',
        'tools:session-stopwatch',
      ],
    },
  ],
};

export const PALETTE_LAYOUTS = { diagram: DIAGRAM, illustrate: ILLUSTRATE, plan: PLAN } as const;

/** The layout a mode's palette shows. Draw mode shows its own tools, so it borrows Diagram's. */
export function paletteLayoutFor(mode: EditorMode): PaletteLayout {
  return mode === 'illustrate' ? ILLUSTRATE : mode === 'plan' ? PLAN : DIAGRAM;
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
 *  left out unless the tab is an event-storming board; a logo-only one unless it has a logo page. */
export function paletteCategoriesFor(
  mode: EditorMode,
  { esBoard = false, logoPages = false }: { esBoard?: boolean; logoPages?: boolean } = {},
): ResolvedPaletteCategory[] {
  return paletteLayoutFor(mode)
    .categories.filter((e) => (esBoard || !e.boardOnly) && (logoPages || !e.logoOnly))
    .map(resolve);
}

/**
 * The palette while a Plan board covers the canvas (maximised, or filling its tab: docs/specs/026-plan/plan-board.md
 * "Maximised board"): only Plan's Cards, whatever the mode, since a card is the one thing that lands on the board.
 * The category the person had stays chosen underneath and comes back when the board is restored.
 */
export const COVERED_PALETTE_CATEGORY = 'plan-cards';
export function coveredPaletteCategories(): ResolvedPaletteCategory[] {
  return paletteCategoriesFor('plan').filter((c) => c.id === COVERED_PALETTE_CATEGORY);
}

/** Whether a mode's palette offers category `id` (on an ordinary tab). */
export function paletteCategoryOffered(mode: EditorMode, id: string): boolean {
  return paletteLayoutFor(mode).categories.some((e) => e.id === id && !e.boardOnly);
}

/** The category the palette opens on: an event-storming board's notation, or the mode's own. */
export function paletteLandingCategory(mode: EditorMode, esBoard: boolean): string {
  return esBoard ? 'event-storming' : paletteLayoutFor(mode).landing;
}
