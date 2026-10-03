// Infographic mode's page (docs/specs/007-editor/editor-modes.md "The page"): the active tab's A4
// orientation and its toggle (a tab edit like any other: one undo step, synced to everyone), and
// the view centred on the page whenever the mode, the tab or the page's shape changes.
import { useEffect, useEffectEvent } from 'react';
import {
  hasPageLook,
  infographicPageRect,
  pageOrientationOf,
  type EditorMode,
  type PageOrientation,
  type Tab,
} from '@livediagram/document';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';

export type InfographicPageView = {
  orientation: PageOrientation;
  // Absent where the viewer may not change the page (a view role, a locked tab).
  setOrientation?: (next: PageOrientation) => void;
};

export function useInfographicPage(deps: {
  activeTab: Tab;
  mode: EditorMode;
  canEdit: boolean;
  tabLoaded: boolean;
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  fitToBounds: (bbox: { x: number; y: number; w: number; h: number }) => void;
}): InfographicPageView | null {
  const { activeTab, mode, canEdit, tabLoaded, commitTabs } = deps;
  const on = hasPageLook(mode);
  const orientation = pageOrientationOf(activeTab);
  const tabId = activeTab.id;

  // Centred in the viewport: after the tab's own first fit (a frame later), so the page wins.
  const centre = useEffectEvent(() => {
    const page = infographicPageRect(orientation);
    deps.fitToBounds({ x: page.x, y: page.y, w: page.width, h: page.height });
    debugLog('[infographic-page] centred', { tabId, orientation });
  });
  useEffect(() => {
    if (!on || !tabLoaded) return;
    const frame = requestAnimationFrame(() => centre());
    return () => cancelAnimationFrame(frame);
  }, [on, tabLoaded, tabId, orientation]);

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
