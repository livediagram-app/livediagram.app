// Infographic mode's pages (docs/specs/007-editor/editor-modes.md "The pages"): the active tab's A4
// pages laid out in their row, and the edits to them: turn a page, add one after the last, remove
// one. Each is a tab edit like any other (one undo step, synced to everyone), and moves the
// content of the pages it shifts along with them (withInfographicPages). It also centres the view
// on the first page whenever the mode or the tab changes.
import { useEffect, useEffectEvent, type RefObject } from 'react';
import {
  hasPageLook,
  infographicPageFitBox,
  infographicPagesOf,
  layOutInfographicPages,
  MAX_INFOGRAPHIC_PAGES,
  nextInfographicPageId,
  withInfographicPages,
  type EditorMode,
  type InfographicPage,
  type LaidOutPage,
  type PageOrientation,
  type Tab,
} from '@livediagram/document';
import { computeFitBelow } from '@/lib/viewport';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';

export type InfographicPageEdits = {
  setOrientation: (pageId: string, next: PageOrientation) => void;
  // Absent at the page limit.
  addPage?: () => void;
  // Absent while there is only one page.
  removePage?: (pageId: string) => void;
};

export type InfographicPagesView = {
  pages: LaidOutPage[];
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
}): InfographicPagesView | null {
  const { activeTab, mode, canEdit, tabLoaded, commitTabs } = deps;
  const on = hasPageLook(mode);
  const tabId = activeTab.id;

  // Centred on the first page, below a top strip: after the tab's own first fit (a frame later),
  // so the page wins. The fit box holds either orientation, so turning it needs no refit.
  const centre = useEffectEvent(() => {
    const canvas = deps.canvasMainRef.current;
    if (!canvas) return;
    const inset = topStripInset(canvas);
    const { zoom, offset } = computeFitBelow(
      { width: canvas.offsetWidth, height: canvas.offsetHeight },
      infographicPageFitBox(),
      inset,
    );
    deps.setViewportZoom(zoom);
    deps.setViewportOffset(offset);
    debugLog('[infographic-page] centred', { tabId, inset, zoom });
  });
  useEffect(() => {
    if (!on || !tabLoaded) return;
    const frame = requestAnimationFrame(() => centre());
    return () => cancelAnimationFrame(frame);
  }, [on, tabLoaded, tabId]);

  if (!on) return null;
  const current = infographicPagesOf(activeTab);
  const pages = layOutInfographicPages(current);
  if (!canEdit || activeTab.locked === true) return { pages };

  // One commit, re-reading the tab's pages at commit time so two quick edits compose.
  const commitPages = (change: (pages: InfographicPage[]) => InfographicPage[] | null) =>
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id !== tabId) return t;
        const next = change(infographicPagesOf(t));
        return next ? withInfographicPages(t, next) : t;
      }),
    );

  const setOrientation = (pageId: string, next: PageOrientation) => {
    if (current.find((p) => p.id === pageId)?.orientation === next) return;
    track('Tab', 'Changed', next === 'landscape' ? 'PageLandscape' : 'PagePortrait');
    commitPages((ps) => ps.map((p) => (p.id === pageId ? { ...p, orientation: next } : p)));
    debugLog('[infographic-page] orientation set', { tabId, pageId, orientation: next });
  };
  // A new page takes the last page's orientation.
  const addPage = () => {
    track('Tab', 'Changed', 'PageAdded');
    commitPages((ps) =>
      ps.length >= MAX_INFOGRAPHIC_PAGES
        ? null
        : [...ps, { id: nextInfographicPageId(ps), orientation: ps[ps.length - 1]!.orientation }],
    );
    debugLog('[infographic-page] page added', { tabId, count: current.length + 1 });
  };
  const removePage = (pageId: string) => {
    track('Tab', 'Changed', 'PageRemoved');
    commitPages((ps) => (ps.length > 1 ? ps.filter((p) => p.id !== pageId) : null));
    debugLog('[infographic-page] page removed', { tabId, pageId });
  };
  return {
    pages,
    edit: {
      setOrientation,
      addPage: current.length < MAX_INFOGRAPHIC_PAGES ? addPage : undefined,
      removePage: current.length > 1 ? removePage : undefined,
    },
  };
}
