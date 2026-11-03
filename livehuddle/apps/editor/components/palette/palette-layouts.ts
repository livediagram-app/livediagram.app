// The palette (docs/specs/012-collaboration/workshop-mode.md "The palette"): which categories Workshop's palette
// offers, in order, what each is called there, and which tiles it holds. A category's identity (its glyph, and the
// label, blurb and band it wears by default) lives in PALETTE_CATEGORIES; a tile's identity in PALETTE_TILES. The
// layout only arranges them.
//
// An entry with no `tiles` holds its category's own tiles (tilesForCategory), so the layout spells out only where it
// differs. The catalogue categories (My shapes, Icons, Stickers) are bodies with their own content and take no tile
// list. The palette lands on Popular, a fixed pick of tiles from across its categories.
import type { EditorMode } from '@livehuddle/document';
import { PALETTE_CATEGORIES } from './palette-categories';
import { tileById, tilesForCategory, type PaletteTileDef } from './palette-tile-defs';
import { openerById } from './palette-openers';

type PaletteLayoutEntry = {
  // A PALETTE_CATEGORIES id: the glyph, and the default label, blurb and band.
  id: string;
  label?: string;
  description?: string;
  band?: number;
  // The tiles, in order, by tile id (or opener id, palette-openers). `DIVIDE` between two puts a fixed divider there
  // for this layout alone (a tile's own `dividerAfter` follows it everywhere). Absent = the category's own tiles.
  tiles?: readonly string[];
};

// A layout's own fixed divider, between the tiles either side of it (docs/specs/007-editor/toolbar-layout.md "Fixed
// dividers").
export const DIVIDE = '|';

type PaletteLayout = {
  // The category the palette opens on.
  landing: string;
  categories: readonly PaletteLayoutEntry[];
};

// The categories whose body is its own content rather than a list of tiles.
export const CATALOGUE_CATEGORIES: ReadonlySet<string> = new Set([
  'my-shapes',
  'icons',
  'stickers',
]);

/** A category's own tile ids, less the named ones: for a layout that drops a tile or two. A dropped tile that ends a
 *  group (`dividerAfter`) leaves its divider after the tile kept before it, so the group still ends there. */
function tilesExcept(categoryId: string, ...drop: string[]): readonly string[] {
  const out: string[] = [];
  for (const tile of tilesForCategory(categoryId)) {
    if (!drop.includes(tile.id)) out.push(tile.id);
    else if (tile.dividerAfter && out.length > 0 && out.at(-1) !== DIVIDE) out.push(DIVIDE);
  }
  return out;
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

// Layout: the containers a board is arranged in, then the parts that label it, the Card, Badge and Step number
// borrowed from Components.
const LAYOUT_TILES = [
  'tools:lane',
  'tools:frame',
  'tools:stack',
  'tools:boundary',
  DIVIDE,
  'tools:diagram-key',
  'components:card',
  'components:badge',
  'components:step',
];

// Workshop's Layout: the same, with the Timeline (docs/specs/009-elements/timeline.md) after the containers, as a
// session plans along one as often.
const WORKSHOP_LAYOUT_TILES = [
  ...LAYOUT_TILES.slice(0, LAYOUT_TILES.indexOf(DIVIDE)),
  'tools:timeline',
  ...LAYOUT_TILES.slice(LAYOUT_TILES.indexOf(DIVIDE)),
];

// Image and Avatar; no embedded pages.
const MEDIA_WITHOUT_EMBEDS = tilesExcept('media', ...EMBED_TILES);

// The tiles no mode's strip holds, found only by searching (docs/specs/007-editor/toolbar-layout.md "Search: every
// element type"): the Code block, the embeds and the page blocks (Hero, Header, Banner, Stat row, Process). They
// still work, so the strip's Search lists them, as the search panel's Add to canvas does.
export const SEARCH_ONLY_TILE_IDS: readonly string[] = [
  'tools:code-block',
  ...EMBED_TILES,
  'components:hero',
  'components:header',
  'components:banner',
  'components:stat',
  'components:process',
];

// Workshop (docs/specs/012-collaboration/workshop-mode.md "The palette"): running a session with a team. Popular, the
// drawing basics a session uses (no Page or Annotation, no Shape Pen or Polygon), the Layout, the Collaborate
// elements as six categories, one per group, ahead of the decorations a room reaches for and the charts.
const WORKSHOP: PaletteLayout = {
  landing: 'popular',
  categories: [
    {
      // What a session is most often run with: a square, notes and words, a frame and an arrow to arrange them,
      // then, behind a divider, the session kit as four openers (palette-openers), each its Collaborate category in
      // a popover.
      id: 'popular',
      tiles: [
        'shapes:square',
        'tools:sticky',
        'tools:text',
        'tools:frame',
        'tools:arrow',
        'tools:image',
        DIVIDE,
        'open:collab-ask',
        'open:collab-tools',
        'open:collab-record',
        'open:collab-react',
      ],
    },
    { id: 'shapes' },
    { id: 'my-shapes' },
    // Words and notes, then a table and a checklist to keep them in. No Page or Annotation.
    {
      id: 'write',
      description: 'Text, sticky notes, tables and checklists.',
      tiles: [
        ...tilesExcept('write', 'tools:page', 'tools:annotation'),
        DIVIDE,
        'tools:table',
        'tools:checklist',
      ],
    },
    { id: 'draw', tiles: tilesExcept('draw', 'tools:shape-pen', 'tools:polygon') },
    // The Layout (docs/specs/010-palette/build-category.md): a board is laid out in frames and lanes and its notes
    // labelled with badges and step numbers, with the Timeline.
    { id: 'layout', tiles: WORKSHOP_LAYOUT_TILES },
    // The session kit next, before the decorations: running the room is what the mode is for, so Ask and Session
    // (the other five, gathered on the bar) come right after the board's structure.
    { id: 'collab-ask' },
    { id: 'collab-tools' },
    { id: 'collab-record' },
    { id: 'collab-react' },
    { id: 'collab-mode' },
    { id: 'collab-navigate' },
    { id: 'icons' },
    { id: 'stickers' },
    { id: 'media', tiles: MEDIA_WITHOUT_EMBEDS },
    // The charts and meters: a session reads results and sets targets as often as a page reports them.
    { id: 'data' },
  ],
};

export const PALETTE_LAYOUTS: Record<EditorMode, PaletteLayout> = {
  workshop: WORKSHOP,
};

function paletteLayoutFor(mode: EditorMode): PaletteLayout {
  return PALETTE_LAYOUTS[mode];
}

export type ResolvedPaletteCategory = (typeof PALETTE_CATEGORIES)[number] & {
  // The tiles it holds, in order; null for a catalogue category, whose body is its own.
  tiles: PaletteTileDef[] | null;
};

const IDENTITY = new Map(PALETTE_CATEGORIES.map((c) => [c.id, c]));

// The listed tiles and openers; a DIVIDE marks the tile before it as ending a group, in this list only.
function resolveTiles(ids: readonly string[]): PaletteTileDef[] {
  const out: PaletteTileDef[] = [];
  for (const id of ids) {
    if (id === DIVIDE) {
      const last = out.at(-1);
      if (last) out[out.length - 1] = { ...last, dividerAfter: true };
      continue;
    }
    const def = tileById(id) ?? openerById(id);
    if (def) out.push(def);
  }
  return out;
}

function resolve(entry: PaletteLayoutEntry): ResolvedPaletteCategory {
  const identity = IDENTITY.get(entry.id);
  if (!identity) throw new Error(`palette layout names an unknown category: ${entry.id}`);
  const tiles = CATALOGUE_CATEGORIES.has(entry.id)
    ? null
    : entry.tiles
      ? resolveTiles(entry.tiles)
      : tilesForCategory(entry.id);
  return {
    ...identity,
    ...(entry.label ? { label: entry.label } : null),
    ...(entry.description ? { description: entry.description } : null),
    ...(entry.band !== undefined ? { group: entry.band } : null),
    tiles,
  };
}

/** The categories a mode's palette offers, in order, with their tiles. */
export function paletteCategoriesFor(mode: EditorMode): ResolvedPaletteCategory[] {
  return paletteLayoutFor(mode).categories.map(resolve);
}

/** Whether a mode's palette offers category `id`. */
export function paletteCategoryOffered(mode: EditorMode, id: string): boolean {
  return paletteLayoutFor(mode).categories.some((e) => e.id === id);
}

/** The category the palette opens on: the mode's own. */
export function paletteLandingCategory(mode: EditorMode): string {
  return paletteLayoutFor(mode).landing;
}

// A Participant's palette (docs/specs/013-workspace/share-roles.md "What a Participant changes"): one category,
// Participate, holding only what it may add, as the full palette's own tiles: the Sticky and Text tiles (whatever a
// mode's Popular holds), then the Image tile. Mind-map branches grow from a node (Tab, Enter), not from a tile.
const PARTICIPANT_TILES = ['tools:sticky', 'tools:text'] as const;
const PARTICIPANT_IMAGE_TILE = 'tools:image';

export function participantTiles(): PaletteTileDef[] {
  const base = PARTICIPANT_TILES.map(tileById).filter((t): t is PaletteTileDef => t !== undefined);
  const image = tileById(PARTICIPANT_IMAGE_TILE);
  return image ? [...base, image] : base;
}

export function participantPaletteCategories(): ResolvedPaletteCategory[] {
  const identity = IDENTITY.get('participate')!;
  return [{ ...identity, tiles: participantTiles() }];
}

// The selection modes a Participant has: look, point and walk around, never an Editor's tools (Eraser, Format
// Painter, Slide Deck).
export const PARTICIPANT_CANVAS_TOOLS: readonly string[] = [
  'select',
  'pan',
  'laser',
  'spotlight',
  // Avatar is listed by the picker only while in force (canvas-tool-options), for every role alike.
  'avatar',
  'isometric',
  'zen',
];
