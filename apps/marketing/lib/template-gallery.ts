import type { EditorMode } from '@livediagram/document';
import { EDITOR_MODES } from '@livediagram/document';
import {
  BLANK_TEMPLATE_FOR_MODE,
  EXTRA_BLANK_TEMPLATES,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  isBlankTemplate,
  templateCategories,
  templateCategoryLabel,
  templateEditorMode,
  templateMatchesQuery,
  templateQueryWords,
  type TemplateCategory,
  type TemplateDescriptor,
} from '@livediagram/templates';

// The landing page's template gallery (docs/specs/019-marketing/marketing-site.md): every template
// the editor ships, each a link that creates that document straight away (/new?template=<kind>,
// docs/specs/007-editor/new-document-route.md), laid out as the editor's template step lays them
// out (docs/specs/008-canvas/canvas-and-palette.md "Templates"): Blank Slate first (every blank and nothing else: each
// mode's, and Blank Spreadsheet), then one shelf per category. The data half lives here
// so the lists and the filters can be tested without rendering the section.

type GalleryTemplate = TemplateDescriptor & {
  // Its primary category (docs/specs/008-canvas/canvas-and-palette.md "Template categories"), then any it is
  // cross-listed in; a blank has none.
  category: TemplateCategory | null;
  categories: readonly TemplateCategory[];
  categoryLabel: string;
  // The editor mode the template opens in (docs/specs/007-editor/templates-by-mode.md).
  mode: EditorMode;
};

// The open shelf: Blank Slate (its id `popular`, the shelf it replaced), or a category.
export type ShelfId = 'popular' | TemplateCategory;

export type GalleryShelf = { id: ShelfId; label: string; templates: GalleryTemplate[] };

// Everything, or one editor mode (the gallery's mode filter, as the template step's).
export type ModeChoice = 'all' | EditorMode;

const POPULAR_LABEL = 'Blank Slate';

const BY_KIND = new Map(TEMPLATES.map((t) => [t.kind, t]));

function toGallery(t: TemplateDescriptor): GalleryTemplate {
  const categories = templateCategories(t.kind);
  const category = categories[0] ?? null;
  return {
    ...t,
    category,
    categories,
    categoryLabel: category ? templateCategoryLabel(category) : '',
    mode: templateEditorMode(t.kind),
  };
}

// Every listed template on a category shelf: hidden templates never appear in a listing, and the
// blanks are only ever on Blank Slate, never on a category shelf
// (docs/specs/007-editor/templates-by-mode.md "Five blanks").
export function galleryTemplates(): GalleryTemplate[] {
  return TEMPLATES.filter((t) => !t.hidden && !isBlankTemplate(t.kind)).map(toGallery);
}

// Blanks the row already shows by another name: Blank Infographic is Blank Illustration's own
// empty infographic page, so it is left off rather than shown twice.
const SHOWN_AS_ANOTHER_BLANK: readonly string[] = ['blank-infographic'];

// Blank Slate's blanks in mode order (the mode switch's), Blank Spreadsheet beside Blank Plan.
const BLANK_SLATE_KINDS = EDITOR_MODES.flatMap((mode) => [
  BLANK_TEMPLATE_FOR_MODE[mode],
  ...EXTRA_BLANK_TEMPLATES.filter(
    (k) => templateEditorMode(k) === mode && !SHOWN_AS_ANOTHER_BLANK.includes(k),
  ),
]);

// Blank Slate: every blank and nothing else, in its fixed order.
export function popularTemplates(): GalleryTemplate[] {
  return BLANK_SLATE_KINDS.flatMap((kind) => {
    const t = BY_KIND.get(kind);
    return t && !t.hidden ? [toGallery(t)] : [];
  });
}

// The editor's own search (templateMatchesQuery): every typed word has to hit the title, the description, the
// kind, a category name or the template's search words ("plan board" finds Kanban through its category, "mortgage"
// the Loan Calculator through its words). An empty query is the whole list.
export function filterGallery(items: GalleryTemplate[], query: string): GalleryTemplate[] {
  if (templateQueryWords(query).length === 0) return items;
  return items.filter((t) => templateMatchesQuery(t, query));
}

// Only the templates of one mode; Everything keeps them all.
export function byMode(items: GalleryTemplate[], choice: ModeChoice): GalleryTemplate[] {
  return choice === 'all' ? items : items.filter((t) => t.mode === choice);
}

// How many templates each choice holds, across Popular and every category (each counted once).
export function modeCounts(): Record<ModeChoice, number> {
  const out: Record<ModeChoice, number> = {
    all: 0,
    diagram: 0,
    draw: 0,
    illustrate: 0,
    plan: 0,
    facilitate: 0,
  };
  const seen = new Set<string>();
  for (const t of [...popularTemplates(), ...galleryTemplates()]) {
    if (seen.has(t.kind)) continue;
    seen.add(t.kind);
    out.all += 1;
    out[t.mode] += 1;
  }
  return out;
}

// The order the cards sit in on each category shelf: the catalogue's order is the order templates
// were added, so like ones bunch together; the gallery mixes them, with a fixed seed, so the order
// is shuffled once and the same on every build and every visit (no layout shift, nothing to
// hydrate differently). Change the seed to deal a new order.
const SHUFFLE_SEED = 20261004;

// mulberry32: a tiny seeded PRNG, enough to deal a stable order.
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Each template's place on its shelf, dealt once from the whole catalogue.
const SHELF_RANK: ReadonlyMap<string, number> = (() => {
  const kinds = TEMPLATES.map((t) => t.kind);
  const random = seeded(SHUFFLE_SEED);
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
  }
  return new Map(kinds.map((k, i) => [k, i]));
})();
const byShelfRank = (a: GalleryTemplate, b: GalleryTemplate) =>
  (SHELF_RANK.get(a.kind) ?? 0) - (SHELF_RANK.get(b.kind) ?? 0);

// Group in catalogue category order, each shelf in its dealt order, dropping categories the
// filters emptied. Browsing shows a template on every category it is shown in (cross-listing); a
// search groups each match under its primary only, so no result shows twice.
export function groupGallery(
  items: GalleryTemplate[],
  { primaryOnly = false }: { primaryOnly?: boolean } = {},
): GalleryShelf[] {
  return TEMPLATE_CATEGORIES.map((c) => ({
    id: c.id as ShelfId,
    label: c.label,
    templates: items
      .filter((t) => (primaryOnly ? t.category === c.id : t.categories.includes(c.id)))
      .sort(byShelfRank),
  })).filter((g) => g.templates.length > 0);
}

// Blank Slate under a mode filter: that mode's blanks (Plan: Blank Plan and Blank Spreadsheet).
export function popularFor(choice: ModeChoice): GalleryTemplate[] {
  return byMode(popularTemplates(), choice);
}

// Popular and every category, under the mode filter, emptied shelves dropped.
export function galleryShelves(choice: ModeChoice): GalleryShelf[] {
  const popular = popularFor(choice);
  return [
    ...(popular.length > 0
      ? [{ id: 'popular' as const, label: POPULAR_LABEL, templates: popular }]
      : []),
    ...groupGallery(byMode(galleryTemplates(), choice)),
  ];
}

// A search's shelves: the matching blanks under Blank Slate (the only shelf they are on), then every
// category with a match, all under the mode filter.
export function searchShelves(query: string, choice: ModeChoice): GalleryShelf[] {
  const blanks = byMode(
    filterGallery(
      popularTemplates().filter((t) => isBlankTemplate(t.kind)),
      query,
    ),
    choice,
  );
  return [
    ...(blanks.length > 0
      ? [{ id: 'popular' as const, label: POPULAR_LABEL, templates: blanks }]
      : []),
    ...groupGallery(byMode(filterGallery(galleryTemplates(), query), choice), {
      primaryOnly: true,
    }),
  ];
}
