import type { EditorMode } from '@livehuddle/document';
import { EDITOR_MODES, seededRandom } from '@livehuddle/document';
import {
  BLANK_TEMPLATE_FOR_MODE,
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
} from '@livehuddle/templates';

// The landing page's template gallery (docs/specs/019-marketing/marketing-site.md): every template
// the editor ships, each a link that creates that document straight away (/new?template=<kind>,
// docs/specs/007-editor/new-document-route.md), laid out as the editor's template step lays them
// out (docs/specs/008-canvas/canvas-and-palette.md "Templates") but led by Office: one shelf per
// category, Office first, then Blank Slate last (the blank and nothing else: livehuddle has one
// mode, so one blank). The data half lives here so the lists and the filters can be tested
// without rendering the section.

export type GalleryTemplate = TemplateDescriptor & {
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
    mode: templateEditorMode(t.kind),
  };
}

// Every listed template on a category shelf: hidden templates never appear in a listing, and the
// blanks are only ever on Blank Slate, never on a category shelf
// (docs/specs/007-editor/templates-by-mode.md "The blank").
export function galleryTemplates(): GalleryTemplate[] {
  return TEMPLATES.filter((t) => !t.hidden && !isBlankTemplate(t.kind)).map(toGallery);
}

// Blank Slate's blanks, one per editor mode: livehuddle's one, Blank Space.
const BLANK_SLATE_KINDS = EDITOR_MODES.map((mode) => BLANK_TEMPLATE_FOR_MODE[mode]);

// Blank Slate: every blank and nothing else, in its fixed order.
export function popularTemplates(): GalleryTemplate[] {
  return BLANK_SLATE_KINDS.flatMap((kind) => {
    const t = BY_KIND.get(kind);
    return t && !t.hidden ? [toGallery(t)] : [];
  });
}

// The editor's own search (templateMatchesQuery): every typed word has to hit the title, the description, the
// kind, a category name or the template's search words ("office" finds every Virtual Spaces template). An empty query is the whole list.
export function filterGallery(items: GalleryTemplate[], query: string): GalleryTemplate[] {
  if (templateQueryWords(query).length === 0) return items;
  return items.filter((t) => templateMatchesQuery(t, query));
}

// The order the cards sit in on each category shelf: the catalogue's order is the order templates
// were added, so like ones bunch together; the gallery mixes them, with a fixed seed, so the order
// is shuffled once and the same on every build and every visit (no layout shift, nothing to
// hydrate differently). Change the seed to deal a new order.
const SHUFFLE_SEED = 20261103;

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

// The category the gallery leads with and opens on: the landing page sells a place to meet, so
// it opens on the offices, never on a blank. The catalogue's own order (TEMPLATE_CATEGORIES,
// alphabetical) is untouched, as the editor reads it; only this gallery moves Office up.
export const LEAD_CATEGORY: TemplateCategory = 'office';

const GALLERY_CATEGORIES = [
  ...TEMPLATE_CATEGORIES.filter((c) => c.id === LEAD_CATEGORY),
  ...TEMPLATE_CATEGORIES.filter((c) => c.id !== LEAD_CATEGORY),
];

// Group in the gallery's category order (Office, then the catalogue's alphabetical order), each
// shelf in its dealt order, dropping empty categories. A template shows on every category it is
// listed in (cross-listing).
export function groupGallery(items: GalleryTemplate[]): GalleryShelf[] {
  return GALLERY_CATEGORIES.map((c) => ({
    id: c.id as ShelfId,
    label: c.label,
    templates: items.filter((t) => t.categories.includes(c.id)).sort(byShelfRank),
  })).filter((g) => g.templates.length > 0);
}

// Every category, Office first, then Blank Slate last: the hero's Open a Space already opens a
// blank, so the gallery leads with something drawn. The gallery only browses.
export function galleryShelves(): GalleryShelf[] {
  return [
    ...groupGallery(galleryTemplates()),
    { id: 'popular' as const, label: POPULAR_LABEL, templates: popularTemplates() },
  ];
}
