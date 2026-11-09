'use client';

// A press on the canvas starts no text selection (each editor's docs/specs/008-canvas/canvas-performance.md "A press
// on the canvas selects no text"). The canvas is `select-none`, yet Safari still begins a text selection from a mouse
// press on it and, on the drag's first move, works out where that selection would run across the whole board: one
// frame of about 0.7 s on a design of 2,000 boxes and 1,999 arrows, at the start of every marquee or pan. The canvas
// cancels the selection as it starts, except where text is being typed (a label, a note, a field) or where an element
// opts in with `select-text`.
import { useEffect, type Ref } from 'react';

const SELECTABLE =
  'input, textarea, [contenteditable]:not([contenteditable="false"]), .select-text';

/** Whether a selection starting at `target` (an element or a text node) is the canvas's to cancel. */
export function cancelsCanvasSelectStart(target: EventTarget | null): boolean {
  const node = target as Node | null;
  const el =
    node && node.nodeType === Node.ELEMENT_NODE ? (node as Element) : (node?.parentElement ?? null);
  return !el?.closest(SELECTABLE);
}

// `ref` as the canvas's surface ref arrives (an object ref; a callback ref has nothing to read and is left alone).
export function useNoCanvasTextSelection(ref: Ref<HTMLElement>): void {
  useEffect(() => {
    const surface = ref && typeof ref === 'object' ? ref.current : null;
    if (!surface) return;
    const onSelectStart = (e: Event) => {
      if (cancelsCanvasSelectStart(e.target)) e.preventDefault();
    };
    surface.addEventListener('selectstart', onSelectStart);
    return () => surface.removeEventListener('selectstart', onSelectStart);
  }, [ref]);
}
