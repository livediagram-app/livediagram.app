import { seededRandom } from '@liveplanner/project';
import {
  BLANK_TEMPLATES,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  isBlankTemplate,
  isPlanTemplate,
  templateCategories,
  templateCategoryLabel,
  templateMatchesQuery,
  templateQueryWords,
  type TemplateCategory,
  type TemplateDescriptor,
} from '@liveplanner/templates';

// The landing page's template gallery (docs/specs/019-marketing/marketing-site.md): every template
// the editor ships in Plan, each a link that creates that project straight away (/new?template=<kind>,
// docs/specs/007-editor/new-project-route.md), laid out as the editor's template step lays them
// out (docs/specs/008-canvas/canvas-and-palette.md "Templates"): Blank Slate first (the Plan blanks and nothing
// else: Blank Plan, Blank Spreadsheet and Blank Form), then one shelf per category. The data half lives here
// so the lists and the filters can be tested without rendering the section.

export type GalleryTemplate = TemplateDescriptor & {
  // Its primary category (docs/specs/008-canvas/canvas-and-palette.md "Template categories"), then any it is
  // cross-listed in; a blank has none.
  category: TemplateCategory | null;
  categories: readonly TemplateCategory[];
  categoryLabel: string;
};

// The open shelf: Blank Slate (its id `popular`, the shelf it replaced), or a category.
export type ShelfId = 'popular' | TemplateCategory;

export type GalleryShelf = { id: ShelfId; label: string; templates: GalleryTemplate[] };

const POPULAR_LABEL = 'Blank Slate';

const BY_KIND = new Map(TEMPLATES.map((t) => [t.kind, t]));

export function toGallery(t: TemplateDescriptor): GalleryTemplate {
  const categories = templateCategories(t.kind);
  const category = categories[0] ?? null;
  return {
    ...t,
    category,
    categories,
    categoryLabel: category ? templateCategoryLabel(category) : '',
  };
}

// The gallery lists only the templates Plan offers (docs/specs/019-marketing/marketing-site.md "Template gallery":
// boards, sheets and forms; isPlanTemplate); the catalogue's other templates are never offered.

// Every listed Plan template on a category shelf: hidden templates never appear in a listing, and the
// blanks are only ever on Blank Slate, never on a category shelf
// (docs/specs/007-editor/templates-by-mode.md "Five blanks").
export function galleryTemplates(): GalleryTemplate[] {
  return TEMPLATES.filter(
    (t) => !t.hidden && !isBlankTemplate(t.kind) && isPlanTemplate(t.kind),
  ).map(toGallery);
}

// Blank Slate's blanks: Blank Plan, then the Plan blanks beside it (Blank Spreadsheet, Blank Form).
const BLANK_SLATE_KINDS = BLANK_TEMPLATES.filter(isPlanTemplate);

// Blank Slate: every Plan blank and nothing else, in its fixed order.
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

// The order the cards sit in on each category shelf: the catalogue's order is the order templates
// were added, so like ones bunch together; the gallery mixes them, with a fixed seed, so the order
// is shuffled once and the same on every build and every visit (no layout shift, nothing to
// hydrate differently). Change the seed to deal a new order.
const SHUFFLE_SEED = 20261122;

// Each template's place on its shelf, dealt once from the whole catalogue.
const SHELF_RANK: ReadonlyMap<string, number> = (() => {
  const kinds = TEMPLATES.map((t) => t.kind);
  const random = seededRandom(SHUFFLE_SEED);
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
  }
  return new Map(kinds.map((k, i) => [k, i]));
})();
const byShelfRank = (a: GalleryTemplate, b: GalleryTemplate) =>
  (SHELF_RANK.get(a.kind) ?? 0) - (SHELF_RANK.get(b.kind) ?? 0);

// Group in catalogue category order, each shelf in its dealt order, dropping empty categories. A
// template shows on every category it is listed in (cross-listing).
export function groupGallery(items: GalleryTemplate[]): GalleryShelf[] {
  return TEMPLATE_CATEGORIES.map((c) => ({
    id: c.id as ShelfId,
    label: c.label,
    templates: items.filter((t) => t.categories.includes(c.id)).sort(byShelfRank),
  })).filter((g) => g.templates.length > 0);
}

// Blank Slate, then every category. Searching lives in the hero (lib/hero-starts.ts), so the gallery
// only browses.
export function galleryShelves(): GalleryShelf[] {
  return [
    { id: 'popular' as const, label: POPULAR_LABEL, templates: popularTemplates() },
    ...groupGallery(galleryTemplates()),
  ];
}
