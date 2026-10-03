// A page layout built for one page (docs/specs/007-editor/infographic-pages.md "Layouts"): laid out
// in the page's content box, the page less its margins. Shared by placing a layout, its picker
// tile and its hover preview, so all three show the same arrangement.
import { pageMargin, type Element, type LaidOutPage } from '@livediagram/document';
import { pageLayoutById, type PageLayoutId } from '@livediagram/templates';

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
