// Infographic mode's pages (docs/specs/007-editor/infographic-pages.md): the active tab's pages
// laid out in their row, the edits to them (infographic-page-edits) and framing one in the view. It
// also centres the view on the first page whenever the mode or the tab changes.
import { useEffect, useEffectEvent, useState, type RefObject } from 'react';
import {
  hasPageLook,
  infographicPageFitBox,
  infographicPagesOf,
  layOutInfographicPages,
  type EditorMode,
  type LaidOutPage,
  type Tab,
} from '@livediagram/document';
import { computeFitBelow } from '@/lib/viewport';
import { debugLog } from '@/lib/debug-log';
import { getTheme } from '@/lib/themes';
import { themeBackgroundPresets, type ThemeBackgroundPreset } from '@/lib/infographic-page-paint';
import { infographicPageEdits, type InfographicPageEdits } from './infographic-page-edits';

export type { InfographicPageEdits };

export type InfographicPagesView = {
  pages: LaidOutPage[];
  // Frames one page in the view (its label's press).
  focusPage: (pageId: string) => void;
  // Backgrounds drawn from the tab's theme, offered first in the page panel.
  themeBackgrounds: ThemeBackgroundPreset[];
  // Absent where the viewer may not change the pages (a view role, a locked tab).
  edit?: InfographicPageEdits;
};

// The Toolbar layout's strip lies over the canvas's top edge; the page centres below it.
const TOP_STRIP_SELECTOR = '[data-toolbar-palette]:not(.hidden)';

/** How far a top strip laid over the canvas reaches down into it, in screen px. */
function topStripInset(canvas: HTMLElement): number {
  const strip = document.querySelector<HTMLElement>(TOP_STRIP_SELECTOR);
  if (!strip) return 0;
  const c = canvas.getBoundingClientRect();
  const s = strip.getBoundingClientRect();
  const overlaps = s.bottom > c.top && s.top < c.top + c.height / 2;
  return overlaps ? s.bottom - c.top : 0;
}

export function useInfographicPage(deps: {
  activeTab: Tab;
  mode: EditorMode;
  canEdit: boolean;
  tabLoaded: boolean;
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  canvasMainRef: RefObject<HTMLElement | null>;
  setViewportZoom: (zoom: number) => void;
  setViewportOffset: (offset: { x: number; y: number }) => void;
  clearSelection: () => void;
}): InfographicPagesView | null {
  const { activeTab, mode, canEdit, tabLoaded, commitTabs } = deps;
  const on = hasPageLook(mode);
  const tabId = activeTab.id;

  // Frames a page (the first by default) below a top strip. The fit box holds either orientation,
  // so turning a page needs no refit.
  const frame = (page?: LaidOutPage) => {
    const canvas = deps.canvasMainRef.current;
    if (!canvas) return;
    const inset = topStripInset(canvas);
    const { zoom, offset } = computeFitBelow(
      { width: canvas.offsetWidth, height: canvas.offsetHeight },
      infographicPageFitBox(page),
      inset,
    );
    deps.setViewportZoom(zoom);
    deps.setViewportOffset(offset);
    debugLog('[infographic-page] framed', { tabId, page: page?.id ?? 'first', inset, zoom });
  };
  // Centred on the first page after the tab's own first fit (a frame later), so the page wins.
  const centre = useEffectEvent(() =>
    frame(layOutInfographicPages(infographicPagesOf(activeTab))[0]),
  );
  useEffect(() => {
    if (!on || !tabLoaded) return;
    const raf = requestAnimationFrame(() => centre());
    return () => cancelAnimationFrame(raf);
  }, [on, tabLoaded, tabId]);

  // A page just added or duplicated: framed once it lands in the row (a frame later, as its
  // sheet mounts).
  const [goTo, setGoTo] = useState<string | null>(null);
  const goToLanded = useEffectEvent(() => {
    const page = layOutInfographicPages(infographicPagesOf(activeTab)).find((p) => p.id === goTo);
    if (!page) return;
    setGoTo(null);
    frame(page);
  });
  const landed = goTo !== null && infographicPagesOf(activeTab).some((p) => p.id === goTo);
  useEffect(() => {
    if (!landed) return;
    const raf = requestAnimationFrame(() => goToLanded());
    return () => cancelAnimationFrame(raf);
  }, [landed]);

  if (!on) return null;
  const current = infographicPagesOf(activeTab);
  const pages = layOutInfographicPages(current);
  const focusPage = (pageId: string) => frame(pages.find((p) => p.id === pageId));
  const themeBackgrounds = themeBackgroundPresets(getTheme(activeTab.theme));
  if (!canEdit || activeTab.locked === true) return { pages, focusPage, themeBackgrounds };
  return {
    pages,
    focusPage,
    themeBackgrounds,
    edit: infographicPageEdits({
      tabId,
      current,
      elements: activeTab.elements,
      commitTabs,
      onCreated: setGoTo,
      onLayoutPlaced: deps.clearSelection,
    }),
  };
}
