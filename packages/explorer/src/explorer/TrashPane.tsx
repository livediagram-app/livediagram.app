'use client';

// The Trash (livediagram's TrashPane): a note on how long things wait here, then the loaded items grouped
// by whose Trash they are in (yours, then each team's by name), each group a card with its rows: the item,
// when it was deleted and how long it has left, Restore, and Delete Forever. Your group's header empties
// your Trash. The list is the Trash view's own paged list, so nothing more is fetched.

import { useMemo, useState } from 'react';
import type { ShownItem } from '../data/overlay';
import { Button, ConfirmDialog } from '@liveworkspace/ui';
import { LIST_CARD, MUTED } from '../ui/classes';
import { InfoIcon, ItemIcon } from '../ui/icons';
import type { Words } from '../words';
import { useExplorer } from './context';
import { EmptyPane } from './EmptyPane';
import { ThisBrowserTrashGroup, useThisBrowserTrashed } from './ThisBrowser';

export const TRASH_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type TrashGroup = { key: string; title: string; teamId: string | null; rows: ShownItem[] };

export function trashGroups(
  items: readonly ShownItem[],
  teamName: (id: string | null) => string | null,
  words: Words,
): TrashGroup[] {
  const mine: ShownItem[] = [];
  const teams = new Map<string, ShownItem[]>();
  for (const item of items) {
    if (!item.teamId) mine.push(item);
    else teams.set(item.teamId, [...(teams.get(item.teamId) ?? []), item]);
  }
  const groups: TrashGroup[] = [];
  if (mine.length > 0)
    groups.push({ key: 'mine', title: `Your ${words.lowerMany}`, teamId: null, rows: mine });
  const teamGroups = [...teams].map(([teamId, rows]) => ({
    key: `team:${teamId}`,
    title: teamName(teamId) ?? 'A team',
    teamId,
    rows,
  }));
  teamGroups.sort((a, b) => a.title.localeCompare(b.title));
  return [...groups, ...teamGroups];
}

/** "Deleted 3 Oct", or why an empty item was tidied away. */
export function trashedOnLabel(item: Pick<ShownItem, 'trashedAt' | 'trashReason'>): string {
  const on = new Date(item.trashedAt ?? 0).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
  return item.trashReason === 'empty' ? `Moved here ${on} because it was empty` : `Deleted ${on}`;
}

export function daysLeftLabel(trashedAt: number, now: number): string {
  const days = Math.max(0, Math.ceil((trashedAt + TRASH_DAYS * DAY_MS - now) / DAY_MS));
  if (days === 0) return 'Removed at the next clean-up';
  return days === 1 ? '1 day left' : `${days} days left`;
}

export function TrashNote({ words }: { words: Words }) {
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] leading-snug text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
      <span className="mt-px shrink-0 text-slate-400">
        <InfoIcon />
      </span>
      <span>
        Deleted {words.lowerMany} wait here for {TRASH_DAYS} days, then they are removed for good.
        Restoring one puts it back where it was.
      </span>
    </div>
  );
}

export function TrashPane({
  items,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  items: ShownItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const { actions, teamName, words, openDialog } = useExplorer();
  const [now] = useState(() => Date.now());
  const [purging, setPurging] = useState<ShownItem | null>(null);
  const groups = useMemo(() => trashGroups(items, teamName, words), [items, teamName, words]);

  const localTrashed = useThisBrowserTrashed();

  if (groups.length === 0 && localTrashed === 0)
    return <EmptyPane view={{ kind: 'trash' }} words={words} />;
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`trash-${group.key}`} className={LIST_CARD}>
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700/60">
            <h2
              id={`trash-${group.key}`}
              className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100"
            >
              {group.title}
            </h2>
            <button
              type="button"
              aria-label={`Empty Trash: ${group.title}`}
              onClick={() =>
                openDialog({ kind: 'empty-trash', teamId: group.teamId, title: group.title })
              }
              className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              Empty Trash
            </button>
          </header>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {group.rows.map((item) => {
              const name = item.title || 'Untitled';
              return (
                <li
                  key={item.id}
                  data-trash-row={item.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                    <ItemIcon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {name}
                    </p>
                    <p className={`text-xs ${MUTED}`}>
                      {trashedOnLabel(item)} · {daysLeftLabel(item.trashedAt ?? now, now)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="xs"
                      aria-label={`Restore ${name}`}
                      onClick={() => void actions.restore(item)}
                    >
                      Restore
                    </Button>
                    <button
                      type="button"
                      // The menu's and the editors' panel's words; the name after them, so a voice command
                      // saying what the button shows still finds it.
                      aria-label={`Delete Forever: ${name}`}
                      onClick={() => setPurging(item)}
                      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      Delete Forever
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <ThisBrowserTrashGroup />
      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" onClick={onLoadMore} busy={loadingMore}>
            {loadingMore ? 'Loading…' : 'Show more'}
          </Button>
        </div>
      ) : null}
      {purging ? (
        <ConfirmDialog
          open
          title={`Delete “${purging.title || 'Untitled'}” for good?`}
          message="This cannot be undone."
          confirmLabel="Delete permanently"
          onCancel={() => setPurging(null)}
          onConfirm={() => {
            const item = purging;
            setPurging(null);
            void actions.purge(item);
          }}
        />
      ) : null}
    </div>
  );
}
