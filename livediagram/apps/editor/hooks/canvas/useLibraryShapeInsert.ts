'use client';

// Placing a shape from a shape library or the Library (docs/specs/013-workspace/shape-libraries.md "Using a library:
// the palette"): the workbench's useLibraryItemInsert, bound to livediagram's elements. Like a paste, its elements
// copied with fresh ids (connections rewired), landed in ONE commit, and selected; a click lands at the middle of the
// view, or 24 px (the paste offset, as a gap) right of an earlier insert it would cover.

import {
  MAX_ELEMENTS_PER_TAB,
  contentBounds,
  duplicateElements,
  type Element,
  type Tab,
} from '@livediagram/document';
import type { ShapeLibraryItem } from '@livediagram/api-schema';
import { useLibraryItemInsert } from '@liveworkspace/workbench/hooks/canvas/useLibraryItemInsert';
import { track } from '@/lib/telemetry';

type Point = { x: number; y: number };

export type LibraryShapeInsertDeps = {
  activeTab: Tab;
  editsBlocked: boolean;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  getViewportCenter: () => Point;
};

/** Places `item` centred on `at` (a drop point), else by the click rule; true when it landed. */
type InsertLibraryShape = (
  item: Pick<ShapeLibraryItem, 'width' | 'height' | 'elements'>,
  at?: Point,
) => boolean;

export function useLibraryShapeInsert(d: LibraryShapeInsertDeps): InsertLibraryShape {
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
    onInserted: () => track('Element', 'Added', 'LibraryShape'),
  });
}
