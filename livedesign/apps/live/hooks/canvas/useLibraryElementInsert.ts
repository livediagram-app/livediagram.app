'use client';

// Placing an item from the Library (liveworkspace/docs/specs/006-media/libraries.md): the workbench's
// useLibraryItemInsert bound to livedesign's elements. Like a paste, its elements copied with fresh ids (connections
// rewired), landed in ONE commit, and selected; a click lands at the middle of the view, or 24 px right of an earlier
// insert it would cover.

import {
  MAX_ELEMENTS_PER_TAB,
  contentBounds,
  duplicateElements,
  type Element,
  type Tab,
} from '@livedesign/design';
import {
  useLibraryItemInsert,
  type InsertLibraryItem,
} from '@liveworkspace/workbench/hooks/canvas/useLibraryItemInsert';

export type LibraryElementInsertDeps = {
  activeTab: Tab;
  editsBlocked: boolean;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  getViewportCenter: () => { x: number; y: number };
};

export function useLibraryElementInsert(d: LibraryElementInsertDeps): InsertLibraryItem<Element> {
  return useLibraryItemInsert<Element>({
    tabId: d.activeTab.id,
    tabElements: d.activeTab.elements,
    locked: !!d.activeTab.locked,
    editsBlocked: d.editsBlocked,
    maxElements: MAX_ELEMENTS_PER_TAB,
    commit: d.commit,
    setSelectedId: d.setSelectedId,
    setMultiSelectedIds: d.setMultiSelectedIds,
    getViewportCenter: d.getViewportCenter,
    duplicate: (elements, ids, dx, dy) => duplicateElements(elements, ids, dx, dy).newElements,
    bounds: (elements) => contentBounds(elements),
  });
}
