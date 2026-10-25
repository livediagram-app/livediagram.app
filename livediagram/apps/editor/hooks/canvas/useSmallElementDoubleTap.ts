'use client';

import { useCallback, useRef, type MouseEvent, type PointerEvent } from 'react';
import { DOUBLE_PRESS_MS, pressLedger } from '@liveworkspace/workbench/lib/double-press';
import { isDoubleTapZoomPointer } from '@/lib/double-tap-zoom';

// A double-tap's second press counts from the element presses' shared ledger (lib/double-press), which every element
// part records into (a box, an arrow's line or label, a selection handle): an arrow opens its label editor on that
// press, a box on the dblclick after it. So the small-element check runs on the press, ahead of them all, and the
// dblclick that follows a framing is swallowed too.
const OPEN_EDITOR = 'input, textarea, [contenteditable="true"], [contenteditable=""]';

// The element a press landed on: its own node, or the node of the element whose selection handles it pressed.
export function pressedElement(target: EventTarget | null): Element | null {
  if (!(target instanceof Element) || target.closest(OPEN_EDITOR)) return null;
  const own = target.closest('[data-element-id]');
  if (own) return own;
  const id = target.closest('[data-grips-for]')?.getAttribute('data-grips-for');
  return id ? document.querySelector(`[data-element-id="${CSS.escape(id)}"]`) : null;
}

// A finger's double-tap on an element too small to work on frames it before it edits
// (docs/specs/008-canvas/canvas-and-palette.md "Double-tap to zoom"), whatever the element would open: mounted as
// the canvas's capture handlers, so they run before any element's own. A double-tap inside an open editor stays the
// editor's, to select a word.
export function useSmallElementDoubleTap(onElement: (node: Element) => boolean): {
  onPointerDownCapture: (e: PointerEvent) => void;
  onDoubleClickCapture: (e: MouseEvent) => void;
} {
  // When the last framing press landed (event time), so the dblclick that follows it does not edit.
  const framedAt = useRef<number | null>(null);
  const onPointerDownCapture = useCallback(
    (e: PointerEvent) => {
      if (!isDoubleTapZoomPointer(e.pointerType)) return;
      const node = pressedElement(e.target);
      const id = node?.getAttribute('data-element-id');
      if (!node || !id) return;
      const press = { id, t: e.timeStamp, x: e.clientX, y: e.clientY, wasSelected: true };
      if (!pressLedger.peek(press).pairs || !onElement(node)) return;
      // Consumed here: recorded as the pair it completes, so a third tap starts afresh.
      pressLedger.press(press);
      framedAt.current = e.timeStamp;
      e.stopPropagation();
    },
    [onElement],
  );
  const onDoubleClickCapture = useCallback((e: MouseEvent) => {
    const at = framedAt.current;
    if (at === null) return;
    framedAt.current = null;
    if (e.timeStamp - at <= DOUBLE_PRESS_MS) e.stopPropagation();
  }, []);
  return { onPointerDownCapture, onDoubleClickCapture };
}
