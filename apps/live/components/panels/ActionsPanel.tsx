'use client';

import { useState } from 'react';
import { type BoxedElement } from '@livediagram/diagram';
import { formatRelativeTimeShort, useRelativeTimeTick } from '@/lib/relative-time';
import { initialsOf } from '@/lib/identity';
import { MovablePanel, type MovablePanelDockProps } from '@/components/primitives/MovablePanel';

export type ActionRow = {
  // Element id; click jumps to it and opens the action popover.
  elementId: string;
  // Display label for the element (same fallbacks as the Comments panel).
  label: string;
  // The action's name, status, and assignee identity.
  actionName: string;
  status: 'open' | 'done';
  assigneeName: string;
  // Whether the action is assigned to the CURRENT user — sorts first
  // and renders as "You" (spec/68 §5: the panel's first job is "what's
  // mine here").
  mine: boolean;
  createdAt: number;
};

type ActionsPanelProps = {
  position: { x: number; y: number } | null;
  // Every action on the tab, open AND done — the panel filters between
  // Outstanding and Completed itself. The caller doesn't mount the
  // panel at all when the list is empty.
  rows: ActionRow[];
  stackBelowY?: number;
  onMoveTo: (x: number, y: number) => void;
  onReset: () => void;
  // Row click: the editor selects the element + opens its action popover.
  onRowClick: (elementId: string) => void;
  // Corner-docking bundle (spec/63), forwarded to the inner MovablePanel.
  dock?: MovablePanelDockProps;
};

// Floating "Actions" panel (spec/68), the Comments panel's sibling. Only
// mounted (by the caller) when the active tab carries at least one
// action; a segmented filter switches between Outstanding and Completed.
// Click any row to jump to the underlying element and open its popover.
export function ActionsPanel({
  position,
  rows,
  stackBelowY,
  onMoveTo,
  onReset,
  onRowClick,
  dock,
}: ActionsPanelProps) {
  useRelativeTimeTick();
  const open = rows.filter((r) => r.status === 'open');
  const done = rows.filter((r) => r.status === 'done');
  // Land on whichever side has content: Outstanding normally, Completed
  // when everything is already done (an empty default view helps no one).
  const [filter, setFilter] = useState<'open' | 'done'>(open.length > 0 ? 'open' : 'done');
  const shown = filter === 'open' ? open : done;
  return (
    <MovablePanel
      title="Actions"
      headerExtra={
        open.length > 0 ? (
          <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
            {open.length}
          </span>
        ) : undefined
      }
      position={position}
      defaultCorner="top-right-stacked"
      width="w-auto sm:w-64"
      stackBelowY={stackBelowY}
      onReset={onReset}
      onMoveTo={onMoveTo}
      {...dock}
      collapsible
      // Default collapsed for the same reason as Comments: it stacks
      // under the Palette and should not crowd the canvas until the
      // user deliberately opens it.
      defaultCollapsed
    >
      <div className="px-2 pb-2">
        {/* Outstanding / Completed segmented filter. */}
        <div className="mb-1.5 grid grid-cols-2 gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
          <FilterTab
            label="Outstanding"
            count={open.length}
            active={filter === 'open'}
            onClick={() => setFilter('open')}
          />
          <FilterTab
            label="Completed"
            count={done.length}
            active={filter === 'done'}
            onClick={() => setFilter('done')}
          />
        </div>
        {shown.length === 0 ? (
          <p className="px-1.5 py-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
            {filter === 'open' ? 'Nothing outstanding.' : 'Nothing completed yet.'}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {shown.map((row) => (
              <li key={row.elementId}>
                <button
                  type="button"
                  onClick={() => onRowClick(row.elementId)}
                  className="group flex w-full items-center gap-2 rounded px-1.5 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span
                    aria-hidden
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white ${
                      row.mine ? 'bg-brand-500' : 'bg-slate-400 dark:bg-slate-600'
                    }`}
                  >
                    {initialsOf(row.assigneeName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-xs font-medium ${
                        row.status === 'done'
                          ? 'text-slate-400 line-through dark:text-slate-500'
                          : 'text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {row.actionName}
                    </span>
                    <span className="block truncate text-[10px] text-slate-400 dark:text-slate-500">
                      {row.mine ? 'You' : row.assigneeName}
                      <span aria-hidden> · </span>
                      {row.label}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                    {formatRelativeTimeShort(Date.now() - row.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MovablePanel>
  );
}

function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold transition ${
        active
          ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100'
          : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
      }`}
    >
      {label}
      <span
        className={`inline-flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full px-1 text-[9px] font-semibold ${
          active
            ? 'bg-brand-500 text-white'
            : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// Derive the panel's rows from the active tab's boxed elements — every
// action, open and done (the panel filters between them). Exported so
// the editor builds the list once and short-circuits the panel mount
// when it's empty. Rows assigned to `selfUserId` sort first, then
// newest-first.
export function actionRowsFromElements(
  elements: BoxedElement[],
  selfUserId: string | null,
): ActionRow[] {
  const rows: ActionRow[] = [];
  for (const el of elements) {
    const action = el.action;
    if (!action) continue;
    const labelSource = el.label;
    // Same element-label fallbacks as commentRowsFromElements: tables
    // have no single label, so describe them by their first cell.
    let label: string;
    if (el.type === 'table') {
      const firstCell = el.cells.flat().find((c) => c.trim().length > 0);
      label = firstCell ? `Table: ${firstCell.trim()}` : 'Table';
    } else {
      label = labelSource && labelSource.trim().length > 0 ? labelSource.trim() : 'Untitled';
    }
    rows.push({
      elementId: el.id,
      label,
      actionName: action.name,
      status: action.status,
      assigneeName: action.assignee.name?.trim() || 'Teammate',
      mine: selfUserId !== null && action.assignee.userId === selfUserId,
      createdAt: action.createdAt,
    });
  }
  rows.sort((a, b) => (a.mine === b.mine ? b.createdAt - a.createdAt : a.mine ? -1 : 1));
  return rows;
}
