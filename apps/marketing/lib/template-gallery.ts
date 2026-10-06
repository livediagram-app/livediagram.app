import type { EditorMode } from '@livediagram/document';
import {
  POPULAR_TEMPLATE_KINDS,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  isBlankTemplate,
  templateCategory,
  templateEditorMode,
  type TemplateCategory,
  type TemplateDescriptor,
  type TemplateKind,
} from '@livediagram/templates';

// The landing page's template gallery (docs/specs/019-marketing/marketing-site.md): every template
// the editor ships, each a link that creates that document straight away (/new?template=<kind>,
// docs/specs/007-editor/new-document-route.md), laid out as the editor's template step lays them
// out (docs/specs/008-canvas/canvas-and-palette.md "Templates"): Popular first (the four blanks,
// then the starters most people reach for), then one shelf per category. The data half lives here
// so the lists and the filters can be tested without rendering the section.

export type GalleryTemplate = TemplateDescriptor & {
  category: TemplateCategory;
  categoryLabel: string;
  // The editor mode the template opens in (docs/specs/007-editor/templates-by-mode.md).
  mode: EditorMode;
};

// The open shelf: Popular, or a category.
export type ShelfId = 'popular' | TemplateCategory;

export type GalleryShelf = { id: ShelfId; label: string; templates: GalleryTemplate[] };

// Everything, or one editor mode (the gallery's mode filter, as the template step's).
export type ModeChoice = 'all' | EditorMode;

export const POPULAR_LABEL = 'Popular';

const LABELS = new Map(TEMPLATE_CATEGORIES.map((c) => [c.id, c.label]));
const BY_KIND = new Map(TEMPLATES.map((t) => [t.kind, t]));

function toGallery(t: TemplateDescriptor): GalleryTemplate {
  const category = templateCategory(t.kind);
  return {
    ...t,
    category,
    categoryLabel: LABELS.get(category) ?? category,
    mode: templateEditorMode(t.kind),
  };
}

// Every listed template on a category shelf: hidden templates never appear in a listing, and the
// four blanks are only ever on Popular, never on a category shelf
// (docs/specs/007-editor/templates-by-mode.md "Four blanks").
export function galleryTemplates(): GalleryTemplate[] {
  return TEMPLATES.filter((t) => !t.hidden && !isBlankTemplate(t.kind)).map(toGallery);
}

// Popular, in its fixed order, the four blanks first.
export function popularTemplates(): GalleryTemplate[] {
  return POPULAR_TEMPLATE_KINDS.flatMap((kind) => {
    const t = BY_KIND.get(kind);
    return t && !t.hidden ? [toGallery(t)] : [];
  });
}

// Case-insensitive word match over the title, the description and the category name, every typed
// word having to hit somewhere ("agile board" finds Kanban through its category and description).
// An empty query is the whole list.
export function filterGallery(items: GalleryTemplate[], query: string): GalleryTemplate[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((t) => {
    const haystack = `${t.title} ${t.description} ${t.categoryLabel}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
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
// filters emptied.
export function groupGallery(items: GalleryTemplate[]): GalleryShelf[] {
  return TEMPLATE_CATEGORIES.map((c) => ({
    id: c.id as ShelfId,
    label: c.label,
    templates: items.filter((t) => t.category === c.id).sort(byShelfRank),
  })).filter((g) => g.templates.length > 0);
}

// Popular under a mode filter: Popular's own templates of that mode (its blank first), topped up
// from the mode's best so it never shows fewer than POPULAR_PER_MODE. Everything keeps Popular as
// the catalogue lists it.
export const POPULAR_PER_MODE = 5;
const MODE_BEST: Readonly<Record<EditorMode, readonly TemplateKind[]>> = {
  diagram: ['swot', 'timeline', 'flowchart'],
  draw: ['journey-doodle', 'comic-strip', 'idea-garden', 'rich-picture'],
  illustrate: ['event-poster', 'year-in-review', 'social-carousel', 'data-story'],
  plan: ['kanban', 'team-retro', 'sprint-board', 'roadmap-board'],
};

export function popularFor(choice: ModeChoice): GalleryTemplate[] {
  const popular = byMode(popularTemplates(), choice);
  if (choice === 'all' || popular.length >= POPULAR_PER_MODE) return popular;
  const have = new Set(popular.map((t) => t.kind));
  const extra = MODE_BEST[choice].flatMap((kind) => {
    const t = BY_KIND.get(kind);
    return t && !t.hidden && !have.has(kind) && templateEditorMode(kind) === choice
      ? [toGallery(t)]
      : [];
  });
  return [...popular, ...extra].slice(0, Math.max(POPULAR_PER_MODE, popular.length));
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

// A search's shelves: the matching blanks under Popular (the only shelf they are on), then every
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
    ...groupGallery(byMode(filterGallery(galleryTemplates(), query), choice)),
  ];
}
