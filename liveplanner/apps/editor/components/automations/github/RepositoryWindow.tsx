'use client';

// The chooser's rows (docs/specs/026-plan/automations.md "The GitHub view": Connected; blueprint "Part 6"): one
// repository's name, its Private tag and its switch, memoised so a flip redraws that row alone; and, for a long list (an
// installation lists up to 1,000), the window that draws only the rows in view, in a scroll box of its own.

import { memo, useState } from 'react';
import type { GithubRepositoryView } from '@liveplanner/api-schema';
import { LockIcon, Switch } from '@liveplanner/ui';

/** One row's height: the rows are a fixed 48px (`h-12`), so the window knows where each one sits. */
export const REPOSITORY_ROW_PX = 48;
/** How many rows the window shows at once: a cut row at the foot says the list scrolls. */
export const REPOSITORY_WINDOW_ROWS = 9.5;
export const REPOSITORY_WINDOW_ROWS_PHONE = 7.5;
/** Rows drawn beyond each edge, so a quick scroll or a Tab to the next row finds it drawn. */
export const REPOSITORY_OVERSCAN = 8;

type Flip = (id: number, on: boolean) => void;

export const RepositoryRow = memo(function RepositoryRow({
  repository: r,
  picked,
  saving,
  onFlip,
  nameId,
  fixed = false,
  position,
}: {
  repository: GithubRepositoryView;
  picked: boolean;
  saving: boolean;
  onFlip: Flip;
  nameId: string;
  // In the window: exactly one row's height, and where it sits in the whole list.
  fixed?: boolean;
  position?: { index: number; of: number };
}) {
  return (
    <li
      data-github-repository=""
      {...(position ? { 'aria-posinset': position.index + 1, 'aria-setsize': position.of } : {})}
      className={`flex items-center gap-3 px-3.5 py-2 ${fixed ? 'h-12' : 'min-h-12'}`}
    >
      <span
        id={nameId}
        className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-slate-800 dark:text-slate-100"
      >
        <span className="truncate font-medium">{r.fullName}</span>
        {r.private ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <LockIcon size={11} aria-hidden />
            Private
          </span>
        ) : null}
      </span>
      <Switch
        size="sm"
        checked={picked}
        labelledBy={nameId}
        disabled={saving}
        onChange={(on) => onFlip(r.id, on)}
      />
    </li>
  );
});

export const REPOSITORY_LIST_CLASSES =
  'divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900';
export const REPOSITORY_BOX_CLASSES =
  'overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700';

/** The rows in view, plus `REPOSITORY_OVERSCAN` each side, between two spacers that keep the list's full height. */
export function RepositoryWindow({
  repositories,
  picked,
  saving,
  onFlip,
  phone,
  idPrefix,
  label,
}: {
  repositories: readonly GithubRepositoryView[];
  picked: ReadonlySet<number>;
  saving: boolean;
  onFlip: Flip;
  phone: boolean;
  idPrefix: string;
  label: string;
}) {
  // The first row in view; set only when a scroll crosses a row, so a scroll within one redraws nothing.
  const [row, setRow] = useState(0);
  const count = repositories.length;
  const shown = phone ? REPOSITORY_WINDOW_ROWS_PHONE : REPOSITORY_WINDOW_ROWS;
  const first = Math.max(0, row - REPOSITORY_OVERSCAN);
  const last = Math.min(count, row + Math.ceil(shown) + REPOSITORY_OVERSCAN);
  return (
    <div
      data-github-repository-window=""
      className={`${REPOSITORY_BOX_CLASSES} overflow-y-auto overscroll-contain`}
      style={{ maxHeight: Math.min(count, shown) * REPOSITORY_ROW_PX }}
      onScroll={(e) => setRow(Math.floor(e.currentTarget.scrollTop / REPOSITORY_ROW_PX))}
    >
      <ul
        aria-label={label}
        className={REPOSITORY_LIST_CLASSES}
        style={{
          paddingTop: first * REPOSITORY_ROW_PX,
          paddingBottom: (count - last) * REPOSITORY_ROW_PX,
        }}
      >
        {repositories.slice(first, last).map((r, i) => (
          <RepositoryRow
            key={r.id}
            repository={r}
            picked={picked.has(r.id)}
            saving={saving}
            onFlip={onFlip}
            nameId={`${idPrefix}-${r.id}`}
            fixed
            position={{ index: first + i, of: count }}
          />
        ))}
      </ul>
    </div>
  );
}
