'use client';

// Moving a card on a calendar (docs/specs/026-plan/plan-views.md "Moving a card on a calendar"): an entry dragged
// onto another day moves its date there. A press that never travels DRAG_SLOP_PX still opens the card; past it, a
// lifted copy of the entry follows the pointer and the day under it is ringed; letting go writes the move as one
// change. Escape or a cancelled pointer drops the drag, unwritten. The keyboard alternative (Alt+Arrows) lives in
// the view, which shares `onMove`.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { swallowNextClick } from './gantt-drag';
import { followWindowDrag } from '@/lib/window-drag';

// How far the pointer travels before a press counts as a drag (and no longer opens the card), as on a Gantt bar.
const CALENDAR_DRAG_SLOP_PX = 3;

// A drag in flight: the card, the day it was on, the day under the pointer (undefined off the grid), and the lifted
// copy's width. It changes only when the day under the pointer does, so a move inside one day re-renders no day; the
// copy's place is its own (CalendarGhostPosition), so only the copy follows the pointer.
type CalendarDragState = {
  itemId: string;
  fromDay: number;
  overDay: number | undefined;
  width: number;
};

// Where the lifted copy sits, in the grid's own (unzoomed) pixels.
export type CalendarGhostPoint = { x: number; y: number };

// The lifted copy's place: read now (the same object until the pointer moves), and heard on every pointer move (one
// listener, the copy).
export type CalendarGhostPosition = {
  read: () => CalendarGhostPoint;
  subscribe: (listener: () => void) => () => void;
};

// The day under a point on screen: the grid is `weeks` rows of seven equal days from `firstDay`, laid out in
// `rect` (its on-screen box, zoom included). Undefined outside it.
export function calendarDayAt(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  firstDay: number,
  weeks: number,
): number | undefined {
  if (rect.width <= 0 || rect.height <= 0 || weeks <= 0) return undefined;
  const col = Math.floor(((clientX - rect.left) / rect.width) * 7);
  const row = Math.floor(((clientY - rect.top) / rect.height) * weeks);
  if (col < 0 || col > 6 || row < 0 || row >= weeks) return undefined;
  return firstDay + row * 7 + col;
}

export function useCalendarDrag({
  gridRef,
  firstDay,
  weeks,
  enabled,
  onMove,
}: {
  // The days' grid: where a drop lands is read off its box.
  gridRef: RefObject<HTMLElement | null>;
  firstDay: number;
  weeks: number;
  // Someone who may move cards, while the view takes input.
  enabled: boolean;
  onMove: (itemId: string, toDay: number) => void;
}) {
  const [drag, setDrag] = useState<CalendarDragState | null>(null);
  const stop = useRef<(() => void) | null>(null);
  // The newest onMove, so `begin` stays one function while the view re-renders.
  const moveRef = useLatest(onMove);
  // The lifted copy's place and its one listener: a pointer move tells the copy alone.
  const point = useRef<CalendarGhostPoint>({ x: 0, y: 0 });
  const listener = useRef<(() => void) | null>(null);
  const ghost = useMemo<CalendarGhostPosition>(
    () => ({
      read: () => point.current,
      subscribe: (fn) => {
        listener.current = fn;
        return () => {
          if (listener.current === fn) listener.current = null;
        };
      },
    }),
    [],
  );
  // A drag in flight when the view goes away ends with it, unwritten.
  useEffect(() => () => stop.current?.(), []);

  const begin = useCallback(
    (itemId: string, fromDay: number) => (e: React.PointerEvent<HTMLElement>) => {
      if (!enabled || e.button !== 0) return;
      stop.current?.();
      // The grid's shape as the drag begins: its month cannot step while the pointer is held.
      const grid = gridRef.current;
      const entry = e.currentTarget;
      if (!grid) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const entryBox = entry.getBoundingClientRect();
      // Where in the entry it was taken, so the lifted copy keeps that point under the pointer.
      const grabX = startX - entryBox.left;
      const grabY = startY - entryBox.top;
      let moved = false;
      let last: CalendarDragState | null = null;
      const onPointerMove = (ev: PointerEvent) => {
        if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) <= CALENDAR_DRAG_SLOP_PX)
          return;
        moved = true;
        const box = grid.getBoundingClientRect();
        // The canvas may be zoomed: screen pixels back to the grid's own.
        const scale = grid.offsetWidth > 0 && box.width > 0 ? grid.offsetWidth / box.width : 1;
        point.current = {
          x: (ev.clientX - grabX - box.left) * scale,
          y: (ev.clientY - grabY - box.top) * scale,
        };
        listener.current?.();
        const overDay = calendarDayAt(box, ev.clientX, ev.clientY, firstDay, weeks);
        // The grid hears only a new day under the pointer (or the drag's start).
        if (last && last.overDay === overDay) return;
        last = { itemId, fromDay, overDay, width: entry.offsetWidth };
        setDrag(last);
      };
      stop.current = followWindowDrag(onPointerMove, (commit) => {
        stop.current = null;
        setDrag(null);
        if (!moved) return;
        // The click a drag's release makes never opens the card it lands on.
        swallowNextClick();
        if (commit && last?.overDay !== undefined && last.overDay !== fromDay)
          moveRef.current(itemId, last.overDay);
      });
    },
    [enabled, gridRef, firstDay, weeks, moveRef],
  );

  return { drag, begin, ghost };
}

// The lifted copy's place, following the pointer: re-renders the copy alone on each move.
export function useGhostPoint(ghost: CalendarGhostPosition): CalendarGhostPoint {
  return useSyncExternalStore(ghost.subscribe, ghost.read, ghost.read);
}
