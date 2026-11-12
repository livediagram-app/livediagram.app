'use client';

// A column's toolbar (docs/specs/026-plan/plan-board.md "A column's own settings"): the quick actions on top of its
// settings popover (PlanColumnPopover.tsx). Move Left and Move Right at the start, then Collapse Column where the board
// offers it, Remove Column at the end.
import type { ReactNode } from 'react';
import type { PlanBoardSetup, PlanColumn } from '@liveplanner/items';
import { ChevronLeftIcon, ChevronRightIcon, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideBetweenVerticalEnd, lucidePanelLeftClose } from '@liveworkspace/icons/lucide';
import { moveColumn, removeColumn } from './board-setup-edits';

// Remove Column's glyph: a column taken out from between its neighbours.
const ColumnOffIcon = lucideGlyph(lucideBetweenVerticalEnd, 16);
// Collapse Column's glyph: the column folded to the left, as the chevron on its head.
const CollapseColumnIcon = lucideGlyph(lucidePanelLeftClose, 16);

export function ColumnToolbar({
  setup,
  column,
  at,
  others,
  mobile,
  onChange,
  onCollapse,
  onClose,
}: {
  setup: PlanBoardSetup;
  column: PlanColumn;
  // The column's index on the board.
  at: number;
  // The board's other columns: Remove Column shows only while one remains.
  others: readonly PlanColumn[];
  mobile: boolean;
  onChange: (next: PlanBoardSetup, part: string) => void;
  onCollapse?: (() => void) | undefined;
  onClose: (restoreFocus: boolean) => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Column actions"
      className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-800/30"
    >
      <div className="flex items-center gap-1.5">
        {/* Move Left and Move Right, one segmented control as the width's is. */}
        <div className="flex h-8 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <ToolbarButton
            label="Move Left"
            keys="Alt+Shift+Left"
            disabled={at <= 0}
            onClick={() => onChange(moveColumn(setup, column.id, -1), 'ColumnReordered')}
          >
            <ChevronLeftIcon size={16} />
          </ToolbarButton>
          <span aria-hidden className="w-px bg-slate-200 dark:bg-slate-700" />
          <ToolbarButton
            label="Move Right"
            keys="Alt+Shift+Right"
            disabled={at >= setup.columns.length - 1}
            onClick={() => onChange(moveColumn(setup, column.id, 1), 'ColumnReordered')}
          >
            <ChevronRightIcon size={16} />
          </ToolbarButton>
        </div>
        {/* Collapse Column: the column becomes a strip for this person; the popover goes with its head. */}
        {onCollapse && !mobile ? (
          <div className="flex h-8 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <ToolbarButton
              label="Collapse Column"
              onClick={() => {
                onClose(false);
                onCollapse();
              }}
            >
              <CollapseColumnIcon />
            </ToolbarButton>
          </div>
        ) : null}
      </div>
      {others.length > 0 ? (
        <Tooltip label="Remove Column">
          <button
            type="button"
            aria-label="Remove Column"
            className="relative touch-target flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-700 motion-reduce:transition-none dark:text-slate-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
            onClick={() => {
              onChange(removeColumn(setup, column.id), 'ColumnRemoved');
              onClose(false);
            }}
          >
            <ColumnOffIcon />
            Remove
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}

// A Move button on the column's toolbar: an icon square in the segmented control, its name as a tooltip, with the
// keys that do the same on a focused column head (plan-board.md "Drag a column").
function ToolbarButton({
  label,
  keys,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  keys?: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const name = keys ? `${label} (${keys})` : label;
  return (
    <Tooltip label={name}>
      <button
        type="button"
        aria-label={name}
        disabled={disabled}
        className="relative touch-target flex w-9 items-center justify-center text-slate-600 transition enabled:hover:bg-slate-100 enabled:hover:text-slate-900 disabled:text-slate-300 motion-reduce:transition-none dark:text-slate-300 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-slate-50 dark:disabled:text-slate-600"
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}
