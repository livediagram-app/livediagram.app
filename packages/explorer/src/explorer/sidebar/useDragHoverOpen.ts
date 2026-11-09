// A folded row that takes no drop of its own (the Library) opens under a drag that rests on it, so a target inside it
// (the Trash) is in reach: after LIBRARY_HOVER_OPEN_MS of the Explorer's own drag (an item, a folder, a This Browser
// item) held over it, once per visit. Shorter than a folder's spring (DRAG_HOVER_OPEN_MS): nothing lands on it, so a
// drag passing over it costs only an open row.

import { useEffect, useRef, type DragEvent } from 'react';
import { useDragStore } from '../../drag/store';

export const LIBRARY_HOVER_OPEN_MS = 500;

type Handlers = Record<
  'onDragEnter' | 'onDragOver' | 'onDragLeave' | 'onDrop',
  (e: DragEvent) => void
>;

/** The row's drag handlers, or undefined while `open` is null (the row is open already). They never accept the
 *  drop: the drag goes on to a target inside. */
export function useDragHoverOpen(open: (() => void) | null): Handlers | undefined {
  const store = useDragStore();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const depth = useRef(0);
  const run = useRef(open);
  useEffect(() => {
    run.current = open;
  });
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  useEffect(() => {
    if (!open) {
      clear();
      depth.current = 0;
    }
  }, [open]);
  if (!open) return undefined;
  return {
    onDragEnter: () => {
      depth.current += 1;
      if (timer.current || store.get() === null) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        run.current?.();
      }, LIBRARY_HOVER_OPEN_MS);
    },
    onDragOver: () => {},
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) clear();
    },
    onDrop: () => {
      depth.current = 0;
      clear();
    },
  };
}
