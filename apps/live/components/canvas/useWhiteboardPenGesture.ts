import { useEffect, useEffectEvent, useState, type RefObject } from 'react';
import { pointerToCanvas } from '@/lib/canvas';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { isWhiteboardPenIntent } from '@/lib/draw-mode';
import { createLiveStroke, type LiveStroke } from '@/lib/live-stroke';

type Point = { x: number; y: number };

type WhiteboardPenGestureDeps = Pick<
  CanvasProps,
  'pendingDraw' | 'viewportZoom' | 'isPinchingRef' | 'onCommitFreehand'
> & {
  wrapperRef: RefObject<HTMLDivElement | null>;
};

// The whiteboard pen's gesture (docs/specs/023-whiteboard/whiteboard.md "Pens", "Touch and pen
// input"; blueprint whiteboard-round-one "Pen ink"). The press makes one LiveStroke and sets it as
// state once; after that every move adds its raw sample and pressure straight to the stroke and
// notifies its subscribers (the ink, the recognition dwell), so drawing costs no React render. One
// sample per move, as Excalidraw takes them: its streamline values are tuned to that rate. Release
// commits the very samples the stroke showed, so what was drawn is what lands.
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
    e: Pick<React.PointerEvent, 'pointerType' | 'pointerId' | 'pressure'>,
    at: Point,
  ) => {
    const stroke = createLiveStroke(e.pointerType, e.pointerId);
    stroke.push(at.x, at.y, e.pressure);
    setPenStroke(stroke);
  };

  // A sample converts with the zoom and the wrapper as they are at its event, so ink stays under
  // the pen even if the view moves mid-stroke.
  const canvasPoint = useEffectEvent((e: PointerEvent): Point | null => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    return rect ? pointerToCanvas(e.clientX, e.clientY, rect, viewportZoom) : null;
  });
  const pinchingNow = useEffectEvent(() => isPinchingRef?.current === true);
  const commitStroke = useEffectEvent((stroke: LiveStroke) => {
    if (stroke.points.length < 2) return;
    console.debug(
      `[whiteboard] stroke ${stroke.pointer} samples=${stroke.points.length} pressure=${stroke.pressures ? 'yes' : 'no'}`,
    );
    const snapped = stroke.shaped();
    onCommitFreehand(stroke.points.slice(), false, {
      ...(stroke.pressures ? { pressures: stroke.pressures.slice() } : {}),
      streamline: stroke.streamline,
      ...(snapped ? { snapped } : {}),
    });
  });

  useEffect(() => {
    if (!penStroke) return;
    const stroke = penStroke;
    // A second finger took over mid-stroke: the stroke is discarded on release.
    let pinched = false;
    const mine = (e: PointerEvent) =>
      stroke.pointerId === undefined ||
      e.pointerId === undefined ||
      e.pointerId === stroke.pointerId;
    const onMove = (e: PointerEvent) => {
      if (!mine(e)) return;
      if (pinchingNow()) pinched = true;
      if (pinched) return;
      const p = canvasPoint(e);
      if (!p || !stroke.push(p.x, p.y, e.pressure)) return;
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
      // Where the pen lifted, if it moved since the last sample. A lifted pen reports no
      // pressure, so the sample keeps the last one.
      const p = canvasPoint(e);
      if (p) stroke.push(p.x, p.y);
      commitStroke(stroke);
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
