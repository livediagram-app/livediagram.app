'use client';

// This Browser in the Explorer: the host app's items kept only in this browser (this-browser.ts), where the host can
// read them (the Explorer served on the app's own address). They show as liveplanner's own Explorer showed them: a
// sidebar row with their count, a view of their own (`/explorer/offline`), a This Browser group in the Trash, and
// among Recent in Home's Jump Back In. The editor's Explorer panel has the same view (panel/PanelThisBrowser.tsx). Each
// opens in its app's editor, which does the rest (rename, restore): the index never sees them, so the Explorer only
// lists them. Where the app moves them into the account, each live row also has Sync: in place in the editor's panel
// (`sync`), or, on the Explorer page, a hand-over to the app's editor (this-browser.ts `thisBrowserConvertHref`).

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { App } from '@liveworkspace/index-client';
import {
  readThisBrowser,
  readThisBrowserConversion,
  subscribeThisBrowser,
  thisBrowserKey,
  type ThisBrowserConversion,
  type ThisBrowserItem,
} from '../this-browser';
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
  // Where the app moves one into the person's account (Sync), when it can for this person (signed in). None: no Sync.
  syncHref?: (item: ThisBrowserItem) => string;
  // The editor's panel, which runs the app's own code: opens one in the editor (default: a page load of `itemHref`),
  // moves one into the account in place (Sync, signed in), and deletes one for good (nothing else holds it).
  // Sync's promise settles once the item has moved, and the lists load again then.
  open?: (item: ThisBrowserItem) => void;
  sync?: (item: ThisBrowserItem) => Promise<unknown> | void;
  remove?: (item: ThisBrowserItem) => void;
  // The Explorer page: where the app runs a Take Offline or Sync handed over at `/explorer/offline?convert=…&item=…`
  // (an older `/offline` link, redirected): the item's own address in its editor, which asks first.
  handOverHref?: (conversion: ThisBrowserConversion, id: string) => string;
};

export const THIS_BROWSER_COPY = {
  label: 'This Browser',
  sentence: 'Lives only in this browser. Clearing this browser’s site data deletes it.',
} as const;

// A host's verb that moved an item (Sync, Take Offline) without a page load: the lists load again once it settles,
// whether it moved or not, so they show where the item is now.
export function thenReload(result: Promise<unknown> | void, reloadLists: () => void): void {
  if (result) void result.then(reloadLists, reloadLists);
}

const live = (i: ThisBrowserItem) => i.trashedAt === null;

// The list as the app last wrote it, per app, parsed again only when its stored text changes: one stable array per
// change, so a reader re-renders only when the list does.
const NO_ITEMS: readonly ThisBrowserItem[] = [];
const reads = new Map<App, { raw: string | null; items: readonly ThisBrowserItem[] }>();
function snapshot(app: App): readonly ThisBrowserItem[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(thisBrowserKey(app));
  } catch {
    return NO_ITEMS;
  }
  const kept = reads.get(app);
  if (kept?.raw === raw) return kept.items;
  const items = raw ? readThisBrowser(app) : NO_ITEMS;
  reads.set(app, { raw, items });
  return items;
}

/** The app's This Browser list on its own origin (every item, live and trashed, newest change first), heard as it
 *  changes in this tab or another. Empty for no app, and while prerendered. */
export function useThisBrowserList(app: App | null): readonly ThisBrowserItem[] {
  const subscribe = useCallback(
    (onChange: () => void) => (app ? subscribeThisBrowser(app, onChange) : () => {}),
    [app],
  );
  return useSyncExternalStore(
    subscribe,
    () => (app ? snapshot(app) : NO_ITEMS),
    () => NO_ITEMS,
  );
}

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

const SYNC_LINK =
  'mr-3 shrink-0 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-300 dark:hover:bg-slate-800';

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

function LocalRow({
  item,
  detail,
  sync = false,
}: {
  item: ThisBrowserItem;
  detail: ReactNode;
  // Offer Sync beside it (a live row, where the host can).
  sync?: boolean;
}) {
  const { thisBrowser } = useHostExtras();
  const { kind, reloadLists } = useExplorer();
  const name = item.title || 'Untitled';
  const syncHref = sync ? thisBrowser?.syncHref?.(item) : undefined;
  return (
    <li data-this-browser-row={item.id} className="flex items-center">
      <a
        href={thisBrowser?.itemHref(item)}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 dark:hover:bg-slate-800/60"
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
      {syncHref ? (
        <a href={syncHref} aria-label={`Sync ${kind.one}: ${name}`} className={SYNC_LINK}>
          Sync {kind.one}
        </a>
      ) : sync && thisBrowser?.sync ? (
        <button
          type="button"
          aria-label={`Sync ${kind.one}: ${name}`}
          onClick={() => thenReload(thisBrowser.sync?.(item), reloadLists)}
          className={`${SYNC_LINK} cursor-pointer`}
        >
          Sync {kind.one}
        </button>
      ) : null}
    </li>
  );
}

/** `/explorer/offline`: every live item kept only in this browser, newest change first. */
export function ThisBrowserPane({ onOpenNav }: { onOpenNav?: () => void }) {
  const { words } = useExplorer();
  const { host, live: items } = useThisBrowserItems();
  useHandOver(host);
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
              sync
              detail={`Changed ${new Date(item.updatedAt).toLocaleDateString(undefined, DATE)}`}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** A Take Offline or Sync asked of this view by its address (`?convert=…&item=…`, an older `/offline` link redirected
 *  here) goes on to the app's editor, which runs it and asks first. Once, and never back here on Back. */
function useHandOver(host: ThisBrowserHost | null) {
  const to = host?.handOverHref;
  useEffect(() => {
    if (!to) return;
    const asked = readThisBrowserConversion(window.location.search);
    if (asked) window.location.replace(to(asked.conversion, asked.id));
  }, [to]);
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
