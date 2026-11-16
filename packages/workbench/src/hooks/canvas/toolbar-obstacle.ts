'use client';

// A panel a selection's toolbar keeps off (`data-toolbar-obstacle`: livediagram's Quick Style panel) says when it
// arrives, resizes, moves or goes, and the toolbar places itself again (useEdgeAwarePlacement). The toolbar otherwise
// re-places only as the selection or the view changes, and the Quick Style panel mounts, and takes its spot, a beat
// after the toolbar placed for a fresh selection, so the toolbar stayed over its top colour row (Work Tracker 1032).
// Coalesced to one note a frame; nothing runs while the panel is still, and a toolbar suspended for a drag ignores it.
import { useLayoutEffect, type RefObject } from 'react';
import { watchMove } from '../../lib/watch-move';

export const TOOLBAR_OBSTACLE_EVENT = 'workbench:toolbar-obstacle';

/** Tells every selection toolbar that an obstacle arrived, changed or went. */
export function noteToolbarObstacle(): void {
  window.dispatchEvent(new Event(TOOLBAR_OBSTACLE_EVENT));
}

/** Notes the obstacle at `ref` while `active`: as it mounts, resizes or moves, and as it goes. */
export function useToolbarObstacle(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    let frame = 0;
    const note = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        noteToolbarObstacle();
      });
    };
    const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(note) : null;
    resize?.observe(el);
    const stopMove = watchMove(el, note);
    note();
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      stopMove();
      noteToolbarObstacle();
    };
  }, [ref, active]);
}
