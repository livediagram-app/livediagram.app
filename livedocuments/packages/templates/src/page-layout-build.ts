// A page layout built for one page (docs/specs/007-editor/pages-mode.md "Layouts"): laid out
// in the page's content box: the page less its margins. Shared by placing a layout, its picker
// tile and its hover preview, so all three show the same arrangement.
import {
  pageContentBox,
  pageMargin,
  settleChips,
  type Element,
  type LaidOutPage,
} from '@livedocuments/document';
import { pageLayoutById } from './layout-catalogue';
import { softenLayoutBoxes } from './layout-soft-boxes';
import { fitLayoutText } from './layout-text-fit';
import { carryPageContent } from './page-layout-carry';
import type { PageLayoutId } from './page-layouts';

type LayoutPage = Pick<LaidOutPage, 'rect' | 'orientation' | 'size'>;

export function buildPageLayout(layout: PageLayoutId, page: LayoutPage): Element[] {
  // Settled as a template is (build-template.ts): a layout's steps are sized after they're made.
  // A slide's picture or panel may run to the page's own edge (a full bleed): the margin is how far.
  const built = pageLayoutById(layout).build({
    ...pageContentBox(page),
    bleed: pageMargin(page),
  });
  // Its boxes soft panels in the theme's Soft look (layout-soft-boxes.ts), its words fitted to their boxes
  // (layout-text-fit.ts).
  const soft = softenLayoutBoxes(built, Math.min(page.rect.width, page.rect.height));
  return settleChips([], fitLayoutText(soft), { attachLoose: false });
}

/** The layout built for the page with the page's own content carried into it (`previous`, the
 *  elements on the page now): what placing it lands, and what its hover preview shows. */
export function buildPageLayoutOver(
  layout: PageLayoutId,
  page: LayoutPage,
  previous: readonly Element[],
): Element[] {
  const placed = buildPageLayout(layout, page);
  return previous.length ? carryPageContent(previous, placed) : placed;
}
