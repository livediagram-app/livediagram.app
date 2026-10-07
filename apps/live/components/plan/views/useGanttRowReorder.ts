'use client';

// Reordering a Gantt chart's rows (docs/specs/026-plan/plan-views.md "Row order"): a row's grip dragged up or down
// moves it within its swimlane, the vertical travel (over the row's on-screen height, so at any zoom) turned into
// a target place; letting go writes the chart's whole order once. Escape or a cancelled pointer drops the drag.
// Alt+Arrow on a row's name moves it one place. The order maths is ganttReorder (packages/items).
import { useEffect, useRef, useState } from 'react';
import { ganttReorder } from '@livediagram/items';

export type GanttRowDrag = {
  itemId: string;
  // The vertical travel so far, in chart px (unscaled).
  dy: number;
  // The row's place in its lane when the drag began, and where it would land now.
  from: number;
  to: number;
  laneIds: readonly string[];
};

export function useGanttRowReorder({
  rowIds,
  rowH,
  onCommit,
}: {
  // Every row's card id, as shown (lane by lane).
  rowIds: readonly string[];
  // A row's height in chart px.
  rowH: number;
  // The chart's next full order, written once.
  onCommit: (order: string[]) => void;
}) {
  const [drag, setDrag] = useState<GanttRowDrag | null>(null);
  const stop = useRef<(() => void) | null>(null);
  // A drag in flight when the chart goes away ends with it, unwritten.
  useEffect(() => () => stop.current?.(), []);

  const begin =
    (itemId: string, laneIds: readonly string[], row: HTMLElement | null) =>
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      // The grip's press is the drag's alone: the canvas never moves the element, no date drag starts.
      e.stopPropagation();
      e.preventDefault();
      const from = laneIds.indexOf(itemId);
      if (from < 0) return;
      stop.current?.();
      const startY = e.clientY;
      // Screen px per chart px: the chart may sit on a zoomed canvas.
      const shown = row?.getBoundingClientRect().height;
      const scale = shown && shown > 0 ? shown / rowH : 1;
      const rowIdsAtStart = [...rowIds];
      let last: GanttRowDrag = { itemId, dy: 0, from, to: from, laneIds };
      setDrag(last);
      const onMove = (ev: PointerEvent) => {
        const dy = (ev.clientY - startY) / scale;
        const to = Math.max(0, Math.min(laneIds.length - 1, from + Math.round(dy / rowH)));
        last = { ...last, dy, to };
        setDrag(last);
      };
      const end = (commit: boolean) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKey, true);
        stop.current = null;
        setDrag(null);
        if (!commit || last.to === last.from) return;
        const next = ganttReorder(rowIdsAtStart, laneIds, itemId, last.to);
        if (next) onCommit(next);
      };
      const onUp = () => end(true);
      const onCancel = () => end(false);
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== 'Escape') return;
        ev.stopPropagation();
        ev.preventDefault();
        end(false);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey, true);
      stop.current = () => end(false);
    };

  // A keyboard move one place up or down its lane: the new place (0-based), or null when it cannot move.
  const move = (itemId: string, laneIds: readonly string[], by: -1 | 1): number | null => {
    const to = laneIds.indexOf(itemId) + by;
    if (to < 0 || to >= laneIds.length) return null;
    const next = ganttReorder(rowIds, laneIds, itemId, to);
    if (!next) return null;
    onCommit(next);
    return to;
  };

  return { drag, begin, move };
}
