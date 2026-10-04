'use client';

import {
  useEffect,
  useEffectEvent,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';

// Keep the caret above a phone's on-screen keyboard (docs/specs/007-editor/live-app.md "Mobile
// chrome"). The keyboard shrinks the VISUAL viewport, not the page, and the canvas never scrolls,
// so editing a label low on the screen typed behind the keyboard. While a text field inside the
// canvas has focus, every visual-viewport change re-checks the caret, and if it sits below the
// visible area the canvas pans up by just the overlap (plus a margin). The pan is not undone when
// the keyboard closes: the user is looking at what they typed.
export const KEYBOARD_MARGIN_PX = 24;

// How far (screen px) the caret runs past the visible bottom edge, or 0 when it is in view.
export function keyboardOverlap(
  caretBottom: number,
  visibleBottom: number,
  margin = KEYBOARD_MARGIN_PX,
): number {
  return Math.max(0, caretBottom - (visibleBottom - margin));
}

function caretBottom(field: HTMLElement): number {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && field.contains(sel.anchorNode)) {
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    // A collapsed caret in an empty line reports a zero rect; fall back to the field.
    if (rect.height > 0) return rect.bottom;
  }
  return field.getBoundingClientRect().bottom;
}

export function useKeyboardAvoidance({
  canvasMainRef,
  zoomRef,
  setViewportOffset,
}: {
  canvasMainRef: RefObject<HTMLElement | null>;
  // The zoom now, read when the keyboard moves.
  zoomRef: RefObject<number>;
  setViewportOffset: Dispatch<SetStateAction<{ x: number; y: number }>>;
}): void {
  const phone = useIsMobileViewport();
  // Reads the latest zoom without re-subscribing on every zoom step.
  const check = useEffectEvent(() => {
    const vv = window.visualViewport;
    const field = document.activeElement;
    const canvas = canvasMainRef.current;
    if (!vv || !(field instanceof HTMLElement) || !canvas || !canvas.contains(field)) return;
    const editable =
      field.isContentEditable ||
      field instanceof HTMLTextAreaElement ||
      field instanceof HTMLInputElement;
    if (!editable) return;
    const dy = keyboardOverlap(caretBottom(field), vv.offsetTop + vv.height);
    if (dy === 0) return;
    // The offset is in canvas units (the zoom applies about the viewport's centre).
    setViewportOffset((o) => ({ x: o.x, y: o.y - dy / zoomRef.current }));
  });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!phone || !vv) return;
    const onChange = () => check();
    vv.addEventListener('resize', onChange);
    vv.addEventListener('scroll', onChange);
    // Focus lands before the keyboard finishes rising; the resize above catches the rest.
    document.addEventListener('focusin', onChange);
    return () => {
      vv.removeEventListener('resize', onChange);
      vv.removeEventListener('scroll', onChange);
      document.removeEventListener('focusin', onChange);
    };
  }, [phone]);
}
