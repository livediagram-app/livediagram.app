import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { AlignmentGuide, DistributionGuide } from '@livehuddle/document';
import { sameDistGuides, sameGuides, sameTargets } from '@/lib/drag-geometry';
import type { SnapTarget } from '@/components/canvas/Canvas.types';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

// Cosmetic snap-guide overlay state for the active drag gesture (alignment
// guides, equal-spacing guides, and arrow-endpoint snap markers), all
// coalesced through rAF. Extracted from useEditorDrag: the guides are purely
// visual (the snap itself is applied synchronously in the drag tick), so
// keeping their state updates off the synchronous pointermove path and behind
// a same-check keeps the overlay out of the critical drag render.
//
// Held in one store per editor, not as the editor's render state
// (docs/specs/008-canvas/canvas-performance.md "A move re-renders what moved"): on a dense board the
// guides change on most frames of a drag, and only the chrome that draws them reads the store, so a
// new set renders that chrome and not the editor, the canvas or its elements.

export type SnapGuides = {
  // Alignment guides for the active gesture. Set from the move-effect on
  // every boxed move / single-element resize, cleared on pointer-up. The
  // render layer (CanvasChrome) draws them as faint lines.
  snapGuides: AlignmentGuide[];
  // Equal-spacing (distribution) guides: the gap segments shown when the
  // element snaps to even spacing with its neighbours.
  distGuides: DistributionGuide[];
  // Connection-point markers shown while dragging an arrow endpoint (the
  // anchors of nearby shapes).
  snapTargets: SnapTarget[];
};

export type SnapGuideStore = {
  get: () => SnapGuides;
  subscribe: (cb: () => void) => () => void;
  // Each part is kept when the new set matches it, and nothing is told when no part changed.
  set: (next: Partial<SnapGuides>) => void;
};

const NO_GUIDES: SnapGuides = { snapGuides: [], distGuides: [], snapTargets: [] };

export function createSnapGuideStore(): SnapGuideStore {
  let value = NO_GUIDES;
  const listeners = createListeners();
  return {
    get: () => value,
    subscribe: listeners.subscribe,
    set(next) {
      const merged: SnapGuides = {
        snapGuides:
          next.snapGuides && !sameGuides(value.snapGuides, next.snapGuides)
            ? next.snapGuides
            : value.snapGuides,
        distGuides:
          next.distGuides && !sameDistGuides(value.distGuides, next.distGuides)
            ? next.distGuides
            : value.distGuides,
        snapTargets:
          next.snapTargets && !sameTargets(value.snapTargets, next.snapTargets)
            ? next.snapTargets
            : value.snapTargets,
      };
      if (
        merged.snapGuides === value.snapGuides &&
        merged.distGuides === value.distGuides &&
        merged.snapTargets === value.snapTargets
      )
        return;
      value = merged;
      listeners.notify();
    },
  };
}

// The guides the chrome draws, read from the editor's store.
export function useSnapGuides(store: SnapGuideStore): SnapGuides {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function useSnapGuideState() {
  const [store] = useState(createSnapGuideStore);
  // Coalesce snap-guide updates into a single rAF. A pending frame is
  // cancelled + rescheduled so only the latest guides land; the store's
  // same-check then skips the render when they're unchanged.
  const guideRafRef = useRef<number | null>(null);
  // Stable identity (useCallback): closes over nothing but the ref + the
  // store, so consumers can safely list it in an effect's dep array
  // without re-subscribing on every render.
  const scheduleGuides = useCallback(
    (align: AlignmentGuide[], dist: DistributionGuide[] = []) => {
      if (guideRafRef.current !== null) cancelAnimationFrame(guideRafRef.current);
      guideRafRef.current = requestAnimationFrame(() => {
        guideRafRef.current = null;
        store.set({ snapGuides: align, distGuides: dist });
      });
    },
    [store],
  );
  // Snap-target markers ride the same coalesce-through-rAF pattern as the
  // guides: only the latest set lands, and the same-check skips the render
  // when the marker set (positions + which is active) is unchanged.
  const snapTargetsRafRef = useRef<number | null>(null);
  const scheduleSnapTargets = useCallback(
    (targets: SnapTarget[]) => {
      if (snapTargetsRafRef.current !== null) cancelAnimationFrame(snapTargetsRafRef.current);
      snapTargetsRafRef.current = requestAnimationFrame(() => {
        snapTargetsRafRef.current = null;
        store.set({ snapTargets: targets });
      });
    },
    [store],
  );
  useEffect(
    () => () => {
      if (guideRafRef.current !== null) cancelAnimationFrame(guideRafRef.current);
      if (snapTargetsRafRef.current !== null) cancelAnimationFrame(snapTargetsRafRef.current);
    },
    [],
  );

  return { snapGuideStore: store, scheduleGuides, scheduleSnapTargets };
}
