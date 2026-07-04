'use client';

import { formatRelativeTimeShort } from '@/lib/relative-time';
import { initialsOf } from '@/lib/identity';
import { Tooltip } from '@/components/primitives/Tooltip';
import { ActionMenuIcon, CommentMenuIcon } from '@/components/palette/context-menu-icons';
import type { ActionRow, CommentRow } from './CollaboratePanel';

// The COLLABORATE panel's row + filter-control components, lifted out
// of CollaboratePanel (which keeps the panel shell, the merge / filter
// state, and the row-derivation helpers its consumers import). The
// type-only import back into the panel file is the usual host pattern.

// The kind filter: one compact button cycling All -> Comments ->
// Actions. A funnel glyph for All; the matching kind glyph +
// brand-tint while filtered, so the narrowed state is visible at a
// glance without a second segmented row.
export function KindFilterButton({
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

export function ActionRowItem({ row, onClick }: { row: ActionRow; onClick: () => void }) {
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

export function CommentRowItem({ row, onClick }: { row: CommentRow; onClick: () => void }) {
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

export function FilterTab({
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
