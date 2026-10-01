'use client';

// The paste notice's slot, measured (lib/board-scene-notice-slot): above the whiteboard dock when
// one is on screen, else where a dock would sit. Re-measured when the dock or the window changes
// size, never on a timer; null until the first measure, so the notice never paints out of place.
import { useLayoutEffect, useState } from 'react';
import { noticeBottom } from '@/lib/board-scene-notice-slot';

const DOCK_SELECTOR = '[data-whiteboard-dock]';
const CANVAS_SELECTOR = '[data-canvas-a11y-root]';

export function useNoticeSlot(active: boolean): number | null {
  const [bottom, setBottom] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!active) return;
    const measure = () => {
      const dock = document.querySelector<HTMLElement>(DOCK_SELECTOR);
      const canvas = document.querySelector<HTMLElement>(CANVAS_SELECTOR);
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
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    const dock = document.querySelector(DOCK_SELECTOR);
    const canvas = document.querySelector(CANVAS_SELECTOR);
    if (dock) observer?.observe(dock);
    if (canvas) observer?.observe(canvas);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [active]);
  return active ? bottom : null;
}
