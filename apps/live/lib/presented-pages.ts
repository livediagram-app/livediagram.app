// The Pages sheets the canvas shows while a page slide presents
// (docs/specs/007-editor/pages-mode.md "Slides"): that page's sheet alone. In the presenter's
// Pages mode it is the mode's own view narrowed to the page; in any other mode (modes are
// per person), the sheet is built from the tab, so a page slide always presents on its page.
import { pagesOf, layOutPages, type Tab } from '@livediagram/document';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import type { ArticlesView } from '@/hooks/editor/useArticles';
import { getTheme } from '@/lib/themes';
import { themeAccent } from '@/lib/page-paint';

const noop = () => {};

export function presentedPages(
  view: PagesModeView | null,
  tab: Tab,
  presentingPageId: string | null,
  // The tab's writing (useArticles), for an article page presenting outside Pages mode.
  articles: ArticlesView | null = null,
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
      // Presenting is reading: the writing takes no caret.
      articles: view.articles ? { ...view.articles, editable: false } : view.articles,
    };
  return {
    pages: only(layOutPages(pagesOf(tab))),
    rowPages: layOutPages(pagesOf(tab)),
    letterbox: true,
    // Presenting is reading: the writing takes no caret.
    ...(articles ? { articles: { ...articles, editable: false } } : {}),
    focusPage: noop,
    fitPageInView: noop,
    readPage: noop,
    themeBackgrounds: [],
    themeAccent: themeAccent(getTheme(tab.theme)),
    tabFont: tab.font,
    layoutPreview: null,
    setLayoutPreview: noop,
  };
}
