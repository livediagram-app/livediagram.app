// A page layout built for one page (docs/specs/007-editor/illustrate-pages.md "Layouts"): laid out
// in the page's content box, the page less its margins. Shared by placing a layout, its picker
// tile and its hover preview, so all three show the same arrangement.
import { pageMargin, type Element, type LaidOutPage } from '@livediagram/document';
import { pageLayoutById } from './layout-catalogue';
import { carryPageContent } from './page-layout-carry';
import type { PageLayoutId } from './page-layouts';

export function buildPageLayout(
  layout: PageLayoutId,
  page: Pick<LaidOutPage, 'rect' | 'orientation' | 'size'>,
): Element[] {
  const m = pageMargin(page);
  const { x, y, width, height } = page.rect;
  return pageLayoutById(layout).build({
    x: x + m,
    y: y + m,
    width: width - 2 * m,
    height: height - 2 * m,
  });
}

/** The layout built for the page with the page's own content carried into it (`previous`, the
 *  elements on the page now): what placing it lands, and what its hover preview shows. */
export function buildPageLayoutOver(
  layout: PageLayoutId,
  page: Pick<LaidOutPage, 'rect' | 'orientation' | 'size'>,
  previous: readonly Element[],
): Element[] {
  const placed = buildPageLayout(layout, page);
  return previous.length ? carryPageContent(previous, placed) : placed;
}
