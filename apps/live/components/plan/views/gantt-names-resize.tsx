'use client';

// The Gantt names column's resize edge (docs/specs/026-plan/plan-views.md "Names column width"): a 6 px strip on the
// column's right edge, a vertical separator. Dragged, the columns follow the pointer as a preview and letting go
// saves the width once; ← and → step it and save at once. Escape or a cancelled pointer drops a drag. Every press
// stops here, so the canvas never moves the chart.
import { useEffect, useRef, useState } from 'react';
import {
  GANTT_NAMES_MIN_PX,
  GANTT_NAMES_MAX_SHARE,
  GANTT_NAMES_STEP_PX,
  ganttNamesWidth,
} from '@livediagram/items';
import type { PlanPalette } from '../plan-palette';

export function GanttNamesResizer({
  width,
  chartPx,
  palette,
  onPreview,
  onCommit,
}: {
  // The column's width now (the chart's units), and the chart's whole width.
  width: number;
  chartPx: number;
  palette: PlanPalette;
  onPreview: (width: number | null) => void;
  onCommit: (width: number) => void;
}) {
  const [active, setActive] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  const max = Math.max(GANTT_NAMES_MIN_PX, Math.floor(chartPx * GANTT_NAMES_MAX_SHARE));

  const begin = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    // Screen pixels to the chart's own pixels: on the canvas the chart may be drawn zoomed (its layout width
    // against its box on screen), and maximised it is wider than the element.
    const host = e.currentTarget.parentElement;
    const layoutPx = host?.offsetWidth || chartPx;
    const box = host?.getBoundingClientRect();
    const scale = box && box.width > 0 ? layoutPx / box.width : 1;
    const startX = e.clientX;
    let next = width;
    setActive(true);
    const onMove = (ev: PointerEvent) => {
      next = ganttNamesWidth(width + (ev.clientX - startX) * scale, layoutPx);
      onPreview(next);
    };
    const end = (commit: boolean) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
      stop.current = null;
      setActive(false);
      onPreview(null);
      if (commit && next !== width) onCommit(next);
    };
    const onUp = () => end(true);
    const onCancel = () => end(false);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      ev.stopPropagation();
      end(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey, true);
    stop.current = () => end(false);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize Names Column"
      aria-valuenow={Math.round(width)}
      aria-valuemin={GANTT_NAMES_MIN_PX}
      aria-valuemax={max}
      tabIndex={0}
      className="group/resize absolute inset-y-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize touch-none outline-none"
      style={{ left: width }}
      onPointerDown={begin}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        e.stopPropagation();
        const stepped = ganttNamesWidth(
          width + (e.key === 'ArrowRight' ? GANTT_NAMES_STEP_PX : -GANTT_NAMES_STEP_PX),
          chartPx,
        );
        if (stepped !== width) onCommit(stepped);
      }}
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-opacity group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100 ${active ? 'opacity-100' : 'opacity-0'}`}
        style={{ backgroundColor: palette.focus }}
      />
    </div>
  );
}
