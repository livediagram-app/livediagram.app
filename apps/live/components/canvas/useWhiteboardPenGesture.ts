import { useEffect, useEffectEvent, useState, type RefObject } from 'react';
import { pointerToCanvas } from '@/lib/canvas';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { isWhiteboardPenIntent } from '@/lib/draw-mode';
import { coalescedSamples, createLiveStroke, eventTime, type LiveStroke } from '@/lib/live-stroke';

type Point = { x: number; y: number };

type WhiteboardPenGestureDeps = Pick<
  CanvasProps,
  'pendingDraw' | 'viewportZoom' | 'isPinchingRef' | 'onCommitFreehand'
> & {
  wrapperRef: RefObject<HTMLDivElement | null>;
};

// The whiteboard pen's gesture (docs/specs/023-whiteboard/whiteboard.md "Pens", "Touch and pen
// input"; blueprint whiteboard-round-one "Live stroke pipeline", Capture). The press makes one
// LiveStroke and sets it as state once; after that every move pushes its coalesced samples straight
// into the stroke and notifies its subscribers (the ink, the recognition dwell), so drawing costs no
// React render. Release commits the pipeline's own final points: what was drawn is what lands.
export function useWhiteboardPenGesture({
  pendingDraw,
  wrapperRef,
  viewportZoom,
  isPinchingRef,
  onCommitFreehand,
}: WhiteboardPenGestureDeps) {
  const [penStroke, setPenStroke] = useState<LiveStroke | null>(null);

  // The pen was put down mid-stroke (Escape, another tool): the stroke goes with it.
  if (penStroke && !isWhiteboardPenIntent(pendingDraw)) {
    console.debug('[whiteboard] stroke discarded: pen put down');
    setPenStroke(null);
  }

  /** Starts a stroke at `at` (canvas px) from the press `e`. */
  const beginWhiteboardStroke = (
    e: Pick<React.PointerEvent, 'pointerType' | 'pointerId' | 'timeStamp'>,
    at: Point,
  ) => {
    const stroke = createLiveStroke(e.pointerType, e.pointerId, viewportZoom);
    stroke.smoother.push(at.x, at.y, eventTime(e));
    setPenStroke(stroke);
  };

  // Samples convert with the zoom and the wrapper as they are at each event, so ink stays under the
  // pen even if the view moves mid-stroke; the smoothing keeps the press's zoom.
  const sampleInto = useEffectEvent((stroke: LiveStroke, samples: PointerEvent[]) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    for (const s of samples) {
      const p = pointerToCanvas(s.clientX, s.clientY, rect, viewportZoom);
      stroke.smoother.push(p.x, p.y, eventTime(s));
    }
  });
  const pinchingNow = useEffectEvent(() => isPinchingRef?.current === true);
  const commitStroke = useEffectEvent((stroke: LiveStroke, coalesced: number) => {
    const points = stroke.smoother.end();
    if (points.length < 2) return;
    console.debug(
      `[whiteboard] stroke ${stroke.pointer} samples=${stroke.smoother.sampleCount} coalesced=${coalesced} kept=${points.length}`,
    );
    onCommitFreehand(points, false);
  });

  useEffect(() => {
    if (!penStroke) return;
    const stroke = penStroke;
    // A second finger took over mid-stroke: the stroke is discarded on release.
    let pinched = false;
    // Samples beyond one per event, for the commit log.
    let coalesced = 0;
    const mine = (e: PointerEvent) =>
      stroke.pointerId === undefined ||
      e.pointerId === undefined ||
      e.pointerId === stroke.pointerId;
    const onMove = (e: PointerEvent) => {
      if (!mine(e)) return;
      if (pinchingNow()) pinched = true;
      if (pinched) return;
      const samples = coalescedSamples(e);
      coalesced += samples.length - 1;
      sampleInto(stroke, samples);
      stroke.notify();
    };
    const onUp = (e: PointerEvent) => {
      if (!mine(e)) return;
      if (pinchingNow()) pinched = true;
      setPenStroke(null);
      if (pinched) {
        console.debug('[whiteboard] stroke discarded: pinch');
        return;
      }
      sampleInto(stroke, [e]);
      commitStroke(stroke, coalesced);
    };
    const onCancel = (e: PointerEvent) => {
      if (!mine(e)) return;
      console.debug('[whiteboard] stroke discarded: cancel');
      setPenStroke(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [penStroke]);

  return { penStroke, beginWhiteboardStroke };
}
