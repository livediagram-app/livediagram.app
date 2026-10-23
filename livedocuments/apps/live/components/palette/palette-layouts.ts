// The palette per page kind (docs/specs/007-editor/pages-mode.md "The palette's kind"): which
// categories each kind's palette offers, in order, what each is called there, and which tiles it
// holds. A category's identity (its glyph, and the label, blurb and band it wears by default)
// lives in PALETTE_CATEGORIES; a tile's identity in PALETTE_TILES. A layout only arranges them,
// so the same tile can sit in different categories in different kinds, and a category can be
// renamed or re-filled for one kind without touching another.
//
// An entry with no `tiles` holds its category's own tiles (tilesForCategory), so a layout spells
// out only where a kind differs. The catalogue categories (Icons, Stickers, Tech) are
// bodies with their own content and take no tile list.
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
  categories: readonly PaletteLayoutEntry[];
};

// The categories whose body is its own content rather than a list of tiles.
export const CATALOGUE_CATEGORIES: ReadonlySet<string> = new Set([
  'icons',
  'stickers',
  'technology',
]);

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

// The Pages palette's Write.
const PAGES_WRITE = tilesForCategory('write').map((t) => t.id);

// Pages mode: the mock-up kit, glyphs, stickers, pictures and charts; no pens, tech icons or
// behaviours.
const PAGES: PaletteLayout = {
  categories: [
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

// The Pages palette by its kind (docs/specs/007-editor/pages-mode.md "The palette's kind"): Design is PAGES; a slide
// has its own, offering what a slide is made of and nothing it has no use for.
// Every tile is in one category.

// A slide (docs/specs/007-editor/pages-mode.md "The palette's kind"): what a talk is told with. Words, shapes, pictures
// and the embeds a talk plays first (Common), then what explains a point (Structure: charts, concept graphics, ready-made
// blocks and device frames for a screenshot), then the decorations; no website Header.
const PAGES_SLIDE: PaletteLayout = {
  categories: [
    { id: 'write', tiles: PAGES_WRITE },
    { id: 'shapes' },
    // Pictures and the embeds a talk plays (a video, a prototype, a page), in Common: a slide reaches for them first.
    { id: 'media', band: 0 },
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

export const PALETTE_LAYOUTS: Readonly<Record<PaletteKind, PaletteLayout>> = {
  design: PAGES,
  slide: PAGES_SLIDE,
  // An article's strip is its formatting (the docked page toolbar); its Search keeps Pages'.
  article: PAGES,
};

/** The layout the palette shows, for its kind. */
function paletteLayoutFor(pagesKind: PaletteKind = 'design'): PaletteLayout {
  return PALETTE_LAYOUTS[pagesKind];
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

/** The categories the palette offers for its kind (`pagesKind`), in order, with their tiles. */
export function paletteCategoriesFor({
  pagesKind,
}: { pagesKind?: PaletteKind } = {}): ResolvedPaletteCategory[] {
  return paletteLayoutFor(pagesKind).categories.map(resolve);
}

/** Whether the palette offers category `id`. */
export function paletteCategoryOffered(id: string): boolean {
  return paletteLayoutFor().categories.some((e) => e.id === id);
}
