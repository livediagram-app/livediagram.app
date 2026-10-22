'use client';

// Keeping a Dashboard's content looking good as its layout changes (docs/specs/026-plan/plan-tabs.md "Filling a
// slot"): a slot added, or a slot moved, may not squeeze a board, sheet or chart below what it needs (keepsFit). Hands
// the page's drops, moves and edge markers a check of the change each zone would make, read against the layout and
// elements as they are when it is asked (the page's handlers outlive a render).
import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import {
  DASHBOARD_ROWS_MAX,
  insertDashboardSlot,
  moveDashboardSlot,
  type DashboardLayout,
  type Element,
} from '@livepages/document';
import type { DashboardItem, DashboardZone, ZoneAllowed } from '@/hooks/plan/dashboard-drop';
import { contentFitKind, keepsFit, type FitOf } from '@/hooks/plan/slot-fit';

const probeId = () => 'probe';

export type FitGuard = {
  fitOf: FitOf;
  // Whether `after` keeps everything looking good, against the layout as it is now.
  keeps: (after: (layout: DashboardLayout) => DashboardLayout) => boolean;
  // The zones a Layout tile or a moved slot may take.
  allowFor: (item: DashboardItem) => ZoneAllowed | undefined;
  allowMove: (slotId: string) => ZoneAllowed;
};

export function useFitGuard(
  pageRef: RefObject<HTMLElement | null>,
  layout: DashboardLayout,
  elements: ReadonlyMap<string, Element>,
): FitGuard {
  const fitOf = useCallback<FitOf>((c) => contentFitKind(c, elements), [elements]);
  const latest = useRef({ layout, fitOf });
  useEffect(() => {
    latest.current = { layout, fitOf };
  }, [layout, fitOf]);
  const keeps = useCallback(
    (change: (l: DashboardLayout) => DashboardLayout) => {
      const { layout: now, fitOf: f } = latest.current;
      const row = pageRef.current?.querySelector('[data-dashboard-row]');
      const width = row ? row.getBoundingClientRect().width : null;
      return keepsFit(now, change(now), f, width);
    },
    [pageRef],
  );
  const allowFor = useCallback(
    (item: DashboardItem): ZoneAllowed | undefined =>
      item.kind === 'slot'
        ? (z: DashboardZone) =>
            z.kind !== 'slot-gap' || keeps((l) => insertDashboardSlot(l, z.rowId, z.index, probeId))
        : undefined,
    [keeps],
  );
  const allowMove = useCallback(
    (slotId: string): ZoneAllowed =>
      (z) =>
        !makesRowPastLimit(latest.current.layout, slotId, z) &&
        keeps((l) => moveDashboardSlot(l, slotId, z, probeId)),
    [keeps],
  );
  return useMemo(
    () => ({ fitOf, keeps, allowFor, allowMove }),
    [fitOf, keeps, allowFor, allowMove],
  );
}

// A slot carried to a gap between rows when its own row stays and the dashboard already has its most rows: no bar is
// drawn there, as the move cannot be made (moveDashboardSlot leaves the layout as it is).
function makesRowPastLimit(layout: DashboardLayout, slotId: string, z: DashboardZone): boolean {
  if (z.kind !== 'row-gap' || layout.rows.length < DASHBOARD_ROWS_MAX) return false;
  const row = layout.rows.find((r) => r.slots.some((s) => s.id === slotId));
  return !!row && row.slots.length > 1;
}
