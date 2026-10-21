'use client';

// Where a palette tile dragged over a Dashboard would land (docs/specs/026-plan/plan-tabs.md "Dashboard tab"): the slot
// it fills outlined, or a bar in the gap it would open (between rows for a row, within a row for a slot), drawn over
// the page in page coordinates so it scrolls with it.
import type { DashboardGeometry, DashboardZone } from '@/hooks/plan/dashboard-drop';

export type ZoneMark =
  | { kind: 'box'; left: number; top: number; width: number; height: number }
  | { kind: 'h-bar'; left: number; top: number; width: number }
  | { kind: 'v-bar'; left: number; top: number; height: number };

// The bar's thickness, and how far a bar at the page's edge sits inside it.
const BAR_PX = 8;
const EDGE_PX = 6;

export function sameZone(a: DashboardZone, b: DashboardZone): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'slot' && b.kind === 'slot') return a.slotId === b.slotId;
  if (a.kind === 'row-gap' && b.kind === 'row-gap') return a.index === b.index;
  return (
    a.kind === 'slot-gap' && b.kind === 'slot-gap' && a.rowId === b.rowId && a.index === b.index
  );
}

// The mark for `zone`, in the page's own coordinates (its box on screen, `page`, at its scroll).
export function zoneMark(
  zone: DashboardZone,
  geo: DashboardGeometry,
  page: { left: number; top: number; width: number },
  scrollTop = 0,
): ZoneMark {
  const y = (v: number) => v - page.top + scrollTop;
  const x = (v: number) => v - page.left;
  if (zone.kind === 'slot') {
    const b = geo.rows.flatMap((r) => r.slots).find((s) => s.id === zone.slotId)?.box;
    if (b)
      return {
        kind: 'box',
        left: x(b.left),
        top: y(b.top),
        width: b.right - b.left,
        height: b.bottom - b.top,
      };
  }
  if (zone.kind === 'slot-gap') {
    const row = geo.rows.find((r) => r.id === zone.rowId);
    if (row) {
      const before = row.slots[zone.index - 1]?.box;
      const after = row.slots[zone.index]?.box;
      const at =
        before && after
          ? (before.right + after.left) / 2
          : before
            ? before.right + EDGE_PX
            : (after?.left ?? row.box.left) - EDGE_PX;
      return {
        kind: 'v-bar',
        left: x(at) - BAR_PX / 2,
        top: y(row.box.top),
        height: row.box.bottom - row.box.top,
      };
    }
  }
  const index = zone.kind === 'row-gap' ? zone.index : 0;
  const above = geo.rows[index - 1]?.box;
  const below = geo.rows[index]?.box;
  const at =
    above && below
      ? (above.bottom + below.top) / 2
      : above
        ? above.bottom + EDGE_PX
        : (below?.top ?? page.top) - EDGE_PX;
  const span = above ?? below;
  return {
    kind: 'h-bar',
    left: span ? x(span.left) : 12,
    top: y(at) - BAR_PX / 2,
    width: span ? span.right - span.left : page.width - 24,
  };
}

// `faint`: one of the places a pressed tile could go, drawn under the one the pointer is over.
export function DropZoneMark({ mark, faint = false }: { mark: ZoneMark; faint?: boolean }) {
  const common = faint
    ? 'pointer-events-none absolute z-10 rounded-full bg-brand-400/35'
    : 'pointer-events-none absolute z-20 rounded-full bg-brand-500 shadow-[0_0_0_6px_rgba(59,130,246,0.18)]';
  if (mark.kind === 'box')
    return (
      <div
        aria-hidden
        className={
          faint
            ? 'pointer-events-none absolute z-10 rounded-2xl border-2 border-dashed border-brand-400/60 bg-brand-500/5'
            : 'pointer-events-none absolute z-20 rounded-2xl border-[3px] border-brand-500 bg-brand-500/10 ring-[6px] ring-brand-500/15'
        }
        style={{ left: mark.left, top: mark.top, width: mark.width, height: mark.height }}
      />
    );
  if (mark.kind === 'h-bar')
    return (
      <div
        aria-hidden
        className={common}
        style={{ left: mark.left, top: mark.top, width: mark.width, height: BAR_PX }}
      />
    );
  return (
    <div
      aria-hidden
      className={common}
      style={{ left: mark.left, top: mark.top, width: BAR_PX, height: mark.height }}
    />
  );
}
