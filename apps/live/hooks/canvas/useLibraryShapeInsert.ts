'use client';

// Placing a shape from a shape library (docs/specs/013-workspace/shape-libraries.md "Using a library:
// the palette"): like a paste, its elements copied with fresh ids (connections rewired), centred on
// the drop point or the middle of the view, landed in ONE commit, and selected.

import {
  MAX_ELEMENTS_PER_TAB,
  duplicateElements,
  type Element,
  type Tab,
} from '@livediagram/document';
import type { ShapeLibraryItem } from '@livediagram/api-schema';
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

/** Places `item` centred on `at` (a drop point), else the middle of the view; true when it landed. */
export type InsertLibraryShape = (item: ShapeLibraryItem, at?: Point) => boolean;

export function useLibraryShapeInsert(d: LibraryShapeInsertDeps): InsertLibraryShape {
  return (item, at) => {
    const tab = d.activeTab;
    if (d.editsBlocked || tab.locked) {
      console.warn('[shape-libraries] insert refused', { reason: 'edits blocked' });
      return false;
    }
    if (tab.elements.length + item.elements.length > MAX_ELEMENTS_PER_TAB) {
      console.warn('[shape-libraries] insert refused', { reason: 'tab full' });
      return false;
    }
    const centre = at ?? d.getViewportCenter();
    const { newElements } = duplicateElements(
      item.elements,
      new Set(item.elements.map((el) => el.id)),
      centre.x - item.width / 2,
      centre.y - item.height / 2,
    );
    if (newElements.length === 0) return false;
    d.commit((els) => [...els, ...newElements]);
    if (newElements.length === 1) {
      d.setSelectedId(newElements[0]!.id);
      d.setMultiSelectedIds(new Set());
    } else {
      d.setSelectedId(null);
      d.setMultiSelectedIds(new Set(newElements.map((el) => el.id)));
    }
    track('Element', 'Added', 'LibraryShape');
    console.debug('[shape-libraries] inserted', { elements: newElements.length });
    return true;
  };
}
