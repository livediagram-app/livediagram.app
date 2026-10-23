'use client';

// This Browser in the Explorer: the host app's items kept only in this browser (this-browser.ts), where the host can
// read them (the Explorer served on the app's own address). They show as liveplanner's own Explorer showed them: a
// sidebar row with their count, a view of their own (`/explorer/offline`), a This Browser group in the Trash, and
// among Recent in Home's Jump Back In. Each opens in its app's editor, which does the rest (rename, sync, restore): the
// index never sees them, so the Explorer only lists them.

import { useMemo, useState, type ReactNode } from 'react';
import type { ThisBrowserItem } from '../this-browser';
import { LIST_CARD, MUTED } from '../ui/classes';
import { useExplorer } from './context';
import { BrowserIcon, useHostExtras } from './host';
import { PaneHeader } from './PaneHeader';
import { daysLeftLabel } from './TrashPane';

/** What a host hands the Explorer for This Browser. */
export type ThisBrowserHost = {
  // Newest change first, live and trashed alike.
  items: readonly ThisBrowserItem[];
  // Where the app opens one.
  itemHref: (item: ThisBrowserItem) => string;
  // The app's help on keeping items in this browser; the pill links there.
  helpHref?: string;
};

export const THIS_BROWSER_COPY = {
  label: 'This Browser',
  sentence: 'Lives only in this browser. Clearing this browser’s site data deletes it.',
} as const;

const live = (i: ThisBrowserItem) => i.trashedAt === null;

/** The live items, newest change first. */
export function useThisBrowserItems(): { host: ThisBrowserHost | null; live: ThisBrowserItem[] } {
  const { thisBrowser } = useHostExtras();
  const items = useMemo(() => thisBrowser?.items.filter(live) ?? [], [thisBrowser]);
  return { host: thisBrowser, live: items };
}

/** Jump Back In's merge: the opened ones among `recent`, by the same rule (last opened first), at most `max`. */
export function mergeOpened<T extends { lastOpenedAt: number | null }>(
  recent: readonly T[],
  local: readonly ThisBrowserItem[],
  max: number,
): (T | ThisBrowserItem)[] {
  const opened = local.filter((i) => i.lastOpenedAt !== null);
  if (opened.length === 0) return [...recent];
  return [...recent, ...opened]
    .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
    .slice(0, Math.max(max, recent.length));
}

let pillSeq = 0;

/** The amber pill every local row and card carries: not colour alone (an icon and the words), its sentence as its
 *  description, and a link to the app's help where the row is not itself a link. */
export function ThisBrowserPill({ inLink = false }: { inLink?: boolean }) {
  const { thisBrowser } = useHostExtras();
  const [id] = useState(() => `this-browser-pill-${++pillSeq}`);
  const body = (
    <>
      <BrowserIcon size={11} />
      <span>{THIS_BROWSER_COPY.label}</span>
      <span id={id} className="sr-only">
        {THIS_BROWSER_COPY.sentence}
      </span>
    </>
  );
  const className =
    'inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-700/30 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-300/40';
  if (inLink || !thisBrowser?.helpHref)
    return (
      <span
        data-this-browser=""
        aria-describedby={id}
        title={THIS_BROWSER_COPY.sentence}
        className={className}
      >
        {body}
      </span>
    );
  return (
    <a
      data-this-browser=""
      href={thisBrowser.helpHref}
      target="_blank"
      rel="noreferrer"
      aria-describedby={id}
      title={THIS_BROWSER_COPY.sentence}
      className={`${className} hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600`}
    >
      {body}
    </a>
  );
}

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

function LocalRow({ item, detail }: { item: ThisBrowserItem; detail: ReactNode }) {
  const { thisBrowser } = useHostExtras();
  const name = item.title || 'Untitled';
  return (
    <li data-this-browser-row={item.id}>
      <a
        href={thisBrowser?.itemHref(item)}
        className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 dark:hover:bg-slate-800/60"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          <BrowserIcon size={14} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
              {name}
            </span>
            <ThisBrowserPill inLink />
          </span>
          <span className={`text-xs ${MUTED}`}>{detail}</span>
        </span>
      </a>
    </li>
  );
}

/** `/explorer/offline`: every live item kept only in this browser, newest change first. */
export function ThisBrowserPane({ onOpenNav }: { onOpenNav?: () => void }) {
  const { words } = useExplorer();
  const { host, live: items } = useThisBrowserItems();
  return (
    <div data-explorer-view="offline">
      <PaneHeader title={THIS_BROWSER_COPY.label} onOpenNav={onOpenNav} showFilter={false} />
      <p className={`mb-5 text-sm ${MUTED}`}>
        {words.many} kept only in this browser. They aren’t in your account and don’t sync to other
        devices.
      </p>
      {!host || items.length === 0 ? (
        <p className={`text-sm ${MUTED}`}>Nothing is kept only in this browser.</p>
      ) : (
        <ul className={`${LIST_CARD} divide-y divide-slate-100 dark:divide-slate-700/60`}>
          {items.map((item) => (
            <LocalRow
              key={item.id}
              item={item}
              detail={`Changed ${new Date(item.updatedAt).toLocaleDateString(undefined, DATE)}`}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** How many of the host's local items wait in its Trash. */
export function useThisBrowserTrashed(): number {
  const { thisBrowser } = useHostExtras();
  return useMemo(
    () => thisBrowser?.items.filter((i) => i.trashedAt !== null).length ?? 0,
    [thisBrowser],
  );
}

/** The Trash's This Browser group: each opens in its app, whose own Trash restores or deletes it. */
export function ThisBrowserTrashGroup() {
  const { thisBrowser } = useHostExtras();
  const [now] = useState(() => Date.now());
  const trashed = useMemo(
    () => thisBrowser?.items.filter((i) => i.trashedAt !== null) ?? [],
    [thisBrowser],
  );
  if (trashed.length === 0) return null;
  return (
    <section
      aria-labelledby="trash-this-browser"
      data-trash-group="this-browser"
      className={LIST_CARD}
    >
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700/60">
        <h2
          id="trash-this-browser"
          className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100"
        >
          {THIS_BROWSER_COPY.label}
        </h2>
        <span className={`text-xs ${MUTED}`}>Open one to restore or delete it.</span>
      </header>
      <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {trashed.map((item) => (
          <LocalRow
            key={item.id}
            item={item}
            detail={`Deleted ${new Date(item.trashedAt!).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
            })} · ${daysLeftLabel(item.trashedAt!, now)}`}
          />
        ))}
      </ul>
    </section>
  );
}

/** A compact Jump Back In card for a local item: opens in the app. */
export function ThisBrowserCard({ item }: { item: ThisBrowserItem }) {
  const { thisBrowser } = useHostExtras();
  const name = item.title || 'Untitled';
  return (
    <a
      data-item-card={item.id}
      data-this-browser-card=""
      href={thisBrowser?.itemHref(item)}
      aria-label={name}
      className="flex h-[3.875rem] min-w-0 items-center gap-3 rounded-[14px] border border-slate-200 bg-white p-2 transition hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-slate-700 dark:bg-slate-800"
    >
      <span className="flex h-11 w-16 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
        <BrowserIcon size={18} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="block truncate text-sm font-semibold leading-5 text-[#17153a] dark:text-slate-100">
          {name}
        </span>
        <ThisBrowserPill inLink />
      </span>
    </a>
  );
}
