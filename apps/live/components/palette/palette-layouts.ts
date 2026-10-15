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
import { openerById } from './palette-openers';

export type PaletteLayoutEntry = {
  // A PALETTE_CATEGORIES id: the glyph, and the default label, blurb and band.
  id: string;
  label?: string;
  description?: string;
  band?: number;
  // The tiles, in order, by tile id (or opener id, palette-openers). `DIVIDE` between two puts a fixed divider there
  // for this layout alone (a tile's own `dividerAfter` follows it everywhere). Absent = the category's own tiles.
  tiles?: readonly string[];
  // Offered only on an event-storming board.
  boardOnly?: true;
  // Offered only while the tab has a logo page (docs/specs/007-editor/logo-pages.md "The Logo
  // palette").
  logoOnly?: true;
};

// A layout's own fixed divider, between the tiles either side of it (docs/specs/007-editor/toolbar-layout.md "Fixed
// dividers").
export const DIVIDE = '|';

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

// Write's own tiles and the Callout (a headed note, as much a diagram's as a page's), then the Comment
// panel and the Action card: comments and assigned actions belong to every mode, so Diagram keeps them
// though their Collaborate category is Facilitate's.
const WRITE_WITH_COMMENTS = [
  ...tilesForCategory('write').map((t) => t.id),
  'components:callout',
  'collab:comment-pin',
  'collab:action-card',
];

// The diagram-building elements Diagram's Build adds to the category's own tiles, the Entity (a class or table, a
// data model's node) among them: it was Popular's alone, and the category bar has no Popular.
const DIAGRAM_BUILD_EXTRAS = [
  'components:card',
  'components:badge',
  'components:step',
  'tools:entity',
];

// The concept graphics, then the Sankey (Diagram's and Illustrate's Concepts).
const CONCEPTS_WITH_SANKEY = [...tilesForCategory('concepts').map((t) => t.id), 'tools:sankey'];

// Image and Avatar; no embedded pages, and no Tab Window (an Illustrate element, docs/specs/009-elements/tab-window.md).
const MEDIA_WITHOUT_EMBEDS = tilesExcept('media', ...EMBED_TILES, 'media:tab-window');

// Diagram mode: Popular, then every category but the mock-up kit (Components, Devices), the charts
// (Data) and the session kit (Stickers, Collaborate: Facilitate's, docs/specs/012-collaboration/
// facilitate-mode.md), each with its own tiles but Media's embeds.
const DIAGRAM: PaletteLayout = {
  landing: 'popular',
  categories: [
    {
      // The twelve a diagram is most often built from: the basic shapes, words, an arrow and a frame, the
      // structures (a mind node, a flowchart node, a Sankey, a table), the AWS marks (an opener, palette-openers) and
      // the entity.
      id: 'popular',
      tiles: [
        'shapes:square',
        'shapes:circle',
        'shapes:diamond',
        'tools:text',
        'tools:arrow',
        'tools:frame',
        'tools:mind-node',
        'tools:flowchart',
        'tools:sankey',
        'tools:table',
        'open:technology/aws',
        'tools:entity',
      ],
    },
    { id: 'shapes' },
    { id: 'my-shapes' },
    // Comments and assigned actions belong to every mode, so their two Collaborate tiles stay here.
    { id: 'write', tiles: WRITE_WITH_COMMENTS },
    { id: 'draw' },
    // The diagram-building elements join Build here (docs/specs/009-elements/card.md and its siblings).
    {
      id: 'build',
      tiles: [...tilesExcept('build', 'tools:sankey'), ...DIAGRAM_BUILD_EXTRAS],
    },
    // Concept graphics (docs/specs/009-elements/concept-graphics.md), and the Sankey: a flow drawn as wide as what it
    // carries explains an idea the way a funnel or a cycle does, so it sits with them rather than with the builders.
    { id: 'concepts', tiles: CONCEPTS_WITH_SANKEY },
    { id: 'event-storming', boardOnly: true },
    { id: 'icons' },
    { id: 'technology' },
    { id: 'media', tiles: MEDIA_WITHOUT_EMBEDS },
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
    // Mind maps, flowcharts, lanes and frames organise a diagram, not a visual page.
    {
      id: 'build',
      tiles: tilesExcept(
        'build',
        'tools:mind-node',
        'tools:org-chart',
        'tools:flowchart',
        'tools:sequence',
        'tools:lane',
        'tools:frame',
        'tools:boundary',
        'tools:diagram-key',
        'tools:sankey',
      ),
    },
    { id: 'concepts', tiles: CONCEPTS_WITH_SANKEY },
    // The web blocks, without the data-model Entity.
    { id: 'components', tiles: tilesExcept('components', 'tools:entity') },
    { id: 'devices' },
    { id: 'icons' },
    { id: 'stickers' },
    { id: 'media' },
    { id: 'data' },
  ],
};

// Facilitate mode (docs/specs/012-collaboration/facilitate-mode.md "The palette"): running a session
// with a team. Popular, the drawing basics a session uses (no Page or Annotation, no Shape Pen or
// Polygon, no Lane or Timeline), the decorations a room reaches for, and the Collaborate elements as
// six categories, one per group, plus the charts; no tech icons, mock-up kit or workshop notation.
const FACILITATE: PaletteLayout = {
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
    // Write and Build as one, "Write & Build": words and notes, then a table and a frame to hold them. No Page or
    // Annotation; and a Sankey reports on a flow, mind maps and flowcharts build a diagram, lanes and timelines lay
    // one out: a session does not stop for them.
    {
      id: 'write',
      label: 'Write & Build',
      description: 'Text, sticky notes, tables, checklists and frames.',
      tiles: [
        ...tilesExcept('write', 'tools:page', 'tools:annotation'),
        DIVIDE,
        'tools:table',
        'tools:checklist',
        'tools:frame',
      ],
    },
    { id: 'draw', tiles: tilesExcept('draw', 'tools:shape-pen', 'tools:polygon') },
    // No Concepts: concept graphics lay out an idea for a diagram (docs/specs/009-elements/concept-graphics.md),
    // which a session does not stop to draw.
    { id: 'icons' },
    { id: 'stickers' },
    { id: 'media', tiles: MEDIA_WITHOUT_EMBEDS },
    // The charts and meters: a session reads results and sets targets as often as a page reports them.
    { id: 'data' },
    { id: 'collab-ask' },
    { id: 'collab-tools' },
    { id: 'collab-record' },
    { id: 'collab-react' },
    { id: 'collab-mode' },
    { id: 'collab-navigate' },
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

export const PALETTE_LAYOUTS = {
  diagram: DIAGRAM,
  illustrate: ILLUSTRATE,
  plan: PLAN,
  facilitate: FACILITATE,
} as const;

/** The layout a mode's palette shows. Draw mode shows its own tools, so it borrows Diagram's. */
export function paletteLayoutFor(mode: EditorMode): PaletteLayout {
  return mode === 'draw' ? DIAGRAM : PALETTE_LAYOUTS[mode];
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

/** Whether a mode's palette offers category `id` (on an ordinary tab). */
export function paletteCategoryOffered(mode: EditorMode, id: string): boolean {
  return paletteLayoutFor(mode).categories.some((e) => e.id === id && !e.boardOnly);
}

// Plan's landing while its tab has no board (docs/specs/026-plan/plan-mode.md "The palette"): a card lands on a
// board, so a tab without one opens on Boards.
export const PLAN_NO_BOARD_LANDING = 'plan-boards';

/**
 * The category the palette opens on: an event-storming board's notation, or the mode's own (Plan's Boards while
 * the tab has no board).
 */
export function paletteLandingCategory(
  mode: EditorMode,
  esBoard: boolean,
  hasPlanBoard = true,
): string {
  if (esBoard) return 'event-storming';
  if (mode === 'plan' && !hasPlanBoard) return PLAN_NO_BOARD_LANDING;
  return paletteLayoutFor(mode).landing;
}

// A Participant's palette (docs/specs/013-workspace/share-roles.md "What a Participant changes"): one category,
// Participate, holding only what it may add, as the full palette's own tiles. On an Event Storming board that is the
// notation's coloured notes; elsewhere the Sticky and Text tiles (whatever a mode's Popular holds); then the Image
// tile. Mind-map branches grow from a node (Tab, Enter), not from a tile.
const PARTICIPANT_TILES = ['tools:sticky', 'tools:text'] as const;
const PARTICIPANT_IMAGE_TILE = 'tools:image';

export function participantTiles(mode: EditorMode, esBoard: boolean): PaletteTileDef[] {
  const landing = paletteLandingCategory(mode, esBoard);
  const category = paletteCategoriesFor(mode, { esBoard }).find((c) => c.id === landing);
  const notation = esBoard ? (category?.tiles ?? []).filter((t) => t.action.type === 'sticky') : [];
  const base =
    notation.length > 0
      ? notation
      : PARTICIPANT_TILES.map(tileById).filter((t): t is PaletteTileDef => t !== undefined);
  const image = tileById(PARTICIPANT_IMAGE_TILE);
  return image ? [...base, image] : base;
}

export function participantPaletteCategories(
  mode: EditorMode,
  esBoard: boolean,
): ResolvedPaletteCategory[] {
  const identity = IDENTITY.get('participate')!;
  return [{ ...identity, tiles: participantTiles(mode, esBoard) }];
}

// The selection modes a Participant has: look, point and walk around, never an Editor's tools (Eraser, Format
// Painter, Slide Deck).
export const PARTICIPANT_CANVAS_TOOLS: readonly string[] = [
  'select',
  'pan',
  'laser',
  'spotlight',
  'avatar',
  'isometric',
  'zen',
];
