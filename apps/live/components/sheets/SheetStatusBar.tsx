'use client';

// The status bar (docs/specs/029-sheets/sheet.md "Selection"): for a selection of more than one number, its Sum,
// Average and Count (and Min and Max, picked in its menu), over the cells that show (rows a filter hides are left
// out), as a spreadsheet's does. The pick is the viewer's own, kept in their browser.
import { useMemo, useState } from 'react';
import { formatNumber } from '@livediagram/sheets';
import { useSheetController, type SheetController } from './sheet-controller';
import { STATS, toggleStatusPick, useStatusPick, type Stat } from './sheet-status-pick';
import { OptionRows } from '@/components/plan/OptionRows';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';

export const STATUS_BAR_PX = 24;
const CELLS_MAX = 100_000;

export { STATS, type Stat } from './sheet-status-pick';
export type SelectionStats = {
  sum: number;
  count: number;
  numbers: number;
  min: number;
  max: number;
};

export function selectionStats(
  c: Pick<SheetController, 'selection' | 'workbook' | 'sheet' | 'geometry'>,
): SelectionStats | null {
  let sum = 0;
  let numbers = 0;
  let count = 0;
  let seen = 0;
  let min = Infinity;
  let max = -Infinity;
  const ext = c.workbook.extent(c.sheet.id);
  for (const g of c.selection.ranges) {
    const r2 = Math.min(g.r2, ext.rows - 1);
    const c2 = Math.min(g.c2, ext.cols - 1);
    for (let r = g.r1; r <= r2; r++) {
      if (c.geometry.hiddenRow(r)) continue;
      for (let col = g.c1; col <= c2; col++) {
        if (++seen > CELLS_MAX) return null;
        const v = c.workbook.value(c.sheet.id, r, col);
        if (v === null || v === '') continue;
        count++;
        if (typeof v === 'number') {
          sum += v;
          numbers++;
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
  }
  return numbers > 1 ? { sum, count, numbers, min, max } : null;
}

export function statValue(stat: Stat, s: SelectionStats): number {
  if (stat === 'Sum') return s.sum;
  if (stat === 'Average') return s.sum / s.numbers;
  if (stat === 'Count') return s.count;
  return stat === 'Min' ? s.min : s.max;
}

// The totals menu's width.
const STATS_MENU_PX = 208;

export function SheetStatusBar() {
  const c = useSheetController();
  const pick = useStatusPick();
  // The totals button while its menu is open (the menu anchors to it).
  const [open, setOpen] = useState<HTMLElement | null>(null);
  // Counted again only when the selection or a value moves, never on a scroll frame.
  const { selection, workbook, sheet, geometry, version } = c;
  const stats = useMemo(
    () => selectionStats({ selection, workbook, sheet, geometry }),
    [selection, workbook, sheet, geometry, version], // eslint-disable-line react-hooks/exhaustive-deps
  );
  if (!stats) return null;
  const n = (v: number) =>
    formatNumber(v, { nf: 'number', dp: Number.isInteger(v) ? 0 : 2 }, c.locale);
  return (
    <div
      className="relative flex shrink-0 items-center justify-end border-t px-1 text-[12px] tabular-nums"
      style={{ height: STATUS_BAR_PX, borderColor: c.palette.cardBorder, color: c.palette.muted }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={!!open}
        aria-label="Selection totals"
        className="flex h-[20px] cursor-pointer items-center gap-3 rounded-md px-2 transition hover:bg-black/5 dark:hover:bg-white/10"
        onClick={(e) => {
          const at = e.currentTarget;
          setOpen((v) => (v ? null : at));
        }}
      >
        {pick.map((stat) => (
          // The name quiet, the number in ink, as a modern spreadsheet's totals read.
          <span key={stat} role="status" className="flex items-baseline gap-1">
            <span className="text-[11px]">{stat}</span>
            <span className="font-semibold" style={{ color: c.palette.text }}>
              {stat === 'Count' ? stats.count : n(statValue(stat, stats))}
            </span>
          </span>
        ))}
        <span aria-hidden className="text-[9px] opacity-70">
          ▾
        </span>
      </button>
      {open ? (
        <AnchoredPopover
          anchor={open}
          name="Selection totals"
          width={STATS_MENU_PX}
          onClose={() => setOpen(null)}
        >
          <OptionRows
            kind="multiple"
            label="Show in the status bar"
            selected={pick}
            onPick={(stat) => toggleStatusPick(stat as Stat)}
            rows={STATS.map((stat) => ({
              id: stat,
              label: stat,
              trailing: (
                <span className="text-[11px] tabular-nums" style={{ color: c.palette.muted }}>
                  {stat === 'Count' ? stats.count : n(statValue(stat, stats))}
                </span>
              ),
              disabled: pick.length === 1 && pick.includes(stat),
            }))}
          />
        </AnchoredPopover>
      ) : null}
    </div>
  );
}
