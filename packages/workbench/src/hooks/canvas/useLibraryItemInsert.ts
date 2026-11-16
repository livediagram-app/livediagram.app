'use client';

// Placing a saved item (livediagram's shape libraries, and the Library every editor shares,
// liveworkspace/docs/specs/006-media/libraries.md): like a paste, its elements copied with fresh ids (connections
// rewired), landed in ONE commit, and selected. A drop lands centred on its point. A click lands centred on the middle
// of the view, unless that would cover an earlier insert still where it landed: then a gap to the right of it, centred
// on its row, so a run of clicks lines up and never stacks. Each editor binds its own element helpers.

import { useRef } from 'react';
import { debugLog } from '../../lib/debug-log';

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };
type LibraryElement = { id: string; type: string; x?: number; y?: number };

// The gap between consecutive clicked inserts: the editors' paste offset.
export const LIBRARY_INSERT_GAP = 24;

// What lands: a saved item's elements, positioned from its top-left corner at (0, 0), and its recorded size.
export type LibraryInsertItem<E> = { width: number; height: number; elements: readonly E[] };

export type LibraryItemInsertDeps<E extends LibraryElement> = {
  tabId: string;
  tabElements: readonly E[];
  locked: boolean;
  editsBlocked: boolean;
  maxElements: number;
  commit: (mapElements: (els: E[]) => E[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  getViewportCenter: () => Point;
  // The editor's own helpers: its paste copy (fresh ids, connections rewired, moved by dx, dy) and content bounds.
  duplicate: (elements: E[], ids: ReadonlySet<string>, dx: number, dy: number) => E[];
  bounds: (elements: E[]) => { w: number; h: number } | null;
  // Logged and counted per insert.
  onInserted?: (count: number) => void;
};

/** Places `item` centred on `at` (a drop point), else by the click rule; true when it landed. */
export type InsertLibraryItem<E> = (item: LibraryInsertItem<E>, at?: Point) => boolean;

// An earlier insert: where its footprint landed, and how to tell it is still there.
type Placed = {
  tabId: string;
  box: Rect;
  ids: string[];
  anchor: { id: string; x: number; y: number };
};

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const boxAround = (centre: Point, width: number, height: number): Rect => ({
  x: centre.x - width / 2,
  y: centre.y - height / 2,
  width,
  height,
});

// Still in place: every element it made exists, and its first is where it landed.
function inPlace(p: Placed, tabId: string, elements: readonly LibraryElement[]): boolean {
  if (p.tabId !== tabId) return false;
  const byId = new Map(elements.map((el) => [el.id, el]));
  const anchor = byId.get(p.anchor.id);
  if (!anchor || anchor.type === 'arrow') return false;
  return anchor.x === p.anchor.x && anchor.y === p.anchor.y && p.ids.every((id) => byId.has(id));
}

/**
 * Where a click lands an item of `size`: centred on `centre`, moved right past every earlier insert it would cover,
 * each move centred on the row of the insert it clears.
 */
export function clickFootprint(
  size: { width: number; height: number },
  centre: Point,
  earlier: readonly Rect[],
): Rect {
  let box = boxAround(centre, size.width, size.height);
  // Each move goes strictly right, so it ends after at most one move per earlier insert.
  for (let moves = 0; moves <= earlier.length; moves++) {
    const covered = earlier.find((b) => overlaps(box, b));
    if (!covered) return box;
    box = {
      ...box,
      x: covered.x + covered.width + LIBRARY_INSERT_GAP,
      y: covered.y + covered.height / 2 - size.height / 2,
    };
  }
  return box;
}

export function useLibraryItemInsert<E extends LibraryElement>(
  d: LibraryItemInsertDeps<E>,
): InsertLibraryItem<E> {
  const placed = useRef<Placed[]>([]);
  return (item, at) => {
    if (d.editsBlocked || d.locked) {
      console.warn('[library] insert refused', { reason: 'edits blocked' });
      return false;
    }
    if (d.tabElements.length + item.elements.length > d.maxElements) {
      console.warn('[library] insert refused', { reason: 'tab full' });
      return false;
    }
    // Forget inserts that moved, went, or belong to another tab.
    placed.current = placed.current.filter((p) => inPlace(p, d.tabId, d.tabElements));
    // The footprint is what lands: the elements' own bounds, which an item stored with another recorded size would
    // otherwise misstate.
    const elements = [...item.elements];
    const bounds = elements.length > 0 ? d.bounds(elements) : null;
    const size = bounds ? { width: bounds.w, height: bounds.h } : item;
    const box = at
      ? boxAround(at, size.width, size.height)
      : clickFootprint(
          size,
          d.getViewportCenter(),
          placed.current.map((p) => p.box),
        );
    const newElements = d.duplicate(elements, new Set(elements.map((el) => el.id)), box.x, box.y);
    if (newElements.length === 0) return false;
    d.commit((els) => [...els, ...newElements]);
    const anchor = newElements.find((el) => el.type !== 'arrow');
    if (anchor) {
      placed.current.push({
        tabId: d.tabId,
        box,
        ids: newElements.map((el) => el.id),
        anchor: { id: anchor.id, x: anchor.x ?? 0, y: anchor.y ?? 0 },
      });
    }
    if (newElements.length === 1) {
      d.setSelectedId(newElements[0]!.id);
      d.setMultiSelectedIds(new Set());
    } else {
      d.setSelectedId(null);
      d.setMultiSelectedIds(new Set(newElements.map((el) => el.id)));
    }
    d.onInserted?.(newElements.length);
    debugLog('[library] inserted', { elements: newElements.length, dropped: !!at });
    return true;
  };
}
