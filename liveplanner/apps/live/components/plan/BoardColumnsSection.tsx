'use client';

// A board's Columns section (docs/specs/026-plan/plan-board.md "The board's own settings"), in its cog and its element
// menu's Board flyout: the board's columns left to right, a row each (its number, colour, name, Done and WIP pills)
// that opens the column's own settings, then the column picker (an existing status, or a new one), adding at the end
// (before the done column when the board ends with one). The section stays open, so several can be added in a row;
// the one just added fades in. At 12 columns the picker gives way to a note. Each add is one element edit.
import { useEffect, useMemo, useState } from 'react';
import type { ShapeElement } from '@liveplanner/project';
import {
  PLAN_COLUMNS_MAX,
  missingBoardStatuses,
  normaliseBoardSetup,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { ChevronRightIcon } from '@liveplanner/ui';
import { InfoNote } from '@/components/palette/plan-menu-parts';
import { AddColumnPicker } from './AddColumnPicker';
import { addColumnAfter } from './board-setup-edits';
import { requestColumnSettings } from './column-settings-request';
import { addStatusColumn, addStatusColumns, pickableStatuses } from './column-status-picks';
import { HEADING, StatusSwatch } from './ExistingStatusList';
import { usePlan } from './PlanContext';
import { trackSetup } from './track-board-setup';

const NO_STATUSES: ReadonlyMap<string, string> = new Map();
// How long a column just added keeps its tint before easing back.
export const ADDED_TINT_MS = 1600;

const PILL =
  'shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide tabular-nums';

// The column a new one goes after: the last, or the one before a done column that ends the board (null: the end).
export function columnsInsertAfter(
  setup: Pick<PlanBoardSetup, 'columns' | 'doneColumnId'>,
): string | null {
  const { columns, doneColumnId } = setup;
  const last = columns[columns.length - 1];
  if (!last) return null;
  if (last.id === doneColumnId && columns.length > 1) return columns[columns.length - 2]!.id;
  return last.id;
}

export function BoardColumnsSection({
  element,
  open = true,
  onClose,
}: {
  element: ShapeElement;
  // Whether the section is open: the project's statuses are worked out only while it is.
  open?: boolean | undefined;
  // Closes whatever holds the section, as a row hands over to the column's own settings.
  onClose?: (() => void) | undefined;
}) {
  const plan = usePlan();
  const setup = useMemo(() => normaliseBoardSetup(element.planBoard), [element.planBoard]);
  // The column just added, tinted a moment as it fades in.
  const [added, setAdded] = useState<string | null>(null);
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(null), ADDED_TINT_MS);
    return () => clearTimeout(t);
  }, [added]);
  const statusNames = useMemo(
    () =>
      open
        ? pickableStatuses(
            plan?.statusNames ?? NO_STATUSES,
            plan?.items?.values() ?? [],
            plan?.types,
          )
        : NO_STATUSES,
    [open, plan?.statusNames, plan?.items, plan?.types],
  );
  const existing = useMemo(
    () =>
      open && setup
        ? missingBoardStatuses(setup, statusNames, {
            items: plan?.items?.values() ?? [],
            types: plan?.types,
            boards: plan?.statusBoards,
          })
        : [],
    [open, setup, statusNames, plan?.items, plan?.types, plan?.statusBoards],
  );
  if (!plan || !plan.canEdit || !setup) return null;
  const after = columnsInsertAfter(setup);
  const commit = (next: PlanBoardSetup, part: string, columnId?: string) => {
    plan.updateBoard(element.id, next);
    trackSetup(part);
    setAdded(columnId ?? null);
  };
  const full = setup.columns.length >= PLAN_COLUMNS_MAX;
  return (
    <div className="flex flex-col">
      <InfoNote>The board’s columns, left to right. Press one to open its settings.</InfoNote>
      <p
        className={`${HEADING} flex items-center gap-1.5 px-3 pb-1.5 pt-2`}
        id={`${element.id}-columns`}
      >
        On This Board
        <span className="rounded-full bg-slate-100 px-1.5 text-[10px] tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          {setup.columns.length}
        </span>
      </p>
      <ol
        aria-labelledby={`${element.id}-columns`}
        // A bordered box, one column to a row, as Plan's option lists are (plan-board.md "Option lists").
        className="mx-3 flex flex-col divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-700"
      >
        {setup.columns.map((c, i) => (
          <li key={c.id} className={c.id === added ? 'animate-fade-in' : undefined}>
            <button
              type="button"
              aria-label={`Open ${c.name} settings`}
              className={`group flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors motion-reduce:transition-none ${
                c.id === added
                  ? 'bg-brand-50 dark:bg-brand-500/15'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/70'
              }`}
              onClick={() => {
                onClose?.();
                requestColumnSettings(c.id);
              }}
            >
              <span className="w-3.5 shrink-0 text-right text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                {i + 1}
              </span>
              <StatusSwatch colour={c.color} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">
                {c.name}
              </span>
              {c.wipLimit ? (
                <span
                  className={`${PILL} bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300`}
                >
                  WIP {c.wipLimit}
                </span>
              ) : null}
              {setup.doneColumnId === c.id ? (
                <span
                  className={`${PILL} bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`}
                >
                  Done
                </span>
              ) : null}
              <ChevronRightIcon
                size={14}
                className="shrink-0 text-slate-300 transition-colors group-hover:text-slate-500 motion-reduce:transition-none dark:text-slate-600 dark:group-hover:text-slate-300"
              />
            </button>
          </li>
        ))}
      </ol>
      <div className="mx-3 mt-3 border-t border-slate-100 pb-3 pt-3 dark:border-slate-800">
        {full ? (
          <p role="status" className="text-[12px] text-slate-500 dark:text-slate-400">
            A board holds up to {PLAN_COLUMNS_MAX} columns.
          </p>
        ) : (
          <AddColumnPicker
            short
            setup={setup}
            statusNames={statusNames}
            existing={existing}
            onPick={(pick) => {
              const made = addStatusColumn(setup, after, pick);
              if (made) commit(made.setup, 'ColumnAddedExisting', made.column.id);
            }}
            onPickAll={(picks) =>
              commit(addStatusColumns(setup, after, picks), 'ColumnAddedExisting')
            }
            onName={(name) => {
              const made = addColumnAfter(setup, after, name);
              if (made) commit(made.setup, 'ColumnAdded', made.column.id);
            }}
          />
        )}
      </div>
    </div>
  );
}
