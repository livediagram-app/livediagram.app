// The Pages sheets the canvas shows while a page slide presents
// (docs/specs/007-editor/pages-mode.md "Slides"): that page's sheet alone, the view narrowed to the page.
import type { PagesModeView } from '@/hooks/editor/usePagesMode';

export function presentedPages(
  view: PagesModeView,
  presentingPageId: string | null,
): PagesModeView {
  if (!presentingPageId) return view;
  return {
    ...view,
    pages: view.pages.filter((p) => p.id === presentingPageId),
    rowPages: view.pages,
    letterbox: true,
    // Presenting is reading: the writing takes no caret.
    articles: view.articles ? { ...view.articles, editable: false } : view.articles,
  };
}
