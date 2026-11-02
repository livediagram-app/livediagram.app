'use client';

// The Fill tool's press (livediagram docs/specs/023-draw-mode/fill-tool.md "Input", livedesign
// docs/specs/023-draw-mode/drawing-tools.md "The Fill tool"): a click or a tap fills, on release, where
// it went down, when the pointer moved less than 6 screen px. A drag, a second finger (a pinch) or a
// cancelled pointer fills nothing, so a pinch still zooms.
import { useEffect, useRef, type RefObject } from 'react';

/** How far a press may travel, in screen px, and still be a press. */
export const FILL_PRESS_SLOP_PX = 6;

type Press = { id: number; x: number; y: number };

export function useFillPress({
  armed,
  wrapperRef,
  viewportZoom,
  isPinchingRef,
  onPaintBucket,
}: {
  // The Fill tool is in hand.
  armed: boolean;
  // The canvas's zoomed content box: a press is measured from its corner, in canvas px.
  wrapperRef: RefObject<HTMLDivElement | null>;
  viewportZoom: number;
  isPinchingRef?: RefObject<boolean>;
  onPaintBucket?: (point: { x: number; y: number }) => void;
}) {
  const stopRef = useRef<(() => void) | null>(null);
  // The press in flight: a second finger landing marks it a pinch rather than starting another.
  const pinchRef = useRef<{ id: number; pinch: () => void } | null>(null);
  // A press in flight is dropped when the tool is put down or the view unmounts.
  useEffect(() => {
    if (armed) return;
    stopRef.current?.();
  }, [armed]);
  useEffect(() => () => stopRef.current?.(), []);

  const beginFillPress = (e: React.PointerEvent): boolean => {
    if (!armed || !onPaintBucket || e.button !== 0) return false;
    e.preventDefault();
    if (pinchRef.current && pinchRef.current.id !== e.pointerId) {
      pinchRef.current.pinch();
      return true;
    }
    // The same pointer down again (its release went missing): a fresh press.
    stopRef.current?.();
    const press: Press = { id: e.pointerId, x: e.clientX, y: e.clientY };
    let pinched = false;
    const pinch = () => {
      pinched = true;
    };
    const onDown = (ev: PointerEvent) => {
      // A second pointer down makes this a pinch.
      if (ev.pointerId !== press.id) pinch();
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== press.id) return;
      stop();
      const moved = Math.hypot(ev.clientX - press.x, ev.clientY - press.y);
      if (pinched || isPinchingRef?.current || moved >= FILL_PRESS_SLOP_PX) return;
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      onPaintBucket({
        x: (press.x - rect.left) / viewportZoom,
        y: (press.y - rect.top) / viewportZoom,
      });
    };
    const onCancel = (ev: PointerEvent) => {
      if (ev.pointerId === press.id) stop();
    };
    const stop = () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
      stopRef.current = null;
      pinchRef.current = null;
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
    stopRef.current = stop;
    pinchRef.current = { id: press.id, pinch };
    return true;
  };

  return { beginFillPress };
}
