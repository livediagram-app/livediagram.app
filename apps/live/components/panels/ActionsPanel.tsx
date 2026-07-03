'use client';

import { isOpenAction, type BoxedElement } from '@livediagram/diagram';
import { formatRelativeTimeShort, useRelativeTimeTick } from '@/lib/relative-time';
import { MovablePanel, type MovablePanelDockProps } from '@/components/primitives/MovablePanel';

export type ActionRow = {
  // Element id; click jumps to it and opens the action popover.
  elementId: string;
  // Display label for the element (same fallbacks as the Comments panel).
  label: string;
  // The action's name + assignee identity, denormalised on the action.
  actionName: string;
  assigneeName: string;
  // Whether the action is assigned to the CURRENT user — carries the
  // "Assigned to you" accent and sorts first (spec/68 §5: the panel's
  // first job is "what's mine here").
  mine: boolean;
  createdAt: number;
};

type ActionsPanelProps = {
  position: { x: number; y: number } | null;
  // Pre-filtered + sorted rows (only OPEN actions). The caller doesn't
  // mount the panel at all when the list is empty, mirroring Comments.
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
// mounted (by the caller) when the active tab has at least one element
// with an OPEN action; done actions never resurrect it. Click any row to
// jump to the underlying element and open its action popover.
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
  return (
    <MovablePanel
      title="Actions"
      headerExtra={
        <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
          {rows.length}
        </span>
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
      <ul className="flex flex-col divide-y divide-slate-100 px-2 pb-2 dark:divide-slate-800">
        {rows.map((row) => (
          <li key={row.elementId}>
            <button
              type="button"
              onClick={() => onRowClick(row.elementId)}
              className="group flex w-full flex-col gap-1 rounded px-1.5 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <div className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                  {row.actionName}
                </span>
                {row.mine ? (
                  <span className="shrink-0 rounded bg-brand-100 px-1 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                    Assigned to you
                  </span>
                ) : null}
              </div>
              <p className="line-clamp-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                {row.label}
              </p>
              <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-400">
                <span className="truncate">{row.mine ? 'You' : row.assigneeName}</span>
                <span>{formatRelativeTimeShort(Date.now() - row.createdAt)}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </MovablePanel>
  );
}

// Derive the panel's rows from the active tab's boxed elements. Exported
// so the editor builds the list once and short-circuits the panel mount
// when it's empty (the spec/68 "only shows with an outstanding action"
// contract). Rows assigned to `selfUserId` sort first, then newest-first.
export function actionRowsFromElements(
  elements: BoxedElement[],
  selfUserId: string | null,
): ActionRow[] {
  const rows: ActionRow[] = [];
  for (const el of elements) {
    const action = el.action;
    if (!isOpenAction(action)) continue;
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
      assigneeName: action.assignee.name?.trim() || 'Teammate',
      mine: selfUserId !== null && action.assignee.userId === selfUserId,
      createdAt: action.createdAt,
    });
  }
  rows.sort((a, b) => (a.mine === b.mine ? b.createdAt - a.createdAt : a.mine ? -1 : 1));
  return rows;
}
