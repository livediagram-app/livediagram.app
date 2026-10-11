'use client';

// Add a Slot, in a slot's cog (its Slot section, SlotSection.tsx) (docs/specs/026-plan/plan-tabs.md "Dashboard tab"), an Editor's: this slot drawn small
// with an arrow on each of its four sides; the side under the pointer or focus lights as the new slot. Left and Right put an empty slot beside this one
// in its row; Above and Below put a row of one slot above or below its row. A side is shown but not offered (dashed and dimmed,
// its tooltip saying why) when the row is full or the new slot would squeeze something below what it needs (useFitGuard).
import { useState } from 'react';
import { Tooltip } from '@livediagram/ui';
import { DirArrow } from '@/components/palette/context-menu-icons';
import {
  DASHBOARD_ROW_H_DEFAULT,
  DASHBOARD_ROWS_MAX,
  DASHBOARD_SLOTS_MAX,
  insertDashboardRow,
  insertDashboardSlot,
} from '@livediagram/document';
import { useDashboard } from './dashboard-context';

type Side = 'left' | 'right' | 'above' | 'below';

const newId = () => crypto.randomUUID();

export function AddSlotSides({
  rowId,
  at,
  onAdded,
}: {
  rowId: string;
  at: { slot: number; row: number; slots: number };
  onAdded: () => void;
}) {
  const { actions, fit, layout } = useDashboard();
  const rowsFull = (layout?.rows.length ?? 0) >= DASHBOARD_ROWS_MAX;
  const why = (side: Side): string | null => {
    if (side === 'above' || side === 'below')
      return rowsFull ? `A dashboard holds up to ${DASHBOARD_ROWS_MAX} rows` : null;
    if (at.slots >= DASHBOARD_SLOTS_MAX) return `A row holds up to ${DASHBOARD_SLOTS_MAX} slots`;
    const index = side === 'left' ? at.slot : at.slot + 1;
    if (fit && !fit.keeps((l) => insertDashboardSlot(l, rowId, index, newId)))
      return 'No room: what is here would be too small';
    return null;
  };
  const add = (side: Side) => {
    if (side === 'left' || side === 'right') {
      const index = side === 'left' ? at.slot : at.slot + 1;
      actions.changeDashboard((l) => insertDashboardSlot(l, rowId, index, newId), 'DashboardSlot');
    } else {
      const index = side === 'above' ? at.row : at.row + 1;
      actions.changeDashboard(
        (l) => insertDashboardRow(l, index, DASHBOARD_ROW_H_DEFAULT, 1, newId),
        'DashboardRow',
      );
    }
    onAdded();
  };
  // The side under the pointer or focus lights up as the new slot.
  const [hover, setHover] = useState<Side | null>(null);
  const side = (s: Side, label: string, horizontal: boolean) => {
    const reason = why(s);
    const lit = hover === s && !reason;
    const button = (
      <button
        type="button"
        aria-label={SIDE_NAMES[s]}
        aria-disabled={reason ? true : undefined}
        aria-describedby={reason ? `${rowId}-${at.slot}-${s}-why` : undefined}
        onPointerEnter={() => setHover(s)}
        onPointerLeave={() => setHover((h) => (h === s ? null : h))}
        onFocus={() => setHover(s)}
        onBlur={() => setHover((h) => (h === s ? null : h))}
        onClick={() => {
          if (!reason) add(s);
        }}
        className={`group/side flex items-center justify-center gap-1 rounded-lg border text-[11px] font-medium outline-none transition duration-micro focus-visible:ring-2 focus-visible:ring-brand-400 motion-reduce:transition-none ${
          horizontal ? 'h-7 w-full' : 'h-full w-12 flex-col'
        } ${
          reason
            ? 'cursor-not-allowed border-dashed border-slate-200 text-slate-300 dark:border-slate-700 dark:text-slate-600'
            : lit
              ? 'cursor-pointer border-brand-400 bg-brand-50 text-brand-700 shadow-sm dark:border-brand-500/70 dark:bg-brand-500/15 dark:text-brand-200'
              : 'cursor-pointer border-dashed border-slate-300 text-slate-500 hover:border-brand-300 dark:border-slate-600 dark:text-slate-400'
        }`}
      >
        {/* The arrow bounces the way it points while its side is hovered or focused (a usable side only). */}
        <span className={reason ? 'flex' : `flex ${NUDGE[SIDE_DIRS[s]]}`}>
          <DirArrow dir={SIDE_DIRS[s]} />
        </span>
        <span>{label}</span>
        {reason ? (
          <span id={`${rowId}-${at.slot}-${s}-why`} className="sr-only">
            {reason}
          </span>
        ) : null}
      </button>
    );
    // A side that cannot be used says why in its tooltip.
    return reason ? <Tooltip label={reason}>{button}</Tooltip> : button;
  };
  return (
    // Labelled as a settings field is (settings-panel-parts SettingsField), atop the cog's Slot section.
    <div role="group" aria-label="Add a Slot" className="flex flex-col gap-1.5 px-3 pb-1 pt-1">
      <span className="px-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
        Add a Slot
      </span>
      <div className="grid grid-cols-[3rem_minmax(0,1fr)_3rem] grid-rows-[1.75rem_4rem_1.75rem] gap-1.5">
        <span />
        {side('above', 'Above', true)}
        <span />
        {side('left', 'Left', false)}
        {/* This slot, drawn small in the middle. */}
        <span
          aria-hidden
          className="flex items-center justify-center rounded-lg border border-brand-300 bg-brand-50/70 text-[10px] font-semibold uppercase tracking-wider text-brand-700 dark:border-brand-500/50 dark:bg-brand-500/10 dark:text-brand-200"
        >
          This Slot
        </span>
        {side('right', 'Right', false)}
        <span />
        {side('below', 'Below', true)}
        <span />
      </div>
    </div>
  );
}

const SIDE_NAMES: Record<Side, string> = {
  above: 'Add Row Above',
  below: 'Add Row Below',
  left: 'Add Slot to the Left',
  right: 'Add Slot to the Right',
};

// Full class names, so Tailwind finds them.
const NUDGE: Record<'up' | 'down' | 'left' | 'right', string> = {
  up: 'group-hover/side:animate-nudge-up group-focus-visible/side:animate-nudge-up',
  down: 'group-hover/side:animate-nudge-down group-focus-visible/side:animate-nudge-down',
  left: 'group-hover/side:animate-nudge-left group-focus-visible/side:animate-nudge-left',
  right: 'group-hover/side:animate-nudge-right group-focus-visible/side:animate-nudge-right',
};

const SIDE_DIRS: Record<Side, 'up' | 'down' | 'left' | 'right'> = {
  above: 'up',
  below: 'down',
  left: 'left',
  right: 'right',
};
