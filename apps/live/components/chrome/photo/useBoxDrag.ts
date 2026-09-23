'use client';

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { DetectedSticky } from '@livediagram/sticky-vision';
import { moveBox, resizeBox, type Corner } from '@/lib/photo-boxes';

// Moving a box by its body, or resizing it by a corner handle (spec/139 Phase
// 9). The pointer is converted into WORKING-image pixels through the
// picture's on-screen rect, which already carries the zoom, so a drag moves
// the box exactly as far as the pointer went at any zoom.
//
// Every step is measured from where the drag STARTED, against the box as it
// was then — never accumulated — so rounding cannot creep.
export function useBoxDrag(opts: {
  pictureRef: RefObject<HTMLDivElement | null>;
  frame: { width: number; height: number };
  onChange: (id: number, next: DetectedSticky) => void;
}) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const drag = useRef<{
    box: DetectedSticky;
    mode: 'move' | Corner;
    x: number;
    y: number;
    pointerId: number;
  } | null>(null);

  useEffect(() => {
    const toWorking = (e: PointerEvent) => {
      const d = drag.current!;
      const rect = optsRef.current.pictureRef.current!.getBoundingClientRect();
      const { width, height } = optsRef.current.frame;
      return {
        dx: ((e.clientX - d.x) / rect.width) * width,
        dy: ((e.clientY - d.y) / rect.height) * height,
      };
    };
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const { dx, dy } = toWorking(e);
      const { frame, onChange } = optsRef.current;
      onChange(
        d.box.id,
        d.mode === 'move' ? moveBox(d.box, dx, dy, frame) : resizeBox(d.box, d.mode, dx, dy, frame),
      );
    };
    const onUp = (e: PointerEvent) => {
      if (drag.current?.pointerId === e.pointerId) drag.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // Start a drag from a box's body ('move') or one of its corners. Only the
  // primary button: the middle button pans, and belongs to the view.
  const begin = (e: ReactPointerEvent, box: DetectedSticky, mode: 'move' | Corner) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    drag.current = { box, mode, x: e.clientX, y: e.clientY, pointerId: e.pointerId };
  };

  // Drop the drag in progress: a second finger arrived, and this is a pinch.
  const cancel = () => {
    drag.current = null;
  };

  return { begin, cancel };
}
