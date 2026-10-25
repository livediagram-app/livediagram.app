// The palette per page kind (docs/specs/007-editor/pages-mode.md "The palette's kind"): which
// categories each kind's palette offers, in order, what each is called there, and which tiles it
// holds. A category's identity (its glyph, and the label, blurb and band it wears by default)
// lives in PALETTE_CATEGORIES; a tile's identity in PALETTE_TILES. A layout only arranges them,
// so the same tile can sit in different categories in different kinds, and a category can be
// renamed or re-filled for one kind without touching another.
//
// An entry with no `tiles` holds its category's own tiles (tilesForCategory), so a layout spells
// out only where a kind differs. The catalogue categories (Icons, Stickers, Tech) are
// bodies with their own content and take no tile list. Every kind lands on its own Popular, a
// fixed pick of twelve tiles from across its categories.
import type { EditorMode } from '@livedesign/design';
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

// The concept graphics, then the Sankey (Pages mode's Concepts).
const CONCEPTS_WITH_SANKEY = [...tilesForCategory('concepts').map((t) => t.id), 'tools:sankey'];

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
      // Twelve tiles a page is most often built from, in the order they are reached for:
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
    { id: 'write', tiles: PAGES_WRITE },
    // No Build (docs/specs/010-palette/build-category.md "In Pages: no Build"): frames organise a diagram, not a
    // visual page, and the Build tiles a page uses join the categories they sit
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

// The Pages palette by its kind (docs/specs/007-editor/pages-mode.md "The palette's kind"): Design is PAGES; a
// wireframe and a logo page each have their own, offering what that page is made of and nothing it has no use for.
// Every tile is in one category (Popular aside, a pick from across them).

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
    // A picture to trace or to set the mark beside.
    { id: 'media', tiles: ['tools:image'] },
  ],
};

const PAGES_BY_KIND: Readonly<Record<PaletteKind, PaletteLayout>> = {
  design: PAGES,
  wireframe: PAGES_WIREFRAME,
  logo: PAGES_LOGO,
};

export const PALETTE_LAYOUTS = {
  pages: PAGES,
} as const;

/** The layout the palette shows: Pages mode's, for its kind. */
function paletteLayoutFor(_mode: EditorMode, pagesKind: PaletteKind = 'design'): PaletteLayout {
  return PAGES_BY_KIND[pagesKind];
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

// The selection modes a Participant has: look and point, never an Editor's tools (Eraser, Format
// Painter).
export const PARTICIPANT_CANVAS_TOOLS: readonly string[] = [
  'select',
  'pan',
  'laser',
  'spotlight',
  'zen',
];
