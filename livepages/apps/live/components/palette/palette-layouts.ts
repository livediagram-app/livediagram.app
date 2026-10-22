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
import type { EditorMode } from '@livepages/document';
import { PALETTE_CATEGORIES } from './palette-categories';
import { tileById, tilesForCategory, type PaletteTileDef } from './palette-tile-defs';
import { openerById } from './palette-openers';
import type { PaletteKind } from '@/lib/palette-kind';

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
// panel and the Action card as their own group: comments and assigned actions belong to every mode, so Diagram
// keeps them though their Collaborate category is Workshop's.
const WRITE_WITH_COMMENTS = [
  ...tilesForCategory('write').map((t) => t.id),
  'components:callout',
  DIVIDE,
  'collab:comment-pin',
  'collab:action-card',
];

// Diagram's Build as two categories (docs/specs/010-palette/build-category.md "In Diagram: Diagrams and Layout").
// Diagrams: the structures that grow as you type, the Entity (a class or table, a data model's node) last; it was
// Popular's alone, and the category bar has no Popular.
const DIAGRAM_DIAGRAMS = [
  'tools:mind-node',
  'tools:org-chart',
  'tools:flowchart',
  'tools:sequence',
  'tools:table',
  'tools:entity',
];

// Layout (Diagram and Workshop): the containers a diagram or a board is arranged in, then the parts that label
// it, the Card, Badge and Step number borrowed from Components.
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

// Workshop's Layout: the same, with the Timeline after the containers, as Workshop has no Concepts (where the
// Timeline lives, docs/specs/009-elements/concept-graphics.md "Timeline") and a session plans along one as often.
const WORKSHOP_LAYOUT_TILES = [
  ...LAYOUT_TILES.slice(0, LAYOUT_TILES.indexOf(DIVIDE)),
  'tools:timeline',
  ...LAYOUT_TILES.slice(LAYOUT_TILES.indexOf(DIVIDE)),
];

// The concept graphics, then the Sankey (Diagram's and Pages mode's Concepts).
const CONCEPTS_WITH_SANKEY = [...tilesForCategory('concepts').map((t) => t.id), 'tools:sankey'];

// Image and Avatar; no embedded pages, and no Tab Window (a Pages element, docs/specs/009-elements/tab-window.md).
const MEDIA_WITHOUT_EMBEDS = tilesExcept('media', ...EMBED_TILES, 'media:tab-window');

// Diagram mode: Popular, then every category but the mock-up kit (Components, Devices), the charts
// (Data) and the session kit (Stickers, Collaborate: Workshop's, docs/specs/012-collaboration/
// workshop-mode.md), each with its own tiles but Media's embeds.
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
    // Build as Diagrams and Layout, with the diagram-building elements from Components (docs/specs/009-elements/card.md
    // and its siblings).
    { id: 'diagrams', tiles: DIAGRAM_DIAGRAMS },
    // Concept graphics (docs/specs/009-elements/concept-graphics.md), and the Sankey: a flow drawn as wide as what it
    // carries explains an idea the way a funnel or a cycle does, so it sits with them rather than with the builders.
    { id: 'concepts', tiles: CONCEPTS_WITH_SANKEY },
    // Layout after Concepts: what is built, then the ideas laid out beside it, then what it is all arranged in.
    { id: 'layout', tiles: LAYOUT_TILES },
    { id: 'icons' },
    { id: 'technology' },
    { id: 'media', tiles: MEDIA_WITHOUT_EMBEDS },
  ],
};

// Pages mode's Components: Layout first (what a page is laid out with: the Hero, Header and Banner, and the Stack that
// lines blocks up), then the web blocks, then Code and the Checklist; no data-model Entity.
const PAGES_COMPONENTS = [
  'components:hero',
  'components:header',
  'components:banner',
  'tools:stack',
  DIVIDE,
  'components:card',
  'components:badge',
  'components:step',
  'components:callout',
  'components:stat',
  'components:process',
  DIVIDE,
  'tools:code-block',
  'tools:checklist',
];

// The Pages palette's Write: the page is the canvas, so no Page element; and no Annotation, a diagram's marker.
const PAGES_WRITE = tilesExcept('write', 'tools:page', 'tools:annotation');

// Pages mode: Popular, the mock-up kit, glyphs, stickers, pictures and charts; no pens, tech
// icons or behaviours.
const PAGES: PaletteLayout = {
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
    { id: 'write', tiles: PAGES_WRITE },
    // No Build (docs/specs/010-palette/build-category.md "In Pages: no Build"): mind maps, flowcharts, lanes and
    // frames organise a diagram, not a visual page, and the Build tiles a page uses join the categories they sit
    // beside: the Stack in Components and the Table in Data. The Timeline is in Concepts, as everywhere.
    { id: 'concepts', tiles: CONCEPTS_WITH_SANKEY },
    { id: 'components', tiles: PAGES_COMPONENTS },
    { id: 'devices' },
    { id: 'icons' },
    { id: 'stickers' },
    { id: 'media' },
    // The charts and meters, then the Table: a page reports in rows as often as in a chart.
    {
      id: 'data',
      tiles: [...tilesForCategory('data').map((t) => t.id), DIVIDE, 'tools:table'],
    },
  ],
};

// The Pages palette by its kind (docs/specs/007-editor/pages-mode.md "The palette's kind"): Design is PAGES; a slide,
// a wireframe and a logo page each have their own, offering what that page is made of and nothing it has no use for.
// Every tile is in one category (Popular aside, a pick from across them).

// A slide (docs/specs/007-editor/pages-mode.md "The palette's kind"): what a talk is told with. Words, shapes, pictures
// and the embeds a talk plays first (Common), then what explains a point (Structure: charts, concept graphics, ready-made
// blocks and device frames for a screenshot), then the decorations; no website Header.
const PAGES_SLIDE: PaletteLayout = {
  landing: 'popular',
  categories: [
    {
      id: 'popular',
      description: 'What a slide is most often made of: a title, a picture, a chart and a point.',
      tiles: [
        'tools:text',
        'tools:image',
        'shapes:square',
        'shapes:circle',
        'shapes:speech-bubble',
        'data:bar',
        'data:pie',
        'components:stat',
        'components:process',
        'components:callout',
        'tools:timeline',
        'media:embed-youtube',
      ],
    },
    { id: 'write', tiles: PAGES_WRITE },
    { id: 'shapes' },
    // Pictures and the embeds a talk plays (a video, a prototype, a page), in Common: a slide reaches for them first.
    { id: 'media', band: 0 },
    { id: 'my-shapes' },
    {
      id: 'data',
      tiles: [...tilesForCategory('data').map((t) => t.id), DIVIDE, 'tools:table'],
    },
    { id: 'concepts', tiles: CONCEPTS_WITH_SANKEY },
    // The blocks that make a point on a slide; no website Header.
    {
      id: 'components',
      tiles: PAGES_COMPONENTS.filter((id) => id !== 'components:header'),
    },
    { id: 'devices' },
    { id: 'icons' },
    { id: 'stickers' },
  ],
};

// A wireframe (docs/specs/007-editor/wireframe-pages.md "The Elements palette"): Components and Elements first, in a
// band of their own, then the rest. Elements holds the Card, the Badge and the Checklist, so Components does not; no
// Concepts (a screen is built from its own parts) and no Devices (the page is its device already).
const SCREEN_BAND = 7;
const PAGES_WIREFRAME: PaletteLayout = {
  landing: 'wireframe',
  categories: [
    { id: 'popular' },
    {
      id: 'components',
      band: SCREEN_BAND,
      tiles: PAGES_COMPONENTS.filter(
        (id) => !['components:card', 'components:badge', 'tools:checklist'].includes(id),
      ),
    },
    {
      // A screen's own parts, with the Badge (and its presets) for a status or a count on them; Text and the Sticky
      // Note are Write's.
      id: 'wireframe',
      band: SCREEN_BAND,
      tiles: [
        'wireframe:button',
        'wireframe:button-outline',
        'wireframe:field',
        'wireframe:search',
        'wireframe:chip',
        'components:badge',
        'wireframe:image',
        'wireframe:avatar',
        'components:card',
        'tools:checklist',
        'wireframe:divider',
      ],
    },
    { id: 'shapes' },
    { id: 'my-shapes' },
    { id: 'write', tiles: PAGES_WRITE },
    { id: 'icons' },
    { id: 'stickers' },
    { id: 'media' },
    {
      id: 'data',
      tiles: [...tilesForCategory('data').map((t) => t.id), DIVIDE, 'tools:table'],
    },
  ],
};

// A logo (docs/specs/007-editor/logo-pages.md "The Logo palette"): what a mark is drawn and set with. Draw (the Pen,
// the Pencil, the Shape Pen, the Polygon, then each person's markers, useLogoMarkerTiles), Shapes, Text, glyphs to
// start from, the Library, and a picture to trace; no charts, blocks, frames, stickers or embeds.
const PAGES_LOGO: PaletteLayout = {
  landing: 'draw',
  categories: [
    {
      id: 'popular',
      description: 'What a mark is most often drawn with: the pen, the pencil, text and shapes.',
      tiles: [
        'logo:pen',
        'tools:pencil',
        'tools:text',
        'shapes:square',
        'shapes:circle',
        'shapes:triangle',
        'shapes:hexagon',
        'shapes:star',
      ],
    },
    {
      id: 'draw',
      description: 'The pen, the pencil, the shape pen and outlines, then your markers.',
      tiles: ['logo:pen', 'tools:pencil', 'tools:shape-pen', DIVIDE, 'tools:polygon'],
    },
    { id: 'shapes' },
    // Text for a wordmark, and a sticky note for a comment on the design.
    { id: 'write', tiles: ['tools:text', DIVIDE, 'tools:sticky'] },
    { id: 'icons' },
    { id: 'my-shapes' },
    // A picture to trace or to set the mark beside.
    { id: 'media', tiles: ['tools:image'] },
  ],
};

const PAGES_BY_KIND: Readonly<Record<PaletteKind, PaletteLayout>> = {
  design: PAGES,
  slide: PAGES_SLIDE,
  // An article's strip is its formatting (the docked page toolbar); its More and Search keep Pages'.
  article: PAGES,
  wireframe: PAGES_WIREFRAME,
  logo: PAGES_LOGO,
};

// Workshop mode (docs/specs/012-collaboration/workshop-mode.md "The palette"): running a session
// with a team. Popular, the drawing basics a session uses (no Page or Annotation, no Shape Pen or
// Polygon), Diagram's Layout, the Collaborate elements as six categories, one per group, ahead of the
// decorations a room reaches for and the charts; no tech icons or mock-up kit.
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
    // Words and notes, then a table and a checklist to keep them in. No Page or Annotation; and a Sankey reports on a
    // flow, mind maps and flowcharts build a diagram: a session does not stop for them.
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
    // Diagram's Layout (docs/specs/010-palette/build-category.md): a board is laid out in frames and lanes and its
    // notes labelled with badges and step numbers, as a diagram is, with the Timeline (Workshop has no Concepts).
    { id: 'layout', tiles: WORKSHOP_LAYOUT_TILES },
    // The session kit next, before the decorations: running the room is what the mode is for, so Ask and Session
    // (the other five, gathered on the bar) come right after the board's structure.
    { id: 'collab-ask' },
    { id: 'collab-tools' },
    { id: 'collab-record' },
    { id: 'collab-react' },
    { id: 'collab-mode' },
    { id: 'collab-navigate' },
    // No Concepts: concept graphics lay out an idea for a diagram (docs/specs/009-elements/concept-graphics.md),
    // which a session does not stop to draw.
    { id: 'icons' },
    { id: 'stickers' },
    { id: 'media', tiles: MEDIA_WITHOUT_EMBEDS },
    // The charts and meters: a session reads results and sets targets as often as a page reports them.
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
  pages: PAGES,
  plan: PLAN,
  workshop: WORKSHOP,
} as const;

/** The layout a mode's palette shows. Draw mode shows its own tools, so it borrows Diagram's. */
function paletteLayoutFor(mode: EditorMode, pagesKind: PaletteKind = 'design'): PaletteLayout {
  if (mode === 'pages') return PAGES_BY_KIND[pagesKind];
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

/** The categories a mode's palette offers, in order, with their tiles. Pages mode offers its kind's
 *  (`pagesKind`). */
export function paletteCategoriesFor(
  mode: EditorMode,
  { pagesKind }: { pagesKind?: PaletteKind } = {},
): ResolvedPaletteCategory[] {
  return paletteLayoutFor(mode, pagesKind).categories.map(resolve);
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

/** Whether a mode's palette offers category `id`. */
export function paletteCategoryOffered(mode: EditorMode, id: string): boolean {
  return paletteLayoutFor(mode).categories.some((e) => e.id === id);
}

// Plan's landing while its tab has no board (docs/specs/026-plan/plan-mode.md "The palette"): a card lands on a
// board, so a tab without one opens on Boards.
const PLAN_NO_BOARD_LANDING = 'plan-boards';

/**
 * The category the palette opens on: the mode's own (Plan's Boards while the tab has no board).
 */
export function paletteLandingCategory(mode: EditorMode, hasPlanBoard = true): string {
  if (mode === 'plan' && !hasPlanBoard) return PLAN_NO_BOARD_LANDING;
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
