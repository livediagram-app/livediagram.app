'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Tab } from '@livediagram/document';
import {
  clampRightWidth,
  fractionFor,
  pairAfterActivation,
  placeOpening,
  readStoredFraction,
  readStoredPair,
  restoredPair,
  rightWidthFor,
  splitAvailable,
  writeStoredFraction,
  writeStoredPair,
  type SplitPair,
} from '@/lib/split-view';
import { track } from '@/lib/telemetry';
import { useViewportHeight } from './useViewportHeight';
import { useViewportWidth } from './useViewportWidth';

export type SplitView = {
  // Whether this screen and this moment can show a split (a wide, tall enough window, not zen /
  // embed / presenting). The drop zone and the menu entry only appear when it can.
  available: boolean;
  // The tab the editor is on, which the menus act for.
  activeId: string;
  // The two tabs and their sides, while the split is showing.
  pair: SplitPair | null;
  // The side the editor is on (the active tab's), while the split is showing.
  editorSide: 'left' | 'right' | null;
  // The right pane's width in px (also the drop ghost's width before a split opens).
  rightWidth: number;
  // Whether dropping `tabId` on the right would change anything.
  canOpen: (tabId: string) => boolean;
  // Put `tabId` in the right pane (see placeOpening for where everything lands).
  open: (tabId: string, via: 'Drag' | 'Menu') => void;
  close: () => void;
  // Move the editor to the tab in the other pane; the tabs keep their sides.
  focus: (tabId: string, via: 'Click' | 'Hover') => void;
  // Fetch a tab's content ahead of showing it (the drop zone's preview of a dragged tab).
  prefetch: (tabId: string) => void;
  // Live resize from the divider; `commit` stores the width once the drag ends.
  resize: (rightWidth: number, commit?: boolean) => void;
  resetWidth: () => void;
};

// The side by side state (docs/specs/007-editor/split-view.md): which tab is on which side and how
// the screen is shared. The editor itself is always on the active tab, so this hook never touches
// the document; it steers `selectTab` and keeps the pair consistent as tabs come and go.
export function useSplitView({
  tabs,
  activeId,
  selectTab,
  documentId,
  hydrated,
  loadedTabIds,
  loadTabs,
  suspended,
}: {
  tabs: readonly Tab[];
  activeId: string;
  selectTab: (tabId: string) => void;
  documentId: string | null;
  // The document's tabs are the real ones (not the pre-load placeholder), so a stored split can be
  // matched against them.
  hydrated: boolean;
  loadedTabIds: ReadonlySet<string>;
  loadTabs: (ids: readonly string[]) => Promise<void>;
  // Zen, embeds, presenting and phones: the split steps aside but is kept, so it comes back.
  suspended: boolean;
}): SplitView {
  const viewportWidth = useViewportWidth();
  const viewportHeight = useViewportHeight();
  const [fraction, setFraction] = useState(readStoredFraction);
  // The pair, and the active tab it was last reconciled with: a change of active tab is folded in
  // during render, so a pane never shows a frame of the editor's own tab.
  const [state, setState] = useState<{ pair: SplitPair; seenActive: string } | null>(null);
  // The tab you were on before this one, for the companion when the active tab is sent right.
  const [history, setHistory] = useState<{ current: string; previous: string | null }>({
    current: activeId,
    previous: null,
  });
  if (history.current !== activeId) setHistory({ current: activeId, previous: history.current });
  const previousActiveId = history.current !== activeId ? history.current : history.previous;

  const tabIds = useMemo(() => tabs.map((t) => t.id), [tabs]);

  let current = state;
  if (current && current.seenActive !== activeId) {
    current = {
      pair: pairAfterActivation(current.pair, current.seenActive, activeId),
      seenActive: activeId,
    };
    setState(current);
  }
  // A tab of the pair was deleted (here or by a collaborator).
  if (
    current &&
    (!tabIds.includes(current.pair.leftId) ||
      !tabIds.includes(current.pair.rightId) ||
      current.pair.leftId === current.pair.rightId)
  ) {
    current = null;
    setState(null);
  }

  // Restore the document's split on arrival, once its tabs are known.
  const [restoredFor, setRestoredFor] = useState<string | null>(null);
  if (hydrated && documentId && restoredFor !== documentId && tabIds.length > 0) {
    setRestoredFor(documentId);
    const restored = restoredPair(readStoredPair(documentId), activeId, tabIds);
    if (restored) {
      current = { pair: restored, seenActive: activeId };
      setState(current);
    }
  }

  const pair = current?.pair ?? null;
  const leftId = pair?.leftId ?? null;
  const rightId = pair?.rightId ?? null;
  useEffect(() => {
    if (documentId && restoredFor === documentId)
      writeStoredPair(documentId, leftId && rightId ? { leftId, rightId } : null);
  }, [documentId, restoredFor, leftId, rightId]);

  // The pane not holding the editor draws its tab: fetch a never-opened tab's content for it.
  const staticId = pair ? (pair.leftId === activeId ? pair.rightId : pair.leftId) : null;
  useEffect(() => {
    if (staticId && !loadedTabIds.has(staticId)) void loadTabs([staticId]);
  }, [staticId, loadedTabIds, loadTabs]);

  const available = !suspended && splitAvailable(viewportWidth, viewportHeight);

  const canOpen = useCallback(
    (tabId: string) => placeOpening(tabIds, activeId, tabId, previousActiveId, pair) !== null,
    [tabIds, activeId, previousActiveId, pair],
  );

  const open = useCallback(
    (tabId: string, via: 'Drag' | 'Menu') => {
      const placement = placeOpening(tabIds, activeId, tabId, previousActiveId, pair);
      if (!placement) return;
      setState({ pair: placement, seenActive: activeId });
      // The editor stays on the active tab wherever it lands, unless the pane it was in just
      // received another tab (a drop onto the right pane while editing there): then it edits that.
      if (placement.leftId !== activeId && placement.rightId !== activeId) selectTab(tabId);
      track('Tab', 'Opened', via === 'Drag' ? 'SideBySideDrag' : 'SideBySideMenu');
    },
    [tabIds, activeId, previousActiveId, pair, selectTab],
  );

  const close = useCallback(() => {
    setState(null);
    track('Tab', 'Closed', 'SideBySide');
  }, []);

  const focus = useCallback(
    (tabId: string, via: 'Click' | 'Hover') => {
      if (tabId === activeId) return;
      selectTab(tabId);
      track('Tab', 'Selected', via === 'Click' ? 'SideBySideClick' : 'SideBySideHover');
    },
    [activeId, selectTab],
  );

  const prefetch = useCallback(
    (tabId: string) => {
      if (!loadedTabIds.has(tabId)) void loadTabs([tabId]);
    },
    [loadedTabIds, loadTabs],
  );

  const resize = useCallback(
    (width: number, commit = false) => {
      const next = fractionFor(clampRightWidth(width, viewportWidth), viewportWidth);
      setFraction(next);
      if (commit) writeStoredFraction(next);
    },
    [viewportWidth],
  );

  const resetWidth = useCallback(() => {
    const next = fractionFor(rightWidthFor(0.5, viewportWidth), viewportWidth);
    setFraction(next);
    writeStoredFraction(next);
  }, [viewportWidth]);

  const showing = available ? pair : null;
  return {
    available,
    activeId,
    pair: showing,
    editorSide: showing ? (showing.leftId === activeId ? 'left' : 'right') : null,
    rightWidth: rightWidthFor(fraction, viewportWidth),
    canOpen,
    open,
    close,
    focus,
    prefetch,
    resize,
    resetWidth,
  };
}
