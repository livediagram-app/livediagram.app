// A layout placed on a page (docs/specs/007-editor/pages-mode.md "Layouts", "Hover previews the layout on the page,
// exactly as it lands"): the one path both a press and a hover take, so what a hover shows is what a press lands
// (Work Tracker 1502). The layout is built for the page with the page's own words and pictures carried in, coloured
// from the tab's theme for the page's half (themedForTab), and put in place of everything on the page (pageLaidOut).
//
// The hover, the press and what the canvas draws meanwhile are livedesign's too: one copy in the workbench
// (createPageLayoutPreview, liveworkspace/docs/specs/011-workbench/page-layout-preview.md), given this placer and the
// builders. A hover's result is drawn in place of the tab's elements through the whole path a placed page takes
// (EditorCanvasHost: each element inked for its page, in the viewer's half, its words re-inked for what is behind
// them), and a press on the layout it shows commits those very elements.
import {
  elementsOnPage,
  layOutPages,
  pageIsDark,
  pageLaidOut,
  pagesOf,
  themedForTab,
  type Element,
  type LaidOutPage,
  type Tab,
} from '@livedocuments/document';
import type { PageLayoutId } from '@livedocuments/templates';
import { createPageLayoutPreview } from '@liveworkspace/workbench/lib/page-layout-preview';
import { track } from '@/lib/telemetry';

/** The layout builder (buildPageLayoutOver), handed in: it loads on first use rather than with the editor. */
export type LayoutBuild = (
  layout: PageLayoutId,
  page: LaidOutPage,
  previous: readonly Element[],
) => Element[];

/** The tab with `layout` placed on page `pageId`, or null when the page is gone or locked. Pure. */
export function layoutPlacedTab(
  tab: Tab,
  pageId: string,
  layout: PageLayoutId,
  build: LayoutBuild,
): Tab | null {
  const pages = layOutPages(pagesOf(tab));
  const page = pages.find((p) => p.id === pageId);
  if (!page) return null;
  const previous = elementsOnPage(tab.elements, pages, pageId);
  const placed = themedForTab(build(layout, page, previous), tab.theme, {
    dark: pageIsDark(page),
  });
  const out = pageLaidOut(tab, pageId, placed);
  return 'tab' in out ? out.tab : null;
}

// Every page layout set, loaded on the first hover or press, kept out of the editor's first load.
export const {
  showLayout,
  useShownLayoutElements,
  shownLayoutElements,
  shownLayoutFor,
  pageLayoutEdits,
} = createPageLayoutPreview<Tab, PageLayoutId, LayoutBuild>({
  load: () =>
    import('@livedocuments/templates/page-layout-build').then((m) => m.buildPageLayoutOver),
  place: layoutPlacedTab,
  onPlace: () => track('Tab', 'Changed', 'PageLayout'),
});
