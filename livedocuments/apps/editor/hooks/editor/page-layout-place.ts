// A layout placed on a page (docs/specs/007-editor/pages-mode.md "Layouts", "Hover previews the layout on the
// page"): the one path both a press and a hover take, so what a hover shows is what a press lands (Work Tracker 1502).
// The layout is built for the page with the page's own words and pictures carried in, coloured from the tab's theme
// for the page's half (themedForTab), and put in place of everything on the page (pageLaidOut). Pure.
//
// A hover hands the result to the canvas, which draws it in place of the tab's elements through the whole path a
// placed page takes (EditorCanvasHost: each element inked for its page, in the viewer's half, its words re-inked for
// what is behind them), and it is remembered here; a press on the layout it shows then commits those very elements,
// so not even an id differs. Anything else
// (the page changed since, another layout, no hover first) is placed afresh by the same function.
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
import { useSyncExternalStore } from 'react';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

/** The layout builder (buildPageLayoutOver), handed in: it loads on first use rather than with the editor. */
export type LayoutBuild = (
  layout: PageLayoutId,
  page: LaidOutPage,
  previous: readonly Element[],
) => Element[];

/** The tab with `layout` placed on page `pageId`, or null when the page is gone or locked. */
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

// The layout a hover is showing: on which tab and page, over which board, and the board it shows.
type Shown = {
  tabId: string;
  pageId: string;
  layout: PageLayoutId;
  over: readonly Element[];
  elements: Element[];
};
let shown: Shown | null = null;
const listeners = createListeners();

/** Shows a hovered layout (the canvas draws `elements` in place of the tab's own), or puts the tab back (null). */
export function showLayout(next: Shown | null): void {
  if (next === shown) return;
  shown = next;
  listeners.notify();
}

/** What the canvas draws for tab `tabId` while a layout is hovered: the tab with it placed; else null. */
export function useShownLayoutElements(tabId: string): Element[] | null {
  return useSyncExternalStore(
    listeners.subscribe,
    () => (shown?.tabId === tabId ? shown.elements : null),
    () => null,
  );
}

/** The hovered layout's board for a tab, read outside React (tests); null when none shows. */
export function shownLayoutElements(tabId: string): Element[] | null {
  return shown?.tabId === tabId ? shown.elements : null;
}

/** The elements a press on `layout` lands: those the hover showed, while it showed this layout on this page over this
 *  very board; else null, to be placed afresh. */
export function shownLayoutFor(
  tabId: string,
  pageId: string,
  layout: PageLayoutId,
  over: readonly Element[],
): Element[] | null {
  const s = shown;
  return s && s.tabId === tabId && s.pageId === pageId && s.layout === layout && s.over === over
    ? s.elements
    : null;
}
