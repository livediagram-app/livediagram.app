// Which layouts a page offers (docs/specs/007-editor/illustrate-pages.md "Layouts", "Slide
// layouts"): an infographic page the page layouts, a slide page the slide layouts, each by its
// own categories; and any layout by its id, for placing it.
import type { Element } from '@livediagram/document';
import type { LayoutBox } from './page-layout-kit';
import { PAGE_LAYOUT_CATEGORIES, PAGE_LAYOUTS, type PageLayoutId } from './page-layouts';
import { SLIDE_LAYOUT_CATEGORIES, SLIDE_LAYOUTS } from './slide-layouts';

export type CatalogueLayout = {
  id: PageLayoutId;
  label: string;
  category: string;
  description: string;
  build: (box: LayoutBox) => Element[];
};

export type LayoutCatalogue = {
  categories: readonly { id: string; label: string }[];
  layouts: readonly CatalogueLayout[];
};

const INFOGRAPHIC: LayoutCatalogue = {
  categories: PAGE_LAYOUT_CATEGORIES,
  layouts: PAGE_LAYOUTS,
};
const SLIDE: LayoutCatalogue = { categories: SLIDE_LAYOUT_CATEGORIES, layouts: SLIDE_LAYOUTS };

/** The layouts a page of this kind starts from (an article page has none, and gets the
 *  infographic ones should it ever ask). */
export function layoutCatalogueFor(kind: 'infographic' | 'article' | 'slide'): LayoutCatalogue {
  return kind === 'slide' ? SLIDE : INFOGRAPHIC;
}

/** A layout by its id, from either catalogue (a reused layout is the same in both). */
export function pageLayoutById(id: PageLayoutId): CatalogueLayout {
  return (PAGE_LAYOUTS.find((l) => l.id === id) ?? SLIDE_LAYOUTS.find((l) => l.id === id))!;
}
