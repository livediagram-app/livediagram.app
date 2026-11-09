'use client';

import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  isBoxed,
  isRetiredArrow,
  retiredArrowEnds,
  type Element,
  type ElementIndex,
  type Point,
} from '@livehuddle/document';
import { dragPreviewFor, subscribeDragPreview, type DragOverlay } from '@/lib/drag-preview';
import { arrowsReading, type RetiredArrowLinks } from '@/components/canvas/retired-arrow-links';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { ridingElements, type RideOffset } from '@liveworkspace/workbench/lib/drag-ride';
import { createRideWriter } from '@liveworkspace/workbench/lib/drag-ride-dom';

// The element layer's drag preview (docs/specs/008-canvas/drag-preview.md "The preview",
// docs/specs/008-canvas/canvas-performance.md "A move re-renders what moved"): what each element looks
// like while a gesture lasts, derived once per preview change outside React and read per element, so a
// preview frame re-renders the elements it changes and never the layer that holds all of them. The
// layer itself re-renders only when the preview adds or removes elements (a Shift-duplicate), which
// changes what it lists. What a preview only moves rides an offset written outside React (drag-ride.ts), so a move
// frame re-renders none of it (docs/specs/008-canvas/drag-preview.md "Moves ride an offset"): only the retired arrows
// with an end on what moved, whose ends are worked out against the preview
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4).

export type LayerDrawn = { element: Element; layerOpacity: number };

// What one element draws from while a preview lasts: the element as the gesture has it, and for a
// retired arrow reading what moved, its ends as the preview has them.
export type PreviewEntry = {
  element: Element;
  ends?: { from: Point; to: Point };
};

// The ids the preview adds and removes: what the layer lists, as one value that holds while the set does.
// `added` carries each element as it was when the set last changed, for listing; what it draws comes
// from its entry.
export type PreviewStructure = Pick<DragOverlay, 'removed' | 'added'>;

export type LayerPreviewInputs = {
  tabId: string;
  ordered: readonly LayerDrawn[];
  drawnElements: readonly Element[];
  elementIndex: ElementIndex;
  arrowLinks: RetiredArrowLinks | null;
};

export type LayerPreviewStore = {
  subscribe: (id: string, cb: () => void) => () => void;
  entryOf: (id: string) => PreviewEntry | undefined;
  subscribeStructure: (cb: () => void) => () => void;
  structure: () => PreviewStructure | null;
  // Re-derives from the latest preview and inputs, notifying only the elements whose entry changed.
  update: (inputs: LayerPreviewInputs) => void;
  // The element plane (a ref callback): the riding offsets are written to nodes under its parent.
  attachPlane: (plane: HTMLElement | null) => void;
};

// `ordered` with the preview laid over it: changed elements swapped in, removed ones dropped, added ones in the order
// lib/drag-preview's applyOverlay gives them (which selection and hit-testing read): those after nothing first, each
// after its neighbour, a chain of adds (a multi-element duplicate) one after another, the rest at the end. An added
// element takes its neighbour's layer opacity. Linear in the board.
export function shownWithOverlay(
  ordered: readonly LayerDrawn[],
  overlay: Pick<DragOverlay, 'removed' | 'added'> & { changed?: DragOverlay['changed'] },
): LayerDrawn[] {
  const pending = new Map<string | null, Element[]>();
  for (const { el, after } of overlay.added)
    pending.set(after, [...(pending.get(after) ?? []), el]);
  const shown: LayerDrawn[] = [];
  const drain = (key: string | null, layerOpacity: number) => {
    const queue = pending.get(key);
    if (!queue) return;
    pending.delete(key);
    for (const el of queue) {
      shown.push({ element: el, layerOpacity });
      drain(el.id, layerOpacity);
    }
  };
  drain(null, ordered[0]?.layerOpacity ?? 1);
  for (const o of ordered) {
    if (overlay.removed.has(o.element.id)) continue;
    shown.push({
      element: overlay.changed?.get(o.element.id) ?? o.element,
      layerOpacity: o.layerOpacity,
    });
    drain(o.element.id, o.layerOpacity);
  }
  for (const key of [...pending.keys()]) drain(key, 1);
  return shown;
}

// Whether two inputs would derive the same entries. The layer hands a fresh object on every render, so identity
// alone made any layer render mid-gesture (a peer's cursor, a timer tick) re-derive every moved element; the fields
// themselves are what matter.
function sameInputs(a: LayerPreviewInputs | null, b: LayerPreviewInputs): boolean {
  return (
    a !== null &&
    a.tabId === b.tabId &&
    a.ordered === b.ordered &&
    a.drawnElements === b.drawnElements &&
    a.elementIndex === b.elementIndex &&
    a.arrowLinks === b.arrowLinks
  );
}

// Whether an element looks the same (every field the same value): a collaborator's preview is rebuilt as a fresh
// object on every frame of ours, though nothing about it moved.
function sameElement(a: Element, b: Element): boolean {
  if (a === b) return true;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]);
}

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

// The previous entry when the new one draws the same (the same element, and for an arrow the same ends), so only
// the elements that changed re-render.
function steadyEntry(prev: PreviewEntry | undefined, next: PreviewEntry): PreviewEntry {
  if (!prev || !sameElement(prev.element, next.element)) return next;
  const pe = prev.ends;
  const ne = next.ends;
  if (pe || ne) {
    if (!pe || !ne || !samePoint(pe.from, ne.from) || !samePoint(pe.to, ne.to)) return next;
  }
  return prev;
}

const structureKey = (s: PreviewStructure | null) =>
  s === null
    ? ''
    : `${[...s.removed].join(',')}|${s.added.map((a) => `${a.el.id}<${a.after ?? ''}`).join(',')}`;

const NO_RIDES: ReadonlyMap<string, RideOffset> = new Map();

export function createLayerPreviewStore(): LayerPreviewStore {
  let entries = new Map<string, PreviewEntry>();
  const rideWriter = createRideWriter();
  // The board the offsets were written over: they stay until the layer draws another (the release's write, in the
  // same paint as the elements at their new place), or the next frame when nothing is written (a cancel).
  let rodeOver: readonly Element[] | null = null;
  let rideCount = 0;
  let dropFrame: number | null = null;
  const dropRides = () => {
    if (dropFrame !== null) cancelAnimationFrame(dropFrame);
    dropFrame = null;
    rodeOver = null;
    rideWriter.apply(NO_RIDES);
  };
  const writeRides = (rides: ReadonlyMap<string, RideOffset>, over: readonly Element[]) => {
    if (dropFrame !== null) cancelAnimationFrame(dropFrame);
    dropFrame = null;
    if (rides.size === 0 && !rideWriter.active()) {
      rideCount = 0;
      return;
    }
    rodeOver = rides.size > 0 ? over : null;
    rideWriter.apply(rides);
    // Logged when the count changes, with how many planes carry the offset as one layer.
    if (rides.size !== rideCount) {
      rideCount = rides.size;
      if (rides.size > 0)
        debugLog('[drag-preview] ride', { count: rides.size, planes: rideWriter.planesCarrying() });
    }
  };
  let structure: PreviewStructure | null = null;
  let lastOverlay: DragOverlay | null = null;
  let lastInputs: LayerPreviewInputs | null = null;
  const byId = new Map<string, Set<() => void>>();
  const structureListeners = new Set<() => void>();

  function derive(
    overlay: DragOverlay,
    inputs: LayerPreviewInputs,
  ): { out: Map<string, PreviewEntry>; rides: ReadonlyMap<string, RideOffset> } {
    const out = new Map<string, PreviewEntry>();
    const { elementIndex, arrowLinks } = inputs;
    const rides = ridingElements(overlay, elementIndex, { isBoxed, arrowsRide: false });
    for (const [id, element] of overlay.changed) if (!rides.has(id)) out.set(id, { element });
    for (const { el } of overlay.added) out.set(el.id, { element: el });
    if (!arrowLinks) return { out, rides };
    // The retired arrows with an end on what the preview changes, adds or removes, drawn with their ends worked out
    // against the board as the preview has it (an end whose element the preview removes takes the other end's point).
    const moved = [
      ...overlay.changed.keys(),
      ...overlay.added.map((a) => a.el.id),
      ...overlay.removed,
    ];
    const ids = arrowsReading(arrowLinks, moved);
    if (ids.size === 0) return { out, rides };
    const index = new Map(elementIndex);
    for (const [id, el] of overlay.changed) index.set(id, el);
    for (const { el } of overlay.added) index.set(el.id, el);
    for (const id of overlay.removed) index.delete(id);
    for (const id of ids) {
      const arrow = index.get(id);
      if (!arrow || !isRetiredArrow(arrow)) continue;
      out.set(id, { element: arrow, ends: retiredArrowEnds(arrow, index) });
    }
    return { out, rides };
  }

  return {
    subscribe(id, cb) {
      let set = byId.get(id);
      if (!set) byId.set(id, (set = new Set()));
      set.add(cb);
      return () => {
        set.delete(cb);
        if (set.size === 0) byId.delete(id);
      };
    },
    entryOf: (id) => entries.get(id),
    subscribeStructure(cb) {
      structureListeners.add(cb);
      return () => {
        structureListeners.delete(cb);
      };
    },
    structure: () => structure,
    attachPlane(plane) {
      rideWriter.setRoot(plane?.parentElement ?? null);
    },
    update(inputs) {
      const overlay = dragPreviewFor(inputs.tabId, inputs.drawnElements);
      // The preview ended and the layer now draws another board (the release landed): the offsets go, in this
      // commit, before it paints.
      if (!overlay && rodeOver && inputs.drawnElements !== rodeOver) dropRides();
      // Nothing to do: no preview before or now, or the same preview over the same inputs.
      if (overlay === lastOverlay && (overlay === null || sameInputs(lastInputs, inputs))) return;
      lastOverlay = overlay;
      lastInputs = inputs;
      const prev = entries;
      const derived = overlay ? derive(overlay, inputs) : null;
      entries = derived?.out ?? new Map<string, PreviewEntry>();
      if (derived) writeRides(derived.rides, inputs.drawnElements);
      else if (rodeOver && dropFrame === null) {
        // No board written yet (a cancel, or the release's write still on its way): drop them before the next
        // paint at the latest.
        dropFrame = requestAnimationFrame(dropRides);
      }
      for (const [id, entry] of entries) entries.set(id, steadyEntry(prev.get(id), entry));
      const nextStructure: PreviewStructure | null =
        overlay && (overlay.removed.size > 0 || overlay.added.length > 0)
          ? { removed: overlay.removed, added: overlay.added }
          : null;
      const structureChanged = structureKey(nextStructure) !== structureKey(structure);
      if (structureChanged) structure = nextStructure;
      // Only the elements whose entry changed (an entry that draws the same is kept, steadyEntry; one the preview no
      // longer holds redraws from the document).
      const touched = new Set([...prev.keys(), ...entries.keys()]);
      for (const id of touched) {
        if (prev.get(id) === entries.get(id)) continue;
        for (const cb of byId.get(id) ?? []) cb();
      }
      if (structureChanged) for (const cb of structureListeners) cb();
    },
  };
}

// The store for one element layer, kept in step with the drag preview and with the layer's inputs. The
// layer reads `structure` (rendering only when the preview adds or removes elements); each element reads
// its own entry through `usePreviewEntry`.
export function useLayerDragPreview(inputs: LayerPreviewInputs): {
  store: LayerPreviewStore;
  structure: PreviewStructure | null;
} {
  const [store] = useState(createLayerPreviewStore);
  const inputsRef = useRef(inputs);
  // The layer rendered with new inputs mid-gesture (a collaborator's change, a new label pass):
  // re-derive against them before paint.
  useLayoutEffect(() => {
    inputsRef.current = inputs;
    store.update(inputs);
  });
  // Subscribed before paint, and read once on subscribing: a preview change between the layer's commit and a passive
  // effect (a layer mounting mid-gesture, a tab switched back to while a peer drags) would otherwise never be applied.
  useLayoutEffect(() => {
    const off = subscribeDragPreview(() => store.update(inputsRef.current));
    store.update(inputsRef.current);
    return off;
  }, [store]);
  const structure = useSyncExternalStore(store.subscribeStructure, store.structure, () => null);
  return { store, structure };
}

// One element's preview entry: undefined while no preview changes it.
export function usePreviewEntry(store: LayerPreviewStore, id: string): PreviewEntry | undefined {
  const subscribe = useCallback((cb: () => void) => store.subscribe(id, cb), [store, id]);
  const read = useCallback(() => store.entryOf(id), [store, id]);
  return useSyncExternalStore(subscribe, read, read);
}
