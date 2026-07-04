'use client';

import { useState } from 'react';
import type { BoxedElement } from '@livediagram/diagram';
import { formatRelativeTimeShort, useRelativeTimeTick } from '@/lib/relative-time';
import { initialsOf } from '@/lib/identity';
import { MovablePanel, type MovablePanelDockProps } from '@/components/primitives/MovablePanel';

// The floating COLLABORATE panel: the Comments and Actions panels
// merged into one surface (they are the two ways work gets discussed /
// divided on a diagram, and two stacked panels crowded the corner).
// A segmented filter splits it into Open (open actions + unresolved
// comment threads) and Resolved (completed actions + resolved threads —
// which now surface here instead of hiding entirely). Each row carries
// a kind chip so comments and actions stay distinguishable at a glance.
// Click a row to jump to the element and open its popover (thread or
// action, per kind).

export type CommentRow = {
  // Element id; click jumps to it and opens the thread.
  elementId: string;
  // Display label for the element, "Untitled" when missing so the
  // row never reads as blank.
  label: string;
  // Number of comments in the thread.
  count: number;
  // Newest comment's author identity for the leading dot. Reused
  // from Comment.authorName / authorColor (denormalised on write
  // so the panel renders without joining the participant list).
  latestAuthorName: string;
  latestAuthorColor: string;
  // Newest comment's text + ts for the row preview + timestamp.
  latestText: string;
  latestAt: number;
  // Resolved threads land in the panel's Resolved view (the thread
  // still lives on the element and reopens from its badge).
  resolved: boolean;
};

export type ActionRow = {
  // Element id; click jumps to it and opens the action popover.
  elementId: string;
  // Display label for the element (same fallbacks as comment rows).
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

// One merged, sortable list entry. Actions assigned to me sort first in
// the Open view; everything else interleaves newest-first on its own
// timestamp (an action's createdAt, a thread's latest comment).
type CollaborateRow =
  | { kind: 'comment'; at: number; mine: false; comment: CommentRow }
  | { kind: 'action'; at: number; mine: boolean; action: ActionRow };

type CollaboratePanelProps = {
  position: { x: number; y: number } | null;
  // Every comment thread (unresolved AND resolved) + every action (open
  // AND done) on the tab — the panel splits Open / Resolved itself. The
  // caller doesn't mount the panel at all when both lists are empty.
  commentRows: CommentRow[];
  actionRows: ActionRow[];
  stackBelowY?: number;
  onMoveTo: (x: number, y: number) => void;
  onReset: () => void;
  // Row clicks: the editor selects the element + opens the matching
  // popover (comment thread / action).
  onCommentRowClick: (elementId: string) => void;
  onActionRowClick: (elementId: string) => void;
  // Corner-docking bundle (spec/63), forwarded to the inner MovablePanel.
  dock?: MovablePanelDockProps;
};

export function CollaboratePanel({
  position,
  commentRows,
  actionRows,
  stackBelowY,
  onMoveTo,
  onReset,
  onCommentRowClick,
  onActionRowClick,
  dock,
}: CollaboratePanelProps) {
  useRelativeTimeTick();
  const merge = (comments: CommentRow[], actions: ActionRow[]): CollaborateRow[] =>
    [
      ...comments.map(
        (c): CollaborateRow => ({ kind: 'comment', at: c.latestAt, mine: false, comment: c }),
      ),
      ...actions.map(
        (a): CollaborateRow => ({ kind: 'action', at: a.createdAt, mine: a.mine, action: a }),
      ),
    ].sort((a, b) => (a.mine === b.mine ? b.at - a.at : a.mine ? -1 : 1));
  const open = merge(
    commentRows.filter((c) => !c.resolved),
    actionRows.filter((a) => a.status === 'open'),
  );
  const resolved = merge(
    commentRows.filter((c) => c.resolved),
    actionRows.filter((a) => a.status === 'done'),
  );
  // Land on whichever side has content: Open normally, Resolved when
  // everything is already wrapped up (an empty default view helps no one).
  const [filter, setFilter] = useState<'open' | 'resolved'>(open.length > 0 ? 'open' : 'resolved');
  const shown = filter === 'open' ? open : resolved;
  return (
    <MovablePanel
      title="Collaborate"
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
      // Default collapsed: an open panel would compete with the Palette
      // right above it. Users open it deliberately when they want to
      // scan the discussion; until then it banner-collapses to its title
      // row so the canvas stays as roomy as possible.
      defaultCollapsed
    >
      <div className="px-2 pb-2">
        {/* Open / Resolved segmented filter. */}
        <div className="mb-1.5 grid grid-cols-2 gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
          <FilterTab
            label="Open"
            count={open.length}
            active={filter === 'open'}
            onClick={() => setFilter('open')}
          />
          <FilterTab
            label="Resolved"
            count={resolved.length}
            active={filter === 'resolved'}
            onClick={() => setFilter('resolved')}
          />
        </div>
        {shown.length === 0 ? (
          <p className="px-1.5 py-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
            {filter === 'open' ? 'Nothing open.' : 'Nothing resolved yet.'}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {shown.map((row) =>
              row.kind === 'action' ? (
                <ActionRowItem
                  key={`a-${row.action.elementId}`}
                  row={row.action}
                  onClick={() => onActionRowClick(row.action.elementId)}
                />
              ) : (
                <CommentRowItem
                  key={`c-${row.comment.elementId}`}
                  row={row.comment}
                  onClick={() => onCommentRowClick(row.comment.elementId)}
                />
              ),
            )}
          </ul>
        )}
      </div>
    </MovablePanel>
  );
}

// Tiny kind chip so a mixed list scans by type without reading rows.
function KindChip({ kind }: { kind: 'Comment' | 'Action' }) {
  return (
    <span
      className={`shrink-0 rounded px-1 text-[9px] font-semibold uppercase tracking-wide ${
        kind === 'Action'
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
      }`}
    >
      {kind}
    </span>
  );
}

function ActionRowItem({ row, onClick }: { row: ActionRow; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
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
          <span className="flex items-center gap-1">
            <span
              className={`min-w-0 flex-1 truncate text-xs font-medium ${
                row.status === 'done'
                  ? 'text-slate-400 line-through dark:text-slate-500'
                  : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              {row.actionName}
            </span>
            <KindChip kind="Action" />
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
  );
}

function CommentRowItem({ row, onClick }: { row: CommentRow; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full flex-col gap-1 rounded px-1.5 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: row.latestAuthorColor }}
          />
          <span
            className={`min-w-0 flex-1 truncate text-xs font-medium ${
              row.resolved
                ? 'text-slate-400 dark:text-slate-500'
                : 'text-slate-800 dark:text-slate-100'
            }`}
          >
            {row.label}
          </span>
          <KindChip kind="Comment" />
          <span className="shrink-0 rounded bg-slate-100 px-1 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {row.count}
          </span>
        </div>
        <p className="line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {row.latestText}
        </p>
        <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-400">
          <span className="truncate">{row.latestAuthorName}</span>
          <span>{formatRelativeTimeShort(Date.now() - row.latestAt)}</span>
        </div>
      </button>
    </li>
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

// Derive comment rows from the active tab's boxed elements. Resolved
// threads are INCLUDED (flagged) so the panel's Resolved view can list
// them; the caller short-circuits the panel mount when the list (plus
// the action list) is empty. Sorted newest-first on latestAt.
export function commentRowsFromElements(elements: BoxedElement[]): CommentRow[] {
  const rows: CommentRow[] = [];
  for (const el of elements) {
    const thread = (el as { commentThread?: { comments: unknown[]; resolved: boolean } })
      .commentThread;
    if (!thread || thread.comments.length === 0) continue;
    const comments = thread.comments as {
      text: string;
      createdAt: number;
      authorName: string;
      authorColor: string;
    }[];
    const latest = comments[comments.length - 1]!;
    rows.push({
      elementId: el.id,
      label: elementRowLabel(el),
      count: comments.length,
      latestAuthorName: latest.authorName,
      latestAuthorColor: latest.authorColor,
      latestText: latest.text,
      latestAt: latest.createdAt,
      resolved: thread.resolved,
    });
  }
  rows.sort((a, b) => b.latestAt - a.latestAt);
  return rows;
}

// Derive action rows — every action, open and done (the panel filters
// between them). Rows assigned to `selfUserId` sort first, then
// newest-first.
export function actionRowsFromElements(
  elements: BoxedElement[],
  selfUserId: string | null,
): ActionRow[] {
  const rows: ActionRow[] = [];
  for (const el of elements) {
    const action = el.action;
    if (!action) continue;
    rows.push({
      elementId: el.id,
      label: elementRowLabel(el),
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

// Shared element-label fallbacks: tables have no single label (the
// cells carry the text), so describe them as "Table" plus the first
// non-empty cell rather than a stray fallback.
function elementRowLabel(el: BoxedElement): string {
  if (el.type === 'table') {
    const firstCell = el.cells.flat().find((c) => c.trim().length > 0);
    return firstCell ? `Table: ${firstCell.trim()}` : 'Table';
  }
  const labelSource = (el as { label?: string }).label;
  return labelSource && labelSource.trim().length > 0 ? labelSource.trim() : 'Untitled';
}
