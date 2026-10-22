// The palette (docs/specs/026-plan/plan-mode.md "The palette"): which categories Plan's palette offers, in order,
// what each is called there, and which tiles it holds. A category's identity (its glyph, and the label, blurb and band
// it wears by default) lives in PALETTE_CATEGORIES; a tile's identity in PALETTE_TILES. A layout only arranges them,
// so a Dashboard's palette can rename or re-fill a category without touching Plan's.
//
// An entry with no `tiles` holds its category's own tiles (tilesForCategory), so a layout spells out only where it
// differs. The catalogue categories (My shapes, Icons, Stickers, Tech) are bodies with their own content and take no
// tile list.
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
  'technology',
]);

// Plan's palette (docs/specs/026-plan/plan-mode.md "The palette"): cards, boards and their widgets first, then the
// plan views that read every card (docs/specs/026-plan/plan-views.md), then the few other elements a team plans beside
// its boards, borrowed from Write, Media and Behaviours; nothing that organises a diagram.
export const PLAN_PALETTE: PaletteLayout = {
  // Opening on Cards: a Plan tab is worked by its boards.
  landing: 'plan-cards',
  categories: [
    { id: 'plan-cards' },
    { id: 'plan-boards' },
    { id: 'plan-metrics' },
    { id: 'plan-visualisations' },
    { id: 'plan-sheets' },
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

/** The categories Plan's palette offers, in order, with their tiles. */
export function paletteCategoriesFor(): ResolvedPaletteCategory[] {
  return PLAN_PALETTE.categories.map(resolve);
}

/**
 * The palette while a Plan board covers the canvas (maximised, or filling its tab: docs/specs/026-plan/plan-board.md
 * "Maximised board"): only Plan's Cards, since a card is the one thing that lands on the board. The category the
 * person had stays chosen underneath and comes back when the board is restored.
 */
export const COVERED_PALETTE_CATEGORY = 'plan-cards';
export function coveredPaletteCategories(): ResolvedPaletteCategory[] {
  return paletteCategoriesFor().filter((c) => c.id === COVERED_PALETTE_CATEGORY);
}

// A Dashboard tab's palette (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): what a slot takes. Popular first, the
// handful a dashboard is most often built from; then Layout's rows and slot, the boards, Sheets, metrics and
// visualisations, and the sticky, which makes a note.
const DASHBOARD: PaletteLayout = {
  landing: 'popular',
  categories: [
    {
      id: 'popular',
      description:
        'What a dashboard is most often built from: rows, a board, a sheet, metrics and charts.',
      tiles: [
        'dashboard:row-metrics',
        'dashboard:row-charts',
        'dashboard:slot',
        'dashboard:card-title',
        'plan:board-kanban',
        'plan:sheet',
        'plan:view-metric-progress',
        'plan:view-metric-count',
        'plan:view-metric-due',
        'plan:view-workload',
        'plan:view-gantt',
        'plan:view-calendar',
        'tools:sticky',
      ],
    },
    { id: 'dashboard-layout' },
    // Filled from the document's tabs (usePaletteCatalogue), dropped while it has none.
    { id: 'dashboard-tabs', tiles: [] },
    { id: 'plan-boards' },
    { id: 'plan-metrics' },
    { id: 'plan-visualisations' },
    // Each band's categories together, so the dropdown names each band once.
    { id: 'plan-sheets' },
    // What is written on the page itself: a note and a section's Title.
    {
      id: 'plan-content',
      label: 'Utilities',
      tiles: [
        'tools:sticky',
        'dashboard:card-title',
        'dashboard:card-status',
        'dashboard:card-checklist',
        'dashboard:card-key-date',
        'dashboard:card-links',
      ],
    },
  ],
};

export function dashboardPaletteCategories(): ResolvedPaletteCategory[] {
  return DASHBOARD.categories.map(resolve);
}
export const DASHBOARD_PALETTE_LANDING = DASHBOARD.landing;

/** Whether Plan's palette offers category `id`. */
export function paletteCategoryOffered(id: string): boolean {
  return PLAN_PALETTE.categories.some((e) => e.id === id);
}

// Plan's landing while its tab has no board (docs/specs/026-plan/plan-mode.md "The palette"): a card lands on a
// board, so a tab without one opens on Boards.
const PLAN_NO_BOARD_LANDING = 'plan-boards';

/** The category the palette opens on: Cards, or Boards while the tab has no board. */
export function paletteLandingCategory(hasPlanBoard = true): string {
  return hasPlanBoard ? PLAN_PALETTE.landing : PLAN_NO_BOARD_LANDING;
}

// A Participant's palette (docs/specs/013-workspace/share-roles.md "What a Participant changes"): one category,
// Participate, holding only what it may add, as the full palette's own tiles: the Sticky and Text tiles, then the
// Image tile.
const PARTICIPANT_TILES = ['tools:sticky', 'tools:text', 'tools:image'] as const;

export function participantTiles(): PaletteTileDef[] {
  return PARTICIPANT_TILES.map(tileById).filter((t): t is PaletteTileDef => t !== undefined);
}

export function participantPaletteCategories(): ResolvedPaletteCategory[] {
  const identity = IDENTITY.get('participate')!;
  return [{ ...identity, tiles: participantTiles() }];
}

// The selection modes a Participant has: look, point and walk around, never an Editor's tools (Format
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
