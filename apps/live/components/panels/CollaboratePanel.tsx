'use client';

import { useState } from 'react';
import type { BoxedElement } from '@livediagram/diagram';
import { formatRelativeTimeShort, useRelativeTimeTick } from '@/lib/relative-time';
import { initialsOf } from '@/lib/identity';
import { MovablePanel, type MovablePanelDockProps } from '@/components/primitives/MovablePanel';
import { Tooltip } from '@/components/primitives/Tooltip';
import { ActionMenuIcon, CommentMenuIcon } from '@/components/palette/context-menu-icons';

// The floating COLLABORATE panel: the Comments and Actions panels
// merged into one surface (they are the two ways work gets discussed /
// divided on a diagram, and two stacked panels crowded the corner).
// A segmented filter splits it into Open (open actions + unresolved
// comment threads) and Resolved (completed actions + resolved threads —
// which now surface here instead of hiding entirely). Every row shares
// one anatomy: a kind glyph (action clipboard / comment bubble) on the
// far left, the name + description in the middle, and the person on the
// far right — an avatar bubble above the relative time, with the name
// on the avatar's hover tooltip rather than spent inline.
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
  // Kind filter (left of the Open / Resolved control): All -> Comments
  // -> Actions, cycled by one compact button so the narrow panel
  // doesn't grow a second segmented row. Open/Resolved counts follow
  // the active kind.
  const [kindFilter, setKindFilter] = useState<'all' | 'comments' | 'actions'>('all');
  const filteredComments = kindFilter === 'actions' ? [] : commentRows;
  const filteredActions = kindFilter === 'comments' ? [] : actionRows;
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
    filteredComments.filter((c) => !c.resolved),
    filteredActions.filter((a) => a.status === 'open'),
  );
  const resolved = merge(
    filteredComments.filter((c) => c.resolved),
    filteredActions.filter((a) => a.status === 'done'),
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
        {/* Kind filter + Open / Resolved segmented filter. */}
        <div className="mb-1.5 flex items-stretch gap-1">
          <KindFilterButton value={kindFilter} onChange={setKindFilter} />
          <div className="grid flex-1 grid-cols-2 gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
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
        </div>
        {shown.length === 0 ? (
          <p className="px-1.5 py-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
            {kindFilter === 'comments'
              ? filter === 'open'
                ? 'No open comments.'
                : 'No resolved comments yet.'
              : kindFilter === 'actions'
                ? filter === 'open'
                  ? 'No open actions.'
                  : 'No completed actions yet.'
                : filter === 'open'
                  ? 'Nothing open.'
                  : 'Nothing resolved yet.'}
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

// The kind filter: one compact button cycling All -> Comments ->
// Actions. A funnel glyph for All; the matching kind glyph +
// brand-tint while filtered, so the narrowed state is visible at a
// glance without a second segmented row.
function KindFilterButton({
  value,
  onChange,
}: {
  value: 'all' | 'comments' | 'actions';
  onChange: (next: 'all' | 'comments' | 'actions') => void;
}) {
  const next = value === 'all' ? 'comments' : value === 'comments' ? 'actions' : 'all';
  const label =
    value === 'all'
      ? 'Showing everything'
      : value === 'comments'
        ? 'Showing comments only'
        : 'Showing actions only';
  return (
    <Tooltip title={label} description="Click to filter by comments or actions.">
      <button
        type="button"
        onClick={() => onChange(next)}
        aria-label={`${label} — click to change the filter`}
        className={`flex w-8 shrink-0 items-center justify-center rounded-lg transition ${
          value === 'all'
            ? 'bg-slate-100 text-slate-500 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            : 'bg-brand-50 text-brand-600 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30'
        }`}
      >
        {value === 'comments' ? (
          <CommentMenuIcon />
        ) : value === 'actions' ? (
          <ActionMenuIcon />
        ) : (
          <FunnelGlyph />
        )}
      </button>
    </Tooltip>
  );
}

function FunnelGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 3h12l-4.5 5v4.5l-3 1.5V8z" />
    </svg>
  );
}

// One shared row shell: kind glyph far left, name + description in the
// middle, avatar-over-time far right. The avatar carries the person's
// name in a tooltip (our custom popover) instead of an inline byline.
function RowShell({
  icon,
  title,
  titleClass,
  description,
  avatar,
  at,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  titleClass: string;
  description: string;
  avatar: { name: string; detail?: string; colorClass?: string; color?: string };
  at: number;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group flex w-full items-start gap-2 rounded px-1.5 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span aria-hidden className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-xs font-medium ${titleClass}`}>{title}</span>
          <span className="line-clamp-1 text-[10px] text-slate-400 dark:text-slate-500">
            {description}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <Tooltip title={avatar.name} description={avatar.detail}>
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-semibold text-white ${avatar.colorClass ?? ''}`}
              style={avatar.color ? { backgroundColor: avatar.color } : undefined}
            >
              {initialsOf(avatar.name)}
            </span>
          </Tooltip>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {formatRelativeTimeShort(Date.now() - at)}
          </span>
        </span>
      </button>
    </li>
  );
}

function ActionRowItem({ row, onClick }: { row: ActionRow; onClick: () => void }) {
  return (
    <RowShell
      icon={<ActionMenuIcon />}
      title={row.actionName}
      titleClass={
        row.status === 'done'
          ? 'text-slate-400 line-through dark:text-slate-500'
          : 'text-slate-800 dark:text-slate-100'
      }
      description={row.label}
      avatar={{
        name: row.mine ? 'You' : row.assigneeName,
        detail: 'Assignee',
        colorClass: row.mine ? 'bg-brand-500' : 'bg-slate-400 dark:bg-slate-600',
      }}
      at={row.createdAt}
      onClick={onClick}
    />
  );
}

function CommentRowItem({ row, onClick }: { row: CommentRow; onClick: () => void }) {
  return (
    <RowShell
      icon={<CommentMenuIcon />}
      title={row.label}
      titleClass={
        row.resolved ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'
      }
      description={row.latestText}
      avatar={{
        name: row.latestAuthorName,
        detail:
          row.count === 1 ? '1 comment in this thread' : `${row.count} comments in this thread`,
        color: row.latestAuthorColor,
      }}
      at={row.latestAt}
      onClick={onClick}
    />
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
