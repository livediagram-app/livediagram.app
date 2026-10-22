// Which layouts a page offers (docs/specs/007-editor/pages-mode.md "Layouts",
// docs/specs/007-editor/logo-pages.md "Logo layouts"): a logo page the logo layouts, a wireframe
// page its device class's, each by its own categories, a page whose kind is not chosen yet none;
// and any layout by its id, for placing it.
import type { Element } from '@livedesign/document';
import type { LayoutBox } from './page-layout-kit';
import type { PageLayoutId } from './page-layouts';
import { LOGO_LAYOUT_CATEGORIES, LOGO_LAYOUTS } from './logo-layouts';
import { WIREFRAME_LAYOUTS, wireframeLayoutsFor } from './wireframe-layouts';
import type { PageKind, WireframeDeviceClass } from '@livedesign/document';

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

const NONE: LayoutCatalogue = { categories: [], layouts: [] };
const LOGO: LayoutCatalogue = { categories: LOGO_LAYOUT_CATEGORIES, layouts: LOGO_LAYOUTS };

/** The layouts a page of this kind starts from; a wireframe page its device class's (every
 *  wireframe layout when no class is given). */
export function layoutCatalogueFor(
  kind: PageKind | null,
  deviceClass?: WireframeDeviceClass | null,
): LayoutCatalogue {
  if (kind === 'logo') return LOGO;
  if (kind === 'wireframe') return wireframeLayoutsFor(deviceClass);
  return NONE;
}

/** A layout by its id, from any catalogue (a reused layout is the same in each). */
export function pageLayoutById(id: PageLayoutId): CatalogueLayout {
  return (LOGO_LAYOUTS.find((l) => l.id === id) ?? WIREFRAME_LAYOUTS.find((l) => l.id === id))!;
}
