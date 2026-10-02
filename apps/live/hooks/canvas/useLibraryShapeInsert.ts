'use client';

// Placing a shape from a shape library (docs/specs/013-workspace/shape-libraries.md "Using a library:
// the palette"): like a paste, its elements copied with fresh ids (connections rewired), landed in
// ONE commit, and selected. A drop lands centred on its point. A click lands centred on the middle of
// the view, unless that would cover an earlier insert still where it landed: then 24 px to the right
// of it (the paste offset, as a gap), centred on its row, so a run of clicks lines up and never
// stacks.

import { useRef } from 'react';
import {
  MAX_ELEMENTS_PER_TAB,
  duplicateElements,
  type BoxedElement,
  type Element,
  type Tab,
} from '@livediagram/document';
import type { ShapeLibraryItem } from '@livediagram/api-schema';
import { PASTE_OFFSET } from '@/lib/paste-placement';
import { track } from '@/lib/telemetry';

type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };

/** The gap between consecutive clicked inserts: the paste offset. */
export const LIBRARY_INSERT_GAP = PASTE_OFFSET;

export type LibraryShapeInsertDeps = {
  activeTab: Tab;
  editsBlocked: boolean;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  getViewportCenter: () => Point;
};

/** Places `item` centred on `at` (a drop point), else by the click rule; true when it landed. */
export type InsertLibraryShape = (item: ShapeLibraryItem, at?: Point) => boolean;

// An earlier insert: where its footprint landed, and how to tell it is still there.
type Placed = {
  tabId: string;
  box: Box;
  ids: string[];
  anchor: { id: string; x: number; y: number };
};

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const boxAround = (centre: Point, width: number, height: number): Box => ({
  x: centre.x - width / 2,
  y: centre.y - height / 2,
  width,
  height,
});

// Still in place: every element it made exists, and its first is where it landed.
function inPlace(p: Placed, tab: Tab): boolean {
  if (p.tabId !== tab.id) return false;
  const byId = new Map(tab.elements.map((el) => [el.id, el]));
  const anchor = byId.get(p.anchor.id);
  if (!anchor || anchor.type === 'arrow') return false;
  return anchor.x === p.anchor.x && anchor.y === p.anchor.y && p.ids.every((id) => byId.has(id));
}

/**
 * Where a click lands `item`: centred on `centre`, moved right past every earlier insert it would
 * cover, each move centred on the row of the insert it clears.
 */
export function clickFootprint(
  item: Pick<ShapeLibraryItem, 'width' | 'height'>,
  centre: Point,
  earlier: readonly Box[],
): Box {
  let box = boxAround(centre, item.width, item.height);
  // Each move goes strictly right, so it ends after at most one move per earlier insert.
  for (let moves = 0; moves <= earlier.length; moves++) {
    const covered = earlier.find((b) => overlaps(box, b));
    if (!covered) return box;
    box = {
      ...box,
      x: covered.x + covered.width + LIBRARY_INSERT_GAP,
      y: covered.y + covered.height / 2 - item.height / 2,
    };
  }
  return box;
}

export function useLibraryShapeInsert(d: LibraryShapeInsertDeps): InsertLibraryShape {
  const placed = useRef<Placed[]>([]);
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
    // Forget inserts that moved, went, or belong to another tab.
    placed.current = placed.current.filter((p) => inPlace(p, tab));
    const box = at
      ? boxAround(at, item.width, item.height)
      : clickFootprint(
          item,
          d.getViewportCenter(),
          placed.current.map((p) => p.box),
        );
    const { newElements } = duplicateElements(
      item.elements,
      new Set(item.elements.map((el) => el.id)),
      box.x,
      box.y,
    );
    if (newElements.length === 0) return false;
    d.commit((els) => [...els, ...newElements]);
    const anchor = newElements.find((el): el is BoxedElement => el.type !== 'arrow');
    if (anchor) {
      placed.current.push({
        tabId: tab.id,
        box,
        ids: newElements.map((el) => el.id),
        anchor: { id: anchor.id, x: anchor.x, y: anchor.y },
      });
    }
    if (newElements.length === 1) {
      d.setSelectedId(newElements[0]!.id);
      d.setMultiSelectedIds(new Set());
    } else {
      d.setSelectedId(null);
      d.setMultiSelectedIds(new Set(newElements.map((el) => el.id)));
    }
    track('Element', 'Added', 'LibraryShape');
    console.debug('[shape-libraries] inserted', { elements: newElements.length, dropped: !!at });
    return true;
  };
}
