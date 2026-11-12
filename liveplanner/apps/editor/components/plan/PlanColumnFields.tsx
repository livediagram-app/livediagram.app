'use client';

// Two of a column's settings rows (docs/specs/026-plan/plan-board.md "A column's own settings"), in its settings
// popover (PlanColumnPopover.tsx): the WIP limit as a stepper, and the width as a segmented radio group.
import { COLUMN_WIDTHS, type PlanColumn } from '@liveplanner/items';
import { plural } from '@liveplanner/project';
import { WIP_LIMIT_MAX } from './board-setup-edits';

const STEP =
  'w-8 text-[15px] text-slate-600 transition enabled:hover:bg-slate-100 disabled:opacity-35 dark:text-slate-300 dark:enabled:hover:bg-slate-800';

// WIP Limit: lower, type or raise it; Off when empty.
export function WipLimitRow({
  column,
  wip,
  setWip,
}: {
  column: PlanColumn;
  wip: number | null;
  setWip: (n: number | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <label
          htmlFor={`column-${column.id}-wip`}
          className="block text-[13px] text-slate-700 dark:text-slate-200"
        >
          WIP Limit
        </label>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {wip ? `Warns past ${plural(wip, 'card')}` : 'No limit'}
        </p>
      </div>
      <div className="flex h-8 shrink-0 items-stretch overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          aria-label="Lower the WIP limit"
          disabled={!wip}
          className={STEP}
          onClick={() => setWip(wip && wip > 1 ? wip - 1 : null)}
        >
          −
        </button>
        <input
          id={`column-${column.id}-wip`}
          type="number"
          inputMode="numeric"
          min={1}
          max={WIP_LIMIT_MAX}
          placeholder="Off"
          key={wip ?? 'none'}
          className="w-11 border-x border-slate-200 bg-transparent text-center text-[13px] tabular-nums text-slate-800 outline-none [appearance:textfield] focus:bg-brand-50 dark:border-slate-700 dark:text-slate-100 dark:focus:bg-brand-500/10 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          defaultValue={wip ?? ''}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          onBlur={(e) => setWip(e.target.value ? Number(e.target.value) : null)}
        />
        <button
          type="button"
          aria-label="Raise the WIP limit"
          disabled={(wip ?? 0) >= WIP_LIMIT_MAX}
          className={STEP}
          onClick={() => setWip((wip ?? 0) + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

// Width: the slots the column takes across the board.
export function ColumnWidthRow({
  column,
  onWidth,
}: {
  column: PlanColumn;
  onWidth: (width: NonNullable<PlanColumn['width']>) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="block text-[13px] text-slate-700 dark:text-slate-200">Width</span>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Slots across the board</p>
      </div>
      <div
        role="radiogroup"
        aria-label="Column width"
        className="flex h-8 shrink-0 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700"
      >
        {COLUMN_WIDTHS.map((w) => {
          const on = (column.width ?? 1) === w;
          return (
            <button
              key={w}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${w} ${w === 1 ? 'slot' : 'slots'}`}
              className={`flex w-10 items-center justify-center gap-[2px] border-r border-slate-200 transition last:border-r-0 dark:border-slate-700 ${
                on
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
              onClick={() => onWidth(w)}
            >
              {Array.from({ length: w }, (_, i) => (
                <span key={i} aria-hidden className="h-3.5 w-1.5 rounded-sm bg-current" />
              ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
