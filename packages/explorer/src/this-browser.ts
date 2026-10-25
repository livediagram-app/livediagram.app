// This Browser: what an app keeps only in this browser (its offline items), for the Explorer served on that app's own
// address (liveworkspace/docs/one-explorer.md "The Explorer on each app's address"). The index never sees these, and
// they live in the app's own storage, which only a page on the app's origin can read. So the app keeps a small list
// of them in localStorage under one shared key (`liveworkspace:this-browser:<app>`): id, title and the few dates the
// Explorer sorts and groups by, never their content. The Explorer page, on the same origin, reads it and hears each
// change; liveworkspace.app can't read it and keeps its link into the app instead.
//
// Plain TypeScript, no React: the apps' offline stores import it to write the list.

import type { App } from '@liveworkspace/index-client';

// The Inbox's rows from the same items, kept beside the list for the page (this-browser-inbox.ts).
export * from './this-browser-inbox';

export type ThisBrowserItem = {
  id: string;
  title: string;
  createdAt: number;
  // Last content or title change.
  updatedAt: number;
  // The last time this browser opened it, for Home's Jump Back In; null when never.
  lastOpenedAt: number | null;
  // In the app's local Trash since then; null while live.
  trashedAt: number | null;
  favourite: boolean;
};

/** The This Browser pill's words: its label, and the sentence it gives on hover and to assistive technology. */
export const THIS_BROWSER_COPY = {
  label: 'This Browser',
  sentence: 'Lives only in this browser. Clearing this browser’s site data deletes it.',
} as const;

/**
 * The This Browser pill's tone, the Explorer's and every editor's: teal, which is no app's accent (livedocuments' is
 * amber) and no status colour, so it never reads as whose an item is, or as fine or failing. The words meet 4.5:1 on
 * the fill (light 9.1:1, dark 12.8:1 over slate-900) and the ring 3:1 against the row (teal-600 on white 3.7:1,
 * teal-400 on slate-900 9.6:1). The picture of a local item is not teal: it takes its own app's accent (LocalPreview).
 */
export const THIS_BROWSER_TONE =
  'bg-teal-50 text-teal-900 ring-1 ring-teal-600 dark:bg-teal-900/40 dark:text-teal-100 dark:ring-teal-400';
/** Its hover fill, where the pill is a link. */
export const THIS_BROWSER_HOVER = 'hover:bg-teal-100 dark:hover:bg-teal-900/60';
/** Its focus outline, where the pill is a link. */
export const THIS_BROWSER_FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:focus-visible:outline-teal-400';

// The list is cut at this many, newest change first: a few dozen offline items is a heavy user, and the whole list
// is parsed on every change.
export const THIS_BROWSER_MAX = 500;
const VERSION = 1;

export const thisBrowserKey = (app: App) => `liveworkspace:this-browser:${app}`;

// The same tab's writes: a `storage` event only reaches other tabs.
const SAME_TAB_EVENT = 'liveworkspace:this-browser';

type Stored = { v: number; items: ThisBrowserItem[] };

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const num = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const numOrNull = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function clean(raw: unknown): ThisBrowserItem | null {
  const r = raw as Partial<Record<keyof ThisBrowserItem, unknown>> | null;
  if (!r || typeof r.id !== 'string' || !r.id) return null;
  const updatedAt = num(r.updatedAt, 0);
  return {
    id: r.id,
    title: typeof r.title === 'string' ? r.title : '',
    createdAt: num(r.createdAt, updatedAt),
    updatedAt,
    lastOpenedAt: numOrNull(r.lastOpenedAt),
    trashedAt: numOrNull(r.trashedAt),
    favourite: r.favourite === true,
  };
}

/** The list as this app last wrote it: newest change first, never more than THIS_BROWSER_MAX. */
export function readThisBrowser(app: App, store: Storage | null = storage()): ThisBrowserItem[] {
  let raw: string | null = null;
  try {
    raw = store?.getItem(thisBrowserKey(app)) ?? null;
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (parsed.v !== VERSION || !Array.isArray(parsed.items)) return [];
    return parsed.items.flatMap((item) => clean(item) ?? []);
  } catch {
    return [];
  }
}

const newestFirst = (a: ThisBrowserItem, b: ThisBrowserItem) => b.updatedAt - a.updatedAt;

/** Replaces the whole list (the app's offline store, read once as it starts). */
export function writeThisBrowser(
  app: App,
  items: readonly ThisBrowserItem[],
  store: Storage | null = storage(),
): void {
  const kept = [...items].sort(newestFirst).slice(0, THIS_BROWSER_MAX);
  try {
    if (!store) return;
    if (kept.length === 0) store.removeItem(thisBrowserKey(app));
    else store.setItem(thisBrowserKey(app), JSON.stringify({ v: VERSION, items: kept }));
  } catch {
    // Storage full or blocked: the Explorer goes without This Browser, the app's own view still lists them.
    return;
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT, { detail: app }));
  }
}

const sameItem = (a: ThisBrowserItem, b: ThisBrowserItem) =>
  a.title === b.title &&
  a.createdAt === b.createdAt &&
  a.updatedAt === b.updatedAt &&
  a.lastOpenedAt === b.lastOpenedAt &&
  a.trashedAt === b.trashedAt &&
  a.favourite === b.favourite;

/** One item changed (written, renamed, trashed, restored, opened). */
export function putThisBrowserItem(
  app: App,
  item: ThisBrowserItem,
  store: Storage | null = storage(),
): void {
  const items = readThisBrowser(app, store);
  const kept = items.find((i) => i.id === item.id);
  // An autosave that changed nothing listed here writes nothing (and wakes no Explorer).
  if (kept && sameItem(kept, item)) return;
  writeThisBrowser(app, [item, ...items.filter((i) => i.id !== item.id)], store);
}

/** One item gone from this browser (deleted, or moved to the account). */
export function dropThisBrowserItem(app: App, id: string, store: Storage | null = storage()): void {
  const items = readThisBrowser(app, store);
  if (!items.some((i) => i.id === id)) return;
  writeThisBrowser(
    app,
    items.filter((i) => i.id !== id),
    store,
  );
}

/** Calls `onChange` when the list changes, in this tab or another. */
export function subscribeThisBrowser(app: App, onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const key = thisBrowserKey(app);
  const onStorage = (e: StorageEvent) => {
    if (e.key === key || e.key === null) onChange();
  };
  const onSameTab = (e: Event) => {
    if ((e as CustomEvent<App>).detail === app) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(SAME_TAB_EVENT, onSameTab);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(SAME_TAB_EVENT, onSameTab);
  };
}

// ---------- An app's offline store, writing the list -----------------------------------------------------------------

/** The fields every app's offline record has (liveplanner's plan, livedocuments' document, livedesign's design). */
export type OfflineRecordFields = {
  id: string;
  name: string;
  createdAt: number;
  savedAt: number;
  trashedAt?: number;
  favourite?: boolean;
  opens?: unknown;
};

/** One write's outcome, as an offline store's read-modify-write reports it: the record as it now is, gone, or
 *  untouched. */
export type OfflineWriteOutcome<R> = R | 'delete' | undefined;

/** What an app's offline store calls to keep its list: `publish` with every record (once per page load), `note` after
 *  each write. `lastOpenedAt` reads the record's opens in the app's own format. `onWrite` hears both, after the list
 *  is written, whether or not the list changed (the Inbox's snapshot, `inboxSnapshotKeeper`, reads the content). */
export function thisBrowserPublisher<R extends OfflineRecordFields>(
  app: App,
  lastOpenedAt: (opens: unknown) => number | null,
  onWrite?: () => void,
) {
  const itemOf = (rec: R): ThisBrowserItem => ({
    id: rec.id,
    title: rec.name,
    createdAt: rec.createdAt,
    updatedAt: rec.savedAt,
    lastOpenedAt: lastOpenedAt(rec.opens),
    trashedAt: rec.trashedAt ?? null,
    favourite: rec.favourite === true,
  });
  return {
    itemOf,
    publish: (recs: readonly R[]) => {
      writeThisBrowser(app, recs.map(itemOf));
      onWrite?.();
    },
    note: (id: string, after: OfflineWriteOutcome<R>) => {
      if (after === 'delete') dropThisBrowserItem(app, id);
      else if (after) putThisBrowserItem(app, itemOf(after));
      else return;
      onWrite?.();
    },
  };
}

// ---------- Moving an item in or out of this browser ----------------------------------------------------------------
// Take Offline (an account's item into this browser, out of the account) and Sync (back again) are the app's own
// conversions: only its code knows how to copy its items in and out of its offline store. The editor's Explorer panel
// runs them in place. The Explorer page on the app's address (liveworkspace's build) offers them and hands over to the
// app's editor, at the item's own address with what to do in its query; the editor asks the person to confirm, checks
// the item is theirs to move, and runs the conversion (conversion-handoff.ts). A request that reaches the Explorer's
// This Browser view instead (`/explorer/offline?convert=…`, an older `/offline` link redirected) goes on to the
// editor the same way. Every app that converts reads the same query through these, so the sides can't drift.

export type ThisBrowserConversion = 'take-offline' | 'sync';

export const THIS_BROWSER_CONVERT_PARAM = 'convert';
export const THIS_BROWSER_ITEM_PARAM = 'item';

const CONVERSIONS: readonly ThisBrowserConversion[] = ['take-offline', 'sync'];

/** An address of the app's (the item's own, in its editor), asked to run one conversion on one item. */
export function thisBrowserConvertHref(
  address: string,
  conversion: ThisBrowserConversion,
  id: string,
): string {
  const params = new URLSearchParams({
    [THIS_BROWSER_CONVERT_PARAM]: conversion,
    [THIS_BROWSER_ITEM_PARAM]: id,
  });
  return `${address}${address.includes('?') ? '&' : '?'}${params}`;
}

/** The conversion a This Browser page's address asks for, or null. */
export function readThisBrowserConversion(
  search: string,
): { conversion: ThisBrowserConversion; id: string } | null {
  const params = new URLSearchParams(search);
  const conversion = params.get(THIS_BROWSER_CONVERT_PARAM) as ThisBrowserConversion | null;
  const id = params.get(THIS_BROWSER_ITEM_PARAM);
  if (!conversion || !CONVERSIONS.includes(conversion) || !id) return null;
  return { conversion, id };
}

/** Takes the request out of the address (once read), so a reload or Back never asks again. */
export function dropThisBrowserConversion(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(THIS_BROWSER_CONVERT_PARAM)) return;
  url.searchParams.delete(THIS_BROWSER_CONVERT_PARAM);
  url.searchParams.delete(THIS_BROWSER_ITEM_PARAM);
  window.history.replaceState(null, '', url);
}
