// Infographic mode's page (docs/specs/007-editor/editor-modes.md "The page"): the active tab's A4
// orientation and its toggle (a tab edit like any other: one undo step, synced to everyone), and
// the view centred on the page whenever the mode or the tab changes.
import { useEffect, useEffectEvent, type RefObject } from 'react';
import {
  hasPageLook,
  infographicPageFitBox,
  pageOrientationOf,
  type EditorMode,
  type PageOrientation,
  type Tab,
} from '@livediagram/document';
import { computeFitBelow } from '@/lib/viewport';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';

export type InfographicPageView = {
  orientation: PageOrientation;
  // Absent where the viewer may not change the page (a view role, a locked tab).
  setOrientation?: (next: PageOrientation) => void;
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
}): InfographicPageView | null {
  const { activeTab, mode, canEdit, tabLoaded, commitTabs } = deps;
  const on = hasPageLook(mode);
  const orientation = pageOrientationOf(activeTab);
  const tabId = activeTab.id;

  // Centred in the viewport, below a top strip: after the tab's own first fit (a frame later), so
  // the page wins. The fit box holds either orientation, so turning the page needs no refit.
  const centre = useEffectEvent(() => {
    const canvas = deps.canvasMainRef.current;
    if (!canvas) return;
    const box = infographicPageFitBox();
    const inset = topStripInset(canvas);
    const { zoom, offset } = computeFitBelow(
      { width: canvas.offsetWidth, height: canvas.offsetHeight },
      box,
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
  const editable = canEdit && activeTab.locked !== true;
  const setOrientation = (next: PageOrientation) => {
    if (next === orientation) return;
    track('Tab', 'Changed', next === 'landscape' ? 'PageLandscape' : 'PagePortrait');
    commitTabs((ts) => ts.map((t) => (t.id === tabId ? { ...t, pageOrientation: next } : t)));
    debugLog('[infographic-page] orientation set', { tabId, orientation: next });
  };
  return { orientation, setOrientation: editable ? setOrientation : undefined };
}
