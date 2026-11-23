'use client';

// The right rail in the canvas chrome (docs/specs/030-knowledgebase/verification.md "Page Health"): docked on a
// window at least 1,280 px wide, under the top row, where the right corner stacks and the bottom-right cluster stand
// clear of it; a Page Info button in the top row below that, and on a phone. Hidden with the rest of the chrome (zen, the welcome flow, an embed).
// The knowledgebase's search dialog is hosted here as well, so it is mounted once with the canvas chrome.
import { useContext, useSyncExternalStore, type ReactNode } from 'react';
import { useMediaQuery } from '@liveknowledge/ui';
import { EditorChromeContext } from '@/app/document/[id]/EditorContext';
import { KnowledgeSearchHost } from './KnowledgeSearchHost';
import { PageSuggestionsHost } from './suggestions/PageSuggestionsHost';
import { usePageRailCollapsed } from '@/lib/page-rail-collapsed';
import { PAGE_RAIL_STRIP_WIDTH, PAGE_RAIL_WIDTH, PageRailButton, PageRailDocked } from './PageRail';

/** The least window width the rail docks at. */
export const PAGE_RAIL_MIN_WINDOW = 1280;
/** The room the page keeps beside the docked rail: its 760 px column and 48 px either side
 *  (docs/specs/030-knowledgebase/page-surface.md "A reading column"). */
export const PAGE_RAIL_PAGE_ROOM = 856;

/** The window width the rail docks at beside a page tree `treeWidth` px wide: never under 1,280 px, and never so
 *  narrow that the page beside it would be scaled down to fit (1,400 px with the tree open, 1,280 with its rail). */
export function pageRailDockWidth(treeWidth: number): number {
  return Math.max(
    PAGE_RAIL_MIN_WINDOW,
    Math.ceil(treeWidth) + PAGE_RAIL_WIDTH + PAGE_RAIL_PAGE_ROOM,
  );
}

const noSubscribe = () => () => {};

export type PageRailChrome = {
  // The screen px the docked rail covers at the canvas's right; 0 when it is not docked.
  width: number;
  el: ReactNode;
  // The Page Info button, for the top row, where the rail is not docked.
  rowButton: ReactNode;
};

export function usePageRailChrome({
  chromeHidden,
  zenMode,
  isMobile,
  treeWidth = 0,
}: {
  chromeHidden: boolean;
  zenMode: boolean;
  isMobile: boolean;
  // The screen px the page tree covers down the left (0 when it is not docked): the rail docks only where the page
  // keeps its full width between the two.
  treeWidth?: number;
}): PageRailChrome {
  const collapsed = usePageRailCollapsed();
  const wide = useMediaQuery(`(min-width: ${pageRailDockWidth(treeWidth)}px)`);
  // Rendered on its own (a test, a workbench preview) the chrome has no editor store, and so no rail.
  const store = useContext(EditorChromeContext);
  const embed = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.get().embedMode ?? false,
    () => false,
  );
  const shown = store !== null && !chromeHidden && !zenMode && !embed;
  // The search dialog's host rides here too: Cmd or Ctrl K works whether the chrome shows or not (zen), never in
  // an embed or outside the editor.
  // The page's suggested edits ride the same once-mounted spot (insights.md "On the page"): hidden with the
  // chrome in zen too, and never in an embed.
  const search =
    store !== null && !embed ? (
      <>
        <KnowledgeSearchHost />
        {chromeHidden || zenMode ? null : <PageSuggestionsHost sheet={isMobile} />}
      </>
    ) : null;
  if (!shown) return { width: 0, el: search, rowButton: null };
  if (wide && !isMobile)
    return {
      // Collapsed, the page centres beside the strip.
      width: collapsed ? PAGE_RAIL_STRIP_WIDTH : PAGE_RAIL_WIDTH,
      el: (
        <>
          {search}
          <PageRailDocked />
        </>
      ),
      rowButton: null,
    };
  return { width: 0, el: search, rowButton: <PageRailButton sheet={isMobile} /> };
}
