import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import { beginCanvasGesture } from '@/lib/canvas-gesture';
import { pointerToCanvas } from '@/lib/canvas';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { isWhiteboardPenIntent } from '@/lib/draw-mode';
import { createLiveStroke, type LiveStroke } from '@/lib/live-stroke';
import { flipStrokeRecognition } from '@/lib/recognition-flip';
import { debugLog } from '@/lib/debug-log';

type Point = { x: number; y: number };

type WhiteboardPenGestureDeps = Pick<
  CanvasProps,
  'pendingDraw' | 'isPinchingRef' | 'onCommitFreehand'
> & {
  viewportZoom: number;
  wrapperRef: RefObject<HTMLDivElement | null>;
};

// The whiteboard pen's gesture (docs/specs/023-draw-mode/draw-mode.md "Pens", "Touch and pen
// input"; blueprint whiteboard-round-one "Pen ink"). The press makes one LiveStroke and sets it as
// state once; after that every move adds its raw sample and pressure straight to the stroke and
// notifies its subscribers (the ink, the recognition dwell), so drawing costs no React render. One
// sample per move, as Excalidraw takes them: its streamline values are tuned to that rate. Release
// commits the very samples the stroke showed, so what was drawn is what lands. Alt (Option) pressed
// while the stroke is live flips it between ink and a shape ("Shape recognition").
export function useWhiteboardPenGesture({
  pendingDraw,
  wrapperRef,
  viewportZoom,
  isPinchingRef,
  onCommitFreehand,
}: WhiteboardPenGestureDeps) {
  const [penStroke, setPenStroke] = useState<LiveStroke | null>(null);
  // A pen stroke is a stroke gesture (docs/specs/008-canvas/canvas-performance.md), however it ends.
  const stroking = penStroke !== null;
  useEffect(() => (stroking ? beginCanvasGesture('stroke') : undefined), [stroking]);

  // The pen was put down mid-stroke (Escape, another tool): the stroke goes with it.
  if (penStroke && !isWhiteboardPenIntent(pendingDraw)) {
    debugLog('[whiteboard] stroke discarded: pen put down');
    setPenStroke(null);
  }

  /** Starts a stroke at `at` (canvas px) from the press `e`. */
  const beginWhiteboardStroke = (
    e: Pick<React.PointerEvent, 'pointerType' | 'pointerId' | 'pressure' | 'shiftKey'>,
    at: Point,
  ) => {
    const stroke = createLiveStroke(e.pointerType, e.pointerId);
    stroke.constrain(e.shiftKey === true);
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
    debugLog(
      `[whiteboard] stroke ${stroke.pointer} samples=${stroke.points.length} pressure=${stroke.pressures ? 'yes' : 'no'}`,
    );
    const snapped = stroke.shaped();
    onCommitFreehand(stroke.points.slice(), false, {
      ...(stroke.pressures ? { pressures: stroke.pressures.slice() } : {}),
      streamline: stroke.streamline,
      // Lifting lands what shows: the shape, or ink broken out of one, never re-read as a shape.
      ...(snapped ? { snapped } : stroke.keepsInk() ? { keepInk: true as const } : {}),
    });
  });

  const penWidth = useEffectEvent(() =>
    isWhiteboardPenIntent(pendingDraw) ? pendingDraw.width : 0,
  );
  // Alt went down while a stroke was live: its release is swallowed too, even after the lift, so
  // the browser never moves the focus to its menu bar.
  const swallowAltUp = useRef(false);
  useEffect(() => {
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'Alt' || !swallowAltUp.current) return;
      e.preventDefault();
      swallowAltUp.current = false;
    };
    window.addEventListener('keyup', onKeyUp);
    return () => window.removeEventListener('keyup', onKeyUp);
  }, []);

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
      // Shift reshapes a locked shape perfect, from this move on (draw-mode.md "Shape
      // recognition"); a move that only changes Shift still redraws.
      const shiftChanged = stroke.constrain(e.shiftKey);
      const p = canvasPoint(e);
      const pushed = p !== null && stroke.push(p.x, p.y, e.pressure);
      if (pushed || shiftChanged) stroke.notify();
    };
    const onUp = (e: PointerEvent) => {
      if (!mine(e)) return;
      if (pinchingNow()) pinched = true;
      setPenStroke(null);
      if (pinched) {
        debugLog('[whiteboard] stroke discarded: pinch');
        return;
      }
      // Where the pen lifted, if it moved since the last sample. A lifted pen reports no
      // pressure, so the sample keeps the last one. Shift keeps what the last move set, so the
      // shape lands as it showed.
      const p = canvasPoint(e);
      if (p) stroke.push(p.x, p.y);
      commitStroke(stroke);
    };
    const onCancel = (e: PointerEvent) => {
      if (!mine(e)) return;
      debugLog('[whiteboard] stroke discarded: cancel');
      setPenStroke(null);
    };
    // Each Alt press flips the stroke (docs/specs/023-draw-mode/draw-mode.md "Shape recognition");
    // while it is held, holding still does not snap the stroke again, and releasing it changes
    // nothing else.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Alt') return;
      e.preventDefault();
      swallowAltUp.current = true;
      if (e.repeat || pinched) return;
      stroke.holdInk(true);
      flipStrokeRecognition(stroke, penWidth(), 'key');
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') stroke.holdInk(false);
    };
    const onBlur = () => stroke.holdInk(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [penStroke]);

  return { penStroke, beginWhiteboardStroke };
}
