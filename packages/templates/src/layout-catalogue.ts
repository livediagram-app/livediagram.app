// Which layouts a page offers (docs/specs/007-editor/pages-mode.md "Layouts", "Slide
// layouts", docs/specs/007-editor/logo-pages.md "Logo layouts"): an infographic page the page
// layouts, a slide page the slide layouts, a logo page the logo layouts, each by its own
// categories; and any layout by its id, for placing it.
import type { Element } from '@livediagram/document';
import type { LayoutBox } from './page-layout-kit';
import { PAGE_LAYOUT_CATEGORIES, PAGE_LAYOUTS, type PageLayoutId } from './page-layouts';
import { LOGO_LAYOUT_CATEGORIES, LOGO_LAYOUTS } from './logo-layouts';
import { SLIDE_LAYOUT_CATEGORIES, SLIDE_LAYOUTS } from './slide-layouts';
import { WIREFRAME_LAYOUTS, wireframeLayoutsFor } from './wireframe-layouts';
import type { WireframeDeviceClass } from '@livediagram/document';

type CatalogueLayout = {
  id: PageLayoutId;
  label: string;
  category: string;
  description: string;
  build: (box: LayoutBox) => Element[];
};

type LayoutCatalogue = {
  categories: readonly { id: string; label: string }[];
  layouts: readonly CatalogueLayout[];
};

const INFOGRAPHIC: LayoutCatalogue = {
  categories: PAGE_LAYOUT_CATEGORIES,
  layouts: PAGE_LAYOUTS,
};
const SLIDE: LayoutCatalogue = { categories: SLIDE_LAYOUT_CATEGORIES, layouts: SLIDE_LAYOUTS };
const LOGO: LayoutCatalogue = { categories: LOGO_LAYOUT_CATEGORIES, layouts: LOGO_LAYOUTS };

/** The layouts a page of this kind starts from (an article page has none, and gets the
 *  infographic ones should it ever ask); a wireframe page its device class's (every wireframe
 *  layout when no class is given). */
export function layoutCatalogueFor(
  kind: 'infographic' | 'article' | 'slide' | 'logo' | 'wireframe',
  deviceClass?: WireframeDeviceClass | null,
): LayoutCatalogue {
  if (kind === 'slide') return SLIDE;
  if (kind === 'logo') return LOGO;
  if (kind === 'wireframe') return wireframeLayoutsFor(deviceClass);
  return INFOGRAPHIC;
}

/** A layout by its id, from any catalogue (a reused layout is the same in each). */
export function pageLayoutById(id: PageLayoutId): CatalogueLayout {
  return (PAGE_LAYOUTS.find((l) => l.id === id) ??
    SLIDE_LAYOUTS.find((l) => l.id === id) ??
    LOGO_LAYOUTS.find((l) => l.id === id) ??
    WIREFRAME_LAYOUTS.find((l) => l.id === id))!;
}
