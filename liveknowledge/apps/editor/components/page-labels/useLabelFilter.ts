'use client';

// The page tree's label filter for a component (docs/specs/030-knowledgebase/page-surface.md "The label filter"): the
// labels it holds that still exist, the pages it keeps (one pass over the tab list, done when the filter or the
// pages change), and whenever it asks to be shown, so the tree opens where it is folded.
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { pagesLabelled, type KnowledgeLabel } from '@liveknowledge/document';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { sameTabsForBar } from '@/app/document/[id]/editor-view-bars';
import {
  chosenOf,
  labelFilterStore,
  type LabelSelectionStore,
} from '@/lib/page-labels/label-selection-store';
import { useKnowledgeLabels } from './page-labels-state';

/** The chosen labels of a selection store that still exist, for the open knowledgebase. */
export function useChosenLabels(store: LabelSelectionStore = labelFilterStore): KnowledgeLabel[] {
  const documentId = useEditorChrome((s) => s.documentId);
  const read = () => store.idsOf(documentId);
  const ids = useSyncExternalStore(store.subscribe, read, read);
  const labels = useKnowledgeLabels();
  return useMemo(() => chosenOf(ids, labels), [ids, labels]);
}

/** The pages the filter keeps, or null with no filter on. */
export function useLabelFilterPages(): ReadonlySet<string> | null {
  const chosen = useChosenLabels();
  const tabs = useEditorChrome((s) => s.tabs, sameTabsForBar);
  return useMemo(
    () =>
      chosen.length
        ? pagesLabelled(
            tabs,
            chosen.map((l) => l.id),
          )
        : null,
    [chosen, tabs],
  );
}

/** Calls `onReveal` each time the filter asks to be shown (a page's label pill pressed), never on mount. */
export function useLabelFilterReveal(onReveal: () => void): void {
  const count = useSyncExternalStore(
    labelFilterStore.subscribe,
    labelFilterStore.revealCount,
    labelFilterStore.revealCount,
  );
  const seen = useRef(count);
  const latest = useRef(onReveal);
  useEffect(() => {
    latest.current = onReveal;
  });
  useEffect(() => {
    if (seen.current === count) return;
    seen.current = count;
    latest.current();
  }, [count]);
}
