// The palette (docs/specs/012-collaboration/workshop-mode.md "The palette"): which categories the meeting palette
// offers, in order, what each is called there, and which tiles it holds. A category's identity (its glyph, and the
// label, blurb and band it wears by default) lives in PALETTE_CATEGORIES; a tile's identity in PALETTE_TILES. The
// layout only arranges them.
//
// An entry with no `tiles` holds its category's own tiles (tilesForCategory), so the layout spells out only where it
// differs. The catalogue category (Stickers) is a body with their own content and take no tile list. The
// palette lands on Popular, a fixed pick of tiles from across its categories.
import { PALETTE_CATEGORIES } from './palette-categories';
import { tileById, tilesForCategory, type PaletteTileDef } from './palette-tile-defs';
import { SPACE_CATEGORIES } from './space-categories';
import { groupedSpaceTiles } from './space-category-groups';

type PaletteLayoutEntry = {
  // A PALETTE_CATEGORIES id: the glyph, and the default label, blurb and band.
  id: string;
  label?: string;
  description?: string;
  band?: number;
  // The tiles, in order, by tile id. `DIVIDE` between two puts a fixed divider there
  // for this layout alone (a tile's own `dividerAfter` follows it everywhere). Absent = the category's own tiles.
  tiles?: readonly string[];
  // Search-only: left off the strip, the phone row and the tabs, while Search still offers its items here
  // (docs/specs/010-palette/palette-top-level-categories.md "Stickers in search only").
  searchOnly?: boolean;
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
export const CATALOGUE_CATEGORIES: ReadonlySet<string> = new Set(['stickers']);

// The tiles no strip holds, found only by searching (docs/specs/007-editor/toolbar-layout.md "Search: every element
// type"). The meeting palette has none: the Search finds only what the palette offers
// (docs/specs/012-collaboration/workshop-mode.md "The palette").
export const SEARCH_ONLY_TILE_IDS: readonly string[] = [];

// The meeting palette (docs/specs/012-collaboration/workshop-mode.md "The palette"): livehuddle's one palette, for
// meeting in a Space. Light content to write with, the Space categories a Space is built from (one per question,
// from their one list in space-categories.tsx; the Avatar button is in Travel), then the decorations. No diagram tools,
// no frame and no Collaborate elements: those are livediagram's (docs/specs/002-project-scope/not-in-livehuddle.md).
// Rooms, Play and Garden list their named groups (docs/specs/010-palette/palette-top-level-categories.md
// "Groups in a flyout", space-category-groups.ts): Rooms opens on Build, then Floor; a divider between two groups,
// and a piece no group lists joins the last, so a new piece still joins by its tileGroup alone.
function spaceCategoryEntry(id: string): PaletteLayoutEntry {
  const own = tilesForCategory(id).map((t) => t.id);
  const tiles = groupedSpaceTiles(id, own, DIVIDE);
  return tiles ? { id, tiles } : { id };
}

const MEETING: PaletteLayout = {
  landing: 'popular',
  categories: [
    {
      // What a Space is most often furnished with: a note and words, then, behind a divider, the pieces a meeting
      // place is built from. No Image or Link card (docs/specs/002-project-scope/not-in-livehuddle.md "Media").
      id: 'popular',
      description: 'What a Space is most often furnished with, from across the palette.',
      tiles: [
        'tools:sticky',
        'tools:text',
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
    // Each Space category holds its group's tiles, in catalogue order or its named groups' order; one with none yet
    // is left off. Their order, and Travel's band of its own, are SPACE_CATEGORIES'
    // (docs/specs/010-palette/palette-top-level-categories.md "The strip's order").
    ...SPACE_CATEGORIES.map((c) => spaceCategoryEntry(c.id)),
    // Decoration: Stickers, search-only (never on the strip). No Icons and no Media
    // (docs/specs/002-project-scope/not-in-livehuddle.md "Icons", "Media: Image and Link card").
    { id: 'stickers', searchOnly: true },
  ],
};

// The one layout; the palette is not keyed by a mode (docs/specs/007-editor/editor-modes.md "The palette").
export const MEETING_PALETTE: PaletteLayout = MEETING;

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

/** The categories the palette offers, in order, with their tiles. A tile category with no tiles (a Space category
 *  whose pieces have not landed yet) is left off rather than opening onto nothing. */
export function paletteCategories(): ResolvedPaletteCategory[] {
  return MEETING_PALETTE.categories
    .filter((entry) => !entry.searchOnly)
    .map(resolve)
    .filter((c) => c.tiles === null || c.tiles.length > 0);
}

/** Whether the palette offers category `id`. */
export function paletteCategoryOffered(id: string): boolean {
  return (
    paletteCategories().some((c) => c.id === id) ||
    MEETING_PALETTE.categories.some((entry) => entry.searchOnly && entry.id === id)
  );
}

/** The category the palette opens on. */
export function paletteLandingCategory(): string {
  return MEETING_PALETTE.landing;
}

// A Participant has no palette (docs/specs/013-workspace/share-roles.md "A Participant walks").

// The canvas tools a read-only session (an Editor on a locked tab) presses on a Selection Mode button: the two sides
// of the Edit | Walk toggle, neither of which writes. A Participant and a Viewer press none: they are always walking
// (docs/specs/013-workspace/share-roles.md "Always walking").
export const PARTICIPANT_CANVAS_TOOLS: readonly string[] = [
  'select',
  // Avatar is every role's (docs/specs/013-workspace/share-roles.md): walking writes nothing.
  'avatar',
];
