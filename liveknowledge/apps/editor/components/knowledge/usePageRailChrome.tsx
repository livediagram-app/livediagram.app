'use client';

// The right rail in the canvas chrome (docs/specs/030-knowledgebase/verification.md "Page Health"): docked on a
// window at least 1,280 px wide, where the right corner stacks and the bottom-right cluster stand clear of it; a
// Page Info button below that, and on a phone. Hidden with the rest of the chrome (zen, the welcome flow, an embed).
import { useContext, useSyncExternalStore, type ReactNode } from 'react';
import { useMediaQuery } from '@liveknowledge/ui';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { EditorChromeContext } from '@/app/document/[id]/EditorContext';
import { toolbarTopClearancePx } from '@/lib/canvas-chrome';
import { PAGE_RAIL_WIDTH, PageRailButton, PageRailDocked } from './PageRail';

/** The window width the rail docks at. */
export const PAGE_RAIL_MIN_WINDOW = 1280;

const noSubscribe = () => () => {};

export type PageRailChrome = {
  // The screen px the docked rail covers at the canvas's right; 0 when it is not docked.
  width: number;
  el: ReactNode;
};

export function usePageRailChrome({
  chromeHidden,
  zenMode,
  isMobile,
}: {
  chromeHidden: boolean;
  zenMode: boolean;
  isMobile: boolean;
}): PageRailChrome {
  const toolbarScale = useUiScale('toolbar');
  const wide = useMediaQuery(`(min-width: ${PAGE_RAIL_MIN_WINDOW}px)`);
  // Rendered on its own (a test, a workbench preview) the chrome has no editor store, and so no rail.
  const store = useContext(EditorChromeContext);
  const embed = useSyncExternalStore(
    store?.subscribe ?? noSubscribe,
    () => store?.get().embedMode ?? false,
    () => false,
  );
  const shown = store !== null && !chromeHidden && !zenMode && !embed;
  const top = toolbarTopClearancePx(toolbarScale);
  if (!shown) return { width: 0, el: null };
  if (wide && !isMobile) return { width: PAGE_RAIL_WIDTH, el: <PageRailDocked top={top} /> };
  return { width: 0, el: <PageRailButton top={top} sheet={isMobile} /> };
}
