'use client';

// The Trash (one-explorer.md "The Trash and Archived", Work Tracker 1492): the band saying how long things wait here
// and what the Trash holds now (ShelfIntro), then the loaded items grouped by whose Trash they are in (yours, then each
// team's by name), each group a card under its own header (the space's disc, its name, how many, Empty Trash), each row
// the item's picture, its name and when it was deleted, a meter of the days it has left (amber in its last week),
// Restore, and Delete Forever. The list is the Trash view's own paged list, so nothing more is fetched.

import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { rowKeys, useFocusAfterRemoval } from '../ui/useFocusAfterRemoval';
import type { ShownItem } from '../data/overlay';
import { Button, Tooltip } from '@liveworkspace/ui';
import { ConfirmDialog } from './lazy-dialogs';
import { DAY_MONTH } from '@liveworkspace/ui/date-format';
import { LIST_CARD, MUTED } from '../ui/classes';
import { ItemIcon, MyWorkIcon, RestoreIcon, TeamIcon, TrashIcon } from '../ui/icons';
import type { Words } from '../words';
import { useExplorer } from './context';
import { EmptyPane } from './EmptyPane';
import { LocalRow, localTrashed, useThisBrowserTrashed } from './ThisBrowser';
import { BrowserIcon, useHostExtras } from './host';
import { BROWSER_STORAGE_COPY } from '../this-browser';
import { quoted } from '../quoted';
import { AppMark } from './badges';
import { THUMB_EDGE } from './HomeSection';
import { ShelfIntro, type ShelfStat } from './ShelfIntro';
import {
  daysLeft,
  daysLeftLabel,
  SOON_DAYS,
  TRASH_DAYS,
  trashedOnLabel,
  trashGroups,
  trashStats,
} from './trash-days';
export {
  daysLeft,
  daysLeftLabel,
  SOON_DAYS,
  TRASH_DAYS,
  trashedOnLabel,
  trashGroups,
  trashStats,
} from './trash-days';

export function TrashIntro({ words, stats }: { words: Words; stats?: ShelfStat[] }) {
  return (
    <ShelfIntro
      data-trash-intro=""
      icon={<TrashIcon />}
      tone="slate"
      title={`Kept for ${TRASH_DAYS} days`}
      description={`Deleted ${words.lowerMany} wait here for ${TRASH_DAYS} days, then they are removed for good. Restoring one puts it back where it was.`}
      stats={stats}
    />
  );
}

/** A group's header: the space's disc (yours, or the team's), its name, how many, and an action at its right. */
export function TrashGroupHeader({
  id,
  title,
  icon,
  tone,
  count,
  action,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  tone: 'sky' | 'indigo' | 'teal';
  count?: number;
  action?: ReactNode;
}) {
  const TONES = {
    sky: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/25',
    indigo:
      'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-400/25',
    teal: 'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-400/10 dark:text-teal-300 dark:ring-teal-400/25',
  } as const;
  return (
    <header className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 dark:border-slate-700/60 dark:bg-slate-900/30">
      <span
        aria-hidden
        className={`flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 [&_svg]:size-3.5 ${TONES[tone]}`}
      >
        {icon}
      </span>
      <h2
        id={id}
        className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100"
      >
        {title}
      </h2>
      {count !== undefined ? (
        <span className="rounded-full bg-slate-200/70 px-1.5 py-px text-[11px] font-medium tabular-nums text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          <span className="text-optical-line">{count.toLocaleString()}</span>
        </span>
      ) : null}
      <span className="ml-auto flex shrink-0 items-center">{action}</span>
    </header>
  );
}

/** The days an item has left, as a short bar and its words: slate while it has time, amber in its last week. */
export function DaysLeftMeter({ trashedAt, now }: { trashedAt: number; now: number }) {
  const days = daysLeft(trashedAt, now);
  const soon = days <= SOON_DAYS;
  const fill = Math.max(4, Math.round((days / TRASH_DAYS) * 100));
  return (
    <span
      data-days-left={days}
      data-days-soon={soon ? '' : undefined}
      className={`inline-flex items-center gap-2 text-xs font-medium tabular-nums ${
        soon ? 'text-amber-800 dark:text-amber-200' : 'text-slate-600 dark:text-slate-300'
      }`}
    >
      <span
        aria-hidden
        className="relative h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      >
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${soon ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-500'}`}
          style={{ width: `${fill}%` }}
        />
      </span>
      {daysLeftLabel(trashedAt, now)}
    </span>
  );
}

const QUIET_ACTION =
  'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300';

const TrashRow = memo(function TrashRow({
  item,
  now,
  showApp,
  onRestore,
  onPurge,
}: {
  item: ShownItem;
  now: number;
  showApp: boolean;
  onRestore: (item: ShownItem) => void;
  onPurge: (item: ShownItem) => void;
}) {
  const { renderThumbnail } = useExplorer();
  const name = item.title || 'Untitled';
  const picture = renderThumbnail?.(item, 'row') ?? (
    <span className="text-slate-300 dark:text-slate-600">
      <ItemIcon size={16} />
    </span>
  );
  return (
    <li
      data-trash-row={item.id}
      className="group flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition hover:bg-slate-50/80 dark:hover:bg-slate-700/30"
    >
      {/* A deleted item's picture, dimmed: it is out of the way until restored. */}
      <span
        aria-hidden
        className={`h-10 w-14 shrink-0 rounded-lg opacity-70 grayscale-[35%] transition group-hover:opacity-100 group-hover:grayscale-0 ${THUMB_EDGE}`}
      >
        {picture}
      </span>
      <div className="min-w-[10rem] flex-1">
        <p className="flex min-w-0 items-center gap-1.5">
          {showApp ? <AppMark app={item.app} size={14} /> : null}
          <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
            {name}
          </span>
        </p>
        <p className={`mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${MUTED}`}>
          <span>{trashedOnLabel(item)}</span>
          <DaysLeftMeter trashedAt={item.trashedAt ?? now} now={now} />
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1 max-sm:ml-[4.25rem]">
        <Button
          variant="secondary"
          size="xs"
          aria-label={`Restore ${name}`}
          onClick={() => onRestore(item)}
        >
          <RestoreIcon />
          Restore
        </Button>
        <Tooltip label={`Delete Forever: ${name}`}>
          <button
            type="button"
            // The menu's and the editors' panel's words; the name after them, so a voice command
            // saying what the button shows still finds it.
            aria-label={`Delete Forever: ${name}`}
            onClick={() => onPurge(item)}
            className={QUIET_ACTION}
          >
            <TrashIcon />
            <span className="max-sm:sr-only">Delete Forever</span>
          </button>
        </Tooltip>
      </div>
    </li>
  );
});

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
  const { actions, teamName, words, openDialog, filter } = useExplorer();
  const [now] = useState(() => Date.now());
  const [purging, setPurging] = useState<ShownItem | null>(null);
  const groups = useMemo(() => trashGroups(items, teamName, words), [items, teamName, words]);
  const stats = useMemo(() => trashStats(items, now, hasMore, words), [items, now, hasMore, words]);
  const showApp = filter === 'all';
  const restore = useCallback((item: ShownItem) => void actions.restore(item), [actions]);

  const localTrashed = useThisBrowserTrashed();
  const list = useRef<HTMLDivElement>(null);
  useFocusAfterRemoval(
    list,
    useMemo(
      () =>
        rowKeys(
          [],
          groups.flatMap((g) => g.rows),
        ),
      [groups],
    ),
  );

  if (groups.length === 0 && localTrashed === 0)
    return <EmptyPane view={{ kind: 'trash' }} words={words} />;
  return (
    <div ref={list} className="flex flex-col gap-5">
      <TrashIntro words={words} stats={groups.length > 0 ? stats : undefined} />
      {groups.map((group) => (
        <section
          key={group.key}
          aria-labelledby={`trash-${group.key}`}
          data-trash-group={group.key}
          className={LIST_CARD}
        >
          <TrashGroupHeader
            id={`trash-${group.key}`}
            title={group.title}
            icon={group.teamId ? <TeamIcon /> : <MyWorkIcon />}
            tone={group.teamId ? 'indigo' : 'sky'}
            count={hasMore ? undefined : group.rows.length}
            action={
              <button
                type="button"
                aria-label={`Empty Trash: ${group.title}`}
                onClick={() =>
                  openDialog({ kind: 'empty-trash', teamId: group.teamId, title: group.title })
                }
                className={QUIET_ACTION}
              >
                Empty Trash
              </button>
            }
          />
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {group.rows.map((item) => (
              <TrashRow
                key={item.id}
                item={item}
                now={now}
                showApp={showApp}
                onRestore={restore}
                onPurge={setPurging}
              />
            ))}
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
          title={`Delete ${quoted(purging.title || 'Untitled')} for good?`}
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

/** The Trash's Offline group: each opens in its app, whose own Trash restores or deletes it. */
export function ThisBrowserTrashGroup() {
  const { thisBrowser } = useHostExtras();
  const [now] = useState(() => Date.now());
  const trashed = useMemo(() => thisBrowser?.items.filter(localTrashed) ?? [], [thisBrowser]);
  if (trashed.length === 0) return null;
  return (
    <section
      aria-labelledby="trash-this-browser"
      data-trash-group="this-browser"
      className={LIST_CARD}
    >
      <TrashGroupHeader
        id="trash-this-browser"
        title={BROWSER_STORAGE_COPY.label}
        icon={<BrowserIcon />}
        tone="teal"
        count={trashed.length}
        action={
          <span className={`text-xs ${MUTED} max-sm:hidden`}>
            Open one to restore or delete it.
          </span>
        }
      />
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {trashed.map((item) => (
          <LocalRow
            key={item.id}
            item={item}
            detail={`Deleted ${DAY_MONTH.format(item.trashedAt!)} · ${daysLeftLabel(item.trashedAt!, now)}`}
          />
        ))}
      </ul>
    </section>
  );
}
