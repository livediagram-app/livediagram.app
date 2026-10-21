// What the layout gallery shows (docs/specs/007-editor/pages-mode.md "The layout gallery"): a
// page's layouts narrowed by the chosen category and the words typed, grouped into sections while
// nothing narrows them, and the layout Surprise Me lands on. Pure, so each rule is tested alone.
import type { PageLayoutId } from '@liveplanner/templates';

export type GalleryLayout = {
  id: PageLayoutId;
  label: string;
  description: string;
  category: string;
};

export type GalleryCategory = { id: string; label: string };

/** Every category: the gallery's first chip, which shows the layouts in their sections. */
export const ALL_LAYOUTS = 'all';

export type GallerySection = {
  // The category's id, or null for one unnamed run of results (a search, or one category).
  id: string | null;
  label: string | null;
  layouts: readonly GalleryLayout[];
};

/** The words typed, lower case and split on spaces: every word must match somewhere. */
function words(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Whether a layout answers every word typed, in its name, its description or its category. */
export function matchesQuery(layout: GalleryLayout, categoryLabel: string, query: string): boolean {
  const hay = `${layout.label} ${layout.description} ${categoryLabel}`.toLowerCase();
  return words(query).every((w) => hay.includes(w));
}

/** The layouts the gallery shows, as sections: under All with nothing typed, one section a
 *  category (an empty category left out); otherwise one unnamed run, in catalogue order. */
export function gallerySections(
  layouts: readonly GalleryLayout[],
  categories: readonly GalleryCategory[],
  category: string,
  query: string,
): GallerySection[] {
  const labelOf = new Map(categories.map((c) => [c.id, c.label]));
  const inCategory = (l: GalleryLayout) => category === ALL_LAYOUTS || l.category === category;
  const shown = layouts.filter(
    (l) => inCategory(l) && matchesQuery(l, labelOf.get(l.category) ?? '', query),
  );
  if (category !== ALL_LAYOUTS || words(query).length > 0) {
    return shown.length ? [{ id: null, label: null, layouts: shown }] : [];
  }
  return categories
    .map((c) => ({ id: c.id, label: c.label, layouts: shown.filter((l) => l.category === c.id) }))
    .filter((s) => s.layouts.length > 0);
}

/** How many layouts each chip stands for: All, then each category, an empty one left out. */
export function categoryCounts(
  layouts: readonly GalleryLayout[],
  categories: readonly GalleryCategory[],
): { id: string; label: string; count: number }[] {
  return [
    { id: ALL_LAYOUTS, label: 'All', count: layouts.length },
    ...categories
      .map((c) => ({ ...c, count: layouts.filter((l) => l.category === c.id).length }))
      .filter((c) => c.count > 0),
  ];
}

/** Surprise Me: one of the layouts shown, never the one it landed on last while there is another
 *  to land on. `random` is in [0, 1). Null when nothing is shown. */
export function surprisePick(
  shown: readonly GalleryLayout[],
  last: PageLayoutId | null,
  random: number,
): PageLayoutId | null {
  const pool = shown.length > 1 ? shown.filter((l) => l.id !== last) : shown;
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(random * pool.length))]!.id;
}
