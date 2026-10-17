'use client';

// A slot carried by its grip (docs/specs/026-plan/plan-tabs.md "Moving a slot"): the zone under the pointer is drawn
// as a drop's is and the slot fades where it was; let go, it moves there (one step). Escape, or the pointer taken away
// (pointercancel: a touch turned into a scroll, the pen lifted out of range), puts it back; so does the page going
// away mid-move, which also takes its window listeners with it. Carried near the page's top or bottom edge, the page
// scrolls that way (faster the closer), so a slot reaches a row out of view, by finger as by mouse.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  dashboardMoveZone,
  readDashboardGeometry,
  type DashboardZone,
  type ZoneAllowed,
} from '@/hooks/plan/dashboard-drop';
import { zoneMark, type ZoneMark } from './drop-zone-mark';

// How near the page's top or bottom edge the pointer scrolls it, and the most it scrolls a frame.
export const MOVE_SCROLL_EDGE_PX = 56;
export const MOVE_SCROLL_MAX_PX = 14;

// How far to scroll the page this frame for a pointer at `y`, between its top and bottom: 0 in the middle.
export function moveScrollStep(y: number, top: number, bottom: number): number {
  const into = (edge: number) =>
    Math.min(1, Math.max(0, (MOVE_SCROLL_EDGE_PX - edge) / MOVE_SCROLL_EDGE_PX));
  if (y < top + MOVE_SCROLL_EDGE_PX) return -Math.ceil(into(y - top) * MOVE_SCROLL_MAX_PX);
  if (y > bottom - MOVE_SCROLL_EDGE_PX) return Math.ceil(into(bottom - y) * MOVE_SCROLL_MAX_PX);
  return 0;
}

type SlotMoving = {
  slotId: string;
  zone: DashboardZone | null;
  mark: ZoneMark | null;
  x: number;
  y: number;
};

export function useSlotMove({
  pageRef,
  allowMove,
  onMove,
}: {
  pageRef: RefObject<HTMLElement | null>;
  allowMove: (slotId: string) => ZoneAllowed;
  // Letting go over a zone: the slot moves there.
  onMove: (slotId: string, zone: DashboardZone) => void;
}): {
  moving: SlotMoving | null;
  beginMove: (slotId: string, start: { clientX: number; clientY: number }) => void;
} {
  const [moving, setMoving] = useState<SlotMoving | null>(null);
  // The move in hand's way out (its listeners removed), for a new move, or the page unmounting mid-move.
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRef.current?.(), []);
  const beginMove = useCallback(
    (slotId: string, start: { clientX: number; clientY: number }) => {
      const root = pageRef.current;
      if (!root) return;
      stopRef.current?.();
      const at = (x: number, y: number): SlotMoving => {
        const geo = readDashboardGeometry(root);
        const zone = dashboardMoveZone(geo, x, y, slotId, allowMove(slotId));
        const mark = zone
          ? zoneMark(zone, geo, root.getBoundingClientRect(), root.scrollTop)
          : null;
        return { slotId, zone, mark, x, y };
      };
      setMoving(at(start.clientX, start.clientY));
      let last = { x: start.clientX, y: start.clientY };
      const onPointerMove = (e: PointerEvent) => {
        last = { x: e.clientX, y: e.clientY };
        setMoving(at(e.clientX, e.clientY));
      };
      // Each frame: near an edge, the page scrolls and the zone under the (still) pointer is found again.
      let frame = requestAnimationFrame(function edge() {
        const box = root.getBoundingClientRect();
        const step = moveScrollStep(last.y, box.top, box.bottom);
        if (step) {
          const was = root.scrollTop;
          root.scrollTop += step;
          if (root.scrollTop !== was) setMoving(at(last.x, last.y));
        }
        frame = requestAnimationFrame(edge);
      });
      const stop = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('keydown', onKey, true);
        if (stopRef.current === stop) stopRef.current = null;
      };
      const cancel = () => {
        stop();
        setMoving(null);
      };
      const onUp = (e: PointerEvent) => {
        cancel();
        const { zone } = at(e.clientX, e.clientY);
        if (zone) onMove(slotId, zone);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        cancel();
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', cancel);
      window.addEventListener('keydown', onKey, true);
      stopRef.current = stop;
    },
    [pageRef, allowMove, onMove],
  );
  return { moving, beginMove };
}
