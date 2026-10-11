'use client';

// A slot carried by its grip (docs/specs/026-plan/plan-tabs.md "Moving a slot"): the zone under the pointer is drawn
// as a drop's is and the slot fades where it was; let go, it moves there (one step). Escape, or the pointer taken away
// (pointercancel: a touch turned into a scroll, the pen lifted out of range), puts it back; so does the page going
// away mid-move, which also takes its window listeners with it.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  dashboardMoveZone,
  readDashboardGeometry,
  type DashboardZone,
  type ZoneAllowed,
} from '@/hooks/plan/dashboard-drop';
import { zoneMark, type ZoneMark } from './drop-zone-mark';

export type SlotMoving = {
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
      const onPointerMove = (e: PointerEvent) => setMoving(at(e.clientX, e.clientY));
      const stop = () => {
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
