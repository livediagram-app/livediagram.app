import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlignmentGuide, DistributionGuide } from '@livediagram/document';
import { sameDistGuides, sameGuides, sameTargets } from '@/lib/drag-geometry';
import type { SnapTarget } from '@/components/canvas/Canvas.types';

// Cosmetic snap-guide overlay state for the active drag gesture (alignment
// guides, equal-spacing guides, and arrow-endpoint snap markers), all
// coalesced through rAF. Extracted from useEditorDrag: the guides are purely
// visual (the snap itself is applied synchronously in the drag tick), so
// keeping their state updates off the synchronous pointermove path and behind
// a same-check keeps the overlay out of the critical drag render. Callers get
// the three arrays to render plus the two schedule* fns to push new sets; the
// setters stay private so the rAF-coalescing can't be bypassed.
export function useSnapGuideState() {
  // Alignment guides for the active gesture. Set from the move-effect on
  // every boxed move / single-element resize, cleared on pointer-up. The
  // render layer (CanvasChrome) draws them as faint lines.
  const [snapGuides, setSnapGuides] = useState<AlignmentGuide[]>([]);
  // Equal-spacing (distribution) guides: the gap segments shown when the
  // element snaps to even spacing with its neighbours. Rendered alongside
  // the alignment guides; coalesced through the same rAF below.
  const [distGuides, setDistGuides] = useState<DistributionGuide[]>([]);
  // Connection-point markers shown while dragging an arrow endpoint (the
  // anchors of nearby shapes). Coalesced through the same rAF as the guides.
  const [snapTargets, setSnapTargets] = useState<SnapTarget[]>([]);
  // Coalesce snap-guide state updates into a single rAF. A pending frame is
  // cancelled + rescheduled so only the latest guides land; the sameGuides
  // guard then skips the render when they're unchanged.
  const guideRafRef = useRef<number | null>(null);
  // Stable identity (useCallback []): closes over nothing but the ref + the
  // state setters, so consumers can safely list it in an effect's dep array
  // without re-subscribing on every render.
  const scheduleGuides = useCallback((align: AlignmentGuide[], dist: DistributionGuide[] = []) => {
    if (guideRafRef.current !== null) cancelAnimationFrame(guideRafRef.current);
    guideRafRef.current = requestAnimationFrame(() => {
      guideRafRef.current = null;
      setSnapGuides((prev) => (sameGuides(prev, align) ? prev : align));
      setDistGuides((prev) => (sameDistGuides(prev, dist) ? prev : dist));
    });
  }, []);
  // Snap-target markers ride the same coalesce-through-rAF pattern as the
  // guides: only the latest set lands, and the same-check skips the render
  // when the marker set (positions + which is active) is unchanged.
  const snapTargetsRafRef = useRef<number | null>(null);
  const scheduleSnapTargets = useCallback((targets: SnapTarget[]) => {
    if (snapTargetsRafRef.current !== null) cancelAnimationFrame(snapTargetsRafRef.current);
    snapTargetsRafRef.current = requestAnimationFrame(() => {
      snapTargetsRafRef.current = null;
      setSnapTargets((prev) => (sameTargets(prev, targets) ? prev : targets));
    });
  }, []);
  useEffect(
    () => () => {
      if (guideRafRef.current !== null) cancelAnimationFrame(guideRafRef.current);
      if (snapTargetsRafRef.current !== null) cancelAnimationFrame(snapTargetsRafRef.current);
    },
    [],
  );

  return { snapGuides, distGuides, snapTargets, scheduleGuides, scheduleSnapTargets };
}
