'use client';

// The editor's Explorer pane's own parts (docs/specs/013-workspace/explorer-structure.md "The pane"): one row, one
// section heading, one thumbnail size, one icon tile, one skeleton and one empty state, so every section reads as the
// same surface whatever it lists.
import type { KeyboardEvent, ReactNode } from 'react';
import { EmptyState } from '@livediagram/ui';

// A row's thumbnail box: the documents' snapshot at the pane's size.
export const PANE_THUMB_BOX =
  'h-9 w-12 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40';

// The quiet text action at a heading's end ("See all", "See timeline").
export const PANE_LINK =
  'cursor-pointer rounded text-xs font-medium text-brand-700 transition hover:text-brand-800 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300 dark:hover:text-brand-200';

export function PaneSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3 px-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  );
}

// Up and Down move between a list's rows (the [data-pane-row] buttons), as the rail's keys do.
export function paneListKeys(e: KeyboardEvent<HTMLElement>): void {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-pane-row]')];
  const at = rows.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  e.preventDefault();
  rows[Math.min(rows.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
}

export function PaneList({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="flex flex-col gap-0.5" onKeyDown={paneListKeys}>
      {children}
    </ul>
  );
}

// One row: a leading thumbnail or tile, the name over a quiet line, and a trailing slot (pills, the ⋯ menu) shown
// beside the main button so a menu never nests inside it.
export function PaneRow({
  leading,
  title,
  meta,
  trailing,
  onActivate,
  current = false,
  label,
  rowProps,
  highlighted = false,
  className = '',
}: {
  leading: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  onActivate?: () => void;
  // The open document's row.
  current?: boolean;
  // The accessible name, when the title is more than words.
  label?: string;
  // Drag and drop, a context menu: spread on the row itself.
  rowProps?: React.HTMLAttributes<HTMLLIElement>;
  // A dragged document rests on it.
  highlighted?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <span className="flex shrink-0 items-center">{leading}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={`truncate text-[13px] leading-5 ${
            current
              ? 'font-semibold text-brand-800 dark:text-brand-100'
              : 'font-medium text-slate-800 dark:text-slate-100'
          }`}
        >
          {title}
        </span>
        {meta ? (
          <span className="truncate text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            {meta}
          </span>
        ) : null}
      </span>
    </>
  );
  return (
    <li
      {...rowProps}
      className={`group/pane-row relative flex items-center gap-1 rounded-lg pr-1.5 transition ${
        current
          ? 'bg-brand-50 dark:bg-brand-500/15'
          : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
      } ${highlighted ? 'ring-2 ring-brand-400' : ''} ${className}`}
    >
      {onActivate ? (
        <button
          type="button"
          data-pane-row=""
          aria-label={label}
          aria-current={current ? 'true' : undefined}
          onClick={onActivate}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 pointer-coarse:py-2.5"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-1.5">{body}</div>
      )}
      {trailing ? <span className="flex shrink-0 items-center gap-1">{trailing}</span> : null}
    </li>
  );
}

// A leading tile for what has no thumbnail: a folder, an event, a trashed document.
export function PaneTile({
  children,
  tone = 'slate',
}: {
  children: ReactNode;
  tone?: 'slate' | 'brand' | 'amber';
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300',
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-200',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-200',
  } as const;
  return (
    <span
      aria-hidden
      className={`flex h-9 w-12 shrink-0 items-center justify-center rounded-md [&_svg]:h-4 [&_svg]:w-4 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function PaneSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul aria-hidden className="flex flex-col gap-0.5">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-2 py-1.5">
          <span className="h-9 w-12 animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-700/70" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-3 w-2/3 animate-pulse rounded bg-slate-200/80 dark:bg-slate-700/70" />
            <span className="h-2.5 w-1/3 animate-pulse rounded bg-slate-200/60 dark:bg-slate-700/50" />
          </span>
        </li>
      ))}
    </ul>
  );
}

// Nothing here: the Explorer's illustrated empty state, sized for the pane.
export function PaneEmpty({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <EmptyState compact icon={icon} title={title} description={description}>
      {children}
    </EmptyState>
  );
}

// A read failed: one line and Try Again.
export function PaneFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <p className="text-xs text-slate-500 dark:text-slate-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        Try Again
      </button>
    </div>
  );
}
