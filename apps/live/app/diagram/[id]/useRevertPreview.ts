'use client';

// Hover-to-preview for the Activity panel's per-row Revert (spec/12).
// Resting the pointer on a revertable row shows, live on the canvas,
// what clicking its Revert button would do — the affected elements
// jump to the entry's `before` state — and pulling the pointer off
// restores the current state. Nothing commits: the preview rides the
// same present-only machinery as the style-preset hover previews
// (spec/48): `tickTabs` (no history push, no activity emit, no room
// broadcast beyond the normal element sync) plus `previewingRef` so
// autosave skips the ephemeral frames.
//
// The Revert CLICK path must clear the preview first (the wrapped
// handler in useEditorState does) so the commit's history snapshot
// captures the true pre-hover state, not the preview.

import { useRef, type MutableRefObject } from 'react';
import type { Element, Tab } from '@livediagram/diagram';
import type { ChangeLogEntry } from '@/lib/api-client';
import { applyRevert } from '@/lib/change-log';

type Snapshot = { tabId: string; elements: Element[] };

export function useRevertPreview(deps: {
  // Live tabs mirror — read + eagerly written (see `write` below), the
  // same lag-avoidance useStylePreview needs: tabsRef only re-syncs to
  // React state post-render, so a leave→enter pair faster than a frame
  // would otherwise snapshot the PREVIOUS preview as the baseline.
  tabsRef: MutableRefObject<Tab[]>;
  // Present-only mutator (no history, no log) for preview + restore.
  tickTabs: (mapTabs: (tabs: Tab[]) => Tab[]) => void;
  // Autosave guard shared with the style previews — flipped on while a
  // preview is on screen so the mutated tabs are never persisted.
  previewingRef: MutableRefObject<boolean>;
}) {
  const { tabsRef, tickTabs, previewingRef } = deps;
  const snapRef = useRef<Snapshot | null>(null);

  const write = (tabId: string, elements: Element[]) => {
    const mapTabs = (ts: Tab[]) => ts.map((t) => (t.id === tabId ? { ...t, elements } : t));
    tabsRef.current = mapTabs(tabsRef.current);
    tickTabs(mapTabs);
  };

  // Show the entry's revert result. No-op for tab-meta entries (no
  // element payload) and while another row's preview is still up (the
  // leave handler clears between rows in practice; the guard keeps a
  // missed leave from compounding snapshots).
  const previewRevert = (entry: ChangeLogEntry) => {
    if (!entry.tabId || entry.elementIds.length === 0) return;
    if (snapRef.current) return;
    const tab = tabsRef.current.find((t) => t.id === entry.tabId);
    if (!tab) return;
    snapRef.current = { tabId: entry.tabId, elements: tab.elements };
    previewingRef.current = true;
    write(
      entry.tabId,
      applyRevert(tab.elements, entry.beforeState as Record<string, Element | null>),
    );
  };

  // Restore the pre-hover state (pointer left the row without a
  // Revert click, or the click path clears before committing).
  const clearRevertPreview = () => {
    const snap = snapRef.current;
    if (!snap) return;
    snapRef.current = null;
    previewingRef.current = false;
    write(snap.tabId, snap.elements);
  };

  return { previewRevert, clearRevertPreview };
}
