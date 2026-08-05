// Shift-duplicate identity swap for a boxed move (spec/80).
//
// Holding Shift mid-drag turns a move into a copy, and it does that by
// SWAPPING identities rather than by dragging a copy: the ORIGINAL elements
// park back at their start position keeping their ids (so every arrow pinned
// to them stays attached to the stationary set), and a fresh CLONE set takes
// over the cursor, drawn as a translucent ghost. Releasing Shift swings it
// back. The final keep-or-discard decision is made at pointer-up.
//
// Lifted out of useEditorDrag's pointer-move listener, where it was ~125
// lines nested three deep inside the boxed-move branch of a ~700-line
// effect. It's the subtlest logic in that effect — idempotent cloning,
// boundary-arrow re-pinning, and snapshot restore each exist because of a
// specific bug — and none of that is about pointer-move plumbing, which is
// all the surrounding code does.
//
// Not a hook: no state of its own. The ref, the ghost-id setState and the
// drag setState all still belong to the caller and are passed in, so the
// React-shaped parts stay where React can see them.

import { duplicateGroupedElements, type ArrowElement, type Element } from '@livediagram/diagram';
import { translateBoxedSelection } from './boxed-drag-resolve';
import type { DragState } from '@/lib/canvas';

export type BoxedDragState = Extract<DragState, { kind: 'boxed' }>;

// What's needed to swing back when Shift is released mid-drag.
export type ShiftDupSwap = {
  cloneIds: Set<string>;
  orig: BoxedDragState;
  origSelectedId: string | null;
  origMultiIds: Set<string>;
};

export type ShiftDuplicateSwapArgs = {
  drag: BoxedDragState;
  shiftKey: boolean;
  isReadOnly: boolean;
  // Canvas-space delta since the gesture started.
  dx: number;
  dy: number;
  elements: Element[];
  // The live swap record, or null when no swap is in effect. Read and
  // written here; it's a ref in the caller so mid-drag Shift toggles don't
  // churn the pointer-listener effect.
  swap: ShiftDupSwap | null;
  setSwap: (next: ShiftDupSwap | null) => void;
  setGhostIds: (ids: ReadonlySet<string> | null) => void;
  setDrag: (next: BoxedDragState) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  multiSelectedIds: Set<string>;
  setMultiSelectedIds: (ids: Set<string>) => void;
  tick: (mapper: (els: Element[]) => Element[]) => void;
};

// Returns true when the swap took over this move tick, meaning the caller
// should stop processing it (the identity change has already been applied,
// and the ordinary translate would fight it).
export function applyShiftDuplicateSwap(args: ShiftDuplicateSwapArgs): boolean {
  const {
    drag,
    shiftKey,
    isReadOnly,
    dx,
    dy,
    elements,
    swap,
    setSwap,
    setGhostIds,
    setDrag,
    selectedId,
    setSelectedId,
    multiSelectedIds,
    setMultiSelectedIds,
    tick,
  } = args;

  if (shiftKey && !swap && !isReadOnly) {
    const dupIds = new Set<string>([...drag.startBounds.keys(), ...drag.startArrowEnds.keys()]);
    // Build the clones ONCE, outside the state updater: React may
    // re-run an updater (StrictMode, batched replays), and a mapper
    // that mints fresh ids per run appends a new clone set each
    // time. With the elements fixed up front the mapper below is
    // idempotent — it only appends when the clones aren't there.
    // Zero offset: the clones spawn exactly where the dragged set
    // currently sits and keep following the cursor from there.
    const { newElements, idMap } = duplicateGroupedElements(elements, dupIds, 0, 0);
    // Boundary arrows: an arrow OUTSIDE the set with exactly one
    // end pinned to a dragged element gets a copy re-pinned to the
    // clone (the other end keeps its original pin), so e.g. an
    // incoming connector is drawn to the duplicate too. Both-ends-
    // inside arrows were already carried by the duplicate helper.
    const boundaryArrows: ArrowElement[] = [];
    for (const el of elements) {
      if (el.type !== 'arrow' || idMap.has(el.id)) continue;
      const remapEnd = (end: ArrowElement['from']): ArrowElement['from'] | null =>
        end.kind === 'pinned' && idMap.has(end.elementId)
          ? { ...end, elementId: idMap.get(end.elementId)! }
          : null;
      const from = remapEnd(el.from);
      const to = remapEnd(el.to);
      if (!from && !to) continue;
      boundaryArrows.push({
        ...el,
        id: crypto.randomUUID(),
        from: from ?? el.from,
        to: to ?? el.to,
      });
    }
    if (newElements.length === 0) return false;

    const cloneIds = new Set([...newElements, ...boundaryArrows].map((el) => el.id));
    setSwap({
      cloneIds,
      orig: drag,
      origSelectedId: selectedId,
      origMultiIds: new Set(multiSelectedIds),
    });
    setGhostIds(cloneIds);
    // Park the originals by RESTORING them — plus every arrow
    // connected to them — from the grab-time snapshot, not by a
    // plain position translate: the frames before this swap were
    // a normal move, whose auto-rebind pass may have re-picked
    // anchor faces on arrows spanning to shapes that never moved.
    // The snapshot puts those anchors back exactly as they were.
    const snapById = new Map(drag.startElements.map((el) => [el.id, el] as const));
    const restoreIds = new Set<string>(dupIds);
    for (const el of drag.startElements) {
      if (el.type !== 'arrow' || restoreIds.has(el.id)) continue;
      const touches = (end: ArrowElement['from']) =>
        (end.kind === 'pinned' && dupIds.has(end.elementId)) ||
        (end.kind === 'on-arrow' && dupIds.has(end.arrowId));
      if (touches(el.from) || touches(el.to)) restoreIds.add(el.id);
    }
    tick((els) => {
      if (els.some((el) => cloneIds.has(el.id))) return els;
      const parked = els.map((el) => (restoreIds.has(el.id) ? (snapById.get(el.id) ?? el) : el));
      return [...parked, ...newElements, ...boundaryArrows];
    });
    // Re-key the live drag to the clone ids (same start bounds,
    // so the dx/dy math continues seamlessly) and move the
    // selection onto the cursor-following set.
    const mapId = (id: string) => idMap.get(id) ?? id;
    setDrag({
      ...drag,
      primaryId: mapId(drag.primaryId),
      startBounds: new Map([...drag.startBounds].map(([id, b]) => [mapId(id), b] as const)),
      startArrowEnds: new Map(
        [...drag.startArrowEnds].map(([id, ends]) => [mapId(id), ends] as const),
      ),
    });
    if (selectedId && idMap.has(selectedId)) setSelectedId(mapId(selectedId));
    if (multiSelectedIds.size > 0) {
      setMultiSelectedIds(new Set([...multiSelectedIds].map(mapId)));
    }
    return true;
  }

  if (!shiftKey && swap) {
    // Shift released mid-drag: drop the clones, hand the cursor
    // back to the originals (translated to where the ghost was),
    // and restore the selection.
    setSwap(null);
    setGhostIds(null);
    tick((els) => {
      const withoutClones = els.filter((el) => !swap.cloneIds.has(el.id));
      return translateBoxedSelection(
        withoutClones,
        swap.orig.startBounds,
        swap.orig.startArrowEnds,
        dx,
        dy,
      );
    });
    setDrag({
      ...drag,
      primaryId: swap.orig.primaryId,
      startBounds: swap.orig.startBounds,
      startArrowEnds: swap.orig.startArrowEnds,
    });
    setSelectedId(swap.origSelectedId);
    setMultiSelectedIds(swap.origMultiIds);
    return true;
  }

  return false;
}
