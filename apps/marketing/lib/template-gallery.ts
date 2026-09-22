import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  templateCategory,
  type TemplateCategory,
  type TemplateDescriptor,
  type TemplateKind,
} from '@livediagram/templates';

// The landing page's template gallery (spec/16): one card per template the
// editor ships, each a link that creates that diagram straight away
// (/new?template=<kind>, spec/14). The data half lives here so the list and
// the filter can be tested without rendering the section.

export type GalleryTemplate = TemplateDescriptor & {
  category: TemplateCategory;
  categoryLabel: string;
};

// Every listed template but Blank: Blank is what the hero's "Just Draw"
// already offers, and a "what will you draw first" card for an empty canvas
// answers nothing. Hidden templates never appear in a listing (spec/09).
export function galleryTemplates(): GalleryTemplate[] {
  const labels = new Map(TEMPLATE_CATEGORIES.map((c) => [c.id, c.label]));
  return TEMPLATES.filter((t) => !t.hidden && t.kind !== 'blank').map((t) => {
    const category = templateCategory(t.kind);
    return { ...t, category, categoryLabel: labels.get(category) ?? category };
  });
}

// Case-insensitive word match over the title, the description and the
// category name, every typed word having to hit somewhere ("agile board"
// finds Kanban through its category and description). An empty query is
// the whole gallery.
export function filterGallery(items: GalleryTemplate[], query: string): GalleryTemplate[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((t) => {
    const haystack = `${t.title} ${t.description} ${t.categoryLabel}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

// Group in catalogue category order, dropping categories the filter emptied.
export function groupGallery(
  items: GalleryTemplate[],
): { id: TemplateCategory; label: string; templates: GalleryTemplate[] }[] {
  return TEMPLATE_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    templates: items.filter((t) => t.category === c.id),
  })).filter((g) => g.templates.length > 0);
}

// The editor URL that commits this template without the wizard (spec/14).
export function templateCreateHref(kind: TemplateKind): string {
  return `/new?template=${encodeURIComponent(kind)}`;
}
