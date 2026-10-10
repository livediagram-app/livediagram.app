'use client';

// Dragging a Gantt bar's ends (docs/specs/026-plan/plan-views.md "Dragging dates"): a handle on each end of a
// bar, or the diamond itself, moves its date by whole days. The mark follows the pointer as a preview and a
// label names the day; letting go writes the one field as one change. A press that never moved opens the
// card as before; Escape or a cancelled pointer drops the drag.
import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  MONTH_SHORT,
  dayParts,
  ganttDayShift,
  ganttDrag,
  type GanttEdge,
  type GanttModel,
  type GanttRow,
  type ItemPatch,
} from '@livediagram/items';

// How far the pointer travels before a press counts as a drag (and no longer opens the card).
const DRAG_SLOP_PX = 3;

// A drag in flight: the mark's new ends, and the day its label names (both ends for a whole bar).
export type GanttPreview = {
  itemId: string;
  from: number;
  to: number;
  day: number;
  whole: boolean;
};

// How long a pending swallow waits for the click a release makes before giving up (no click came: the pointer
// was let go outside the window).
const SWALLOW_CLICK_MS = 400;

// The click a drag's release makes, wherever it lands (the row under the pointer, past a clamped end), stopped
// before anything sees it, so a drag never opens a card (plan-views.md "Drags and draws pin the timeline").
export function swallowNextClick(): void {
  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    done();
  };
  const timer = window.setTimeout(() => done(), SWALLOW_CLICK_MS);
  function done() {
    window.clearTimeout(timer);
    window.removeEventListener('click', onClick, true);
  }
  window.addEventListener('click', onClick, true);
}

export function ganttDayLabel(day: number): string {
  const p = dayParts(day);
  return `${p.date} ${MONTH_SHORT[p.month]}`;
}

// What a drag's label says: the day the end lands on, or a moved bar's two days.
export function ganttPreviewLabel(preview: GanttPreview): string {
  return preview.whole
    ? `${ganttDayLabel(preview.from)} → ${ganttDayLabel(preview.to)}`
    : ganttDayLabel(preview.day);
}

export function useGanttDrag({
  model,
  trackRef,
  onCommit,
  onBegin,
}: {
  model: Pick<GanttModel, 'from' | 'to'>;
  // The time axis, whose width turns pixels into days.
  trackRef: RefObject<HTMLElement | null>;
  onCommit: (itemId: string, patch: ItemPatch) => void;
  // A drag begins (the chart pins its timeline, useGanttWindow's pin).
  onBegin?: () => void;
}) {
  const [preview, setPreview] = useState<GanttPreview | null>(null);
  const moved = useRef(false);
  const stop = useRef<(() => void) | null>(null);
  // A drag in flight when the view goes away ends with it, unwritten.
  useEffect(() => () => stop.current?.(), []);

  const begin = (row: GanttRow, edge: GanttEdge) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    stop.current?.();
    onBegin?.();
    const startX = e.clientX;
    const width = trackRef.current?.getBoundingClientRect().width ?? 0;
    moved.current = false;
    let last: ReturnType<typeof ganttDrag> = null;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (Math.abs(dx) > DRAG_SLOP_PX) moved.current = true;
      last = ganttDrag(row, edge, ganttDayShift(model, dx, width));
      setPreview(
        last
          ? {
              itemId: row.item.id,
              from: last.from,
              to: last.to,
              day: edge === 'to' ? last.to : last.from,
              whole: edge === 'bar',
            }
          : null,
      );
    };
    const end = (commit: boolean) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
      stop.current = null;
      setPreview(null);
      if (moved.current) swallowNextClick();
      if (commit && last) onCommit(row.item.id, { set: last.set });
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

  // The click that ends a drag does not open the card; a plain press still does.
  const swallowClick = (e: React.MouseEvent) => {
    if (!moved.current) return;
    moved.current = false;
    e.stopPropagation();
  };

  return { preview, begin, swallowClick };
}

export type GanttDragApi = ReturnType<typeof useGanttDrag>;

// The bar's body, between its end handles: dragged, it moves both dates together; pressed, it opens the card.
export function GanttBarGrab({
  row,
  left,
  width,
  drag,
}: {
  row: GanttRow;
  // The bar's start and width along the axis, percentages.
  left: number;
  width: number;
  drag: GanttDragApi;
}) {
  return (
    <span
      aria-hidden
      data-gantt-handle="bar"
      className="absolute top-1/2 h-4 -translate-y-1/2 cursor-grab touch-none active:cursor-grabbing"
      style={{ left: `${left}%`, width: `${width}%` }}
      onPointerDown={drag.begin(row, 'bar')}
      onClick={drag.swallowClick}
    />
  );
}

// One end's handle: a wide invisible hit area holding a grip, a small rounded tab with two ridges in the
// mark's colour, shown on the row's hover and lifted a little under the pointer. A diamond is its own grip.
export function GanttHandle({
  row,
  edge,
  at,
  colour,
  surface,
  drag,
}: {
  row: GanttRow;
  edge: GanttEdge;
  // Where the handle sits along the axis, a percentage.
  at: number;
  colour: string;
  // The chart's background, the grip's fill.
  surface: string;
  drag: GanttDragApi;
}) {
  return (
    <span
      aria-hidden
      data-gantt-handle={edge}
      className="group/handle absolute top-0 z-10 flex h-full w-4 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center"
      style={{ left: `${at}%` }}
      onPointerDown={drag.begin(row, edge)}
      onClick={drag.swallowClick}
    >
      {edge === 'mark' ? null : (
        <span
          className="flex h-5 w-2.5 items-center justify-center gap-[2px] rounded-[4px] border-[1.5px] opacity-0 shadow-sm transition duration-150 motion-reduce:transition-none group-hover:opacity-100 group-hover/handle:scale-110 group-hover/handle:opacity-100 group-hover/handle:shadow-md"
          style={{ borderColor: colour, backgroundColor: surface }}
        >
          <span className="h-2 w-px rounded-full" style={{ backgroundColor: colour }} />
          <span className="h-2 w-px rounded-full" style={{ backgroundColor: colour }} />
        </span>
      )}
    </span>
  );
}
