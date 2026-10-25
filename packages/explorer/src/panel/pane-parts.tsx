'use client';

// The editor's Explorer pane's own parts (liveplanner's explorer-panel/pane-parts.tsx, as it was before the index):
// one row, one section heading, one thumbnail size, one icon tile, one skeleton and one empty state, so every
// section reads as the same surface whatever it lists.
import type { KeyboardEvent, ReactNode } from 'react';
import { EmptyState } from '@liveworkspace/ui';

// A row's thumbnail box: the item's snapshot at the pane's size, framed like a little page.
export const PANE_THUMB_BOX =
  'h-11 w-[60px] shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-slate-200/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] dark:bg-slate-900 dark:ring-slate-700';
// A preview card's thumbnail: filling the card's top.
export const PANE_PREVIEW_BOX = 'h-full w-full bg-white dark:bg-slate-900';

// The surface every card in the pane shares: raised a touch off the pane, lifting on hover.
const CARD =
  'rounded-xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition duration-micro hover:-translate-y-px hover:shadow-[0_6px_16px_-6px_rgba(15,23,42,0.18)] hover:ring-slate-300 motion-reduce:hover:translate-y-0 dark:bg-slate-800/70 dark:ring-slate-700/80 dark:hover:ring-slate-600';
const CARD_CURRENT =
  'rounded-xl bg-brand-50/70 ring-2 ring-brand-400/70 shadow-[0_1px_2px_rgba(15,23,42,0.05)] dark:bg-brand-500/10 dark:ring-brand-400/50';

// The quiet text action at a heading's end ("See all"): a line of small text, padded to a finger's
// 44px on a touch screen.
export const PANE_LINK =
  'relative touch-target cursor-pointer rounded text-xs font-medium text-brand-700 transition hover:text-brand-800 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300 dark:hover:text-brand-200';

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
function paneListKeys(e: KeyboardEvent<HTMLElement>): void {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-pane-row]')];
  const at = rows.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  e.preventDefault();
  rows[Math.min(rows.length - 1, Math.max(0, at + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
}

// Rows cascade in as a list arrives (lvd-cascade: a rise and fade, still under reduced motion).
export function PaneList({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="lvd-cascade flex flex-col gap-1.5" onKeyDown={paneListKeys}>
      {children}
    </ul>
  );
}

// Two columns of preview cards (folders, Jump Back In), cascading in as the rows do.
export function PaneGrid({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="lvd-cascade grid grid-cols-2 gap-2" onKeyDown={paneListKeys}>
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
  // The open project's row.
  current?: boolean;
  // The accessible name, when the title is more than words.
  label?: string;
  // Drag and drop, a context menu: spread on the row itself.
  rowProps?: React.HTMLAttributes<HTMLLIElement>;
  // A dragged project rests on it.
  highlighted?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <span className="flex shrink-0 items-center">{leading}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={`truncate text-[13.5px] leading-5 ${
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
      className={`group group/pane-row relative flex items-center gap-1 pr-2 ${current ? CARD_CURRENT : CARD} ${
        highlighted ? '!ring-2 !ring-brand-400' : ''
      } ${className}`}
    >
      {onActivate ? (
        <button
          type="button"
          data-pane-row=""
          aria-label={label}
          aria-current={current ? 'true' : undefined}
          onClick={onActivate}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 pointer-coarse:py-2.5"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2">{body}</div>
      )}
      {trailing ? <span className="flex shrink-0 items-center gap-1">{trailing}</span> : null}
    </li>
  );
}

// A leading tile for what has no thumbnail: a folder, an event, a trashed project. Each tone a soft gradient with a
// hairline of its own colour, so tiles read as a family at a glance.
export type PaneTone = 'slate' | 'brand' | 'amber' | 'emerald' | 'sky' | 'violet' | 'rose';
const TONES: Record<PaneTone, string> = {
  slate:
    'from-slate-50 to-slate-100 text-slate-500 ring-slate-200/80 dark:from-slate-800 dark:to-slate-800/60 dark:text-slate-300 dark:ring-slate-700',
  brand:
    'from-brand-50 to-brand-100/70 text-brand-700 ring-brand-200/70 dark:from-brand-500/20 dark:to-brand-500/10 dark:text-brand-200 dark:ring-brand-400/25',
  amber:
    'from-amber-50 to-amber-100/70 text-amber-600 ring-amber-200/70 dark:from-amber-500/20 dark:to-amber-500/10 dark:text-amber-200 dark:ring-amber-400/25',
  emerald:
    'from-emerald-50 to-emerald-100/70 text-emerald-600 ring-emerald-200/70 dark:from-emerald-500/20 dark:to-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/25',
  sky: 'from-sky-50 to-sky-100/70 text-sky-600 ring-sky-200/70 dark:from-sky-500/20 dark:to-sky-500/10 dark:text-sky-200 dark:ring-sky-400/25',
  violet:
    'from-violet-50 to-violet-100/70 text-violet-600 ring-violet-200/70 dark:from-violet-500/20 dark:to-violet-500/10 dark:text-violet-200 dark:ring-violet-400/25',
  rose: 'from-rose-50 to-rose-100/70 text-rose-600 ring-rose-200/70 dark:from-rose-500/20 dark:to-rose-500/10 dark:text-rose-200 dark:ring-rose-400/25',
};

// `mark` is the compact one, for rows that stand for an event or a place rather than a project (the Timeline, This
// Browser): a small square beside the name, so the row stays one line high and never reads as a thumbnail.
export function PaneTile({
  children,
  tone = 'slate',
  size = 'tile',
}: {
  children: ReactNode;
  tone?: PaneTone;
  size?: 'tile' | 'mark';
}) {
  const box =
    size === 'mark'
      ? 'size-8 rounded-lg [&_svg]:size-4'
      : 'h-11 w-[60px] rounded-lg [&_svg]:h-[18px] [&_svg]:w-[18px]';
  return (
    <span
      aria-hidden
      data-pane-tile={size}
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br ring-1 ${box} ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

// A preview card: a picture across its top (a project's snapshot, a folder's tile), the name and a quiet line under
// it, a trailing slot (the ⋯ menu) over the picture's corner.
export function PaneCard({
  preview,
  title,
  meta,
  trailing,
  onActivate,
  current = false,
  label,
  rowProps,
  highlighted = false,
}: {
  preview: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  onActivate?: () => void;
  current?: boolean;
  label?: string;
  rowProps?: React.HTMLAttributes<HTMLLIElement>;
  highlighted?: boolean;
}) {
  return (
    <li
      {...rowProps}
      className={`group group/pane-card relative flex min-w-0 flex-col overflow-hidden ${current ? CARD_CURRENT : CARD} ${
        highlighted ? '!ring-2 !ring-brand-400' : ''
      }`}
    >
      {onActivate ? (
        <button
          type="button"
          data-pane-row=""
          aria-label={label}
          aria-current={current ? 'true' : undefined}
          onClick={onActivate}
          className="flex min-w-0 flex-col text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
        >
          <span className="block aspect-[16/9] w-full overflow-hidden border-b border-slate-100 dark:border-slate-700/70">
            {preview}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5 px-2.5 pb-2 pt-1.5">
            <span
              className={`truncate text-[13px] font-semibold leading-5 ${
                current
                  ? 'text-brand-800 dark:text-brand-100'
                  : 'text-slate-800 dark:text-slate-100'
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
        </button>
      ) : (
        // Renaming: the name is a field, which may not sit inside a button.
        <div className="flex min-w-0 flex-col">
          <span className="block aspect-[16/9] w-full overflow-hidden border-b border-slate-100 dark:border-slate-700/70">
            {preview}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5 px-2.5 pb-2 pt-1.5">
            <span
              className={`truncate text-[13px] font-semibold leading-5 ${
                current
                  ? 'text-brand-800 dark:text-brand-100'
                  : 'text-slate-800 dark:text-slate-100'
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
        </div>
      )}
      {trailing ? (
        <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md bg-white/90 shadow-sm backdrop-blur transition pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-within:opacity-100 pointer-fine:has-[[aria-expanded=true]]:opacity-100 dark:bg-slate-900/80">
          {trailing}
        </span>
      ) : null}
    </li>
  );
}

// A folder's picture for its card: the folder glyph large on its tone, and what it holds.
export function FolderPreview({ icon, count }: { icon: ReactNode; count: string }) {
  return (
    <span className="relative flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-50 via-white to-sky-50 text-brand-700 dark:from-brand-500/20 dark:via-slate-900 dark:to-sky-500/10 dark:text-brand-300 [&_svg]:h-9 [&_svg]:w-9">
      {icon}
      <span className="absolute bottom-1.5 left-2 rounded-full bg-white/90 px-1.5 text-[10px] font-semibold leading-4 text-slate-600 shadow-sm dark:bg-slate-800/90 dark:text-slate-300">
        {count}
      </span>
    </span>
  );
}

// A square icon button for a row's own verbs (Restore, Delete), named by its tooltip.
export function PaneIconButton({
  label,
  onClick,
  tone = 'brand',
  children,
}: {
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  tone?: 'brand' | 'danger';
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200 shadow-sm transition focus-visible:outline-2 focus-visible:outline-brand-500 pointer-coarse:h-11 pointer-coarse:w-11 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 [&_svg]:h-4 [&_svg]:w-4 ${
        tone === 'danger'
          ? 'hover:bg-rose-50 hover:text-rose-600 hover:ring-rose-200 dark:hover:bg-rose-500/15 dark:hover:text-rose-300 dark:hover:ring-rose-400/40'
          : 'hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-200 dark:hover:bg-brand-500/15 dark:hover:text-brand-200 dark:hover:ring-brand-400/40'
      }`}
    >
      {children}
    </button>
  );
}

export function PaneSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul aria-hidden className="flex flex-col gap-1.5">
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-xl px-2 py-2 ring-1 ring-slate-200/70 dark:ring-slate-700/60"
        >
          <span className="h-11 w-[60px] animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-700/70" />
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
