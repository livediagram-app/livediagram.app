// The palette (docs/specs/012-collaboration/workshop-mode.md "The palette"): which categories the meeting palette
// offers, in order, what each is called there, and which tiles it holds. A category's identity (its glyph, and the
// label, blurb and band it wears by default) lives in PALETTE_CATEGORIES; a tile's identity in PALETTE_TILES. The
// layout only arranges them.
//
// An entry with no `tiles` holds its category's own tiles (tilesForCategory), so the layout spells out only where it
// differs. The catalogue categories (Icons, Stickers) are bodies with their own content and take no tile list. The
// palette lands on Popular, a fixed pick of tiles from across its categories.
import type { EditorMode } from '@livehuddle/document';
import { PALETTE_CATEGORIES } from './palette-categories';
import { tileById, tilesForCategory, type PaletteTileDef } from './palette-tile-defs';
import { SPACE_CATEGORIES } from './space-categories';

type PaletteLayoutEntry = {
  // A PALETTE_CATEGORIES id: the glyph, and the default label, blurb and band.
  id: string;
  label?: string;
  description?: string;
  band?: number;
  // The tiles, in order, by tile id. `DIVIDE` between two puts a fixed divider there
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
export const CATALOGUE_CATEGORIES: ReadonlySet<string> = new Set(['icons', 'stickers']);

// The tiles no strip holds, found only by searching (docs/specs/007-editor/toolbar-layout.md "Search: every element
// type"). The meeting palette has none: the Search finds only what the palette offers
// (docs/specs/012-collaboration/workshop-mode.md "The palette").
export const SEARCH_ONLY_TILE_IDS: readonly string[] = [];

// The meeting palette (docs/specs/012-collaboration/workshop-mode.md "The palette"): livehuddle's one palette, for
// meeting in a Space. Light content to write with, the Space categories a Space is built from (one per question,
// from their one list in space-categories.tsx; the Avatar button is in Travel), then the decorations. No diagram tools,
// no frame and no Collaborate elements: those are livediagram's (docs/specs/002-project-scope/not-in-livehuddle.md).
const MEETING: PaletteLayout = {
  landing: 'popular',
  categories: [
    {
      // What a Space is most often furnished with: a note, words, a picture and a link, then, behind a divider, the
      // pieces a meeting place is built from.
      id: 'popular',
      description: 'What a Space is most often furnished with, from across the palette.',
      tiles: [
        'tools:sticky',
        'tools:text',
        'tools:image',
        'tools:link-card',
        DIVIDE,
        'tools:room',
        'tools:meeting-table',
        'tools:chair',
        'tools:focus-button',
        'tools:avatar-pad',
      ],
    },
    // Words and notes. No Pointer note, Table, Checklist, Page or Annotation.
    { id: 'write', description: 'Text and sticky notes.', tiles: ['tools:text', 'tools:sticky'] },
    // Each Space category holds its group's tiles, in catalogue order; one with none yet is left off.
    ...SPACE_CATEGORIES.map((c) => ({ id: c.id })),
    { id: 'icons' },
    { id: 'stickers' },
    // A picture (upload, the gallery, image search) and a link card. No avatar, no video or website embeds.
    {
      id: 'media',
      description: 'A picture, uploaded or found, and a link card.',
      tiles: ['tools:image', 'tools:link-card'],
    },
  ],
};

export const PALETTE_LAYOUTS: Record<EditorMode, PaletteLayout> = {
  workshop: MEETING,
};

function paletteLayoutFor(mode: EditorMode): PaletteLayout {
  return PALETTE_LAYOUTS[mode];
}

export type ResolvedPaletteCategory = (typeof PALETTE_CATEGORIES)[number] & {
  // The tiles it holds, in order; null for a catalogue category, whose body is its own.
  tiles: PaletteTileDef[] | null;
};

const IDENTITY = new Map(PALETTE_CATEGORIES.map((c) => [c.id, c]));

// The listed tiles; a DIVIDE marks the tile before it as ending a group, in this list only.
function resolveTiles(ids: readonly string[]): PaletteTileDef[] {
  const out: PaletteTileDef[] = [];
  for (const id of ids) {
    if (id === DIVIDE) {
      const last = out.at(-1);
      if (last) out[out.length - 1] = { ...last, dividerAfter: true };
      continue;
    }
    const def = tileById(id);
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

/** The categories a mode's palette offers, in order, with their tiles. A tile category with no tiles (a Space
 *  category whose pieces have not landed yet) is left off rather than opening onto nothing. */
export function paletteCategoriesFor(mode: EditorMode): ResolvedPaletteCategory[] {
  return paletteLayoutFor(mode)
    .categories.map(resolve)
    .filter((c) => c.tiles === null || c.tiles.length > 0);
}

/** Whether a mode's palette offers category `id`. */
export function paletteCategoryOffered(mode: EditorMode, id: string): boolean {
  return paletteCategoriesFor(mode).some((c) => c.id === id);
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

// The selection modes a Participant has: look and walk around (Build's Select and Hand, Interact's Avatar), never
// Edit's Eraser or Format Painter.
export const PARTICIPANT_CANVAS_TOOLS: readonly string[] = [
  'select',
  'pan',
  // Avatar is every role's (docs/specs/013-workspace/share-roles.md): walking writes nothing.
  'avatar',
];
