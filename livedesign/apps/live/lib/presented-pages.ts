// The Pages sheets the canvas shows while a page slide presents
// (docs/specs/007-editor/pages-mode.md "Slides"): that page's sheet alone. In the presenter's
// Pages mode it is the mode's own view narrowed to the page; in any other mode (modes are
// per person), the sheet is built from the tab, so a page slide always presents on its page.
import { pagesOf, layOutPages, tabWireframeFrameTheme, type Tab } from '@livedesign/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { getTheme } from '@/lib/themes';
import { themeAccent } from '@/lib/page-paint';

const noop = () => {};

export function presentedPages(
  view: PagesModeView | null,
  tab: Tab,
  presentingPageId: string | null,
): PagesModeView | null {
  if (!presentingPageId) return view;
  const only = <T extends { id: string }>(pages: readonly T[]) =>
    pages.filter((p) => p.id === presentingPageId);
  if (view)
    return {
      ...view,
      pages: only(view.pages),
      rowPages: view.pages,
      letterbox: true,
    };
  return {
    pages: only(layOutPages(pagesOf(tab))),
    rowPages: layOutPages(pagesOf(tab)),
    letterbox: true,
    focusPage: noop,
    fitPageInView: noop,
    themeBackgrounds: [],
    themeAccent: themeAccent(getTheme(tab.theme)),
    frameTheme: tabWireframeFrameTheme(tab),
    tabFont: tab.font,
    layoutPreview: null,
    setLayoutPreview: noop,
  };
}
