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

type PaletteLayoutEntry = {
  // A PALETTE_CATEGORIES id: the glyph, and the default label, blurb and band.
  id: string;
  label?: string;
  description?: string;
  band?: number;
  // The tiles, in order, by tile id (or opener id, palette-openers). `DIVIDE` between two puts a fixed divider there
  // for this layout alone (a tile's own `dividerAfter` follows it everywhere). Absent = the category's own tiles.
  tiles?: readonly string[];
  // Icons only: whether it offers the stickers too, as its Stickers side (IconsCategoryTab). A layout without them
  // (a diagram, a logo) shows the icons alone.
  stickers?: true;
  // Offered only on an event-storming board.
  boardOnly?: true;
};

// A layout's own fixed divider, between the tiles either side of it (docs/specs/007-editor/toolbar-layout.md "Fixed
// dividers").
export const DIVIDE = '|';

type PaletteLayout = {
  // The category the palette opens on (an event-storming board opens on its notation instead).
  landing: string;
  categories: readonly PaletteLayoutEntry[];
};

// Icons where a layout offers the stickers too: its line under the flyout's name says so.
const ICONS_WITH_STICKERS =
  'Single-colour glyphs for any idea, and colour stickers to react, mark status and celebrate.';

// The categories whose body is its own content rather than a list of tiles.
export const CATALOGUE_CATEGORIES: ReadonlySet<string> = new Set([
  'my-shapes',
  'icons',
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
  'media:embed-live',
];

// Write's own tiles, then the Comment panel and the Action card as their own group: comments and assigned actions
// belong to every mode, so Diagram keeps them though their Collaborate category is Workshop's. The Callout is a Card
// preset, not a Write tile (owner, 2026-11-19).
const WRITE_WITH_COMMENTS = [
  ...tilesForCategory('write').map((t) => t.id),
  DIVIDE,
  'collab:comment-pin',
  'collab:action-card',
];

// Diagram's Build spread over Concepts and Layout (docs/specs/010-palette/build-category.md "In Diagram: Concepts and
// Layout"). The structures that grow as you type open Concepts as its Diagrams group.
const DIAGRAM_BUILDERS = [
  'tools:mind-node',
  'tools:org-chart',
  'tools:flowchart',
  'tools:sequence',
];

// Diagram's Shapes: its own tiles, then the BPMN notation as a group of its own (docs/specs/009-elements/bpmn.md
// "The palette"): no category or toolbar button of its own.
const DIAGRAM_SHAPES = [
  ...tilesForCategory('shapes').map((t) => t.id),
  DIVIDE,
  ...tilesForCategory('bpmn').map((t) => t.id),
];

// Image and Avatar; no embedded pages.
// Image and Avatar side by side as one Pictures group (owner, 2026-11-19): the embeds' divider between them dropped.
const MEDIA_WITHOUT_EMBEDS = tilesExcept('media', ...EMBED_TILES).filter((id) => id !== DIVIDE);

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
  // Media merged in (owner, 2026-11-16): a picture or an avatar is placed as a frame or a badge is, so the image and
  // avatar sit at Layout's end rather than in a category of two.
  DIVIDE,
  ...MEDIA_WITHOUT_EMBEDS,
];

// Workshop's Layout: the same, with the Timeline after the containers, as Workshop has no Concepts (where the
// Timeline lives, docs/specs/009-elements/concept-graphics.md "Timeline") and a session plans along one as often.
const WORKSHOP_LAYOUT_TILES = [
  ...LAYOUT_TILES.slice(0, LAYOUT_TILES.indexOf(DIVIDE)),
  'tools:timeline',
  ...LAYOUT_TILES.slice(LAYOUT_TILES.indexOf(DIVIDE)),
];

// Diagram's Layout: the containers with the Table (its own divider ends them), the parts with the Infrastructure
// tile after the Step number (owner, 2026-11-19: its popover holds the C4 tiles and the Entity, as the Card's holds
// its presets), then the pictures.
const DIAGRAM_LAYOUT_TILES = [
  ...LAYOUT_TILES.slice(0, LAYOUT_TILES.indexOf(DIVIDE)),
  'tools:table',
  ...LAYOUT_TILES.slice(LAYOUT_TILES.indexOf(DIVIDE) + 1, LAYOUT_TILES.lastIndexOf(DIVIDE)),
  'layout:infrastructure',
  ...LAYOUT_TILES.slice(LAYOUT_TILES.lastIndexOf(DIVIDE)),
];

// Diagram's Concepts in four groups (owner, 2026-11-19; toolbar-layout.md "Fixed dividers"): Diagrams (the builders),
// Layers (what stacks or nests), Process (what moves through stages or time) and Relationships (what turns or
// radiates).
const DIAGRAM_CONCEPTS = [
  ...DIAGRAM_BUILDERS,
  DIVIDE,
  'concepts:layer-stack',
  'concepts:pyramid',
  'concepts:onion',
  DIVIDE,
  'concepts:funnel',
  'concepts:chevrons',
  'tools:timeline',
  'tools:sankey',
  DIVIDE,
  'concepts:cycle',
  'concepts:hub',
];

// The tiles no mode's strip holds, found only by searching (docs/specs/007-editor/toolbar-layout.md "Search: every
// element type"): the Code block, the embeds, the devices and the page blocks (Hero, Header, Banner, Stat row,
// Process). Pages mode's palette was their home; they still work in every mode, so the strip's Search lists them as
// this mode's wherever it is shown, as the search panel's Add to canvas does.
export const SEARCH_ONLY_TILE_IDS: readonly string[] = [
  'tools:code-block',
  ...EMBED_TILES,
  ...tilesForCategory('devices').map((t) => t.id),
  'components:hero',
  'components:header',
  'components:banner',
  'components:stat',
  'components:process',
  // The C4 tiles, offered on the strip only inside Layout's Infrastructure popover.
  ...tilesForCategory('diagrams')
    .map((t) => t.id)
    .filter((id) => id !== 'layout:infrastructure'),
];

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
    { id: 'shapes', tiles: DIAGRAM_SHAPES },
    { id: 'my-shapes' },
    // Comments and assigned actions belong to every mode, so their two Collaborate tiles stay here.
    { id: 'write', tiles: WRITE_WITH_COMMENTS },
    { id: 'draw' },
    // Build spread over Concepts and Layout (owner, 2026-11-19; docs/specs/010-palette/build-category.md). Concepts:
    // the builders, then the concept graphics (docs/specs/009-elements/concept-graphics.md) and the Sankey, a flow
    // drawn as wide as what it carries.
    { id: 'concepts', tiles: DIAGRAM_CONCEPTS },
    // Layout after Concepts: what is built, then what it is all arranged in, labelled with and drawn from.
    { id: 'layout', tiles: DIAGRAM_LAYOUT_TILES },
    { id: 'event-storming', boardOnly: true },
    { id: 'icons' },
    { id: 'technology' },
  ],
};

// Workshop mode (docs/specs/012-collaboration/workshop-mode.md "The palette"): running a session
// with a team. Popular, the drawing basics a session uses (no Page or Annotation, no Shape Pen or
// Polygon), Diagram's Layout, the Collaborate elements as six categories, one per group, ahead of the
// decorations a room reaches for and the charts; no tech icons, mock-up kit or workshop notation.
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
    { id: 'icons', stickers: true, description: ICONS_WITH_STICKERS },
    // The charts and meters: a session reads results and sets targets as often as a page reports them.
    { id: 'data' },
  ],
};

export const PALETTE_LAYOUTS = {
  diagram: DIAGRAM,
  workshop: WORKSHOP,
} as const;

/** The layout a mode's palette shows. Draw mode shows its own tools, so it borrows Diagram's. */
function paletteLayoutFor(mode: EditorMode): PaletteLayout {
  return mode === 'draw' ? DIAGRAM : PALETTE_LAYOUTS[mode];
}

export type ResolvedPaletteCategory = (typeof PALETTE_CATEGORIES)[number] & {
  // The tiles it holds, in order; null for a catalogue category, whose body is its own.
  tiles: PaletteTileDef[] | null;
  // Icons: whether it offers the stickers too (its Stickers side).
  stickers?: boolean;
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
    ...(entry.stickers ? { stickers: true } : null),
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
  // Stickers are the Icons category's Stickers side, where a layout offers them.
  if (id === 'stickers')
    return paletteLayoutFor(mode).categories.some((e) => e.id === 'icons' && e.stickers);
  return paletteLayoutFor(mode).categories.some((e) => e.id === id && !e.boardOnly);
}

/** The category the palette opens on: an event-storming board's notation, or the mode's own. */
export function paletteLandingCategory(mode: EditorMode, esBoard: boolean): string {
  if (esBoard) return 'event-storming';
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

// The selection modes a Participant has: look, point and move around, never an Editor's tools (Eraser, Format
// Painter, Slide Deck).
export const PARTICIPANT_CANVAS_TOOLS: readonly string[] = [
  'select',
  'pan',
  'laser',
  'spotlight',
  'isometric',
  'zen',
];
