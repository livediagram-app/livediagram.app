'use client';

// Hover-to-preview for the Tidy Up popover's tiles (docs/specs/008-canvas/layout-cleanup.md "Hover to see
// it first"). On a desktop pointer, hovering Auto-align or one of the Auto Layout styles lays the tab
// out live behind the popover; the change only sticks on press, and pulling the pointer off the tile
// puts everything back.
//
// It is the style-preset preview (docs/specs/010-palette/style-presets.md) one level up: that one previews a
// look on the selected elements, this one previews a POSITION on all of them.
// The mechanics are the same and matter for the same reasons:
//
//   - The first hover snapshots the tab's elements. Every hover lays out from
//     that snapshot, never from the preview on screen, so sweeping across the
//     tiles shows each style cleanly instead of stacking them.
//   - Preview and revert go through `tickTabs` (present-only, no undo snapshot,
//     no activity emit), so a sweep can't spam history or the realtime channel.
//   - `tabsRef` is written eagerly beside each tick, because it is otherwise
//     re-synced in a post-render effect and lags by a frame. A sweep fires
//     leave/enter pairs faster than that, and a stale read would bake the last
//     preview in as the baseline.
//   - The commit is the existing command, untouched. The press reverts first
//     and commits second in the same React batch, so the two updaters compose
//     and undo returns to the true pre-hover layout.

import { useRef, type MutableRefObject } from 'react';
import type { Element, Tab } from '@livediagram/document';
import type { CleanupKind } from '@/lib/tab-cleanup';
import type { CleanupVerdict } from '@/lib/tidy-verdict';
import { loadTidyEngine, tidyEngine } from '@/lib/tidy-engine';

type CleanupPreviewApi = {
  /** Lay the tab out as this cleanup would, without committing anything. */
  previewCleanup: (kind: CleanupKind) => void;
  /** Put the tab back as it was. Safe to call with no preview in flight. */
  endCleanupPreview: () => void;
  /**
   * Whether this cleanup is worth offering (lib/tidy-verdict.ts), judged on the tab as the author
   * has it: the pre-hover snapshot while a preview is on screen, the live tab otherwise.
   */
  assessCleanupKind: (kind: CleanupKind) => CleanupVerdict;
};

export function useCleanupPreview(deps: {
  editsBlocked: boolean;
  activeId: string;
  tabsRef: MutableRefObject<Tab[]>;
  tickTabs: (mapTabs: (tabs: Tab[]) => Tab[]) => void;
  // Flipped on while a preview is on screen so autosave skips the ephemeral
  // tick: the preview mutates `tabs` to render, but must never be persisted.
  previewingRef: MutableRefObject<boolean>;
}): CleanupPreviewApi {
  const { editsBlocked, activeId, tabsRef, tickTabs, previewingRef } = deps;
  const originalsRef = useRef<{ tabId: string; elements: Element[] } | null>(null);

  const writeElements = (elements: Element[]) => {
    const mapTabs = (ts: Tab[]) => ts.map((t) => (t.id === activeId ? { ...t, elements } : t));
    tabsRef.current = mapTabs(tabsRef.current);
    tickTabs(mapTabs);
  };

  const previewCleanup = (kind: CleanupKind) => {
    if (editsBlocked) return;
    // The popover loads the tidiers as it opens; a hover in the moment before they arrive shows nothing.
    const engine = tidyEngine();
    if (!engine) {
      void loadTidyEngine();
      return;
    }
    const snapshot =
      originalsRef.current?.tabId === activeId
        ? originalsRef.current
        : {
            tabId: activeId,
            elements: tabsRef.current.find((t) => t.id === activeId)?.elements ?? [],
          };
    if (snapshot.elements.length === 0) return;
    originalsRef.current = snapshot;
    previewingRef.current = true;
    // Layers are read live: a preview never changes them, and their locks decide what stays put.
    const layers = tabsRef.current.find((t) => t.id === activeId)?.layers;
    writeElements(engine.cleanupElements(snapshot.elements, kind, layers));
  };

  const endCleanupPreview = () => {
    const snapshot = originalsRef.current;
    if (!snapshot) return;
    originalsRef.current = null;
    // The revert restores what is already saved, so autosave may run again.
    previewingRef.current = false;
    // Only ever restores the tab it snapshotted: a tab switch mid-hover must
    // not write one tab's elements onto another.
    const mapTabs = (ts: Tab[]) =>
      ts.map((t) => (t.id === snapshot.tabId ? { ...t, elements: snapshot.elements } : t));
    tabsRef.current = mapTabs(tabsRef.current);
    tickTabs(mapTabs);
  };

  // Called by the popover only once the tidiers have loaded; before that there is nothing to judge with,
  // and offering the tidier is the safe default (its press is then judged by the command).
  const assessCleanupKind = (kind: CleanupKind): CleanupVerdict => {
    const engine = tidyEngine();
    if (!engine) return { kind: 'ok' };
    const tab = tabsRef.current.find((t) => t.id === activeId);
    const elements =
      originalsRef.current?.tabId === activeId
        ? originalsRef.current.elements
        : (tab?.elements ?? []);
    return engine.assessCleanup(elements, kind, tab?.layers);
  };

  return { previewCleanup, endCleanupPreview, assessCleanupKind };
}
