'use client';

// The editor's notice slot, measured (lib/notice-slot): above the whiteboard dock when one is on
// screen, else where a dock would sit. A notice on show holds the slot, so a suggestion waits. Re-measured when the dock or the window changes
// size, never on a timer; null until the first measure, so the notice never paints out of place.
import { useLayoutEffect, useState } from 'react';
import { holdNoticeSlot, noticeBottom } from '../../lib/notice-slot';
import { CANVAS_ROOT_SELECTOR } from '../../lib/canvas-selectors';

const DOCK_SELECTOR = '[data-whiteboard-dock]';

// `hold` false for a notice that yields to others (a suggestion), so it never blocks itself.
export function useNoticeSlot(active: boolean, hold = true): number | null {
  const [bottom, setBottom] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!active) return;
    const measure = () => {
      const dock = document.querySelector<HTMLElement>(DOCK_SELECTOR);
      const canvas = document.querySelector<HTMLElement>(CANVAS_ROOT_SELECTOR);
      setBottom(
        noticeBottom({
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          dockTop: dock ? dock.getBoundingClientRect().top : null,
          canvasBottom: canvas ? canvas.getBoundingClientRect().bottom : window.innerHeight,
        }),
      );
    };
    measure();
    const release = hold ? holdNoticeSlot() : null;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    const dock = document.querySelector(DOCK_SELECTOR);
    const canvas = document.querySelector(CANVAS_ROOT_SELECTOR);
    if (dock) observer?.observe(dock);
    if (canvas) observer?.observe(canvas);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      release?.();
    };
  }, [active, hold]);
  return active ? bottom : null;
}
