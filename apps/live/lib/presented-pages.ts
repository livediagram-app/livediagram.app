// The Infographic sheets the canvas shows while a page slide presents
// (docs/specs/007-editor/infographic-pages.md "Slides"): that page's sheet alone. In the presenter's
// Infographic mode it is the mode's own view narrowed to the page; in any other mode (modes are
// per person), the sheet is built from the tab, so a page slide always presents on its page.
import { infographicPagesOf, layOutInfographicPages, type Tab } from '@livediagram/document';
import type { InfographicPagesView } from '@/hooks/editor/useInfographicPage';

const noop = () => {};

export function presentedPages(
  view: InfographicPagesView | null,
  tab: Tab,
  presentingPageId: string | null,
): InfographicPagesView | null {
  if (!presentingPageId) return view;
  const only = <T extends { id: string }>(pages: readonly T[]) =>
    pages.filter((p) => p.id === presentingPageId);
  if (view) return { ...view, pages: only(view.pages) };
  return {
    pages: only(layOutInfographicPages(infographicPagesOf(tab))),
    focusPage: noop,
    themeBackgrounds: [],
    tabFont: tab.font,
    layoutPreview: null,
    setLayoutPreview: noop,
  };
}
